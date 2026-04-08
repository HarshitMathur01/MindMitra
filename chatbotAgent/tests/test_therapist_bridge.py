"""Tests for Therapist Bridge consent filtering and builder helpers."""

from app.api.therapist_bridge import apply_consent_to_emotional_profile
from app.models.therapist_bridge_models import ConsentStatePayload
from app.services.therapist_profile_builder import _score_topics_from_summaries


def test_apply_consent_assessments_only_strips_behavioral():
    emotional = {
        "moodTrends": [{"date": "2026-01-01", "mood": 5}],
        "patterns": [{"icon": "x", "title": "t", "description": "d"}],
        "topics": [{"topic": "Sleep", "frequency": 10, "sentiment": -0.2}],
        "assessments": [{"type": "PHQ-9", "score": 5, "severity": "mild", "date": "2026-01-01"}],
        "crisisEvents": [{"date": "2026-01-01", "severity": "moderate", "actionTaken": "x"}],
    }
    consent = ConsentStatePayload(
        shareFullProfile=False,
        shareAssessments=True,
        sharePatterns=False,
        shareAnonymously=True,
    )
    out = apply_consent_to_emotional_profile(emotional, consent)
    assert out["assessments"]
    assert out["moodTrends"] == []
    assert out["patterns"] == []
    assert out["topics"] == []
    assert out["crisisEvents"] == []


def test_apply_consent_full_keeps_behavioral():
    emotional = {
        "moodTrends": [{"date": "2026-01-01", "mood": 5}],
        "patterns": [],
        "topics": [],
        "assessments": [{"type": "PHQ-9", "score": 5, "severity": "mild", "date": "2026-01-01"}],
        "crisisEvents": [],
    }
    consent = ConsentStatePayload(
        shareFullProfile=True,
        shareAssessments=True,
        sharePatterns=True,
        shareAnonymously=True,
    )
    out = apply_consent_to_emotional_profile(emotional, consent)
    assert len(out["moodTrends"]) == 1


def test_topics_from_summaries_lexicon():
    summaries = [
        {
            "summary_text": "I feel anxious about exams and cannot sleep",
            "themes": ["stress"],
            "emotional_arc": [],
            "updated_at": None,
        }
    ]
    topics, refs = _score_topics_from_summaries(summaries)
    assert topics
    labels = {t["topic"].lower() for t in topics}
    assert "academic" in labels or "anxiety" in labels or "sleep" in labels
    assert refs
