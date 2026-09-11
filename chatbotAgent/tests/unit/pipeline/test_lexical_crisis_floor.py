"""Lexical crisis floor — the backstop for a dead signal-extraction model.

Regression cover for the 2026-08-30 outage: Groq decommissioned the configured
llama models, ``_call_groq`` began returning None for every turn, and
``_fallback_raw`` degraded urgency to the session's last known value (0 on a
new session). Because ``crisis_bypass_check`` fires only at urgency 3, an
explicit suicidal message was answered with an ordinary greeting on both
``POST /chat`` and ``POST /anam/crisis-check``.

The floor only runs on the degraded path — see the design note in
``app/pipeline/signal_extraction.py``.
"""
from __future__ import annotations

import pytest

from app.models.signals import AffectVector, GroqSignalRaw
from app.pipeline import signal_extraction
from tests.factories import make_ingested, make_session


async def _groq_down(_message: str, _session):
    """Stand in for a decommissioned / unreachable model."""
    return None


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    [
        "I want to kill myself tonight, I have the pills ready",
        "i think im going to end my life",
        "I've been having suicidal thoughts",
        "honestly i just want to die",
        "main khudkushi karna chahta hoon",
        "mujhe jaan de deni hai",
        "ab jeena nahi chahta",
        "मैं आत्महत्या करना चाहता हूँ",
    ],
)
def test_lexical_hit_matches_explicit_intent(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    [
        "I have a lot of assignments due this week and I am tired",
        "hello",
        "my exams are killing me",
        "that lecture was dead boring",
        "I'm dying to see the new movie",
        # Negated — the thought is described as past/absent.
        "I don't want to kill myself anymore, that phase passed",
    ],
)
def test_lexical_hit_ignores_benign_and_negated(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_floor_forces_urgency_3_when_extraction_is_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The exact regression: model gone + explicit intent must still reach 3."""
    monkeypatch.setattr(signal_extraction, "_call_groq", _groq_down)
    session = make_session()

    signals = await signal_extraction.extract_signals(
        make_ingested("I want to kill myself tonight, I have the pills ready"),
        session=session,
    )

    assert signals.fallback_used is True
    assert signals.urgency_score == 3


@pytest.mark.unit
@pytest.mark.asyncio
async def test_floor_leaves_benign_message_alone_when_extraction_is_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(signal_extraction, "_call_groq", _groq_down)
    session = make_session()

    signals = await signal_extraction.extract_signals(
        make_ingested("I have a lot of assignments due this week and I am tired"),
        session=session,
    )

    assert signals.fallback_used is True
    assert signals.urgency_score == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_floor_does_not_override_a_healthy_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When Groq answers we defer to it, even on crisis-shaped wording.

    A false crisis erodes trust in the one response that has to be believed,
    so the lexical layer is a backstop for the outage case only.
    """

    async def healthy(_message: str, _session):
        return GroqSignalRaw(
            affect_vector=AffectVector(valence=-0.2, arousal=0.5, dominance=0.5),
            urgency_score=0,
            language_register="casual",
            code_mix_ratio=0.2,
            sarcasm_detected=False,
            implicit_distress_signals=[],
            topic_keywords=["film"],
        )

    monkeypatch.setattr(signal_extraction, "_call_groq", healthy)

    signals = await signal_extraction.extract_signals(
        make_ingested("that plot twist made me want to die, so good"),
        session=make_session(),
    )

    assert signals.fallback_used is False
    assert signals.urgency_score == 0
