"""Session lifecycle: extraction intervals, session end, narrative cadence."""

from __future__ import annotations

import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from app.core.session_lifecycle import SessionLifecycle


@pytest.fixture
def immediate_thread(monkeypatch):
    """Run daemon targets synchronously in tests."""

    class ImmediateThread(threading.Thread):
        def start(self):
            if self._target:
                self._target(*self._args, **self._kwargs or {})

    monkeypatch.setattr("app.core.session_lifecycle.threading.Thread", ImmediateThread)


def test_on_message_triggers_extraction_at_interval(immediate_thread):
    mm = MagicMock()
    mm.store.add_structured = MagicMock()
    mm.add_memories = MagicMock()
    life = SessionLifecycle(mm)
    msgs = [{"role": "user", "content": str(i)} for i in range(12)]
    life.on_message(msgs, "user-1", "sess-1", 12, None)
    mm.store.add_structured.assert_called_once()
    args, _ = mm.store.add_structured.call_args
    assert len(args[0]) <= 12
    mm.add_memories.assert_not_called()


def test_on_message_no_trigger_before_interval(immediate_thread):
    mm = MagicMock()
    life = SessionLifecycle(mm)
    msgs = [{"role": "user", "content": "x"}] * 11
    life.on_message(msgs, "user-1", "sess-1", 11, None)
    mm.store.add_structured.assert_not_called()
    mm.add_memories.assert_not_called()


def test_on_session_end_calls_summary(immediate_thread):
    mm = MagicMock()
    mm.store.memory_crud = MagicMock()
    mm.store.add_structured = MagicMock()
    mm.reflection.generate_session_summary = MagicMock(return_value=True)
    life = SessionLifecycle(mm)
    with patch.object(life, "_increment_profile_session_count", return_value=3):
        life.on_session_end([{"role": "user", "content": "hi"}], "user-1", "sess-1")
    mm.reflection.generate_session_summary.assert_called_once()


def test_on_session_end_updates_registry(immediate_thread):
    crud = MagicMock()
    mm = MagicMock()
    mm.store.memory_crud = crud
    mm.store.add_structured = MagicMock()
    mm.reflection.generate_session_summary = MagicMock(return_value=True)
    life = SessionLifecycle(mm)
    with patch.object(life, "_increment_profile_session_count", return_value=1):
        life.on_session_end([{"role": "user", "content": "a"}], "u", "s1")
    crud.update_session_end.assert_called_once_with("s1", summary_written=True)


def test_narrative_triggered_at_10_sessions(immediate_thread):
    mm = MagicMock()
    mm.store.memory_crud = MagicMock()
    mm.store.add_structured = MagicMock()
    mm.reflection.generate_session_summary = MagicMock(return_value=True)
    mm.reflection.update_user_narrative = MagicMock()
    life = SessionLifecycle(mm)
    with patch.object(life, "_increment_profile_session_count", return_value=10):
        life.on_session_end([{"role": "user", "content": "x"}], "u", "s")
    mm.reflection.update_user_narrative.assert_called_once_with("u")


def test_narrative_not_triggered_at_9_sessions(immediate_thread):
    mm = MagicMock()
    mm.store.memory_crud = MagicMock()
    mm.store.add_structured = MagicMock()
    mm.reflection.generate_session_summary = MagicMock(return_value=True)
    mm.reflection.update_user_narrative = MagicMock()
    life = SessionLifecycle(mm)
    with patch.object(life, "_increment_profile_session_count", return_value=9):
        life.on_session_end([{"role": "user", "content": "x"}], "u", "s")
    mm.reflection.update_user_narrative.assert_not_called()


def test_on_session_start_parallel_fetch(monkeypatch):
    delays = {"p": 0.0, "m": 0.0}

    def slow_profile(_uid):
        time.sleep(delays["p"])
        return {"session_count": 1}

    def slow_mem(*_a, **_k):
        time.sleep(delays["m"])
        return "ctx"

    mm = MagicMock()
    mm.get_user_profile = MagicMock(side_effect=slow_profile)
    mm.retrieve_memories = MagicMock(side_effect=slow_mem)
    mm.set_session_memory_snapshot = MagicMock()
    delays["p"] = delays["m"] = 0.05
    mm.store.memory_crud = MagicMock()
    life = SessionLifecycle(mm)
    t0 = time.monotonic()
    life.on_session_start("user-1", "sess-x")
    elapsed = time.monotonic() - t0
    mm.get_user_profile.assert_called_once()
    mm.retrieve_memories.assert_called_once()
    assert elapsed < 2.0
    mm.set_session_memory_snapshot.assert_called_once()


def test_extraction_failure_does_not_crash(immediate_thread):
    mm = MagicMock()

    def boom(*_a, **_k):
        raise RuntimeError("extract fail")

    mm.store.add_structured = boom
    mm.add_memories = MagicMock()
    life = SessionLifecycle(mm)
    msgs = [{"role": "user", "content": str(i)} for i in range(12)]
    life.on_message(msgs, "user-1", "sess-1", 12, None)
