"""Earned-intimacy read gate on memory_manager.retrieve_memories."""
from __future__ import annotations

from unittest.mock import MagicMock

from app.agents.memory_manager import MemoryManager


def test_retrieve_memories_early_session_skips_fetch():
    mm = MemoryManager.__new__(MemoryManager)
    mm.retriever = MagicMock()
    mm.get_user_profile = MagicMock(return_value={"session_count": 0, "trust_tier": 1})
    out = mm.retrieve_memories("hello", "user-1", session_message_count=1)
    assert out == ""
    mm.retriever.fetch_memory_records.assert_not_called()


def test_retrieve_memories_passes_arc_to_fetch_when_unblocked():
    mm = MemoryManager.__new__(MemoryManager)
    mm.retriever = MagicMock()
    mm.retriever.fetch_memory_records.return_value = []
    mm.get_user_profile = MagicMock(
        return_value={
            "session_count": 10,
            "trust_tier": 2,
            "language_preference": "en",
            "narrative_paragraph": None,
        }
    )
    from unittest.mock import patch

    with patch("app.core.context_composer.ContextComposer") as CC:
        CC.return_value.compose.return_value = ""
        mm.retrieve_memories(
            "hello",
            "user-1",
            session_message_count=4,
            cl_arc_trajectory="volatile",
        )
    mm.retriever.fetch_memory_records.assert_called_once()
    _, kwargs = mm.retriever.fetch_memory_records.call_args
    assert kwargs["arc_trajectory"] == "volatile"
    assert kwargs["session_message_count"] == 4
