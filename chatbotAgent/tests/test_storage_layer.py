import re
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.core.decay_engine import DecayEngine
from app.core.memory_crud import MemoryCRUD
from app.core.memory_pipeline_types import MemoryCandidate


@pytest.fixture
def sample_candidate() -> MemoryCandidate:
    return MemoryCandidate(
        type="semantic",
        content="User enjoys hiking.",
        verbatim_anchor="I love hiking",
        confidence=0.88,
        emotional_valence=0.5,
        emotional_intensity=0.3,
        tags=["hobby"],
        is_sensitive=False,
        language="en",
    )


@patch("app.core.memory_crud.get_embedding_service")
def test_crud_insert_writes_to_both(mock_get_svc, sample_candidate):
    mock_get_svc.return_value.embed.return_value = [0.01] * 1024
    qclient = MagicMock()
    sb = MagicMock()
    sb.table.return_value.insert.return_value = MagicMock()

    crud = MemoryCRUD(qclient, sb)
    mid = crud.insert(sample_candidate, "user-uuid", "session-uuid")

    assert len(mid) == 36
    qclient.upsert.assert_called_once()
    sb.table.assert_any_call("memory_metadata")
    assert sb.table.return_value.insert.called


def test_crud_reinforce_increments_count():
    qclient = MagicMock()
    point = MagicMock()
    point.payload = {"access_count": 3, "data": "x"}
    qclient.retrieve.return_value = [point]

    sb = MagicMock()
    sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"access_count": 3}
    ]

    crud = MemoryCRUD(qclient, sb)
    crud.reinforce("mem-point-1")

    qclient.set_payload.assert_called_once()
    args, kwargs = qclient.set_payload.call_args
    assert kwargs["payload"]["access_count"] == 4
    sb.table.return_value.update.assert_called()


def test_crud_soft_delete_sets_inactive():
    qclient = MagicMock()
    point = MagicMock()
    point.payload = {"access_count": 1, "is_active": True}
    qclient.retrieve.return_value = [point]

    sb = MagicMock()
    meta = MagicMock()
    meta.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"notes": ""}]
    upd_chain = MagicMock()
    upd_chain.eq.return_value.execute.return_value = MagicMock()
    meta.update.return_value = upd_chain
    sb.table.return_value = meta

    crud = MemoryCRUD(qclient, sb)
    crud.soft_delete("mid-1", "user_requested")

    pl = qclient.set_payload.call_args.kwargs["payload"]
    assert pl["is_active"] is False
    qclient.delete.assert_not_called()
    assert meta.update.called
    kw = meta.update.call_args[0][0]
    assert kw["is_active"] is False


def test_decay_episodic_decays_faster_than_semantic():
    base = {
        "created_at": "2025-01-01T00:00:00+00:00",
        "last_accessed_at": "2025-06-01T00:00:00+00:00",
        "access_count": 2,
        "confidence": 0.8,
    }
    epi = {**base, "pipeline_memory_type": "episodic"}
    sem = {**base, "pipeline_memory_type": "semantic"}
    assert DecayEngine.compute_decay_score(epi) < DecayEngine.compute_decay_score(sem)


def test_decay_archives_below_threshold():
    crud = MagicMock()
    crud.get_user_memories.return_value = [
        {
            "mem0_id": "m-old",
            "created_at": "1999-01-01T00:00:00+00:00",
            "last_accessed_at": "1999-01-02T00:00:00+00:00",
            "access_count": 1,
            "confidence": 0.02,
            "pipeline_memory_type": "episodic",
        }
    ]
    out = DecayEngine.run_decay_pass("user-1", crud)
    # Extremely low decay scores should soft-delete under the two-tier policy.
    assert out["soft_deleted"] >= 1
    crud.soft_delete.assert_called_with("m-old", "decay_soft_delete")


def test_decay_formula_bounds():
    for t in ("episodic", "semantic", "procedural", "relational", "affective", "crisis", "reflection"):
        s = DecayEngine.compute_decay_score(
            {
                "created_at": "2020-01-01T00:00:00+00:00",
                "last_accessed_at": "2030-01-01T00:00:00+00:00",
                "access_count": 100,
                "confidence": 1.0,
                "pipeline_memory_type": t,
            }
        )
        assert 0.0 <= s <= 1.0


def test_migration_sql_is_additive():
    root = Path(__file__).resolve().parents[2]
    sql_path = root / "supabase" / "migrations" / "20260409140000_memory_architecture_v2.sql"
    text = sql_path.read_text()
    assert not re.search(r"\bDROP\s+TABLE\b", text, re.IGNORECASE)
    assert not re.search(r"\bDROP\s+COLUMN\b", text, re.IGNORECASE)
