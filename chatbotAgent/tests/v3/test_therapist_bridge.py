"""Contract tests for the Therapist Bridge.

This surface hands a clinical profile to a third party over an unauthenticated
magic link, so the things pinned here are the things that would be harmful to
get wrong quietly:

  * consent filtering, including the case where no consent block is sent at all
    — that used to return the whole profile,
  * crisis rows having their own toggle rather than riding on `sharePatterns`,
  * PHQ-2 banding and its "inferred, not administered" provenance note,
  * expired tokens being indistinguishable from unknown ones,
  * referral write failures surfacing as errors instead of a 200 saying "failed",
  * the profile builder reading v3 sources rather than the dead pre-v3 tables.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.api import therapist_bridge as tb
from app.models.therapist_bridge_models import ConsentStatePayload
from app.services import therapist_profile_builder as builder


# ── consent filtering ────────────────────────────────────────────────────

def _profile() -> dict:
    return {
        "moodTrends": [{"date": "2026-08-01T12:00:00.000Z", "mood": 5}],
        "patterns": [
            {"icon": "📊", "title": "Practice engagement", "description": "x", "evidence_refs": []},
            {"icon": "🧩", "title": "Theme", "description": "narrative bullet", "evidence_refs": []},
        ],
        "topics": [{"topic": "Sleep", "frequency": 9, "sentiment": -0.2}],
        "assessments": [{"type": "PHQ-2", "score": 4, "severity": "band", "date": "2026-08-01", "note": "n"}],
        "crisisEvents": [{"date": "2026-07-01", "severity": "high", "actionTaken": "a", "source": "s"}],
    }


def test_missing_consent_shares_nothing():
    """A request with no consent block must deny, not disclose.

    This is the regression that matters most: the old implementation returned
    the profile untouched when `consent` was None, so a client that simply
    omitted the field shared everything.
    """
    out = tb.apply_consent_to_emotional_profile(_profile(), None)

    assert out["assessments"] == []
    assert out["moodTrends"] == []
    assert out["patterns"] == []
    assert out["topics"] == []
    assert out["crisisEvents"] == []


def test_patterns_consent_does_not_leak_crisis_events():
    """Crisis history has its own key; enabling mood trends must not include it."""
    consent = ConsentStatePayload(
        share_assessments=False,
        share_patterns=True,
        share_summaries=True,
        share_words=False,
        share_crisis_flags=False,
    )

    out = tb.apply_consent_to_emotional_profile(_profile(), consent)

    assert out["moodTrends"], "patterns consent should keep mood trends"
    assert out["topics"], "patterns consent should keep topics"
    assert out["crisisEvents"] == [], "crisis rows need their own consent"
    assert out["assessments"] == []


def test_summaries_off_strips_narrative_bullets():
    """Layer C bullets are the only summary-derived prose that reaches a clinician."""
    consent = ConsentStatePayload(
        share_assessments=True,
        share_patterns=True,
        share_summaries=False,
        share_words=False,
        share_crisis_flags=True,
    )

    out = tb.apply_consent_to_emotional_profile(_profile(), consent)
    titles = [p["title"] for p in out["patterns"]]

    assert "Practice engagement" in titles, "deterministic metrics survive"
    assert "Theme" not in titles, "narrative bullets are summary-derived"


def test_consent_filter_does_not_mutate_its_input():
    original = _profile()
    tb.apply_consent_to_emotional_profile(original, ConsentStatePayload.deny_all())
    assert original["assessments"], "filtering must work on a copy"


def test_consent_accepts_camel_case_aliases():
    """The frontend sends camelCase; populate_by_name keeps both spellings valid."""
    consent = ConsentStatePayload.model_validate(
        {
            "shareAssessments": False,
            "sharePatterns": True,
            "shareSummaries": False,
            "shareWords": False,
            "shareCrisisFlags": True,
        }
    )
    assert consent.share_assessments is False
    assert consent.share_crisis_flags is True


def test_dropped_consent_key_is_rejected():
    """share_anonymously governed nothing and is gone; extra='forbid' catches it."""
    with pytest.raises(Exception):
        ConsentStatePayload.model_validate({"shareAnonymously": True})


# ── PHQ-2 ────────────────────────────────────────────────────────────────

def test_phq2_bands_on_the_validated_cutpoint():
    below = builder._phq2_to_assessments({"phq2_scores": [{"date": "2026-08-01", "sleep": 1, "mood": 1}]})
    at = builder._phq2_to_assessments({"phq2_scores": [{"date": "2026-08-01", "sleep": 2, "mood": 1}]})

    assert below[0]["score"] == 2
    assert "below" in below[0]["severity"]
    assert at[0]["score"] == 3
    assert "further evaluation" in at[0]["severity"]


def test_phq2_always_states_it_was_not_self_administered():
    """The provenance is the whole reason this figure needs care."""
    rows = builder._phq2_to_assessments({"phq2_scores": [{"date": "2026-08-01", "sleep": 3, "mood": 3}]})

    assert rows[0]["type"] == "PHQ-2"
    note = rows[0]["note"].lower()
    assert "not self-administered" in note
    assert "language model" in note


def test_phq2_reads_the_most_recent_entry():
    rows = builder._phq2_to_assessments(
        {
            "phq2_scores": [
                {"date": "2026-06-01", "sleep": 0, "mood": 0},
                {"date": "2026-08-01", "sleep": 3, "mood": 2},
            ]
        }
    )
    assert rows[0]["score"] == 5
    assert rows[0]["date"] == "2026-08-01"


def test_phq2_absent_yields_no_assessment_rather_than_a_zero():
    """An empty list is a real answer. A 0 would read as 'screened, and fine'."""
    assert builder._phq2_to_assessments({"phq2_scores": []}) == []
    assert builder._phq2_to_assessments({}) == []


def test_phq2_tolerates_a_single_item():
    rows = builder._phq2_to_assessments({"phq2_scores": [{"date": "2026-08-01", "sleep": None, "mood": 2}]})
    assert rows[0]["score"] == 2
    assert "mood item only" in rows[0]["severity"]


# ── crisis derivation ────────────────────────────────────────────────────

def test_crisis_rows_come_from_session_urgency():
    """`crisis_events` has no writer in v3; peak_urgency carries the signal."""
    sessions = [
        {"started_at": "2026-08-01T10:00:00+00:00", "peak_urgency": 3},
        {"started_at": "2026-07-20T10:00:00+00:00", "peak_urgency": 2},
        {"started_at": "2026-07-01T10:00:00+00:00", "peak_urgency": 1},
    ]

    rows = builder._crisis_to_ui(sessions, {})

    assert len(rows) == 2, "urgency 1 is not a crisis"
    assert rows[0]["severity"] == "high"
    assert rows[1]["severity"] == "moderate"


def test_crisis_rows_never_carry_message_content():
    rows = builder._crisis_to_ui([{"started_at": "2026-08-01T10:00:00+00:00", "peak_urgency": 3}], {})
    assert "No message content stored." in rows[0]["actionTaken"]


def test_active_cooldown_flag_is_surfaced():
    rows = builder._crisis_to_ui(
        [], {"recent_crisis_flag": True, "crisis_flag_set_at": "2026-08-10T10:00:00+00:00"}
    )
    assert rows[0]["severity"] == "active-cooldown"


# ── topics ───────────────────────────────────────────────────────────────

def test_topics_score_over_episodic_summaries_and_semantic_themes():
    episodic = [{"summary_text": "talked about exams and not being able to sleep", "topic_keywords": ["study"]}]
    semantic = {"recurring_themes": {"anxious": 3}, "discomfort_topics": ["lonely"]}

    topics, refs = builder._score_topics(episodic, semantic)
    labels = {t["topic"] for t in topics}

    assert "Academic" in labels
    assert "Sleep" in labels
    assert "Anxiety" in labels
    assert "Loneliness" in labels
    assert all(r.startswith("episodic_lexicon:") for r in refs)


def test_topics_empty_without_sources():
    topics, refs = builder._score_topics([], {})
    assert topics == []
    assert refs == []


# ── the builder no longer reads dead tables ──────────────────────────────

def test_builder_does_not_query_pre_v3_tables():
    """session_summaries / crisis_events / user_contexts have no writer in v3.

    Reading them is what made every live profile come back empty. If a future
    change reintroduces one of these, it needs a writer first.
    """
    source = (builder.__file__).replace(".py", ".py")
    with open(source, encoding="utf-8") as fh:
        code = "".join(
            line for line in fh if not line.lstrip().startswith("#")
        )

    for dead in ('table("session_summaries")', 'table("crisis_events")', 'table("user_contexts")'):
        assert dead not in code, f"builder still queries {dead}"


# ── endpoint behaviour ───────────────────────────────────────────────────

@pytest.fixture
def bridge(monkeypatch):
    """Stub the profile pipeline and Supabase so the route logic is what's tested."""
    state: dict = {"audits": [], "rpc": [], "referral_raises": False, "row": None}

    async def fake_bundle(user_id):  # noqa: ANN001
        return {
            "facts": {"user_id_prefix": user_id[:8]},
            "metrics": {"topics_lexicon": [], "patterns_seed": []},
            "emotionalProfile": _profile(),
            "data_gaps": ["No PHQ-2 recorded yet."],
            "disclaimer": builder.DISCLAIMER,
        }

    def fake_synthesis(facts, metrics, emotional):  # noqa: ANN001
        return emotional, "stub-model", "stub-hash"

    async def fake_audit(payload):  # noqa: ANN001
        state["audits"].append(payload)
        return True

    class _Result:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, table):
            self._table = table

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def update(self, *_a, **_k):
            return self

        def execute(self):
            if self._table == "therapist_referrals":
                return _Result([state["row"]] if state["row"] else [])
            return _Result([{"payload": {"emotionalProfile": _profile()}, "created_at": "2026-08-01"}])

    class _Client:
        def table(self, name):
            return _Query(name)

        def rpc(self, name, params):
            state["rpc"].append((name, params))
            if state["referral_raises"]:
                raise RuntimeError("insert exploded")
            return _Query("rpc")

    client = _Client()
    monkeypatch.setattr(tb, "build_profile_bundle", fake_bundle)
    monkeypatch.setattr(tb, "synthesize_narrative_bundle", lambda *a, **k: ({}, "stub-model", "stub-hash"))
    monkeypatch.setattr(tb, "_run_synthesis", fake_synthesis)
    monkeypatch.setattr(tb, "supabase_client", client)
    monkeypatch.setattr(tb.profile_service, "write_audit_log", fake_audit)
    return state


