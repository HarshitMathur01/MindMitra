"""
Pipeline Orchestrator — COMPASS execution.

CrisisManager keyword/LLM gate with severity ``hard`` returns a warm static template
(Path D). All other turns run a single COMPASS response path; cognitive-layer
``intent`` / ``risk_level`` shape prompts via ``ctx`` and do not select alternate
handlers or models.
"""
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from .crisis_manager import CrisisManager
from ..agents.memory_manager import memory_manager
from ..agents.response_agent import ResponseGenerator
from ..controllers.llm_controller import LLMController
from ..agents.analysis_agent import AnalysisAgent
from ..core.config import config
from ..core.context_composer import ContextComposer
from ..core.logging import log_event
from ..services.locale_service import resolve_locale
from supabase import Client

logger = logging.getLogger(__name__)

from ..core.cognitive_layer_types import CognitivLayerOutput


def _path_generation_int(azure_subkey: str, default: int) -> int:
    """Read per-path limit from azure_controller, then glm_controller (same keys for both providers)."""
    v = config.get(f"azure_controller.{azure_subkey}")
    if v is not None:
        return int(v)
    v2 = config.get(f"glm_controller.{azure_subkey}")
    if v2 is not None:
        return int(v2)
    return default


def _path_generation_float(azure_subkey: str, glm_subkey: str, default: float) -> float:
    v = config.get(f"azure_controller.{azure_subkey}")
    if v is not None:
        return float(v)
    v2 = config.get(f"glm_controller.{glm_subkey}")
    if v2 is not None:
        return float(v2)
    return default


