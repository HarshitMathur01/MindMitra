"""
Phase 4 — Reflective Consolidation Worker + Ebbinghaus decay.

These tests exercise the worker end-to-end against the in-memory Supabase
fake and a stub Qdrant + embedder, so they run fully offline.
"""
from __future__ import annotations

import asyncio
import math
from datetime import datetime, timedelta, timezone
from typing import List

import pytest

from app.jobs.consolidation_worker import (
    CandidateMemory,
    ConsolidationWorker,
    _default_jaccard_similarity,
)
from app.memory.decay import (
    ARCHIVE_THRESHOLD,
    apply_decay,
    reinforce_on_recall,
    time_constant_days,
)
from app.memory.episodic import EpisodicService
from app.memory.qdrant_v2 import InMemoryQdrant
from app.memory.repositories import EpisodicRepo, InMemorySupabase


# ── Decay math ──────────────────────────────────────────────────────────────

def test_decay_zero_elapsed_returns_input():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert apply_decay(
        current_strength=1.0, importance=0.5,
        last_recalled_at=now.isoformat(), created_at=now.isoformat(), now=now,
    ) == pytest.approx(1.0)


def test_decay_strictly_monotonically_decreasing_with_time():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    s_now = apply_decay(
        current_strength=1.0, importance=0.5,
        last_recalled_at=base.isoformat(), created_at=base.isoformat(),
        now=base + timedelta(days=10),
    )
    s_later = apply_decay(
        current_strength=1.0, importance=0.5,
        last_recalled_at=base.isoformat(), created_at=base.isoformat(),
        now=base + timedelta(days=60),
    )
    assert 0.0 < s_later < s_now < 1.0


def test_higher_importance_decays_slower():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    later = base + timedelta(days=30)
    low = apply_decay(current_strength=1.0, importance=0.1,
                      last_recalled_at=base.isoformat(), created_at=base.isoformat(), now=later)
    high = apply_decay(current_strength=1.0, importance=0.9,
                       last_recalled_at=base.isoformat(), created_at=base.isoformat(), now=later)
    assert high > low


def test_recall_reinforces_strength():
    s = 0.30
    s2 = reinforce_on_recall(s)
    assert s2 > s
    s3 = reinforce_on_recall(s2)
    assert s3 > s2 < 1.0  # noqa: E711  (chained comparison kept readable)
    # Idempotent ceiling.
    for _ in range(50):
        s = reinforce_on_recall(s)
    assert s == pytest.approx(1.0, abs=1e-3)


def test_time_constant_monotonic_in_importance():
    assert time_constant_days(0.0) < time_constant_days(0.5) < time_constant_days(1.0)


# ── Jaccard dedup ───────────────────────────────────────────────────────────

def test_jaccard_basic_properties():
    assert _default_jaccard_similarity("alice talked about exams", "alice talked about exams") == 1.0
    assert _default_jaccard_similarity("alice talked about exams",
                                       "alice mentioned upcoming exams") > 0.3
    assert _default_jaccard_similarity("alice talked about exams",
                                       "weather was lovely today") < 0.2
    assert _default_jaccard_similarity("", "anything") == 0.0


# ── End-to-end consolidation ────────────────────────────────────────────────

def _stub_embed_factory(dim: int = 8):
    async def _embed(texts: List[str]) -> List[List[float]]:
        # Deterministic toy embedding: per-character hash → small vec.
        out = []
        for t in texts:
            v = [0.0] * dim
            for i, ch in enumerate(t.encode("utf-8")):
                v[i % dim] += (ch % 13) / 13.0
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            out.append([x / n for x in v])
        return out
    return _embed