CONSENT = {
    "shareAssessments": True,
    "sharePatterns": True,
    "shareSummaries": False,
    "shareWords": False,
    "shareCrisisFlags": True,
}


def test_directory_exposes_matching_fields(client):
    rows = client.get("/therapist-bridge/therapists").json()

    assert rows, "directory stub should not be empty"
    for row in rows:
        # matchTherapists() scores on these; a missing key silently zeroes a
        # therapist's score rather than erroring.
        assert row["approach"] and row["qualities"] and row["formats"]
        assert "photo" not in row, "portraits are bundled client-side, keyed by id"


def test_profile_preview_writes_an_audit_row(client, bridge):
    response = client.post(
        "/therapist-bridge/profile-preview",
        json={"includeNarrative": False, "consent": CONSENT},
    )

    assert response.status_code == 200
    assert response.json()["dataGaps"]
    actions = [a["action"] for a in bridge["audits"]]
    assert "therapist_bridge.profile_preview" in actions


def test_profile_preview_applies_consent_server_side(client, bridge):
    """The preview modal renders this payload, so filtering has to happen here."""
    response = client.post(
        "/therapist-bridge/profile-preview",
        json={"includeNarrative": False, "consent": {**CONSENT, "shareAssessments": False}},
    )

    assert response.json()["emotionalProfile"]["assessments"] == []


