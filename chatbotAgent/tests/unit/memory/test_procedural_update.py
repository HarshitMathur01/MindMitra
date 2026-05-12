"""Procedural memory EMA tests."""
from __future__ import annotations

import pytest

from app.memory.procedural_update import compute_procedural_ema
from tests.factories import make_session


def _session_with_urgency(urgency: int = 2):
    session = make_session(turn_count=4)
    session.session_peak_urgency = urgency
    session.append_affect({"turn": 1, "valence": -0.3, "arousal": 0.5, "dominance": 0.5, "urgency": urgency, "code_mix_ratio": 0.6})
    session.append_affect({"turn": 2, "valence": -0.2, "arousal": 0.55, "dominance": 0.5, "urgency": urgency, "code_mix_ratio": 0.6})
    session.turns = [
        {"role": "user", "content": "I'm stressed about work and exam"},
        {"role": "assistant", "content": "I hear you"},
    ]
    session.procedural_profile["dependency_risk_counter"] = 3
    session.procedural_profile["social_mentions_count"] = 0
    session.dependency_signals = {"social_mentions_count": 0, "sessions_this_week": 2}
    return session


@pytest.mark.unit
def test_dependency_counter_increments_when_no_social_contact() -> None:
    updates = compute_procedural_ema(_session_with_urgency())

    assert updates["dependency_risk_counter"] == 4


@pytest.mark.unit
def test_dependency_counter_decrements_when_social_contact_is_present() -> None:
    session = _session_with_urgency()
    session.dependency_signals["social_mentions_count"] = 3

    updates = compute_procedural_ema(session)

    assert updates["dependency_risk_counter"] == 2


@pytest.mark.unit
def test_warmth_floor_is_enforced() -> None:
    session = _session_with_urgency()
    session.procedural_profile["style_vector"]["warmth"] = 0.4

    updates = compute_procedural_ema(session)

    assert updates["style_vector"]["warmth"] >= 0.45


@pytest.mark.unit
def test_consecutive_high_urgency_sessions_are_tracked() -> None:
    updates = compute_procedural_ema(_session_with_urgency(urgency=2))

    assert updates["consecutive_high_urgency_sessions"] == 1
