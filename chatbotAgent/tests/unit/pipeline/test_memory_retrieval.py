"""Layer 4 memory retrieval contract tests."""
from __future__ import annotations

import pytest

from app.pipeline import memory_retrieval
from tests.factories import make_orchestrator, make_session


@pytest.mark.unit
@pytest.mark.asyncio
async def test_memory_gate_closed_skips_qdrant_but_keeps_semantic_facts(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_if_called(*_args, **_kwargs):
        raise AssertionError("Qdrant search must not run when memory gate is closed")

    monkeypatch.setattr(memory_retrieval, "_qdrant_search", fail_if_called)

    result = await memory_retrieval.retrieve_memory(
        user_id="user-test",
        embedding=[0.0] * 384,
        orchestrator=make_orchestrator(memory_gate=False),
        session=make_session(),
    )

    assert result.memory_retrieved is False
    assert result.episodic_memories == []
    assert "engineering student" in result.semantic_facts_injection
    assert "Priya" in result.semantic_facts_injection


@pytest.mark.unit
@pytest.mark.asyncio
async def test_memory_retrieval_filters_by_user_and_ranks_memories(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_qdrant_search(user_id: str, embedding: list[float], limit_candidates: int):
        captured.update(
            {"user_id": user_id, "embedding_len": len(embedding), "limit_candidates": limit_candidates}
        )
        return [
            (
                {
                    "summary_text": "They discussed exam pressure.",
                    "session_date": "2026-05-01T00:00:00+00:00",
                    "affect_mean": {"valence": -0.2, "arousal": 0.6},
                    "ending_affect": {"valence": -0.1, "arousal": 0.5},
                    "named_entities": ["Priya"],
                    "techniques_used": ["breathing"],
                },
                0.95,
            )
        ]

    monkeypatch.setattr(memory_retrieval, "_qdrant_search", fake_qdrant_search)

    result = await memory_retrieval.retrieve_memory(
        user_id="user-test",
        embedding=[0.1] * 384,
        orchestrator=make_orchestrator(memory_gate=True),
        session=make_session(),
    )

    assert captured == {"user_id": "user-test", "embedding_len": 384, "limit_candidates": 5}
    assert result.memory_retrieved is True
    assert result.retrieval_scores.episodic_count == 1
    assert result.episodic_memories[0].summary_text == "They discussed exam pressure."
    assert result.episodic_memories[0].harmonic_score > 0.9


@pytest.mark.unit
@pytest.mark.asyncio
async def test_qdrant_failure_degrades_to_semantic_only(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_search(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr(memory_retrieval, "_qdrant_search", failing_search)

    result = await memory_retrieval.retrieve_memory(
        user_id="user-test",
        embedding=[0.1] * 384,
        orchestrator=make_orchestrator(memory_gate=True),
        session=make_session(),
    )

    assert result.memory_retrieved is False
    assert result.episodic_memories == []
    assert result.semantic_facts_injection
