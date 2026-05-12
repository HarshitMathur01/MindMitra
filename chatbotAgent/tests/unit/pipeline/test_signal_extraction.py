"""Layer 2 signal extraction degradation and passive-risk tests."""
from __future__ import annotations

import pytest

from app.models.signals import AffectVector, GroqSignalRaw
from app.pipeline import signal_extraction
from tests.factories import make_ingested, make_session


@pytest.mark.unit
@pytest.mark.asyncio
async def test_signal_fallback_preserves_passive_hopelessness_escalation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(signal_extraction, "get_groq", lambda: None)
    session = make_session()
    ingested = make_ingested("nothing will ever get better. no way out. what's the point")

    signals = await signal_extraction.extract_signals(ingested, session=session)

    assert signals.fallback_used is True
    assert signals.urgency_score == 2
    assert signals.passive_signals.hopelessness_count >= 3
    assert any(signal.startswith("hopelessness_x") for signal in signals.implicit_distress_signals)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_longitudinal_risk_escalates_nonzero_urgency(monkeypatch: pytest.MonkeyPatch) -> None:
    async def raw(_message: str, _session):
        return GroqSignalRaw(
            affect_vector=AffectVector(valence=-0.3, arousal=0.6, dominance=0.4),
            urgency_score=1,
            language_register="casual",
            code_mix_ratio=0.3,
            sarcasm_detected=False,
            implicit_distress_signals=[],
            topic_keywords=["work"],
        )

    monkeypatch.setattr(signal_extraction, "_call_groq", raw)
    session = make_session(longitudinal_risk_flag=True)

    signals = await signal_extraction.extract_signals(make_ingested("I am overwhelmed at work"), session=session)

    assert signals.fallback_used is False
    assert signals.urgency_score == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_invalid_groq_payload_degrades_to_last_known_state(monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken_raw(_message: str, _session):
        return None

    session = make_session()
    session.urgency_history = [1]
    monkeypatch.setattr(signal_extraction, "_call_groq", broken_raw)

    signals = await signal_extraction.extract_signals(make_ingested("I need help"), session=session)

    assert signals.fallback_used is True
    assert signals.urgency_score == 1
    assert "signal_extraction_failed" in signals.implicit_distress_signals


@pytest.mark.unit
@pytest.mark.asyncio
async def test_farewell_pattern_raises_urgency_even_when_classifier_is_low(monkeypatch: pytest.MonkeyPatch) -> None:
    async def low_urgency_raw(_message: str, _session):
        return GroqSignalRaw(
            affect_vector=AffectVector(valence=-0.2, arousal=0.4, dominance=0.4),
            urgency_score=0,
            language_register="casual",
            code_mix_ratio=0.2,
            sarcasm_detected=False,
            implicit_distress_signals=[],
            topic_keywords=[],
        )

    monkeypatch.setattr(signal_extraction, "_call_groq", low_urgency_raw)

    signals = await signal_extraction.extract_signals(
        make_ingested("goodbye, take care of yourself"),
        session=make_session(),
    )

    assert signals.urgency_score == 2
    assert signals.passive_signals.farewell_detected is True
