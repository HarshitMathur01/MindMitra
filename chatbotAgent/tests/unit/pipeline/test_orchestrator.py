"""Layer 3 orchestrator decision tests."""
from __future__ import annotations

import pytest

from app.pipeline.orchestrator import run_orchestrator
from tests.factories import make_session, make_signals


@pytest.mark.unit
def test_active_listener_holds_for_minimum_turn_window() -> None:
    session = make_session(current_mode="active_listener", turn_count=3)
    session.mode_history = [{"mode": "active_listener", "turn_number": 2, "reason": "x"}]
    session.urgency_history = [1, 1, 0]

    out = run_orchestrator(make_signals(urgency=0), session)

    assert out.selected_mode == "active_listener"


@pytest.mark.unit
def test_recovery_check_fires_on_fresh_session_after_distress() -> None:
    session = make_session(turn_count=0, is_new_session=True, previous_session_peak_urgency=2)

    out = run_orchestrator(make_signals(urgency=0), session)

    assert out.selected_mode == "recovery_check"
    assert "fresh_session_after_distress" in out.mode_change_reason


@pytest.mark.unit
def test_sustained_high_urgency_triggers_referral_bridge() -> None:
    session = make_session(turn_count=5)
    session.urgency_history = [2, 2, 2, 2]

    out = run_orchestrator(make_signals(urgency=2), session)

    assert out.selected_mode == "referral_bridge"
    assert out.memory_gate is False


@pytest.mark.unit
def test_dependency_flag_requires_high_dependency_and_low_social_contact() -> None:
    session = make_session()
    session.procedural_profile["dependency_risk_counter"] = 9
    session.procedural_profile["social_mentions_count"] = 1

    flagged = run_orchestrator(make_signals(urgency=1), session)
    assert flagged.dependency_flag is True

    session.procedural_profile["social_mentions_count"] = 5
    unflagged = run_orchestrator(make_signals(urgency=0), session)
    assert unflagged.dependency_flag is False


@pytest.mark.unit
def test_memory_gate_closes_on_crisis_and_temperature_is_bounded() -> None:
    session = make_session()
    session.urgency_history = [3]

    out = run_orchestrator(make_signals(urgency=3), session)

    assert out.memory_gate is False
    assert 0.0 <= out.temperature <= 1.0


@pytest.mark.unit
def test_active_listener_response_budget_is_short_for_high_distress() -> None:
    session = make_session(current_mode="active_listener", turn_count=4)
    session.urgency_history = [2, 2, 2]
    session.mode_history = [{"mode": "active_listener", "turn_number": 1, "reason": "x"}]

    out = run_orchestrator(make_signals(urgency=2), session)

    assert out.max_response_tokens == 80
