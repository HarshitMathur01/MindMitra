"""Unit tests: crisis keyword gate (deterministic, no network)."""

import pytest

from app.pipeline.crisis_manager import CrisisManager


@pytest.fixture
def cm():
    return CrisisManager(groq_nlp=None, supabase=None)


def test_hard_crisis_suicide_phrase(cm):
    assert cm.check_crisis_keywords("I want to end my life") == "hard"


def test_hard_crisis_self_harm(cm):
    assert cm.check_crisis_keywords("Sometimes I want to hurt myself") == "hard"


def test_ambiguous_contains_suicide_word(cm):
    level = cm.check_crisis_keywords("We read a book about suicide in class")
    assert level in ("ambiguous", "hard", "safe")


def test_safe_benign(cm):
    assert cm.check_crisis_keywords("I am stressed about exams") == "safe"


def test_hindi_crisis_phrase(cm):
    assert cm.check_crisis_keywords("Main jeena nahi chahta") == "hard"
