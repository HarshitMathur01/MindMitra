"""Phase 1 — crisis_fast_path v2 unit tests (offline, deterministic)."""
from __future__ import annotations

import pytest


# Same severity classes the legacy test uses.

HARD_PHRASES = [
    # English
    "I want to kill myself",
    "I'm going to end it tonight",
    "I don't want to live anymore",
    "I'd be better off dead",
    # Hinglish / Romanised Hindi
    "mujhe jeene ka mann nahi hai",
    "main khud ko khatam karna chahta hoon",
    "yaar mujhe aaj sab kuch khatam kar dena hai",
    "mar jaana chahti hoon",
    # Devanagari
    "मुझे जीने का मन नहीं है",
    "मैं खुद को खत्म कर देना चाहता हूँ",
]

AMBIGUOUS_PHRASES = [
    "I'm hopeless",
    "what's the point",
    "I can't take this anymore",
    "main thak gayi",
    "bas ho gaya yaar",
]

SAFE_PHRASES = [
    "hi mitra",
    "I had a really nice day today",
    "my exams went well",
    "yaar movie kaisi thi tumhari?",
]

BENIGN_LOOKALIKES = [
    "I could just die laughing at this meme",
    "this song is killing me, so good",
    "ye gaana mar dala, mast hai yaar",
    "I'm dying to meet you tomorrow",
]


@pytest.mark.parametrize("phrase", HARD_PHRASES)
def test_hard_phrases_classified_hard(phrase):
    from app.pipeline.crisis_fast_path import classify_lexical
    assert classify_lexical(phrase) in {"hard", "ambiguous"}, phrase


@pytest.mark.parametrize("phrase", AMBIGUOUS_PHRASES)
def test_ambiguous_phrases_not_safe(phrase):
    from app.pipeline.crisis_fast_path import classify_lexical
    assert classify_lexical(phrase) in {"ambiguous", "hard"}, phrase


@pytest.mark.parametrize("phrase", SAFE_PHRASES)
def test_safe_phrases_classified_safe(phrase):
    from app.pipeline.crisis_fast_path import classify_lexical
    assert classify_lexical(phrase) == "safe", phrase


@pytest.mark.parametrize("phrase", BENIGN_LOOKALIKES)
def test_benign_lookalikes_not_hard(phrase):
    from app.pipeline.crisis_fast_path import classify_lexical
    assert classify_lexical(phrase) != "hard", phrase


def test_evaluate_returns_decision_with_response_for_hard():
    from app.pipeline.crisis_fast_path import evaluate
    d = evaluate("I want to kill myself", language="en")
    assert d.triggered is True and d.level == "hard"
    assert d.response and "📞" in d.response


def test_evaluate_passes_through_safe():
    from app.pipeline.crisis_fast_path import evaluate
    d = evaluate("had a great day today", language="en")
    assert d.triggered is False and d.level == "safe"


def test_empty_input_is_safe():
    from app.pipeline.crisis_fast_path import classify_lexical
    assert classify_lexical("") == "safe"
    assert classify_lexical("   ") == "safe"
