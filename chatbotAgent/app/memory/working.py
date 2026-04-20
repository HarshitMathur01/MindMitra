"""
Working memory — per-session ephemeral buffer.

Holds the last N turns + active affective snapshot + per-turn classifier output.
NOT persisted; lives in process memory keyed by `(user_id, session_id)`.

Process restarts wipe it (acceptable: turns are persisted to chat_messages).
"""
from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from threading import RLock
from typing import Deque, Dict, List, Optional, Tuple


@dataclass
class Turn:
    role: str               # 'user' | 'assistant' | 'system'
    content: str
    ts: float = field(default_factory=time.time)
    affect: Optional[Dict] = None     # {label, vad}
    intent: Optional[str] = None


@dataclass
class WorkingState:
    user_id: str
    session_id: str
    turns: Deque[Turn] = field(default_factory=lambda: deque(maxlen=20))
    last_affect: Optional[Dict] = None
    started_at: float = field(default_factory=time.time)


class WorkingMemoryStore:
    """Thread-safe in-memory store with bounded per-session buffers."""

    def __init__(self, max_sessions: int = 10_000, max_turns_per_session: int = 20):
        self._lock = RLock()
        self._states: Dict[Tuple[str, str], WorkingState] = {}
        self._max_sessions = max_sessions
        self._max_turns = max_turns_per_session

    def _evict_if_needed(self) -> None:
        if len(self._states) <= self._max_sessions:
            return
        # Evict oldest by start time.
        oldest = sorted(self._states.items(), key=lambda kv: kv[1].started_at)[: max(1, len(self._states) - self._max_sessions)]
        for k, _ in oldest:
            self._states.pop(k, None)

    def get_or_create(self, user_id: str, session_id: str) -> WorkingState:
        key = (user_id, session_id)
        with self._lock:
            st = self._states.get(key)
            if st is None:
                st = WorkingState(user_id=user_id, session_id=session_id,
                                  turns=deque(maxlen=self._max_turns))
                self._states[key] = st
                self._evict_if_needed()
            return st

    def append_turn(self, user_id: str, session_id: str, turn: Turn) -> None:
        st = self.get_or_create(user_id, session_id)
        with self._lock:
            st.turns.append(turn)
            if turn.affect:
                st.last_affect = turn.affect

    def recent_turns(self, user_id: str, session_id: str, n: int = 10) -> List[Turn]:
        st = self.get_or_create(user_id, session_id)
        with self._lock:
            return list(st.turns)[-n:]

    def clear(self, user_id: str, session_id: str) -> None:
        with self._lock:
            self._states.pop((user_id, session_id), None)

    def __len__(self) -> int:
        return len(self._states)


# Default process-wide instance.
working_memory = WorkingMemoryStore()
