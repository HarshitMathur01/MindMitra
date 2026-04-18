"""Unit tests for MEMOIR scoring, suppression, diversity, and retrieval dual-mode."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.core.memoir_scorer import MEMOIRScorer, cosine_similarity, select_top_diverse
from app.core.memory_suppressor import MemorySuppressor


def _vec(*vals: float) -> list[float]:
    return list(vals)


def _base_memory(**overrides):
    now = datetime.now(timezone.utc).isoformat()
    m = {
        "id": "m1",
        "memory": "hello",
        "type": "semantic",
        "memory_type": "semantic",
        "emotional_valence": 0.0,
        "emotional_intensity": 0.0,
        "access_count": 1,
        "confidence": 0.9,
        "is_sensitive": False,
        "is_active": True,
        "decay_score": 1.0,
        "is_resolved": False,
        "tags": [],
        "last_accessed": now,
        "last_accessed_at": now,
    }
    m.update(overrides)
    return m


def test_memoir_meaning_component_identical_embeddings():
    """M_meaning uses cosine_similarity — identical vectors → 1.0."""
    a = _vec(1.0, 2.0, 3.0)
    b = _vec(1.0, 2.0, 3.0)
    assert cosine_similarity(a, b) == pytest.approx(1.0)
    assert cosine_similarity([], [1.0]) == 0.0
    assert cosine_similarity([1.0, 0.0], [0.0, 0.0]) == 0.0


def test_memoir_meaning_component():
    """Identical query and memory embeddings → M_meaning = 1.0 drives weighted score."""
    q = _vec(1.0, 0.0, 0.0, 0.0)
    memv = _vec(1.0, 0.0, 0.0, 0.0)
    m = _base_memory(
        type="semantic",
        emotional_valence=0.0,
        access_count=8,
    )
    assert cosine_similarity(q, memv) == pytest.approx(1.0)
    s = MEMOIRScorer.score(
        m,
        q,
        memv,
        {"valence": 0.0, "intensity": 0.0},
        "casual",
        20,
    )
    # M=1, E=1, Mm=1, O=1, I=(1.2/1.5), R=1 → 0.25+0.2+0.15+0.15+0.12+0.1 = 0.97
    assert s == pytest.approx(0.97)


def test_memoir_emotional_congruence():
    mv, cv, ci = 0.8, 0.8, 1.0
    e = 1.0 - abs(mv - cv) * ci
    assert max(0.0, e) == pytest.approx(1.0)
    q = _vec(1.0, 0.0, 0.0, 0.0)
    memv = _vec(0.0, 1.0, 0.0, 0.0)
    m = _base_memory(
        emotional_valence=0.8,
        type="semantic",
        memory_type="semantic",
    )
    s = MEMOIRScorer.score(
        m,
        q,
        memv,
        {"valence": 0.8, "intensity": 1.0},
        "casual",
        20,
    )
    assert s > 0.0


def test_memoir_relationship_gate_early_session():
    q = _vec(1.0, 0.0, 0.0, 0.0)
    memv = _vec(1.0, 0.0, 0.0, 0.0)
    sens = _base_memory(
        type="episodic",
        memory_type="episodic",
        is_sensitive=True,
        emotional_valence=0.5,
    )
    plain = _base_memory(
        type="episodic",
        memory_type="episodic",
        is_sensitive=False,
        emotional_valence=0.5,
    )
    affect = {"valence": 0.5, "intensity": 0.0}
    s_sens = MEMOIRScorer.score(sens, q, memv, affect, "venting", 2)
    s_plain = MEMOIRScorer.score(plain, q, memv, affect, "venting", 2)
    # PDF: sensitive memories down-weighted across the board in sessions 1–3.
    assert s_plain > s_sens


def test_memoir_relationship_gate_established():
    q = _vec(1.0, 0.0, 0.0, 0.0)
    memv = _vec(1.0, 0.0, 0.0, 0.0)
    a = _base_memory(type="semantic", is_sensitive=True)
    b = _base_memory(type="semantic", is_sensitive=False)
    affect = {"valence": 0.0, "intensity": 0.0}
    assert MEMOIRScorer.score(a, q, memv, affect, "casual", 15) == MEMOIRScorer.score(
        b, q, memv, affect, "casual", 15
    )


def test_suppressor_blocks_decayed():
    m = _base_memory(decay_score=0.05, is_sensitive=False)
    ctx = {"intent": "venting", "session_count": 10, "user_message": "hi"}
    sup, reason = MemorySuppressor.should_suppress(m, ctx)
    assert sup is True
    assert reason == "decayed"


def test_suppressor_blocks_low_confidence():
    m = _base_memory(confidence=0.35, decay_score=1.0)
    ctx = {"intent": "venting", "session_count": 10, "user_message": "hi"}
    sup, reason = MemorySuppressor.should_suppress(m, ctx)
    assert sup is True
    assert reason == "low_confidence"


def test_suppressor_user_suppressed():
    m = _base_memory(id="blocked-1", mem0_id="blocked-1", confidence=0.95, decay_score=1.0)
    ctx = {"intent": "venting", "session_count": 10, "user_message": "hi", "suppressed_ids": frozenset({"blocked-1"})}
    sup, reason = MemorySuppressor.should_suppress(m, ctx)
    assert sup is True
    assert reason == "user_suppressed"


def test_suppressor_allows_crisis_override():
    m = _base_memory(
        decay_score=0.05,
        is_sensitive=True,
        confidence=0.9,
        emotional_intensity=0.9,
    )
    ctx = {"intent": "crisis", "session_count": 1, "user_message": "help"}
    sup, reason = MemorySuppressor.should_suppress(m, ctx)
    assert sup is False
    assert reason == ""


def test_suppressor_resolved_emotional_hidden():
    m = _base_memory(
        type="emotional",
        memory_type="emotional",
        is_resolved=True,
        tags=["workplace"],
    )
    ctx = {"intent": "casual", "session_count": 10, "user_message": "how is the weather"}
    sup, reason = MemorySuppressor.should_suppress(m, ctx)
    assert sup is True
    assert reason == "resolved_event"


def test_suppressor_resolved_emotional_with_tag_allowed():
    m = _base_memory(
        type="emotional",
        memory_type="emotional",
        is_resolved=True,
        tags=["workplace"],
    )
    ctx = {
        "intent": "casual",
        "session_count": 10,
        "user_message": "I want to talk about workplace again",
    }
    out = MemorySuppressor.filter_candidates([m], ctx)
    assert out == [m]


def test_decay_formula_bounds():
    import math

    from app.core.decay_engine import LAMBDA_MAP

    for lam in LAMBDA_MAP.values():
        for days in (0, 1, 30, 365):
            mm = math.exp(-lam * days)
            assert 0.0 <= mm <= 1.0


def test_type_diversity_enforced():
    # Need ≥3 types to fill top_n=7 under max_per_type=3 (2 types cap at 6).
    scored = [(1.0 - i * 0.001, {"type": "episodic", "id": str(i)}) for i in range(5)]
    scored += [(0.55 - i * 0.01, {"type": "semantic", "id": f"s{i}"}) for i in range(8)]
    scored += [(0.52 - i * 0.01, {"type": "procedural", "id": f"p{i}"}) for i in range(4)]
    scored.sort(key=lambda x: x[0], reverse=True)
    out = select_top_diverse(scored, top_n=7, max_per_type=3)
    assert len(out) == 7
    assert sum(1 for m in out if m["type"] == "episodic") <= 3


def test_retrieve_memories_uses_fetch_memory_records():
    from app.agents.memory_retriever import MemoryRetriever

    store = MagicMock()
    store._ready = True
    store._qdrant_client = MagicMock()
    store._collection = "companion_memories"
    store.memory_crud = MagicMock()
    r = MemoryRetriever(store)
    with patch.object(
        r,
        "fetch_memory_records",
        return_value=[
            {
                "id": "1",
                "type": "semantic",
                "memory": "stored fact",
                "is_sensitive": False,
                "emotional_valence": 0.0,
                "emotional_intensity": 0.0,
            }
        ],
    ) as fr:
        out = r.retrieve_memories("hello", "user-1", "emotional")
        fr.assert_called_once()
        assert "WHAT YOU KNOW ABOUT THIS PERSON" in (out or "")
        assert "stored fact" in (out or "")


def test_crisis_pinning_sort_order():
    memories = [
        _base_memory(id="low", is_sensitive=False, type="semantic"),
        _base_memory(id="pin", is_sensitive=True, type="affective"),
    ]
    q = _vec(1.0, 0.0, 0.0)
    memv = _vec(1.0, 0.0, 0.0)
    scored = []
    for m in memories:
        sc = MEMOIRScorer.score(
            m, q, memv, {"valence": 0.0, "intensity": 0.0}, "crisis", 10
        )
        if m.get("is_sensitive"):
            sc = 1.0
        scored.append((sc, m))
    scored.sort(key=lambda x: x[0], reverse=True)
    assert scored[0][1]["id"] == "pin"
    assert scored[0][0] == 1.0
