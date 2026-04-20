"""
Phase 2 — Memory v2 unit tests (offline).

All tests use the InMemorySupabase + InMemoryQdrant fakes from
`app.memory.repositories` and `app.memory.qdrant_v2` so we never hit a real
service, which makes this suite the test gate after every Phase 2 change.
"""
from __future__ import annotations

import asyncio
from typing import List

import pytest


# ── Working memory ──────────────────────────────────────────────────────────

def test_working_memory_buffer_is_bounded():
    from app.memory.working import WorkingMemoryStore, Turn
    store = WorkingMemoryStore(max_turns_per_session=3)
    for i in range(10):
        store.append_turn("u1", "s1", Turn(role="user", content=f"msg {i}"))
    recent = store.recent_turns("u1", "s1", n=10)
    assert len(recent) == 3
    assert [t.content for t in recent] == ["msg 7", "msg 8", "msg 9"]


def test_working_memory_isolates_sessions():
    from app.memory.working import WorkingMemoryStore, Turn
    store = WorkingMemoryStore()
    store.append_turn("u1", "s1", Turn(role="user", content="a"))
    store.append_turn("u1", "s2", Turn(role="user", content="b"))
    store.append_turn("u2", "s1", Turn(role="user", content="c"))
    assert store.recent_turns("u1", "s1") == [t for t in store.recent_turns("u1", "s1")]
    assert len(store.recent_turns("u1", "s1")) == 1
    assert len(store.recent_turns("u1", "s2")) == 1
    assert len(store.recent_turns("u2", "s1")) == 1


# ── Importance scorer ───────────────────────────────────────────────────────

@pytest.mark.parametrize("text", ["hi", "thanks", "ok", "good night", "bye", ""])
def test_generic_closers_are_not_memorable(text):
    from app.memory.importance import score_turn
    s = score_turn(text)
    assert s.write is False, text


def test_emotional_self_disclosure_is_memorable():
    from app.memory.importance import score_turn
    s = score_turn(
        "I had a huge fight with my mom today and I just feel hopeless about everything",
        affect_vad={"v": -0.6, "a": 0.7, "d": -0.4},
        intent="vent",
    )
    assert s.write is True
    assert s.score >= 0.55
    assert "self_disclosure" in s.reasons or "high_arousal(0.70)" in s.reasons


def test_crisis_intent_always_memorable():
    from app.memory.importance import score_turn
    s = score_turn("I want to die", intent="crisis")
    assert s.write is True


def test_logistics_is_not_memorable():
    from app.memory.importance import score_turn
    s = score_turn("can you remind me at 6pm?", intent="logistics")
    assert s.write is False


# ── Identity Card service ───────────────────────────────────────────────────

def test_identity_card_round_trip():
    from app.memory.repositories import InMemorySupabase
    from app.memory.identity_card import IdentityCardService

    sb = InMemorySupabase()
    svc = IdentityCardService(sb)
    assert svc.is_empty("u1") is True

    svc.upsert_partial("u1", {"preferred_name": "Aarav", "languages": ["en", "hi"]},
                      provenance="onboarding", provenance_session="s0")
    card = svc.load("u1")
    assert card.preferred_name == "Aarav"
    assert card.languages == ["en", "hi"]
    assert "preferred_name" in card.field_provenance
    assert svc.is_empty("u1") is False


def test_identity_card_partial_merge_preserves_existing():
    from app.memory.repositories import InMemorySupabase
    from app.memory.identity_card import IdentityCardService

    sb = InMemorySupabase()
    svc = IdentityCardService(sb)
    svc.upsert_partial("u1", {"preferred_name": "Aarav"}, provenance="onboarding")
    svc.upsert_partial("u1", {"languages": ["hi"], "stated_identities": [{"text": "engineering student"}]},
                      provenance="extractor")
    card = svc.load("u1")
    assert card.preferred_name == "Aarav"
    assert "hi" in card.languages
    assert any("engineering" in (i.get("text") or "") for i in card.stated_identities)


def test_identity_card_render_for_prompt_compact():
    from app.memory.repositories import InMemorySupabase
    from app.memory.identity_card import IdentityCardService

    sb = InMemorySupabase()
    svc = IdentityCardService(sb)
    svc.upsert_partial("u1", {
        "preferred_name": "Aarav", "pronouns": "he/him", "languages": ["en", "hi"],
        "stated_identities": [{"text": "second-year engineering student"}],
    })
    rendered = svc.load("u1").render_for_prompt()
    assert "Aarav" in rendered and "he/him" in rendered
    assert "engineering" in rendered


# ── Episodic service (uses InMemoryQdrant + an embed stub) ──────────────────

class _StubEmbedder:
    """Hash-based deterministic 'embeddings' so retrieval is reproducible."""
    def __init__(self, dim: int = 16):
        self.dim = dim

    async def __call__(self, texts: List[str]) -> List[List[float]]:
        out = []
        for t in texts:
            v = [0.0] * self.dim
            for i, ch in enumerate(t.lower()):
                v[i % self.dim] += (ord(ch) % 13) / 13.0
            # normalise
            import math
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            out.append([x / n for x in v])
        return out


