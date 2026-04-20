"""
Dual-Track Generator (architecture §6.5).

Two parallel response pathways:

    Track A — Fast Listener
        Small, low-latency model (Groq Llama-3.1-8B / Gemini Flash). Streams
        immediately. Target TTFT ≤ 400 ms. Always runs. Always streams.
        Owns the user's *felt* response — validation, mirroring, presence.

    Track B — Deep Reflector
        Larger model (Gemini 2.5 Pro / GLM-4.6 / Azure GPT-4.1). Runs in a
        background task in parallel with Track A. *Never blocks* the stream.
        When it finishes BEFORE Track A is fully drained, we may swap the
        in-progress reply with B's output (split-flap UX). Otherwise we hold
        B's output for the next turn as a "deeper note".

Stance gating:
    - CRISIS / CO_REGULATE → only Track A runs (we want the simplest, calmest
      possible response; deep reflection adds risk, not value).
    - VALIDATE / REFLECT / INFORM → A runs; B runs only when stage ≥ FAMILIAR.
    - INQUIRE / REFER → A only (these are short by design).

The result mirrors `GenerationResult` from `generator.py` so the orchestrator
treats both generators uniformly.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from ...core.prompts.critic import critique
from .generator import GenerationResult, _REJECT_FALLBACK
from .stance_selector import Stance

logger = logging.getLogger(__name__)


LLMCompleteFn = Callable[..., Awaitable[str]]


@dataclass
class DualTrackResult(GenerationResult):
    """Adds a flag for whether Track B's output was actually shown."""
    track_b_used: bool = False
    track_b_text: Optional[str] = None
    track_b_timed_out: bool = False


# Stances where we should *never* run Track B (keep things simple + safe).
_TRACK_B_FORBIDDEN: set = {Stance.CRISIS, Stance.CO_REGULATE, Stance.REFER, Stance.INQUIRE}


