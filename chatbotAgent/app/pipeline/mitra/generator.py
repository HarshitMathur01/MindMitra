"""
Two-pass generator: draft → critic → revise (or accept).

Pass 1 generates a draft using the assembled (system, user) prompt pair.
The critic evaluates the draft against the v0/v1 rules. If verdict is:
    ACCEPT       → return draft.
    SOFT_REWRITE → call the LLM again with a tight rewrite hint.
    REJECT       → call the LLM again with the issues + a stricter hint;
                   if still REJECT, fall back to a hand-crafted safe message.

The LLM is dependency-injected as an async callable:
    `async def llm_complete(*, system: str, user: str,
                            stream_callback: Optional[Callable[[str], None]] = None,
                            ) -> str`
This keeps the generator transport-agnostic — pass the real provider, or in
tests a stub that returns canned strings.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from ...core.prompts.critic import CritiqueReport, Verdict, critique

logger = logging.getLogger(__name__)


LLMCompleteFn = Callable[..., Awaitable[str]]


@dataclass
class GenerationResult:
    text: str
    accepted_on_pass: int = 1     # 1 = first draft, 2 = after rewrite, 3 = fallback
    critique_v1: Optional[CritiqueReport] = None
    critique_v2: Optional[CritiqueReport] = None
    timings_ms: Dict[str, float] = field(default_factory=dict)
    fallback_used: bool = False


_REJECT_FALLBACK = (
    "I want to slow down and stay with you for a second. "
    "Whatever you're carrying right now, you don't have to carry it alone."
)


class TwoPassGenerator:
    def __init__(
        self,
        *,
        llm_complete: LLMCompleteFn,
        max_questions_per_turn: int = 1,
        max_questions_per_window: Optional[int] = None,
    ):
        self.llm = llm_complete
        self.max_q_per_turn = max_questions_per_turn
        self.max_q_per_window = max_questions_per_window

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
    ) -> GenerationResult:
        # Stance can tighten the per-turn question budget further.
        max_q = self.max_q_per_turn
        if stance_constraints is not None:
            try:
                max_q = min(max_q, int(getattr(stance_constraints, "max_questions", max_q)))
            except (TypeError, ValueError):
                pass

        # ── Pass 1: draft ───────────────────────────────────────────────────
        draft = await self.llm(system=system, user=user, stream_callback=stream_callback)
        c1 = critique(
            draft, intent=intent, retrieved_memories=retrieved_summaries,
            max_questions_per_turn=max_q,
            max_questions_per_window=self.max_q_per_window,
            prior_questions_in_window=prior_questions_in_window,
            stance_constraints=stance_constraints,
        )
        if c1.verdict == Verdict.ACCEPT:
            return GenerationResult(text=draft, accepted_on_pass=1, critique_v1=c1)

        # ── Pass 2: revise with critic hint ────────────────────────────────
        revise_user = (
            f"{user}\n\n"
            f"# Critic feedback (REVISE)\n"
            f"{c1.rewrite_hint or 'Tighten the response and obey all therapeutic rules above.'}\n"
            "Rewrite the response. Keep it warm, brief, and rule-compliant. "
            "Do NOT mention this feedback in the response."
        )
        # No streaming on revision passes — emit only the final revised text
        # to keep SSE clients from receiving two overlapping streams.
        revised = await self.llm(system=system, user=revise_user, stream_callback=None)
        c2 = critique(
            revised, intent=intent, retrieved_memories=retrieved_summaries,
            max_questions_per_turn=max_q,
            max_questions_per_window=self.max_q_per_window,
            prior_questions_in_window=prior_questions_in_window,
            stance_constraints=stance_constraints,
        )
        if c2.verdict in (Verdict.ACCEPT, Verdict.SOFT_REWRITE):
            return GenerationResult(text=revised, accepted_on_pass=2,
                                    critique_v1=c1, critique_v2=c2)

        # ── Pass 3: hard fallback (deterministic safe response) ────────────
        return GenerationResult(
            text=_REJECT_FALLBACK, accepted_on_pass=3,
            critique_v1=c1, critique_v2=c2, fallback_used=True,
        )
