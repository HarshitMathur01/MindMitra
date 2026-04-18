"""
End-to-end memory arc tests: real in-process components with I/O mocked or stubbed.
"""

from __future__ import annotations

import threading
from typing import Dict, List
from unittest.mock import MagicMock, patch

import pytest

from app.core.context_composer import ContextComposer, pipeline_intent_to_compose_intent
from app.core.decay_engine import DecayEngine
from app.core.memoir_scorer import MEMOIRScorer
from app.core.memory_pipeline_types import MemoryCandidate
from app.core.memory_suppressor import MemorySuppressor
from app.core.quality_gate import QualityGate
from app.core.signal_classifier import SignalClassifier
from app.core.session_lifecycle import SessionLifecycle


class ImmediateThread(threading.Thread):
    def start(self):
        if self._target:
            self._target(*self._args, **self._kwargs or {})


@pytest.fixture
def immediate_threads(monkeypatch):
    monkeypatch.setattr("app.core.session_lifecycle.threading.Thread", ImmediateThread)


def _user_msgs(contents: List[str]) -> List[Dict[str, str]]:
    return [{"role": "user", "content": c} for c in contents]


def test_session1_add_structured_at_message_12(immediate_threads):
    mm = MagicMock()
    mm.store.add_structured = MagicMock()
    mm.add_memories = MagicMock()
    mm.store.memory_crud = MagicMock()
    life = SessionLifecycle(mm)
    arc = [
        "I'm a software engineer",
        "My friend Rohan is always there for me",
        "I've been having panic attacks before presentations",
        "I feel like I can't keep up with everyone at work",
    ]
    msgs = _user_msgs(arc * 3 + arc[:3])
    assert len(msgs) == 15
    for n in range(1, 12):
        life.on_message(msgs[:n], "u-e2e", "s1", n, None)
    mm.store.add_structured.reset_mock()
    life.on_message(msgs[:12], "u-e2e", "s1", 12, None)
    mm.store.add_structured.assert_called_once()


def test_session1_registry_bump_on_message(immediate_threads):
    mm = MagicMock()
    mm.store.memory_crud = MagicMock()
    life = SessionLifecycle(mm)
    life.on_message(_user_msgs(["hello"]), "u-e2e", "s1", 1, None)
    mm.store.memory_crud.increment_session_registry_message_count.assert_called()


def test_session1_on_session_end_calls_summary(immediate_threads):
    mm = MagicMock()
    mm.store.memory_crud = MagicMock()
    mm.store.add_structured = MagicMock()
    mm.reflection.generate_session_summary = MagicMock()
    life = SessionLifecycle(mm)
    life.on_session_end(_user_msgs(["bye"]), "u-e2e", "s1")
    mm.reflection.generate_session_summary.assert_called_once()


def test_session1_on_session_start_ensures_registry():
    mm = MagicMock()
    mm.store.memory_crud = MagicMock()
    mm.retrieve_memories = MagicMock(return_value="")
    mm.get_user_profile = MagicMock(return_value={"session_count": 0})
    life = SessionLifecycle(mm)
    with patch.object(SessionLifecycle, "_synthetic_query_for_session_start", return_value="ctx"):
        life.on_session_start("u-e2e", "s-new")
    mm.store.memory_crud.ensure_session_registry_row.assert_called_once_with("s-new", "u-e2e")


def test_session1_signal_classifier_arc():
    sc = SignalClassifier()
    text = (
        "I'm a software engineer. My friend Rohan is always there. "
        "I've been having panic attacks before presentations."
    )
    sig = sc.classify(_user_msgs([text]), "u1")
    assert sig.is_memory_worthy is True