class PipelineOrchestrator:
    """
    Orchestrates COMPASS: crisis sentinel ``hard`` → warm static template; otherwise
    cognitive layer + one unified response generation path.
    """

    _TECHNIQUE_DIRECTIVES: Dict[str, str] = {
        "validate": (
            "Be fully present — no advice, no reframes. "
            "Name the specific feeling beneath their words ('that exhaustion that sleep doesn't fix' > 'you seem tired'). "
            "Reflect the weight of what they said, not just its surface."
        ),
        "reframe": (
            "Plant one gentle alternative perspective as a seed, not a correction. "
            "Tone: 'I wonder if there's another way to read that...' / "
            "'What if the fact this hurts so much means you actually care deeply about getting it right.'"
        ),
        "ground": (
            "Bring their attention to the present moment — body, breath, or what they can sense right now. "
            "Weave it naturally: 'Take a breath with me' / 'Notice your feet on the floor — that's real.' "
            "Make it a shared moment, not a prescribed exercise."
        ),
        "problem-solve": (
            "Acknowledge the size of the problem first, then name one small, achievable step they can take right now. "
            "'What if you just did the first five minutes.' Goal is agency, not a full plan."
        ),
        "refer": (
            "Acknowledge warmly that this is bigger than a chat can hold. "
            "Frame professional support as strength: 'Reaching out to someone trained in this is taking yourself seriously.' "
            "Stay connected — walk alongside them toward more support, don't hand them off."
        ),
        "psychoeducation": (
            "Share one normalizing insight using a relatable analogy "
            "('Your brain is running a fire drill — that anxious feeling is your alarm doing its job, just a bit too enthusiastically.'). "
            "Conversational and concise — a gift, not a lecture."
        ),
    }

    def __init__(
        self,
        groq_nlp: Optional[AnalysisAgent],
        glm: LLMController,
        response_gen: ResponseGenerator,
        crisis_manager: CrisisManager,
        supabase: Optional[Client],
    ) -> None:
        self.groq_nlp = groq_nlp
        self.glm = glm
        self.response_gen = response_gen
        self.crisis_manager = crisis_manager
        self.supabase = supabase

        from ..core.cognitive_layer import CognitiveLayer

        _groq = self.groq_nlp
        _client = _groq.client if _groq and getattr(_groq, "client", None) else None
        _model = getattr(_groq, "model", "") if _groq else ""
        default_model = str(config.get("nlp_module.model", "") or "").strip() or "qwen/qwen3-32b"
        self.cognitive_layer = CognitiveLayer(_client, _model or default_model)

    @staticmethod
    def _build_voice_hint(voice: Dict) -> Optional[str]:
        """
        Build a concise voice prosody summary for cognitive-layer context.
        Returns None if no meaningful voice data available.
        """
        if not voice:
            return None

        parts = []
        wpm = voice.get("speech_rate_wpm")
        if wpm:
            parts.append(f"{wpm} WPM ({voice.get('speech_rate_category', 'normal')})")

        pause = voice.get("pause_pattern")
        if pause and pause != "minimal":
            parts.append(f"pauses: {pause}")

        prosody = voice.get("prosody", {})
        if prosody:
            jitter = prosody.get("jitter_local_percent")
            if jitter is not None and jitter > 2.0:
                parts.append(f"voice shakiness: {jitter:.1f}%")

            pitch_std = prosody.get("pitch_std_hz", 0)
            pitch_mean = prosody.get("pitch_mean_hz", 0)
            if pitch_mean > 0 and pitch_std < 15:
                parts.append("monotone voice")
            elif pitch_std > 60:
                parts.append("highly variable pitch")

            hnr = prosody.get("hnr_db")
            if hnr is not None and hnr < 8:
                parts.append("breathy/unclear voice")

        return ", ".join(parts) if parts else None

    _QUESTION_CONSTRAINTS: Dict[str, str] = {
        "trust_window": " Ask at most ONE warm, specific question. Prefer reflective statements like 'I wonder...' or 'It sounds like...'.",
        "deepening": " Ask at most ONE question. Prefer 'I wonder...' and observational statements over direct questions.",
        "insight": " Ask at most one gentle question in your entire response. Prefer 'I wonder...' statements.",
        "companion": " Ask at most one question in your entire response. Lead with statements.",
    }

    @staticmethod
    def _get_question_constraint(ctx: Dict) -> str:
        """Return a question constraint string based on conversation stage."""
        stage = ctx.get("_conversation_stage", "companion")
        return PipelineOrchestrator._QUESTION_CONSTRAINTS.get(
            stage, PipelineOrchestrator._QUESTION_CONSTRAINTS["companion"]
        )

    def _technique_directive(self, intervention: str) -> str:
        """Pure Python dict lookup. Zero LLM calls."""
        return self._TECHNIQUE_DIRECTIVES.get(intervention.lower(), self._TECHNIQUE_DIRECTIVES["validate"])

    def _run_cognitive_layer(self, ctx: Dict) -> CognitivLayerOutput:
        user_message = ctx.get("user_message", "")
        recent_turns = ctx.get("session_context", {}).get("recent_messages", [])
        session_count = int(ctx.get("session_message_count", 0) or 0)

        # Always run keyword scan before CognitiveLayer.analyze; orchestrator may override via ctx.
        kw_live = self.crisis_manager.check_crisis_keywords(user_message)
        crisis_level = ctx.get("_crisis_sentinel_for_cognitive")
        if crisis_level is None:
            crisis_level = kw_live

        pre_arc = ctx.get("_precomputed_emotional_arc")
        trust_tier = ctx.get("_relational_trust_tier")

        cl_output = self.cognitive_layer.analyze(
            user_message=user_message,
            recent_turns=recent_turns,
            session_count=session_count,
            crisis_sentinel_level=crisis_level,
            precomputed_arc=pre_arc if isinstance(pre_arc, dict) else None,
            trust_tier=trust_tier,
            ambiguous_llm_cleared=bool(ctx.get("_crisis_ambiguous_llm_cleared")),
        )

        ctx.update(cl_output.to_ctx_dict())

        if ctx.get("eval_trace") or ctx.get("_eval_trace_requested"):
            ctx.setdefault("_eval_data", {})["cognitive_layer"] = {
                "intent": cl_output.intent,
                "risk_level": cl_output.risk_level,
                "arc_trajectory": cl_output.arc_trajectory,
                "arc_delta": cl_output.arc_delta,
                "fallback_used": cl_output.fallback_used,
                "question_allowed": cl_output.question_allowed,
                "intervention_sequence": cl_output.intervention_sequence,
            }

        return cl_output

    def _build_intervention_directive(self, intervention_seq: List[str], ctx: Dict) -> str:
        arc = ctx.get("cl_arc_trajectory", "stable")
        mi_move = ctx.get("cl_mi_move", "reflection")
        question_allowed = ctx.get("cl_question_allowed", True)
        language = ctx.get("cl_language_mirror", "en")

        directive_map = {
            "validate": (
                "First: acknowledge what the user is feeling without judgment. "
                "Name the emotion if clear."
            ),
            "reflect": (
                "Use reflective listening — mirror the essence of what they said, not the words."
            ),
            "ground": (
                "Gently help the user connect to the present. "
                "A simple grounding question or observation."
            ),
            "reframe": (
                "Offer a gentle alternative perspective only if the user seems open. Don't force it."
            ),
            "affirm": "Acknowledge the user's strength or courage in sharing this.",
            "explore": "Invite the user to say more. Follow their lead.",
            "practical_support": (
                "Offer a concrete, actionable suggestion. Keep it specific and achievable."
            ),
            "summary": "Briefly reflect back what you've understood so far before continuing.",
            "no_intervention": "Be present and warm. Follow the user's conversational lead.",
        }

        mi_move_map = {
            "open_question": "End with one open-ended question if question_allowed.",
            "affirmation": "Include a genuine affirmation of the user's effort or resilience.",
            "reflection": "Use a reflective statement rather than a question.",
            "summary": "Briefly summarize what you've heard before responding.",
            "no_move": "",
        }

        language_note = {
            "hinglish": (
                "Mirror the user's Hinglish naturally. Don't force it — respond in whichever mix feels right."
            ),
            "hi": "Respond in Hindi if the user wrote in Hindi.",
            "en": "",
        }

        steps = [directive_map.get(s, "") for s in intervention_seq if s in directive_map]
        directive = " → ".join(f"Step {i + 1}: {s}" for i, s in enumerate(steps) if s)

        mi_note = mi_move_map.get(mi_move, "")
        if not question_allowed:
            mi_note = "Do NOT ask any question this turn."

        lang_note = language_note.get(language, "")
        arc_note = ""
        if arc == "falling":
            arc_note = (
                "Note: user's emotional state is declining. Prioritize warmth over advice."
            )
        elif arc == "volatile":
            arc_note = "Note: user's emotions are fluctuating. Stay steady and grounding."

        parts = [p for p in [directive, mi_note, lang_note, arc_note] if p]
        return "\n".join(parts)

    def _compass_max_tokens(self) -> int:
        v = config.get("azure_controller.max_tokens_path_compass")
        if v is not None:
            return int(v)
        v2 = config.get("glm_controller.max_tokens_path_compass")
        if v2 is not None:
            return int(v2)
        return _path_generation_int("max_tokens_path_c", 1024)

    def _compass_temperature(self) -> float:
        v = config.get("azure_controller.temperature_path_compass")
        if v is not None:
            return float(v)
        v2 = config.get("glm_controller.temperature_path_compass")
        if v2 is not None:
            return float(v2)
        return _path_generation_float("temperature_path_c", "temperature_path_c", 0.55)

    def _run_compass_response(self, ctx: Dict) -> None:
        """Single non-crisis path: one ResponseGenerator call shaped by all ``cl_*`` fields."""
        logger.info("━" * 50)
        logger.info("🧭 [COMPASS] ▶  EXECUTING: unified response path (v2 cognitive)")
        logger.info("━" * 50)

        ctx["_response_max_tokens"] = self._compass_max_tokens()
        ctx["_response_temperature"] = self._compass_temperature()

        pc = ctx.get("cl_cultural_context", "") or ""
        seq = ctx.get("cl_intervention_sequence", ["validate"])
        first_int = seq[0] if seq and seq[0] != "no_intervention" else "validate"
        ctx["psychological_analysis"] = {
            "emotional_state": ctx.get("cl_primary_emotion", "distressed"),
            "primary_stressor": pc,
            "stress_categories": [pc] if pc else ["General"],
            "risk_assessment": ctx.get("cl_risk_level", "moderate"),
            "risk_level": ctx.get("cl_risk_level", "moderate"),
            "intervention": first_int,
            "insight": "",
            "cultural_factor": pc,
            "cultural_pressures": pc,
            "coping_assessment": "",
            "intervention_priority": "supportive",
            "psychological_insights": [],
        }
        lm = ctx.get("cl_language_mirror", "en")
        style = "hinglish" if lm == "hinglish" else ("hindi" if lm == "hi" else "english")
        ctx.setdefault(
            "nlp_analysis",
            {
                "primary_emotion": ctx.get("cl_primary_emotion", "unknown"),
                "intensity": ctx.get("cl_emotional_intensity", 0.5),
                "emotions": {},
                "sentiment": {"score": ctx.get("cl_emotional_valence", 0.0), "label": "neutral"},
                "key_phrases": [],
                "language_detected": lm,
                "urgency_flag": False,
            },
        )
        ctx.setdefault(
            "cultural_context",
            {
                "language_style": style,
                "hindi_english_ratio": 0.0,
                "code_switching_detected": lm in ("hinglish", "hi"),
                "cultural_sensitivity_flags": [pc] if pc else [],
                "communication_pattern": "warm",
                "regional_context": "",
                "formality_level": "medium",
            },
        )
        ctx["technique_selection"] = {
            "primary_technique": first_int.replace("-", " ").title(),
            "therapeutic_approach": first_int,
            "activity_recommendations": [],
            "rationale": "COMPASS — cognitive layer",
        }
        ctx["intervention_directive"] = (
            self._build_intervention_directive(seq, ctx) + self._get_question_constraint(ctx)
        )
        provider = str(ctx.get("_response_provider") or "llm")
        model = str(ctx.get("_response_model") or getattr(self.glm, "model_name", "?"))
        logger.info(f"  📞 [COMPASS] Calling {provider} response-gen (model={model})...")
        _t_gen = time.monotonic()
        self.response_gen.generate(ctx)
        logger.info(
            f"  ✅ [COMPASS] {provider} response-gen done in {(time.monotonic()-_t_gen)*1000:.0f}ms | "
            f"response={len(ctx.get('ai_response', ''))} chars"
        )

    def route_and_execute(self, ctx: Dict, session_id: Optional[str], message_count: int = 0) -> None:
        """
        Single entry point for the chat pipeline.
        1. Stage 1 (parallel): crisis sentinel + MEMOIR retrieval + within-session arc.
        2. If sentinel is ``hard``, warm crisis template and return (no cognitive / no LLM response).
        3. Else: cognitive layer (COMPASS), then one ResponseGenerator call.

        Args:
            message_count: Pre-fetched session message count (avoids a duplicate DB query).
                           Pass 0 to let the orchestrator fetch it itself.
        """
        text = ctx["user_message"]
        recent = ctx["session_context"].get("recent_messages", [])

        # Resolve locale (client setting wins, then script detection, then default)
        client_lang = ctx.get("personality_settings", {}).get("language")
        locale_ctx = resolve_locale(text, client_lang)
        ctx["personality_settings"]["language"] = locale_ctx.locale
        ctx["locale_context"] = {
            "locale": locale_ctx.locale,
            "bcp47": locale_ctx.bcp47,
            "confidence": locale_ctx.confidence,
            "source": locale_ctx.source,
        }

        _t_router = time.monotonic()

        # ── Conversation stage (compute once — used for question budget + screening gate) ──
        from ..services.supabase_service import get_hybrid_message_count
        from ..utils.constants import (
            MEMORY_TRIGGER_INTERVAL,
            STAGE_TRUST_WINDOW_MAX,
            STAGE_DEEPENING_MAX,
            STAGE_INSIGHT_MAX,
        )
        # Use the pre-fetched count when available — avoids a duplicate Supabase COUNT(*) call
        session_msg_count = message_count if message_count > 0 else (
            get_hybrid_message_count(session_id) if session_id else len(recent)
        )

        _uid_for_lifecycle = ctx.get("user_id", "anonymous")
        if session_id and _uid_for_lifecycle != "anonymous":
            memory_manager.maybe_warm_session(_uid_for_lifecycle, session_id, session_msg_count)

        _user_id = ctx.get("user_id", "anonymous")
        _MEMORY_TIMEOUT = float(
            config.get("performance.pipeline_memory_parallel_timeout_seconds", 5.0)
        )

        # ── Conversation stage (for question budget) ─────────────────────
        if session_msg_count <= STAGE_TRUST_WINDOW_MAX:
            ctx["_conversation_stage"] = "trust_window"
        elif session_msg_count <= STAGE_DEEPENING_MAX:
            ctx["_conversation_stage"] = "deepening"
        elif session_msg_count <= STAGE_INSIGHT_MAX:
            ctx["_conversation_stage"] = "insight"
        else:
            ctx["_conversation_stage"] = "companion"
        logger.info(f"📊 [STAGE] Conversation stage: {ctx['_conversation_stage']} (msg_count={session_msg_count})")

        ctx["session_message_count"] = session_msg_count
        prof_prefetch = (
            memory_manager.get_user_profile(_user_id) if _user_id != "anonymous" else {}
        )
        ctx["_relational_trust_tier"] = prof_prefetch.get("trust_tier", 1)
        ctx["_profile_session_count"] = int(prof_prefetch.get("session_count", 0) or 0)
        ctx["memory_clarification_pending"] = bool(prof_prefetch.get("memory_clarification_pending", False))

        # ── Stage 1 (parallel): crisis sentinel + MEMOIR retrieval + within-session arc ──
        _t_s1 = time.monotonic()
        # Same reader instance as CognitiveLayer so tests / monkeypatches stay aligned.
        arc_reader = self.cognitive_layer.arc_reader
        kw_scan = "safe"
        arc_pre: Dict[str, Any] = {}
        mem_ctx_stage1 = ""
        crisis_ambiguous_cleared = False
        with ThreadPoolExecutor(max_workers=3) as _s1_ex:
            fut_kw = _s1_ex.submit(self.crisis_manager.check_crisis_keywords, text)
            fut_arc = _s1_ex.submit(arc_reader.compute_arc, recent)

            # PDF Stage 1B: retrieval happens in parallel. At this stage we do not yet have
            # cognitive-layer affect/intent; we seed with a safe default and refine later in
            # MEMOIR-specific refactors.
            seed_intent = "emotional"
            fut_mem = _s1_ex.submit(
                memory_manager.retrieve_memories,
                text,
                _user_id,
                seed_intent,
                session_id=session_id,
                current_affect={"valence": 0.0, "intensity": 0.0},
                memory_reference_allowed=True,
                session_message_count=session_msg_count,
                cl_arc_trajectory="stable",
            )

            try:
                kw_scan = fut_kw.result(timeout=_MEMORY_TIMEOUT) or "safe"
            except Exception as kw_exc:
                logger.debug("[STAGE1] crisis sentinel failed: %s", kw_exc)
                kw_scan = "safe"

            try:
                arc_pre = fut_arc.result(timeout=_MEMORY_TIMEOUT) or {}
            except Exception as arc_exc:
                logger.debug("[STAGE1] arc reader failed: %s", arc_exc)
                arc_pre = arc_reader.compute_arc([]) or {}
            ctx["_precomputed_emotional_arc"] = arc_pre
            # Expose arc numerics for prompt v2 without expanding the 14-key cl_* contract.
            ctx["arc_current_valence"] = float((arc_pre or {}).get("current_valence", 0.0) or 0.0)
            ctx["arc_session_low"] = float((arc_pre or {}).get("session_low", 0.0) or 0.0)

            # Crisis ambiguous LLM disambiguation runs only if needed; keep it out of the
            # hottest parallel lane unless ambiguity is detected.
            if kw_scan == "ambiguous":
                try:
                    _t_crisis = time.monotonic()
                    crisis_confirmed = self.crisis_manager.crisis_llm_check(text)
                    logger.info(
                        f"{'🚨' if crisis_confirmed else '✅'} [CRISIS-GATE] LLM check "
                        f"→ {'CRISIS CONFIRMED' if crisis_confirmed else 'safe'} "
                        f"({(time.monotonic()-_t_crisis)*1000:.0f}ms)"
                    )
                    crisis_ambiguous_cleared = not crisis_confirmed
                    if crisis_confirmed:
                        kw_scan = "hard"
                except Exception as exc:
                    logger.debug("[STAGE1] crisis LLM check failed: %s", exc)

            try:
                mem_ctx_stage1 = fut_mem.result(timeout=_MEMORY_TIMEOUT) or ""
            except TimeoutError:
                logger.warning(
                    "⏱️ [STAGE1] MEMOIR retrieve_memories timed out (%ss) — skipping",
                    _MEMORY_TIMEOUT,
                )
                mem_ctx_stage1 = ""
            except Exception as mem_exc:
                logger.error("❌ [STAGE1] MEMOIR retrieve_memories failed: %s", mem_exc)
                mem_ctx_stage1 = ""

        ctx["_crisis_ambiguous_llm_cleared"] = bool(kw_scan == "ambiguous" and crisis_ambiguous_cleared)
        ctx["_crisis_sentinel_for_cognitive"] = ("safe" if (kw_scan == "ambiguous" and crisis_ambiguous_cleared) else kw_scan)

        if mem_ctx_stage1:
            ctx["memory_context"] = mem_ctx_stage1

        if ctx.get("_eval_trace_requested"):
            ctx.setdefault("_eval_data", {})["stage1"] = {
                "latency_ms": round((time.monotonic() - _t_s1) * 1000, 1),
                "kw_scan": kw_scan,
                "memory_chars": len(mem_ctx_stage1 or ""),
            }

        log_event(
            logger,
            "compass_stage1_parallel",
            user=str(_user_id)[:12],
            session=str(session_id or "none")[:16],
            kw_scan=kw_scan,
            arc_direction=(arc_pre or {}).get("arc_direction", "stable"),
            arc_delta=(arc_pre or {}).get("arc_delta", 0.0),
            memory_chars=len(mem_ctx_stage1 or ""),
            latency_ms=round((time.monotonic() - _t_s1) * 1000, 1),
        )
        logger.info(
            "[COMPASS] Stage1 parallel complete | latency_ms=%.0f",
            (time.monotonic() - _t_s1) * 1000,
        )

        if kw_scan == "hard":
            from ..core.crisis_templates import build_warm_crisis_response

            ctx["_pipeline_path"] = "D-crisis-warm"
            stub = CognitivLayerOutput(
                intent="crisis",
                risk_level="crisis",
                primary_emotion="distress",
                intervention_sequence=["refer"],
                question_allowed=False,
            )
            ctx.update(stub.to_ctx_dict())
            if ctx.get("_eval_trace_requested"):
                ctx.setdefault("_eval_data", {})["cognitive_layer"] = {
                    "skipped": True,
                    "reason": "crisis_sentinel_hard",
                    "kw_scan": kw_scan,
                    "latency_ms": 0.0,
                }
            ps = ctx.get("personality_settings") or {}
            ctx.setdefault("language_preference", ps.get("language", "english"))
            ctx["ai_response"] = build_warm_crisis_response(ctx, None, template_severity="hard")
            ctx["response_generated"] = True
            ctx["psychological_analysis"] = {
                "emotional_state": "crisis",
                "risk_assessment": "crisis",
                "risk_level": "crisis",
            }
            ctx["technique_selection"] = {
                "primary_technique": "Crisis-Protocol",
                "therapeutic_approach": "refer",
                "activity_recommendations": [],
                "rationale": "warm static crisis response",
            }
            ctx["intervention_directive"] = ""
            self.crisis_manager.log_crisis_event(ctx)
            return

        # ── Cognitive layer (COMPASS) — before MEMOIR so scoring can use affect ──
        _t_cl = time.monotonic()
        cl_output = self._run_cognitive_layer(ctx)
        _cl_ms = (time.monotonic() - _t_cl) * 1000
        intent_cl = cl_output.intent
        if ctx.get("_eval_trace_requested"):
            ctx.setdefault("_eval_data", {})["cognitive_layer"] = {
                "latency_ms": round(_cl_ms, 1),
                "intent": intent_cl,
                "risk": cl_output.risk_level,
                "arc": getattr(cl_output, "arc_trajectory", ""),
                "fallback_used": bool(getattr(cl_output, "fallback_used", False)),
                "model": str(getattr(self.cognitive_layer, "model", "") or ""),
            }
        log_event(
            logger,
            "compass_cognitive_layer",
            user=str(_user_id)[:12],
            session=str(session_id or "none")[:16],
            model=str(getattr(self.cognitive_layer, "model", "") or ""),
            intent=intent_cl,
            risk=cl_output.risk_level,
            emotion=getattr(cl_output, "primary_emotion", ""),
            arc=getattr(cl_output, "arc_trajectory", ""),
            fallback_used=bool(getattr(cl_output, "fallback_used", False)),
            latency_ms=round(_cl_ms, 1),
        )
        logger.info(
            "[COMPASS] Cognitive layer complete | intent=%s risk=%s emotion=%s arc=%s latency_ms=%.0f",
            intent_cl,
            cl_output.risk_level,
            getattr(cl_output, "primary_emotion", "?"),
            getattr(cl_output, "arc_trajectory", "?"),
            _cl_ms,
        )

        if ctx.get("memory_clarification_pending"):
            ctx["cl_mi_move"] = "open_question"
            ctx["cl_question_allowed"] = True

        # PDF-ditto: Stage 1B retrieval runs before cognitive layer (parallel Stage 1).
        # Do not re-run retrieval post-cognitive; cognitive outputs only gate injection/formatting later.

        if os.getenv("MM_MEMORY_TRACE", "").lower() in ("1", "true", "yes"):
            _mem_final = ctx.get("memory_context") or ""
            logger.info(
                "[MM_MEMORY_TRACE] orchestrator after_memory+trend: user=%s... last_user_query=%r "
                "memory_context_chars=%s",
                str(_user_id)[:14],
                (text or "")[:240],
                len(_mem_final),
            )

        ctx["_pipeline_path"] = "COMPASS-v2"
        self._run_compass_response(ctx)