def test_referral_records_expiry_and_audits(client, bridge):
    response = client.post(
        "/therapist-bridge/referral",
        json={"therapistId": "maren", "consent": CONSENT},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "created"
    assert body["expiresAt"], "a magic link with no lifetime reads as permanent"

    # One RPC, not two inserts — a partial write would orphan the snapshot.
    assert len(bridge["rpc"]) == 1
    assert bridge["rpc"][0][0] == "create_therapist_referral"
    assert "therapist_bridge.referral_created" in [a["action"] for a in bridge["audits"]]


def test_referral_write_failure_is_not_reported_as_success(client, bridge):
    """It used to return HTTP 200 with status='failed'."""
    bridge["referral_raises"] = True

    response = client.post(
        "/therapist-bridge/referral",
        json={"therapistId": "maren", "consent": CONSENT},
    )

    assert response.status_code >= 500


def test_expired_token_is_indistinguishable_from_unknown(client, bridge):
    bridge["row"] = {
        "id": "ref-1",
        "user_id": "u-1",
        "snapshot_id": "snap-1",
        "consent": CONSENT,
        "status": "created",
        "created_at": "2026-07-01",
        "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "viewed_at": None,
    }

    response = client.get("/therapist-bridge/clinician-brief/some-token")

    assert response.status_code == 404
    assert "expire" not in response.json()["detail"].lower()


def test_live_token_returns_the_consent_scope_it_was_created_with(client, bridge):
    bridge["row"] = {
        "id": "ref-1",
        "user_id": "u-1",
        "snapshot_id": "snap-1",
        "consent": CONSENT,
        "status": "created",
        "created_at": "2026-08-01",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "viewed_at": None,
    }

    response = client.get("/therapist-bridge/clinician-brief/some-token")

    assert response.status_code == 200
    body = response.json()
    assert body["consentScope"]["shareAssessments"] is True
    assert "therapist_bridge.clinician_brief_read" in [a["action"] for a in bridge["audits"]]


def test_unknown_token_is_404(client, bridge):
    bridge["row"] = None
    assert client.get("/therapist-bridge/clinician-brief/nope").status_code == 404
