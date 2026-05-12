"""Layer 5 prompt builder tests."""
from __future__ import annotations

import pytest

from app.pipeline.prompt_builder import build_full_prompt, build_partial_prompt
from tests.factories import make_ingested, make_memory_result, make_orchestrator, make_session, make_signals


@pytest.mark.unit
def test_prompt_includes_expected_blocks_when_context_is_present() -> None:
    session = make_session()
    session.turns = [{"role": "user", "content": "hi"}]
    orchestrator = make_orchestrator()
    partial = build_partial_prompt(orchestrator=orchestrator, tone=orchestrator.tone_params)
    memory = make_memory_result(semantic_facts_injection="They are a student.")

    bundle = build_full_prompt(
        partial=partial,
        memory=memory,
        session=session,
        ingested=make_ingested("hello"),
        orchestrator=orchestrator,
        signals=make_signals(),
    )

    assert bundle.blocks_used["block1_system_identity"] > 50
    assert bundle.blocks_used["block2_tone"] > 5
    assert bundle.blocks_used["block3_memory"] > 0
    assert bundle.blocks_used["block4_cultural_frame"] > 10
    assert bundle.blocks_used["block5_mode"] > 10
    assert bundle.blocks_used["block6_anti_sycophancy"] > 5
    assert "USER:" in bundle.full_prompt


@pytest.mark.unit
def test_dependency_modifier_only_in_companion_mode() -> None:
    companion = make_orchestrator(mode="companion", dependency=True)
    assert "QUIET NUDGE" in build_partial_prompt(orchestrator=companion, tone=companion.tone_params)["block5_mode"]

    listener = make_orchestrator(mode="active_listener", dependency=True)
    assert "QUIET NUDGE" not in build_partial_prompt(orchestrator=listener, tone=listener.tone_params)["block5_mode"]


@pytest.mark.unit
def test_token_budget_trims_history_before_safety_identity() -> None:
    session = make_session()
    session.turns = [{"role": "user", "content": "x" * 5000} for _ in range(40)]
    orchestrator = make_orchestrator()
    partial = build_partial_prompt(orchestrator=orchestrator, tone=orchestrator.tone_params)

    bundle = build_full_prompt(
        partial=partial,
        memory=make_memory_result(),
        session=session,
        ingested=make_ingested("hi"),
        orchestrator=orchestrator,
        signals=make_signals(),
        max_total_tokens=2000,
    )

    assert bundle.prompt_token_count <= 2200
    assert bundle.blocks_used["block1_system_identity"] > 200
    assert bundle.blocks_used["block7_working_memory"] < 2000


@pytest.mark.unit
def test_current_user_message_uses_redacted_ingested_text() -> None:
    orchestrator = make_orchestrator()
    partial = build_partial_prompt(orchestrator=orchestrator, tone=orchestrator.tone_params)

    bundle = build_full_prompt(
        partial=partial,
        memory=make_memory_result(),
        session=make_session(),
        ingested=make_ingested("call me at 9876543210"),
        orchestrator=orchestrator,
        signals=make_signals(),
    )

    assert "9876543210" not in bundle.full_prompt
    assert "[phone]" in bundle.user_text
