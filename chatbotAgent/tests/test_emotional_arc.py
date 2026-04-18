"""Unit tests for EmotionalArcReader (no network / DB)."""
from __future__ import annotations

from unittest.mock import patch

from app.core.emotional_arc import EmotionalArcReader


def test_score_text_positive_english():
    s = EmotionalArcReader().score_text("I feel really good today")
    assert s > 0.2


def test_score_text_negative_english():
    s = EmotionalArcReader().score_text("I am devastated and hopeless")
    assert s < -0.2


def test_score_text_hinglish_negative():
    s = EmotionalArcReader().score_text(
        "Yaar main bahut bura feel kar raha hun, koi nahi sunta"
    )
    assert s < -0.1


def test_score_text_hinglish_positive():
    s = EmotionalArcReader().score_text("Aaj thoda better feel kar raha hun, shukriya")
    assert s > 0.0


def test_score_clamped():
    r = EmotionalArcReader()
    for payload in ("", "x" * 5000, "!@#$", "mixed " * 200):
        v = r.score_text(payload)
        assert -1.0 <= v <= 1.0


def test_compute_arc_rising():
    r = EmotionalArcReader()
    msgs = [{"role": "user", "content": f"m{i}"} for i in range(6)]
    # Narrow positive band so volatile rule (range > 0.6, low < -0.2, high > 0.2) does not fire.
    with patch.object(r, "score_text", side_effect=[0.05, 0.08, 0.1, 0.18, 0.28, 0.42]):
        out = r.compute_arc(msgs, window=8)
    assert out["arc_direction"] == "rising"
    assert out["turn_count"] == 6


def test_compute_arc_falling():
    r = EmotionalArcReader()
    msgs = [{"role": "user", "content": f"m{i}"} for i in range(6)]
    with patch.object(r, "score_text", side_effect=[0.42, 0.38, 0.32, 0.22, 0.12, 0.05]):
        out = r.compute_arc(msgs, window=8)
    assert out["arc_direction"] == "falling"


def test_compute_arc_stable():
    r = EmotionalArcReader()
    msgs = [{"role": "user", "content": str(i)} for i in range(4)]
    with patch.object(r, "score_text", side_effect=[0.02, -0.01, 0.0, 0.03]):
        out = r.compute_arc(msgs, window=8)
    assert out["arc_direction"] == "stable"


def test_compute_arc_volatile():
    r = EmotionalArcReader()
    msgs = [{"role": "user", "content": str(i)} for i in range(6)]
    with patch.object(
        r, "score_text", side_effect=[0.8, -0.8, 0.8, -0.8, 0.8, -0.8]
    ):
        out = r.compute_arc(msgs, window=8)
    assert out["arc_direction"] == "volatile"


def test_compute_arc_empty():
    out = EmotionalArcReader().compute_arc([])
    assert out == {
        "current_valence": 0.0,
        "arc_direction": "stable",
        "arc_delta": 0.0,
        "session_low": 0.0,
        "session_high": 0.0,
        "turn_count": 0,
    }


def test_compute_arc_single_message():
    out = EmotionalArcReader().compute_arc(
        [{"role": "user", "content": "I'm fine"}]
    )
    assert out["arc_direction"] == "stable"
    assert out["turn_count"] == 1


def test_vader_fallback_path_still_scores_hinglish(monkeypatch):
    monkeypatch.setattr("app.core.emotional_arc._VADER_IMPORT_OK", False)
    monkeypatch.setattr("app.core.emotional_arc._VADER_ANALYZER", None)
    monkeypatch.setattr(EmotionalArcReader, "VADER_AVAILABLE", False)

    r = EmotionalArcReader()
    s = r.score_text("bahut bura lag raha hai, koi nahi sunta")
    assert s < 0