@pytest.mark.asyncio
async def test_episodic_write_and_retrieve_round_trip():
    from app.memory.repositories import InMemorySupabase
    from app.memory.qdrant_v2 import InMemoryQdrant
    from app.memory.episodic import EpisodicService

    sb, qd = InMemorySupabase(), InMemoryQdrant()
    embed = _StubEmbedder()
    svc = EpisodicService(sb=sb, qdrant=qd, embed_fn=embed.__call__)

    ep = await svc.write(
        user_id="u1",
        summary="User is anxious about end-semester exams next month.",
        verbatim_quote="exams are in 3 weeks and I haven't started preparing",
        affect_label="anxious",
        affect_vad={"v": -0.4, "a": 0.7, "d": -0.3},
        themes=["academics", "exams"],
        importance=0.8,
        source_session="s1",
    )
    assert ep.qdrant_id and ep.id  # both populated; fake mirrors Postgres uuid default

    hits = await svc.retrieve(user_id="u1", query="how are exams going", top_k=3)
    assert hits, "expected at least one match"
    assert hits[0].summary.startswith("User is anxious")
    assert hits[0].score is not None and hits[0].score > 0


@pytest.mark.asyncio
async def test_episodic_retrieval_isolates_users():
    from app.memory.repositories import InMemorySupabase
    from app.memory.qdrant_v2 import InMemoryQdrant
    from app.memory.episodic import EpisodicService

    sb, qd = InMemorySupabase(), InMemoryQdrant()
    embed = _StubEmbedder()
    svc = EpisodicService(sb=sb, qdrant=qd, embed_fn=embed.__call__)

    await svc.write(user_id="u1", summary="user1 talked about her dog",
                    importance=0.7, affect_label="happy")
    await svc.write(user_id="u2", summary="user2 mentioned her thesis defense",
                    importance=0.7, affect_label="anxious")

    hits = await svc.retrieve(user_id="u1", query="thesis", top_k=5)
    for h in hits:
        assert h.user_id == "u1", "must never leak across users"


@pytest.mark.asyncio
async def test_episodic_empty_query_returns_empty():
    from app.memory.repositories import InMemorySupabase
    from app.memory.qdrant_v2 import InMemoryQdrant
    from app.memory.episodic import EpisodicService

    sb, qd = InMemorySupabase(), InMemoryQdrant()
    svc = EpisodicService(sb=sb, qdrant=qd, embed_fn=_StubEmbedder().__call__)
    assert await svc.retrieve(user_id="u1", query="") == []
    assert await svc.retrieve(user_id="u1", query="   ") == []


# ── Affective three-channel service ─────────────────────────────────────────

def test_affective_lexical_record_aggregates_running_mean():
    from datetime import date
    from app.memory.repositories import InMemorySupabase
    from app.memory.affective import AffectiveService

    sb = InMemorySupabase()
    svc = AffectiveService(sb)
    today = date.today()
    svc.record_lexical(user_id="u1", vad={"v": -0.4, "a": 0.6, "d": 0.0}, label="sad", bucket=today)
    svc.record_lexical(user_id="u1", vad={"v": -0.6, "a": 0.5, "d": -0.1}, label="sad", bucket=today)
    rows = svc.repo.recent_buckets("u1", channel="lexical", days=2)
    assert len(rows) == 1
    assert rows[0]["message_count"] == 2
    assert rows[0]["vad_mean"]["v"] == pytest.approx(-0.5, abs=0.01)


def test_affective_pattern_requires_two_channel_agreement():
    from datetime import date, timedelta
    from app.memory.repositories import InMemorySupabase
    from app.memory.affective import AffectiveService

    sb = InMemorySupabase()
    svc = AffectiveService(sb)

    # Lexical-only signal: 7 days of negative valence — should NOT surface.
    base = date.today()
    for d in range(7):
        svc.record_lexical(user_id="u1", vad={"v": -0.4, "a": 0.5, "d": 0.0},
                           label="sad", bucket=base - timedelta(days=d))
    assert svc.recent_pattern("u1", days=14) is None

    # Add concurring self-report — now surface.
    svc.record_self_report(user_id="u1", scores={"phq9": 14}, bucket=base)
    pat = svc.recent_pattern("u1", days=14)
    assert pat is not None
    assert pat.label == "low_mood_trend"
    assert "lexical" in pat.supporting_channels
    assert "self_report" in pat.supporting_channels
    assert pat.confidence >= 0.7


def test_affective_no_pattern_when_data_is_thin():
    from app.memory.repositories import InMemorySupabase
    from app.memory.affective import AffectiveService

    svc = AffectiveService(InMemorySupabase())
    svc.record_lexical(user_id="u1", vad={"v": -0.6, "a": 0.5, "d": 0.0}, label="sad")
    assert svc.recent_pattern("u1", days=14) is None
