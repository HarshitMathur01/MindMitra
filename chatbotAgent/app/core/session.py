"""SessionObject — exact shape of the Redis-backed per-session state.

Schema mirrors the spec (Task 0.1 in ``html-to-markdown.md``). The dataclass
is the *only* place that knows how to (de)serialise itself; every other layer
reads/writes through the helpers in :mod:`app.services.session_service`.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .logging import get_logger, log_context

logger = get_logger(__name__)

REQUIRED_SESSION_FIELDS: Dict[str, type | tuple[type, ...]] = {
    "session_id": str,
    "user_id": str,
    "started_at": str,
    "last_activity": str,
    "status": str,
    "turn_count": int,
    "current_mode": str,
    "mode_history": list,
    "affect_history": list,
    "urgency_history": list,
    "turns": list,
    "language_register": str,
    "code_mix_ratio": (int, float),
    "dependency_signals": dict,
    "cultural_frame_id": str,
    "longitudinal_risk_flag": bool,
    "session_peak_urgency": int,
    "llm_tokens_used": int,
    "semantic_profile": dict,
    "procedural_profile": dict,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AffectSnapshot:
    turn: int
    valence: float
    arousal: float
    dominance: float
    urgency: int


@dataclass
class ModeHistoryEntry:
    mode: str
    turn_number: int
    reason: str


@dataclass
class TurnRecord:
    role: str  # "user" | "assistant"
    content: str
    timestamp: str
    source: Optional[str] = None
    safety_flags: Optional[Dict[str, Any]] = None
    urgency: Optional[int] = None
    mode: Optional[str] = None


@dataclass
class SessionObject:
    """Full per-session state held in Redis under ``session:{user_id}:{session_id}``."""

    session_id: str
    user_id: str
    started_at: str = field(default_factory=_now_iso)
    last_activity: str = field(default_factory=_now_iso)
    status: str = "active"  # "active" | "ended"
    turn_count: int = 0
    current_mode: str = "companion"
    mode_history: List[Dict[str, Any]] = field(default_factory=list)
    affect_history: List[Dict[str, Any]] = field(default_factory=list)
    urgency_history: List[int] = field(default_factory=list)
    turns: List[Dict[str, Any]] = field(default_factory=list)
    language_register: str = "casual"
    code_mix_ratio: float = 0.5
    dependency_signals: Dict[str, int] = field(
        default_factory=lambda: {"sessions_this_week": 0, "social_mentions_count": 0}
    )
    cultural_frame_id: str = "metro_social"
    longitudinal_risk_flag: bool = False
    session_peak_urgency: int = 0
    llm_tokens_used: int = 0
    # ── flags carried for fast access without re-querying Supabase ───────
    is_new_session: bool = True
    total_sessions_at_start: int = 0
    previous_session_peak_urgency: int = 0
    current_topic_keywords: List[str] = field(default_factory=list)
    # ── caches populated at session start ───────────────────────────────
    semantic_profile: Dict[str, Any] = field(default_factory=dict)
    procedural_profile: Dict[str, Any] = field(default_factory=dict)
    # ── activity suggestion state (cooldown + recently-shown rail) ──────
    last_suggestion_turn: int = -10
    last_suggestion_id: Optional[str] = None
    suggestion_history: List[Dict[str, Any]] = field(default_factory=list)

    # ── (de)serialisation ───────────────────────────────────────────────
    def to_json(self) -> str:
        return json.dumps(asdict(self), default=str, ensure_ascii=False)

    @classmethod
    def from_json(cls, payload: str) -> "SessionObject":
        data = json.loads(payload)
        validate_session_payload(data)
        return cls(**data)

    def integrity_check(self) -> bool:
        return validate_session_payload(asdict(self), session_id=self.session_id, user_id=self.user_id)

    # ── helpers used across layers ──────────────────────────────────────
    def touch(self) -> None:
        self.last_activity = _now_iso()

    def append_turn(self, turn: Dict[str, Any]) -> None:
        self.turns.append(turn)
        self.turn_count = sum(1 for t in self.turns if t.get("role") == "user")

    def append_affect(self, snapshot: Dict[str, Any]) -> None:
        self.affect_history.append(snapshot)
        urgency = int(snapshot.get("urgency", 0))
        self.urgency_history.append(urgency)
        if len(self.urgency_history) > 10:
            self.urgency_history.pop(0)
        if urgency > self.session_peak_urgency:
            self.session_peak_urgency = urgency

    def set_mode(self, mode: str, reason: str) -> None:
        if mode != self.current_mode:
            self.mode_history.append(
                {"mode": mode, "turn_number": self.turn_count, "reason": reason}
            )
        self.current_mode = mode

    def recent_turns(self, n: int = 8) -> List[Dict[str, Any]]:
        return self.turns[-n:]

    def recent_user_messages(self, n: int = 6) -> List[str]:
        users = [t for t in self.turns if t.get("role") == "user"]
        return [t.get("content", "") for t in users[-n:]]

    def recent_affect(self, n: int = 5) -> List[Dict[str, Any]]:
        return self.affect_history[-n:]


# ── Redis key helpers ─────────────────────────────────────────────────────
def session_key(user_id: str, session_id: str) -> str:
    return f"session:{user_id}:{session_id}"


def active_session_key(user_id: str) -> str:
    return f"active_session:{user_id}"


def session_lock_key(session_id: str) -> str:
    return f"lock:session_end:{session_id}"


def embedding_cache_key(sha16: str) -> str:
    return f"emb:{sha16}"


def validate_session_payload(
    data: Dict[str, Any],
    *,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> bool:
    """Validate the minimum Redis session shape before using it."""
    ok = True
    for field_name, expected_type in REQUIRED_SESSION_FIELDS.items():
        if field_name not in data:
            logger.warning(
                "session integrity missing field",
                extra=log_context(session_id=session_id or data.get("session_id"), user_id=user_id or data.get("user_id"), field=field_name),
            )
            ok = False
            continue
        if not isinstance(data[field_name], expected_type):
            logger.warning(
                "session integrity type mismatch",
                extra=log_context(
                    session_id=session_id or data.get("session_id"),
                    user_id=user_id or data.get("user_id"),
                    field=field_name,
                    expected=getattr(expected_type, "__name__", str(expected_type)),
                    actual=type(data[field_name]).__name__,
                ),
            )
            ok = False
    if data.get("status") not in ("active", "ended"):
        logger.warning(
            "session integrity invalid status",
            extra=log_context(session_id=session_id or data.get("session_id"), user_id=user_id or data.get("user_id"), status=data.get("status")),
        )
        ok = False
    return ok
