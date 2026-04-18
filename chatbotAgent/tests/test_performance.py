"""Lightweight timing smoke tests (stdlib `time` only)."""

from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

from app.core.context_composer import ContextComposer, pipeline_intent_to_compose_intent
from app.core.signal_classifier import SignalClassifier


def test_retrieval_under_250ms():
    from app.agents.memory_retriever import MemoryRetriever

    store = MagicMock()
    store._ready = True
    store._qdrant_client = MagicMock()
    store._collection = "companion_memories"
    store.memory_crud = MagicMock()
    r = MemoryRetriever(store)

    canned = [
        {
            "id": str(i),
            "mem0_id": str(i),
            "type": "semantic",
            "memory_type": "semantic",
            "memory": f"memory {i}",
            "is_sensitive": False,
            "emotional_valence": 0.0,
            "emotional_intensity": 0.1,
        }
        for i in range(5)
    ]

    with patch.object(r, "_memoir_collect_top_memories", return_value=canned):
        t0 = time.perf_counter()
        r.fetch_memory_records("short query", "u-perf", "emotional", session_id="s1")
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert elapsed_ms < 250.0


def test_compose_under_10ms():
    memories = [
        {
            "id": str(i),
            "type": "semantic",
            "memory": f"Stable fact number {i} about preferences and routines.",
        }
        for i in range(7)
    ]
    prof = {"session_count": 3, "narrative_paragraph": None}
    t0 = time.perf_counter()
    for _ in range(25):
        ContextComposer().compose(
            memories,
            prof,
            3,
            pipeline_intent_to_compose_intent("emotional"),
        )
    elapsed_ms = (time.perf_counter() - t0) / 25 * 1000.0
    assert elapsed_ms < 10.0


def test_signal_classifier_under_5ms():
    msg = "x" * 500
    sc = SignalClassifier()
    t0 = time.perf_counter()
    for _ in range(50):
        sc.classify([{"role": "user", "content": msg}], "u")
    elapsed_ms = (time.perf_counter() - t0) / 50 * 1000.0
    assert elapsed_ms < 5.0