def _make_worker():
    sb = InMemorySupabase()
    qd = InMemoryQdrant()
    embed = _stub_embed_factory()
    episodic = EpisodicService(sb=sb, qdrant=qd, embed_fn=embed)
    repo = EpisodicRepo(sb)

    async def extract_two(user_id: str, session_id: str):
        return [
            CandidateMemory(
                summary="alice talked about her board exam stress",
                affect_label="anxious", themes=["exams", "stress"],
                importance_hint=0.8, source_session=session_id,
            ),
            CandidateMemory(
                summary="alice rides her bike to clear her head",
                affect_label="calm", themes=["coping"],
                importance_hint=0.7, source_session=session_id,
            ),
        ]

    async def reflect_two(user_id, eps):
        return [{"insight": "exams correlate with anxious affect"}] if eps else []

    worker = ConsolidationWorker(
        episodic=episodic,
        episodic_repo=repo,
        extract_fn=extract_two,
        reflect_fn=reflect_two,
    )
    return worker, sb, repo


def test_consolidation_writes_high_importance_candidates():
    worker, sb, repo = _make_worker()
    report = asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    assert report.n_candidates == 2
    assert report.n_written == 2
    assert report.n_dedup_skipped == 0
    assert len(repo.by_user("u1")) == 2


def test_consolidation_skips_low_importance_candidates():
    sb = InMemorySupabase()
    qd = InMemoryQdrant()
    repo = EpisodicRepo(sb)
    episodic = EpisodicService(sb=sb, qdrant=qd, embed_fn=_stub_embed_factory())

    async def extract(user_id, session_id):
        return [CandidateMemory(summary="trivial chat about weather",
                                importance_hint=0.20)]

    worker = ConsolidationWorker(episodic=episodic, episodic_repo=repo, extract_fn=extract)
    report = asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    assert report.n_written == 0
    assert repo.by_user("u1") == []


def test_consolidation_dedups_against_existing_summaries():
    worker, sb, repo = _make_worker()
    asyncio.run(worker.run_once_for_user("u1", session_id="s1"))

    # Re-run with the same extraction → all should be deduped.
    report = asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    assert report.n_written == 0
    assert report.n_dedup_skipped == 2


def test_decay_sweep_archives_old_low_importance_memories():
    worker, sb, repo = _make_worker()
    # Seed an ancient, very-low-importance memory.
    long_ago = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    sb.table("mitra_episodic_memories").insert({
        "user_id": "u1",
        "qdrant_id": "qid-stale",
        "summary": "an ancient trivial mention",
        "importance": 0.05,
        "strength": 0.4,
        "created_at": long_ago,
        "last_recalled_at": long_ago,
    }).execute()

    report = asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    assert report.n_archived >= 1
    rows = repo.by_user("u1")
    archived = [r for r in rows if r["qdrant_id"] == "qid-stale"]
    assert archived and archived[0].get("archived_at") is not None
    assert archived[0]["strength"] <= ARCHIVE_THRESHOLD


def test_decay_sweep_keeps_recent_high_importance_memories():
    worker, sb, repo = _make_worker()
    fresh_ts = datetime.now(timezone.utc).isoformat()
    sb.table("mitra_episodic_memories").insert({
        "user_id": "u1",
        "qdrant_id": "qid-fresh",
        "summary": "alice mentioned an important goal",
        "importance": 0.9,
        "strength": 1.0,
        "created_at": fresh_ts,
        "last_recalled_at": fresh_ts,
    }).execute()

    asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    rows = [r for r in repo.by_user("u1") if r["qdrant_id"] == "qid-fresh"]
    assert rows[0].get("archived_at") in (None,)
    assert rows[0]["strength"] >= 0.95


def test_reflection_stage_runs_when_episodes_exist():
    worker, sb, repo = _make_worker()
    report = asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    assert report.n_reflections == 1


def test_reflection_returns_zero_when_no_episodes():
    sb = InMemorySupabase()
    qd = InMemoryQdrant()
    repo = EpisodicRepo(sb)
    episodic = EpisodicService(sb=sb, qdrant=qd, embed_fn=_stub_embed_factory())

    async def extract(*_):
        return []

    async def reflect(_uid, eps):
        return [{"x": 1}] if eps else []

    worker = ConsolidationWorker(
        episodic=episodic, episodic_repo=repo,
        extract_fn=extract, reflect_fn=reflect,
    )
    report = asyncio.run(worker.run_once_for_user("u1", session_id="s1"))
    assert report.n_reflections == 0
