"""Phase 1 — stance v2 prompt builder smoke tests (offline)."""
from __future__ import annotations

import pytest


def test_question_budget_per_stage_monotonic():
    from app.core.prompts.stance import question_budget, Stage
    s = question_budget(Stage.STRANGER)
    a = question_budget(Stage.ACQUAINTANCE)
    f = question_budget(Stage.FAMILIAR)
    t = question_budget(Stage.TRUSTED)
    # caps should monotonically not decrease as relationship deepens
    assert s["per_window"] <= f["per_window"] <= t["per_window"]
    assert s["per_turn"] <= f["per_turn"]


def test_build_stance_returns_a_system_prompt():
    from app.core.prompts.stance import build_stance, StanceContext, Stage
    ctx = StanceContext(stage=Stage.FAMILIAR, persona="mitra", language="hinglish",
                        user_preferred_name="Aarav")
    text = build_stance(ctx)
    assert "MindMitra" in text
    assert "FAMILIAR" in text
    assert "Question Budget" in text
    assert "Hinglish" in text or "hinglish" in text.lower()
    assert "Aarav" in text


def test_unknown_persona_falls_back_to_mitra():
    from app.core.prompts.stance import build_stance, StanceContext
    text = build_stance(StanceContext(persona="unknown_voice"))
    assert "warm, attentive friend" in text  # mitra default


def test_prompts_package_exposes_v2_modules():
    """Legacy `app/core/prompts.py` was removed. The new package must still
    expose the v2 sub-modules (stance / critic / crisis)."""
    from app.core import prompts as p
    assert hasattr(p, "stance")
    assert hasattr(p, "critic")
    assert hasattr(p, "crisis")
