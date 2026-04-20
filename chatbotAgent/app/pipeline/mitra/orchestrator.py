"""
MITRA Pipeline Orchestrator.

Top-level entry that runs ONE turn end-to-end:

    classify → (safety fast-path or)
    retrieve (parallel, deadlined) → assemble → two-pass generate
    → write turn trace → emit working-memory append → return result

The orchestrator is **transport-agnostic**: it takes injected services and a
streaming callback. The HTTP layer wraps the result for SSE.

Result shape mirrors the legacy `process_user_chat` so the chat route can
flag-flip with no SSE contract change.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from ...core.logging import log_banner, log_stage
from ...core.prompts.stance import Stage
from ...core.telemetry import latency_audit, slo_check, span
from ..crisis_fast_path import build_crisis_response, evaluate_two_stage
from .assembler import ContextAssembler, stage_weights
from .classifier import IntentClassifier, TurnClassification
from .retriever import RetrieverOrchestrator
from .stance_selector import StanceConstraints, select_stance

logger = logging.getLogger("app.mitra")


@dataclass
class TurnInput:
    user_id: str
    session_id: str
    user_message: str
    recent_turns: List[Dict[str, str]] = field(default_factory=list)
    persona: str = "mitra"
    language: str = "en"
    stage: Stage = Stage.STRANGER
    user_preferred_name: Optional[str] = None
    prior_questions_in_window: int = 0


@dataclass
class TurnResult:
    message: str
    modality: str = "therapy"
    confidence: float = 0.85
    classification: Optional[TurnClassification] = None
    stance: Optional[str] = None
    used_episodes: int = 0
    accepted_on_pass: int = 1
    fallback_used: bool = False
    timings_ms: Dict[str, float] = field(default_factory=dict)
    is_crisis: bool = False
    debug: Dict[str, Any] = field(default_factory=dict)


class MitraPipeline:
    def __init__(
        self,
        *,
        classifier: IntentClassifier,
        retriever: RetrieverOrchestrator,
        assembler: ContextAssembler,
        generator: Any,  # TwoPassGenerator | DualTrackGenerator
        relationship_state=None,
        trace_repo=None,
        working_memory=None,
        crisis_confirmer: Optional[Callable[..., Any]] = None,
        crisis_event_sink: Optional[Callable[[Dict[str, Any]], Any]] = None,
    ):
        self.classifier = classifier
        self.retriever = retriever
        self.assembler = assembler
        self.generator = generator
        self.relationship_state = relationship_state
        self.trace_repo = trace_repo
        self.working_memory = working_memory
        self.crisis_confirmer = crisis_confirmer
        self.crisis_event_sink = crisis_event_sink

    async def process_turn(
        self,
        turn: TurnInput,
        *,
        stream_callback: Optional[Callable[[str], None]] = None,
    ) -> TurnResult:
        timings: Dict[str, float] = {}
        t0 = time.perf_counter()

        log_banner(
            "🧠 MITRA TURN START",
            [
                f"user        : {turn.user_id[:8]}",
                f"session     : {(turn.session_id or '-')[:8]}",
                f"persona     : {turn.persona}",
                f"language    : {turn.language}",
                f"history     : {len(turn.recent_turns)} turns",
                f"msg_len     : {len(turn.user_message)} chars",
            ],
            logger=logger,
        )

        # ── 0. Stage hydration (DB authoritative if service is bound) ──────
        if self.relationship_state is not None:
            try:
                turn.stage = self.relationship_state.current_stage(turn.user_id)
                log_stage("hydrate_stage", stage=turn.stage.value)
            except Exception as exc:  # noqa: BLE001
                logger.debug("stage hydration failed: %s", exc)

        # ── 1. Classify + Crisis detector (in parallel) ─────────────────────
        # Cheap classifier sync; crisis detector may call out to an LLM
        # confirmer for ambiguous text. Run both concurrently so the
        # confirmer never adds latency to the safe path.
        with span("classify_and_crisis", attrs={"user_id": turn.user_id}):
            cls_task = asyncio.to_thread(
                self.classifier.classify, turn.user_message,
                recent_turns=[t.get("content", "") for t in (turn.recent_turns or [])],
            )
            crisis_task = asyncio.create_task(evaluate_two_stage(
                turn.user_message,
                language=turn.language,
                confirmer=self.crisis_confirmer,
                event_sink=self.crisis_event_sink,
                user_id=turn.user_id,
                session_id=turn.session_id,
            ))
            cls, crisis_decision = await asyncio.gather(cls_task, crisis_task)
        timings["classify_ms"] = (time.perf_counter() - t0) * 1000
        slo_check("classify", elapsed_ms=timings["classify_ms"])
        slo_check("crisis", elapsed_ms=timings["classify_ms"])
        log_stage(
            "classify+safety",
            intent=cls.intent.value,
            safety=cls.safety_signal,
            crisis=crisis_decision.triggered,
            dur_ms=int(timings["classify_ms"]),
        )

        # ── 2. Crisis fast-path short-circuit ──────────────────────────────
        if crisis_decision.triggered or cls.safety_signal == "hard":
            log_banner(
                "🚨 CRISIS FAST-PATH",
                [
                    "Routing to crisis safety response — skipping memory retrieval and generation.",
                    f"trigger_level : {getattr(crisis_decision, 'level', cls.safety_signal)}",
                ],
                logger=logger,
            )
            text = crisis_decision.response or build_crisis_response(language=turn.language)
            if stream_callback:
                stream_callback(text)
            self._safe_trace(turn=turn, classification=cls, text=text, is_crisis=True, timings=timings)
            timings["total_ms"] = (time.perf_counter() - t0) * 1000
            logger.info(
                "✅ MITRA TURN COMPLETE (crisis) %sms",
                int(timings["total_ms"]),
            )
            return TurnResult(
                message=text, modality="crisis", confidence=1.0,
                classification=cls, stance="crisis", is_crisis=True,
                timings_ms=timings,
                debug={"crisis_trace": crisis_decision.eval_trace},
            )

        # ── 3. Retrieve ─────────────────────────────────────────────────────
        t1 = time.perf_counter()
        weights = stage_weights(turn.stage)
        current_vad = self._estimate_current_vad(turn.user_message)
        with span("retrieve", attrs={"user_id": turn.user_id, "intent": cls.intent.value}):
            ctx = await self.retriever.fetch(
                user_id=turn.user_id,
                query=turn.user_message,
                intent=cls.intent.value,
                needs_memory=cls.needs_memory,
                needs_self_disclosure=cls.needs_self_disclosure,
                salience_weights=weights,
                current_vad=current_vad,
            )
        timings["retrieve_ms"] = (time.perf_counter() - t1) * 1000
        slo_check("retrieve", elapsed_ms=timings["retrieve_ms"])
        log_stage(
            "retrieve_memories",
            episodes=len(ctx.episodes or []),
            identity_card=bool(ctx.identity_card),
            affect=getattr(getattr(ctx, "affect_pattern", None), "label", None),
            dur_ms=int(timings["retrieve_ms"]),
        )

        # Pull preferred name from identity card if not provided.
        preferred_name = turn.user_preferred_name
        if not preferred_name and ctx.identity_card and getattr(ctx.identity_card, "preferred_name", None):
            preferred_name = ctx.identity_card.preferred_name

        # ── 3.5 Stance selection (deterministic) ────────────────────────────
        stance_c: StanceConstraints = select_stance(
            classification=cls,
            affect_pattern=ctx.affect_pattern,
            user_message=turn.user_message,
            preferences=ctx.preferences,
        )
        log_stage(
            "select_stance",
            stance=stance_c.stance.value,
            max_q=stance_c.max_questions,
        )

        # ── 4. Assemble ────────────────────────────────────────────────────
        t2 = time.perf_counter()
        with span("assemble", attrs={"stage": turn.stage.value, "stance": stance_c.stance.value}):
            prompt = self.assembler.assemble(
                user_message=turn.user_message,
                stage=turn.stage,
                persona=turn.persona,
                language=turn.language,
                identity_card=ctx.identity_card,
                episodes=ctx.episodes,
                affect_pattern=ctx.affect_pattern,
                procedural_recommendation=ctx.procedural_recommendation,
                recent_turns=turn.recent_turns,
                user_preferred_name=preferred_name,
                preferences=ctx.preferences,
                stance_constraints=stance_c,
            )
        timings["assemble_ms"] = (time.perf_counter() - t2) * 1000
        slo_check("assemble", elapsed_ms=timings["assemble_ms"])
        log_stage(
            "assemble_prompt",
            sys_chars=len(prompt.system),
            user_chars=len(prompt.user),
            episodes_used=prompt.used_episodes,
            callback_budget=prompt.callback_budget,
            dur_ms=int(timings["assemble_ms"]),
        )

        # Reinforce strength on the memories we actually surfaced (testing
        # effect). Only count the ones inside the callback budget.
        try:
            episodic = getattr(self.retriever, "episodic", None)
            if episodic is not None and prompt.used_episodes > 0:
                used_ids = [
                    getattr(ep, "id", None)
                    for ep in (ctx.episodes or [])[: prompt.used_episodes]
                    if getattr(ep, "id", None)
                ]
                if used_ids:
                    await asyncio.to_thread(episodic.mark_recalled, used_ids)
        except Exception as exc:  # noqa: BLE001
            logger.debug("mark_recalled fanout failed: %s", exc)

        # ── 5. Generate (two-pass OR dual-track) ───────────────────────────
        t3 = time.perf_counter()
        retrieved_summaries = [
            getattr(e, "summary", "") for e in ctx.episodes if getattr(e, "summary", "")
        ]
        gen_kwargs: Dict[str, Any] = dict(
            system=prompt.system,
            user=prompt.user,
            intent=cls.intent.value,
            retrieved_summaries=retrieved_summaries,
            prior_questions_in_window=turn.prior_questions_in_window,
            stream_callback=stream_callback,
            stance_constraints=stance_c,
        )
        # DualTrackGenerator wants the relationship stage too.
        if hasattr(self.generator, "_should_run_track_b"):
            gen_kwargs["stage_value"] = turn.stage.value
        log_stage(
            "generate_response",
            generator=type(self.generator).__name__,
            stream=bool(stream_callback),
        )
        with span("generate", attrs={"intent": cls.intent.value, "stance": stance_c.stance.value}):
            gen = await self.generator.generate(**gen_kwargs)
        timings["generate_ms"] = (time.perf_counter() - t3) * 1000
        slo_check("generate", elapsed_ms=timings["generate_ms"])
        log_stage(
            "generate_done",
            chars=len(gen.text or ""),
            accepted_on_pass=gen.accepted_on_pass,
            fallback=gen.fallback_used,
            dur_ms=int(timings["generate_ms"]),
        )
        # If DualTrack ran Track B, surface its timing under the right SLO key.
        try:
            tb_ms = (getattr(gen, "timings_ms", {}) or {}).get("track_b_ms")
            if tb_ms is not None:
                timings["track_b_ms"] = float(tb_ms)
                slo_check("track_b", elapsed_ms=float(tb_ms))
        except Exception:  # noqa: BLE001
            pass

        # ── 6. Write trace + append to working memory ──────────────────────
        critic_summary = self._summarize_critic(gen)
        self._safe_trace(
            turn=turn, classification=cls, text=gen.text,
            is_crisis=False, timings=timings,
            extra={
                "used_episodes": prompt.used_episodes,
                "accepted_on_pass": gen.accepted_on_pass,
                "fallback_used": gen.fallback_used,
                "critic": critic_summary,
                "stance": stance_c.stance.value,
                "callback_budget": prompt.callback_budget,
            },
        )
        self._safe_working_memory_append(turn=turn, gen_text=gen.text)
        self._safe_record_relationship_turn(
            turn=turn, classification=cls, fallback_used=gen.fallback_used,
        )

        timings["total_ms"] = (time.perf_counter() - t0) * 1000
        slo_check("total", elapsed_ms=timings["total_ms"])
        audit = latency_audit(
            timings_ms=timings,
            user_id=turn.user_id,
            session_id=turn.session_id,
        )
        log_banner(
            "✅ MITRA TURN COMPLETE",
            [
                f"intent      : {cls.intent.value}",
                f"stance      : {stance_c.stance.value}",
                f"chars       : {len(gen.text or '')}",
                f"episodes    : {prompt.used_episodes}",
                f"accepted_on : pass {gen.accepted_on_pass}",
                f"fallback    : {gen.fallback_used}",
                f"timings_ms  : "
                + " ".join(f"{k}={int(v)}" for k, v in timings.items()),
            ],
            logger=logger,
        )
        return TurnResult(
            message=gen.text,
            modality="therapy",
            confidence=0.85 if not gen.fallback_used else 0.6,
            classification=cls,
            stance=stance_c.stance.value,
            used_episodes=prompt.used_episodes,
            accepted_on_pass=gen.accepted_on_pass,
            fallback_used=gen.fallback_used,
            timings_ms=timings,
            debug={
                "retrieval_errors": ctx.errors,
                "stance_rationale": stance_c.rationale,
                "callback_budget": prompt.callback_budget,
                "latency_breaches": audit["breaches"],
            },
        )

    # ── helpers ─────────────────────────────────────────────────────────────

    def _safe_trace(
        self, *, turn: TurnInput, classification: TurnClassification,
        text: str, is_crisis: bool, timings: Dict[str, float],
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.trace_repo:
            return
        try:
            row = {
                "user_id": turn.user_id,
                "session_id": turn.session_id,
                "intent": classification.intent.value,
                "safety_signal": classification.safety_signal,
                "is_crisis": is_crisis,
                "response_chars": len(text or ""),
                "timings_ms": timings,
            }
            if extra:
                row.update(extra)
            self.trace_repo.insert(row)
        except Exception as exc:  # noqa: BLE001
            logger.warning("turn-trace insert failed: %s", exc)

    def _summarize_critic(self, gen) -> Dict[str, Any]:
        """Compact, telemetry-friendly summary of critic v1+v2 issues."""
        out: Dict[str, Any] = {"v1": None, "v2": None}
        for k, rep in (("v1", getattr(gen, "critique_v1", None)),
                       ("v2", getattr(gen, "critique_v2", None))):
            if rep is None:
                continue
            out[k] = {
                "verdict": getattr(rep.verdict, "value", str(rep.verdict)),
                "issues": [
                    {
                        "id": i.rule_id,
                        "sev": getattr(i.severity, "value", str(i.severity)),
                    }
                    for i in (rep.issues or [])
                ],
            }
        return out

    def _estimate_current_vad(self, text: str) -> Optional[Dict[str, float]]:
        """Cheap lexical VAD estimate of the *current* user turn — used to
        feed the affective_resonance term during retrieval. Heuristic only;
        a proper classifier replaces this in Phase 2."""
        if not text:
            return None
        t = text.lower()
        v_pos = sum(t.count(w) for w in ("happy", "calm", "good", "great", "love", "khush", "shanti"))
        v_neg = sum(t.count(w) for w in ("sad", "tired", "angry", "scared", "anxious", "stress", "rona", "udaas", "dukhi"))
        a_high = sum(t.count(w) for w in ("panic", "racing", "freak", "jhagda", "shout", "scream"))
        a_low  = sum(t.count(w) for w in ("numb", "empty", "drained", "tired", "sleepy"))
        if (v_pos + v_neg + a_high + a_low) == 0:
            return None
        valence = (v_pos - v_neg) / max(1, (v_pos + v_neg))
        arousal = (a_high - a_low) / max(1, (a_high + a_low))
        return {"v": float(valence), "a": float(arousal), "d": 0.0}

    def _safe_working_memory_append(self, *, turn: TurnInput, gen_text: str) -> None:
        if not self.working_memory:
            return
        try:
            self.working_memory.append_turn(
                turn.session_id, role="user", content=turn.user_message,
            )
            self.working_memory.append_turn(
                turn.session_id, role="assistant", content=gen_text,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("working-memory append failed: %s", exc)

    def _safe_record_relationship_turn(
        self, *, turn: TurnInput, classification: TurnClassification,
        fallback_used: bool,
    ) -> None:
        """Update Relationship State counters at the per-turn level.
        - VENT or substantial self-disclosure → user-initiated disclosure.
        - generator fallback → potential rupture (we said something subpar).
        """
        if self.relationship_state is None:
            return
        try:
            from ...memory.importance import score_turn
            score = score_turn(turn.user_message).score
        except Exception:  # noqa: BLE001
            score = 0.0
        self_disclosure = (
            classification.intent.value in ("vent", "share_event")
            and score >= 0.5
        )
        try:
            self.relationship_state.record_turn(
                turn.user_id,
                user_initiated_disclosure=self_disclosure,
                rupture_detected=fallback_used,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("record_turn failed: %s", exc)