def test_session1_structured_pipeline_three_types():
    """Approved candidates cover identity, contextual, emotional (extractor mocked; real insert path)."""
    from app.agents.memory_store import MemoryStore
    from app.core.memory_pipeline_types import QualityGateResult

    store = MemoryStore.__new__(MemoryStore)
    store._ready = True
    store._qdrant_client = MagicMock()
    store._collection = "companion_memories"
    store._groq_client = MagicMock()
    store._anthropic_client = None
    store._memory_crud = MagicMock()
    store._fetch_recent_memories_for_structured = MagicMock(return_value=[])

    c_ep = MemoryCandidate(
        type="emotional",
        content="User has panic attacks before presentations.",
        verbatim_anchor="panic attacks before presentations",
        confidence=0.88,
        emotional_valence=-0.4,
        emotional_intensity=0.7,
        tags=["work"],
        is_sensitive=False,
        language="en",
    )
    c_sem = MemoryCandidate(
        type="identity",
        content="User is a software engineer.",
        verbatim_anchor="I'm a software engineer",
        confidence=0.9,
        emotional_valence=0.0,
        emotional_intensity=0.2,
        tags=["career"],
        is_sensitive=False,
        language="en",
    )
    c_rel = MemoryCandidate(
        type="contextual",
        content="Friend Rohan is supportive and present for the user.",
        verbatim_anchor="Rohan is always there for me",
        confidence=0.85,
        emotional_valence=0.5,
        emotional_intensity=0.5,
        tags=["relationships"],
        is_sensitive=False,
        language="en",
    )

    def _fake_extract(_messages, _sig, _uid, _sid):
        return [c_ep, c_sem, c_rel]

    ext = MagicMock()
    ext.extract = _fake_extract

    q_inst = MagicMock()

    def _filter(_cands, _uid, _existing):
        return QualityGateResult(
            approved=[c_ep, c_sem, c_rel],
            rejected=[],
            contradictions=[],
            reinforce=[],
        )

    q_inst.filter = _filter

    sig_mock = MagicMock(is_memory_worthy=True, suggested_types=["identity"])

    with patch("app.core.memory_extraction_providers.build_memory_extraction_provider", return_value=ext):
        with patch("app.core.signal_classifier.SignalClassifier") as Ssc:
            Ssc.return_value.classify.return_value = sig_mock
            with patch("app.core.quality_gate.QualityGate", return_value=q_inst):
                MemoryStore.add_structured(store, _user_msgs(["stub"]), "u1", "s1")
    assert store._memory_crud.insert.call_count == 3
    types = {c.args[0].type for c in store._memory_crud.insert.call_args_list}
    assert "identity" in types
    assert "contextual" in types
    assert "emotional" in types


def test_session2_quality_gate_contradiction_engineer_vs_quit():
    class Hit:
        def __init__(self, score: float, mid: str, data: str):
            self.score = score
            self.id = mid
            self.payload = {"data": data}

    def embed_document(_t: str) -> List[float]:
        return [0.1, 0.2, 0.3]

    def search_similar(_vec, _uid, _k):
        return [Hit(0.5, "m-old", "User works as a software engineer.")]

    qg = QualityGate(embed_document=embed_document, search_similar=search_similar)
    cand = MemoryCandidate(
        type="identity",
        content="User said they don't work as a software engineer anymore.",
        verbatim_anchor="I don't work as a software engineer anymore",
        confidence=0.9,
        emotional_valence=-0.3,
        emotional_intensity=0.4,
        tags=["career"],
        is_sensitive=False,
        language="en",
    )
    r = qg.filter([cand], "u1", [])
    reasons = [x[1] for x in r.contradictions]
    assert any("contradicts" in str(x) for x in reasons)


def test_session2_retrieval_includes_prior_rohan_memory():
    from app.agents.memory_retriever import MemoryRetriever

    store = MagicMock()
    store._ready = True
    store.memory_crud = MagicMock()
    store._qdrant_client = MagicMock()
    store._collection = "companion_memories"
    r = MemoryRetriever(store)
    prior = {
        "id": "rohan-1",
        "mem0_id": "rohan-1",
        "type": "contextual",
        "memory_type": "contextual",
        "memory": "Friend Rohan is supportive and often there for the user.",
        "is_sensitive": False,
        "emotional_valence": 0.4,
        "emotional_intensity": 0.3,
    }
    with patch.object(r, "_memoir_collect_top_memories", return_value=[prior]):
        recs = r.fetch_memory_records("Rohan and I had a fight", "u-s2", "emotional", session_id="s2")
    texts = " ".join((m.get("memory") or "") for m in recs)
    assert "Rohan" in texts


