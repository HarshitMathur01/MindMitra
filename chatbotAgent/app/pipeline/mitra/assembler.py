"""
Context Assembler — builds the final `(system, user)` prompt pair.

Compresses retrieved context with a strict character budget. Identity Card
always wins; episodes are added in order until the budget is exhausted.
The system prompt comes from `app.core.prompts.stance.build_stance(...)`,
parametrised by the current Stage + persona + language.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ...core.prompts.stance import Stage, StanceContext, build_stance, stance_addendum
from ...memory.salience import SalienceWeights

logger = logging.getLogger(__name__)


@dataclass
class AssembledPrompt:
    system: str
    user: str
    used_episodes: int = 0
    used_chars: int = 0
    callback_budget: int = 0
    debug: Dict[str, Any] = field(default_factory=dict)


# Per-stage character budgets for the memory block — keep prompts tight.
_BUDGETS = {
    Stage.STRANGER:   600,
    Stage.ACQUAINTANCE: 1100,
    Stage.FAMILIAR:    1700,
    Stage.TRUSTED:     2400,
}


# Callback Budget — max number of explicit memory references injected into the
# prompt at each relationship stage. Strangers: never call back. Trusted: up to 3.
_CALLBACK_BUDGET = {
    Stage.STRANGER:    0,
    Stage.ACQUAINTANCE: 1,
    Stage.FAMILIAR:    2,
    Stage.TRUSTED:     3,
}


# Per-stage salience weight tuning. Earlier stages bias toward recency
# (don't keep dredging up old material when we barely know them); later
# stages tilt toward importance and affective resonance (the memories that
# matter to *them*).
_STAGE_WEIGHTS = {
    Stage.STRANGER:    SalienceWeights(recency=0.45, importance=0.20, affect=0.10, relevance=0.25),
    Stage.ACQUAINTANCE: SalienceWeights(recency=0.30, importance=0.25, affect=0.15, relevance=0.30),
    Stage.FAMILIAR:    SalienceWeights(recency=0.20, importance=0.30, affect=0.20, relevance=0.30),
    Stage.TRUSTED:     SalienceWeights(recency=0.15, importance=0.30, affect=0.25, relevance=0.30),
}


def stage_weights(stage: Stage) -> SalienceWeights:
    """Public accessor — used by the retriever to score memories per stage."""
    return _STAGE_WEIGHTS.get(stage, SalienceWeights())


class ContextAssembler:
    def assemble(
        self,
        *,
        user_message: str,
        stage: Stage,
        persona: str = "mitra",
        language: str = "en",
        identity_card: Optional[Any] = None,
        episodes: Optional[List[Any]] = None,
        affect_pattern: Optional[Any] = None,
        procedural_recommendation: Optional[Any] = None,
        recent_turns: Optional[List[Dict[str, str]]] = None,
        user_preferred_name: Optional[str] = None,
        preferences: Optional[Any] = None,
        stance_constraints: Optional[Any] = None,
    ) -> AssembledPrompt:
        system_base = build_stance(StanceContext(
            stage=stage, persona=persona, language=language,
            user_preferred_name=user_preferred_name,
        ))
        system_addendum = ""
        if stance_constraints is not None:
            stance_value = getattr(getattr(stance_constraints, "stance", None), "value", "")
            system_addendum = stance_addendum(stance_value)
        system = system_base if not system_addendum else f"{system_base}\n\n{system_addendum}"

        budget = _BUDGETS.get(stage, 1500)
        callback_cap = _CALLBACK_BUDGET.get(stage, 1)

        # Procedural preferences can pull the cap down further (user said
        # "don't reference past sessions explicitly").
        if preferences is not None:
            try:
                cc = float(getattr(preferences, "callback_comfort", 0.6))
                if cc < 0.3:
                    callback_cap = min(callback_cap, 0)
                elif cc < 0.5:
                    callback_cap = min(callback_cap, 1)
            except (TypeError, ValueError):
                pass

        # Stance can also veto callbacks (CRISIS / CO_REGULATE / INQUIRE / REFER).
        if stance_constraints is not None and not getattr(stance_constraints, "callbacks_allowed", True):
            callback_cap = 0

        memory_block, used_eps, used_chars = self._render_memory(
            identity_card=identity_card,
            episodes=episodes or [],
            affect_pattern=affect_pattern,
            procedural_recommendation=procedural_recommendation,
            budget_chars=budget,
            callback_cap=callback_cap,
        )

        history_block = self._render_history(recent_turns or [], max_turns=6)
        prefs_line = ""
        if preferences is not None and hasattr(preferences, "render_for_prompt"):
            prefs_line = preferences.render_for_prompt() or ""

        user = self._compose_user_block(
            memory_block=memory_block,
            history_block=history_block,
            user_message=user_message,
            prefs_line=prefs_line,
        )

        return AssembledPrompt(
            system=system, user=user,
            used_episodes=used_eps, used_chars=used_chars,
            callback_budget=callback_cap,
            debug={
                "stage": stage.value,
                "budget": budget,
                "callback_cap": callback_cap,
                "weights": stage_weights(stage).normalised().__dict__,
                "stance": getattr(getattr(stance_constraints, "stance", None), "value", None),
            },
        )

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _render_memory(
        self, *, identity_card, episodes, affect_pattern,
        procedural_recommendation, budget_chars: int, callback_cap: int,
    ) -> tuple[str, int, int]:
        sections: List[str] = []
        used_eps = 0

        # 1. Identity Card always first (always small).
        if identity_card and hasattr(identity_card, "render_for_prompt"):
            ic = identity_card.render_for_prompt()
            if ic:
                sections.append(f"WHO THEY ARE\n{ic}")

        # 2. Affect pattern (1-2 lines).
        if affect_pattern and hasattr(affect_pattern, "render_for_prompt"):
            ap = affect_pattern.render_for_prompt()
            if ap:
                sections.append(f"RECENT EMOTIONAL TREND\n{ap}")

        # 3. Episodes — capped by both the Callback Budget AND the char budget.
        if episodes and callback_cap > 0:
            ep_lines: List[str] = [
                "RELEVANT MEMORIES (you may explicitly reference at most "
                f"{callback_cap} of these — never more)",
            ]
            for ep in episodes[:callback_cap]:
                line = ep.render_for_prompt() if hasattr(ep, "render_for_prompt") else str(ep)
                tentative = "\n".join(ep_lines + [line])
                running = "\n\n".join(sections + [tentative])
                if len(running) > budget_chars:
                    break
                ep_lines.append(line)
                used_eps += 1
            if used_eps > 0:
                sections.append("\n".join(ep_lines))
        elif episodes and callback_cap == 0:
            # Callback budget = 0 → don't even surface memories. The fact that
            # we *have* memory is implicit through Identity Card and stance.
            pass

        # 4. Procedural hint (terse).
        if procedural_recommendation and hasattr(procedural_recommendation, "intervention"):
            sections.append(
                f"WHAT HELPED THEM BEFORE\n- {procedural_recommendation.intervention} "
                f"(avg valence delta {procedural_recommendation.avg_valence_delta:+.2f})"
            )

        block = "\n\n".join(sections)
        return block, used_eps, len(block)

    def _render_history(self, turns: List[Dict[str, str]], *, max_turns: int) -> str:
        if not turns:
            return ""
        recent = turns[-max_turns:]
        lines = []
        for t in recent:
            role = (t.get("role") or "user").lower()
            tag = "USER" if role == "user" else "MITRA"
            lines.append(f"{tag}: {t.get('content', '').strip()}")
        return "RECENT CONVERSATION\n" + "\n".join(lines)

    def _compose_user_block(self, *, memory_block: str, history_block: str,
                            user_message: str, prefs_line: str = "") -> str:
        parts: List[str] = []
        if memory_block:
            parts.append(memory_block)
        if prefs_line:
            parts.append(f"HOW THEY LIKE TO BE TALKED TO\n{prefs_line}")
        if history_block:
            parts.append(history_block)
        parts.append(f"CURRENT MESSAGE\nUSER: {user_message.strip()}")
        return "\n\n".join(parts)