class DualTrackGenerator:
    """Run a Track-A streaming generation and (optionally) a Track-B deeper
    generation in parallel.

    Track A always runs. Track B is gated by stance + stage and races against
    a deadline; if it finishes after Track A has already streamed to the user,
    its output is dropped (we don't surprise the user with a swap).
    """

    def __init__(
        self,
        *,
        llm_fast: LLMCompleteFn,
        llm_deep: Optional[LLMCompleteFn] = None,
        track_b_deadline_ms: int = 1800,
        max_questions_per_turn: int = 1,
        max_questions_per_window: Optional[int] = None,
        min_stage_for_track_b: str = "familiar",
    ):
        self.fast = llm_fast
        self.deep = llm_deep or llm_fast  # graceful: same model both tracks
        self.deadline_s = track_b_deadline_ms / 1000.0
        self.max_q_per_turn = max_questions_per_turn
        self.max_q_per_window = max_questions_per_window
        self.min_stage_for_track_b = min_stage_for_track_b

    async def generate(
        self,
        *,
        system: str,
        user: str,
        intent: Optional[str] = None,
        retrieved_summaries: Optional[List[str]] = None,
        prior_questions_in_window: int = 0,
        stream_callback: Optional[Callable[[str], None]] = None,
        stance_constraints: Optional[Any] = None,
        stage_value: str = "stranger",
    ) -> DualTrackResult:
        timings: Dict[str, float] = {}
        t0 = time.perf_counter()

        max_q = self.max_q_per_turn
        if stance_constraints is not None:
            try:
                max_q = min(max_q, int(getattr(stance_constraints, "max_questions", max_q)))
            except (TypeError, ValueError):
                pass

        run_b = self._should_run_track_b(stance_constraints, stage_value)

        # ── Launch Track A (always) and Track B (if applicable) in parallel.
        track_a_task = asyncio.create_task(
            self.fast(system=system, user=user, stream_callback=stream_callback)
        )
        track_b_task: Optional[asyncio.Task] = None
        if run_b:
            track_b_task = asyncio.create_task(
                self._run_track_b(system=system, user=user)
            )

        # ── Await Track A first — it owns the stream.
        try:
            a_text = await track_a_task
        except Exception as exc:  # noqa: BLE001
            logger.warning("Track A failed: %s", exc)
            a_text = _REJECT_FALLBACK
        timings["track_a_ms"] = (time.perf_counter() - t0) * 1000

        c1 = critique(
            a_text, intent=intent, retrieved_memories=retrieved_summaries,
            max_questions_per_turn=max_q,
            max_questions_per_window=self.max_q_per_window,
            prior_questions_in_window=prior_questions_in_window,
            stance_constraints=stance_constraints,
        )

        # ── Track B handling: race against a tight deadline.
        b_text: Optional[str] = None
        b_timed_out = False
        if track_b_task is not None:
            remaining = max(0.0, self.deadline_s - (time.perf_counter() - t0))
            try:
                b_text = await asyncio.wait_for(track_b_task, timeout=remaining)
            except asyncio.TimeoutError:
                b_timed_out = True
                track_b_task.cancel()
                logger.info("Track B timed out after %.0fms", self.deadline_s * 1000)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Track B failed: %s", exc)
        timings["track_b_ms"] = (time.perf_counter() - t0) * 1000 - timings["track_a_ms"]

        # ── Pick a winner.
        # If A passed the critic AND we already streamed it, A wins (no swap surprise).
        if c1.verdict.value == "ACCEPT" and stream_callback is not None:
            return DualTrackResult(
                text=a_text, accepted_on_pass=1, critique_v1=c1,
                timings_ms=timings,
                track_b_used=False, track_b_text=b_text, track_b_timed_out=b_timed_out,
            )

        # If A failed the critic and B is available + clean, prefer B.
        if b_text:
            c2 = critique(
                b_text, intent=intent, retrieved_memories=retrieved_summaries,
                max_questions_per_turn=max_q,
                max_questions_per_window=self.max_q_per_window,
                prior_questions_in_window=prior_questions_in_window,
                stance_constraints=stance_constraints,
            )
            if c2.verdict.value in ("ACCEPT", "SOFT_REWRITE"):
                return DualTrackResult(
                    text=b_text, accepted_on_pass=2,
                    critique_v1=c1, critique_v2=c2,
                    timings_ms=timings,
                    track_b_used=True, track_b_text=b_text, track_b_timed_out=False,
                )

        # No usable B → revise-and-retry on A or fall back.
        if c1.verdict.value == "ACCEPT":
            return DualTrackResult(
                text=a_text, accepted_on_pass=1, critique_v1=c1,
                timings_ms=timings,
                track_b_used=False, track_b_text=b_text, track_b_timed_out=b_timed_out,
            )

        # Soft-rewrite on A (no streaming this time — we already streamed once).
        revise_user = (
            f"{user}\n\n"
            f"# Critic feedback (REVISE)\n"
            f"{c1.rewrite_hint or 'Tighten the response and obey all therapeutic rules above.'}\n"
            "Rewrite the response. Keep it warm, brief, and rule-compliant. "
            "Do NOT mention this feedback in the response."
        )
        try:
            revised = await self.fast(system=system, user=revise_user, stream_callback=None)
        except Exception:  # noqa: BLE001
            revised = _REJECT_FALLBACK
        c2 = critique(
            revised, intent=intent, retrieved_memories=retrieved_summaries,
            max_questions_per_turn=max_q,
            max_questions_per_window=self.max_q_per_window,
            prior_questions_in_window=prior_questions_in_window,
            stance_constraints=stance_constraints,
        )
        if c2.verdict.value in ("ACCEPT", "SOFT_REWRITE"):
            return DualTrackResult(
                text=revised, accepted_on_pass=2,
                critique_v1=c1, critique_v2=c2, timings_ms=timings,
                track_b_used=False, track_b_text=b_text, track_b_timed_out=b_timed_out,
            )
        return DualTrackResult(
            text=_REJECT_FALLBACK, accepted_on_pass=3,
            critique_v1=c1, critique_v2=c2, fallback_used=True,
            timings_ms=timings,
            track_b_used=False, track_b_text=b_text, track_b_timed_out=b_timed_out,
        )

    # ── helpers ─────────────────────────────────────────────────────────────

    async def _run_track_b(self, *, system: str, user: str) -> str:
        """Track B runs without streaming (the user only sees Track A live).
        We append a brief 'deep mode' nudge so the larger model leans into
        synthesis vs. raw mirroring."""
        deep_user = (
            f"{user}\n\n# Deep-track guidance\n"
            "Write a single, polished, slightly deeper response. Same therapeutic "
            "rules apply. Aim for synthesis the fast model could miss — name a "
            "pattern, surface a value, or offer a careful interpretation. Stay "
            "humble and brief."
        )
        return await self.deep(system=system, user=deep_user, stream_callback=None)

    def _should_run_track_b(self, stance_c, stage_value: str) -> bool:
        if stance_c is not None:
            stance_val = getattr(getattr(stance_c, "stance", None), "value", "")
            try:
                if Stance(stance_val) in _TRACK_B_FORBIDDEN:
                    return False
            except ValueError:
                pass
        # Stage gate: only run B once we've earned a relationship.
        order = ("stranger", "acquaintance", "familiar", "trusted")
        try:
            return order.index(stage_value) >= order.index(self.min_stage_for_track_b)
        except ValueError:
            return False