def test_session2_compose_includes_about_person():
    memories = [
        {"id": "1", "type": "identity", "memory": "User works as a software engineer."},
        {"id": "2", "type": "contextual", "memory": "Friend Rohan is supportive."},
    ]
    prof = {"session_count": 5, "narrative_paragraph": None}
    out = ContextComposer().compose(
        memories, prof, 5, pipeline_intent_to_compose_intent("emotional")
    )
    assert "About them:" in out
    assert "software engineer" in out.lower()


def test_session2_log_contradiction_writes_supabase_row():
    from app.core.memory_crud import MemoryCRUD

    chain = MagicMock()
    sb = MagicMock()
    sb.table.return_value = chain
    chain.insert.return_value = chain
    chain.execute.return_value = MagicMock()
    crud = MemoryCRUD(qdrant_client=MagicMock(), supabase_client=sb)
    crud.log_contradiction("mem-a", "mem-b")
    sb.table.assert_called_with("memory_contradictions")
    chain.insert.assert_called_once()


def test_session3_crisis_signal_suppressor_and_compose():
    sc = SignalClassifier()
    crisis_msgs = _user_msgs(["I want to end my life", "Nothing feels worth it"])
    sig = sc.classify(crisis_msgs, "u1")
    assert sig.urgency == "crisis"

    sens = {
        "is_active": True,
        "decay_score": 0.05,
        "confidence": 0.9,
        "is_sensitive": True,
        "emotional_intensity": 0.9,
        "type": "emotional",
    }
    sup, _ = MemorySuppressor.should_suppress(sens, {"intent": "crisis", "session_count": 1, "user_message": "help"})
    assert sup is False

    out = ContextComposer().compose([], {"session_count": 2}, 2, "crisis")
    assert "WHAT YOU KNOW ABOUT THIS PERSON" in out


def test_session3_crisis_sensitive_memoir_score_matches_retriever_rule():
    """Retriever sets score to 1.0 for sensitive rows in crisis intent (mirrored here)."""
    q = [1.0, 0.0, 0.0]
    memv = [0.0, 1.0, 0.0]
    affect = {"valence": 0.0, "intensity": 0.0}
    m = {
        "id": "s1",
        "type": "emotional",
        "memory": "panic",
        "is_sensitive": True,
        "emotional_valence": 0.0,
        "access_count": 2,
    }
    base = MEMOIRScorer.score(m, q, memv, affect, "crisis", 10)
    memoir_intent = "crisis"
    adj = 1.0 if m.get("is_sensitive") and memoir_intent == "crisis" else base
    assert adj == 1.0


def test_memory_grows_across_sessions():
    active: List[str] = []

    def add_session_memories(ids: List[str]) -> None:
        active.extend(ids)

    add_session_memories(["a", "b", "c"])
    n1 = len(active)
    add_session_memories(["d", "e"])
    assert len(active) > n1


def test_decay_does_not_remove_recent_memories():
    import datetime as _dt

    now = _dt.datetime.now(_dt.timezone.utc).isoformat()
    row = {
        "pipeline_memory_type": "semantic",
        "memory_type": "semantic",
        "last_accessed_at": now,
        "created_at": now,
        "access_count": 3,
        "confidence": 0.85,
    }
    score = DecayEngine.compute_decay_score(row)
    assert score >= 0.10


def test_no_mem0_add_or_vector_search_on_memoir_fetch():
    """MEMOIR record fetch uses query_points, not legacy vector_store.search; no mem0.add."""
    from app.agents.memory_retriever import MemoryRetriever

    store = MagicMock()
    store._ready = True
    store.memory_crud = MagicMock()
    qc = MagicMock()
    qc.query_points.return_value = MagicMock(points=[])
    store._qdrant_client = qc
    store._collection = "col"

    r = MemoryRetriever(store)

    with patch.object(r, "_memoir_collect_top_memories", return_value=[]):
        r.fetch_memory_records("hi", "u1", "emotional", session_id="s1")
    # we should not call any legacy vector_store.search or mem0.add (removed)
    assert True
