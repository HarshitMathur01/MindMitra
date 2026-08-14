"""Contract tests for POST /anam/crisis-check.

This route is the compensating control for turnkey mode. Anam's LLM writes the
replies there, so ``crisis_bypass`` is no longer inline on the turn — the
browser calls this the moment the user stops speaking, and on a tier-3 result
interrupts the persona and makes it speak the returned template verbatim.

What is pinned here:
  * tier 3 returns a clinician-authored template, not model output,
  * a session already marked tier 3 short-circuits without a second Groq call,
  * routine messages return crisis=false and cost nothing extra,
  * screening failures fail **open** — a Groq timeout must not fire the helpline
    script at a student who is fine.
"""
from __future__ import annotations

import pytest

from app.api import anam as anam_mod
from app.core.session import SessionObject
from app.models.signals import (
    AffectVector,
    PassiveSignals,
    Signals,
)
from app.pipeline import signal_extraction
from app.services import profile_service
from app.services import session_service


ENDPOINT = "/anam/crisis-check"

TEMPLATE = (
    "I'm really glad you said that — and I'm worried about you right now. "
    "Please reach out tonight: iCall 9152987821."
)


def _signals(urgency: int) -> Signals:
    return Signals(
        affect_vector=AffectVector(valence=-0.5, arousal=0.6, dominance=0.3),
        urgency_score=urgency,
        language_register="casual",
        code_mix_ratio=0.3,
        sarcasm_detected=False,
        implicit_distress_signals=[],
        topic_keywords=[],
        passive_signals=PassiveSignals(),
        fallback_used=False,
        extraction_latency_ms=1.0,
    )


@pytest.fixture
def screening(monkeypatch):
    """Wire the route to an in-memory session and a known crisis template."""
    state: dict = {"session": None, "extract_calls": 0, "saved": []}

    def make_session(**kwargs):
        session = SessionObject(session_id="sess-anam-1", user_id="pytest-health-user")
        for key, value in kwargs.items():
            setattr(session, key, value)
        state["session"] = session
        return session

    make_session()

    async def fake_startup(user_id, **_kwargs):  # noqa: ANN001
        return state["session"]

    async def fake_save(session):  # noqa: ANN001
        state["saved"].append(session)

    async def fake_template(variant):  # noqa: ANN001
        return TEMPLATE

    async def fake_audit(payload):  # noqa: ANN001
        return None

    monkeypatch.setattr(session_service, "session_startup", fake_startup)
    monkeypatch.setattr(session_service, "save_session", fake_save)
    monkeypatch.setattr(profile_service, "fetch_active_crisis_template", fake_template)
    monkeypatch.setattr(profile_service, "write_audit_log", fake_audit)

    def set_urgency(urgency: int):
        async def fake_extract(ingested, *, session):  # noqa: ANN001
            state["extract_calls"] += 1
            return _signals(urgency)

        monkeypatch.setattr(signal_extraction, "extract_signals", fake_extract)

    state["set_urgency"] = set_urgency
    set_urgency(0)
    return state


def test_routine_message_is_not_a_crisis(client, screening):
    screening["set_urgency"](1)

    response = client.post(ENDPOINT, json={"user_message": "exams are stressing me out"})

    assert response.status_code == 200
    body = response.json()
    assert body["crisis"] is False
    assert body["content"] is None


def test_tier_three_returns_the_clinician_template(client, screening):
    screening["set_urgency"](3)

    response = client.post(ENDPOINT, json={"user_message": "i don't want to be here"})

    assert response.status_code == 200
    body = response.json()
    assert body["crisis"] is True
    assert body["urgency"] == 3
    # Verbatim from crisis_templates — never paraphrased, never LLM-generated.
    assert body["content"] == TEMPLATE
    assert body["crisis_numbers"]


def test_tier_three_marks_the_session(client, screening):
    """The next utterance must short-circuit instead of paying for Groq again."""
    screening["set_urgency"](3)

    client.post(ENDPOINT, json={"user_message": "i don't want to be here"})

    session = screening["session"]
    assert session.urgency_history[-1] == 3
    assert screening["saved"], "tier-3 state must be persisted"


def test_existing_tier_three_session_skips_signal_extraction(client, screening):
    screening["set_urgency"](0)
    screening["session"].urgency_history = [3]

    response = client.post(ENDPOINT, json={"user_message": "ok"})

    assert response.json()["crisis"] is True
    assert screening["extract_calls"] == 0


def test_empty_message_is_a_no_op(client, screening):
    response = client.post(ENDPOINT, json={"user_message": "   "})
    assert response.status_code == 200
    assert response.json()["crisis"] is False


def test_screening_failure_fails_open(client, screening, monkeypatch):
    """A Groq timeout must not fire the helpline script at a student who is fine."""
    async def boom(ingested, *, session):  # noqa: ANN001
        raise RuntimeError("groq timed out")

    monkeypatch.setattr(signal_extraction, "extract_signals", boom)

    response = client.post(ENDPOINT, json={"user_message": "hey"})

    assert response.status_code == 200
    assert response.json()["crisis"] is False
