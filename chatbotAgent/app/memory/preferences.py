"""
Procedural memory — interaction preferences ("how the user wants to be talked to").

Distinct from the intervention-outcome ledger in `procedural.py` (which tracks
*what helps them*); this module tracks *how they want us to communicate*:

    - tone              : warm | playful | matter-of-fact | calm-coach
    - prefers_listening : True if user explicitly says "I just want to vent"
    - callback_comfort  : 0..1 — how much they like the bot referencing past
    - language_register : 'en' | 'hi' | 'hinglish'
    - response_length   : 'short' | 'medium' | 'long'

Stored as a tiny per-user JSON row. Updated in three ways:
    1. user can set via Memory Mirror UI (PUT /me/memory/preferences)
    2. extractor flags strong signals ("don't fix me", "I just need to vent")
    3. defaults are derived from the identity card's `code_mix_register`

Always loaded into context — it's tiny.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .repositories import SupabaseLike, _BaseRepo

logger = logging.getLogger(__name__)


_ALLOWED_TONES = {"warm", "playful", "matter_of_fact", "calm_coach"}
_ALLOWED_REGISTERS = {"en", "hi", "hinglish", "auto"}
_ALLOWED_LENGTHS = {"short", "medium", "long", "auto"}


@dataclass
class UserPreferences:
    user_id: str
    tone: str = "warm"
    prefers_listening: bool = False     # True => bias toward VALIDATE/REFLECT
    callback_comfort: float = 0.6       # 0..1; lower => fewer explicit "I remember…"
    language_register: str = "auto"
    response_length: str = "auto"
    notes: str = ""
    incognito_until: Optional[str] = None  # ISO ts; while > now() we suspend memory writes
    updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "tone": self.tone,
            "prefers_listening": self.prefers_listening,
            "callback_comfort": float(self.callback_comfort),
            "language_register": self.language_register,
            "response_length": self.response_length,
            "notes": self.notes,
            "incognito_until": self.incognito_until,
            "updated_at": self.updated_at,
        }

    def is_incognito_now(self) -> bool:
        if not self.incognito_until:
            return False
        try:
            ts = datetime.fromisoformat(self.incognito_until.replace("Z", "+00:00"))
            return ts > datetime.now(timezone.utc)
        except (ValueError, TypeError):
            return False

    def render_for_prompt(self) -> str:
        """Compact, prompt-injectable summary."""
        parts = [f"Tone: {self.tone}"]
        if self.prefers_listening:
            parts.append("They have asked us to listen, not fix.")
        if self.callback_comfort < 0.4:
            parts.append("They prefer we do NOT reference past sessions explicitly.")
        if self.response_length == "short":
            parts.append("Keep replies short.")
        elif self.response_length == "long":
            parts.append("Longer reflections are welcome.")
        return " | ".join(parts)


class _PreferencesRepo(_BaseRepo):
    table_name = "mitra_user_preferences"

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        res = self.t.select("*").eq("user_id", user_id).limit(1).execute()
        return (res.data or [None])[0]

    def upsert(self, row: Dict[str, Any]) -> Dict[str, Any]:
        assert "user_id" in row
        return self.t.upsert(row, on_conflict="user_id").execute().data[0]


class PreferencesService:
    """Thin service over `_PreferencesRepo`. Defaults are returned when the
    row does not yet exist (we never block a turn on a missing preference)."""

    def __init__(self, client: SupabaseLike):
        self.repo = _PreferencesRepo(client)

    def load(self, user_id: str) -> UserPreferences:
        row = self.repo.get(user_id)
        if not row:
            return UserPreferences(user_id=user_id)
        return _row_to_prefs(row)

    def upsert_partial(self, user_id: str, patch: Dict[str, Any]) -> UserPreferences:
        cur = self.load(user_id).to_dict()
        for k, v in (patch or {}).items():
            if k == "tone" and v not in _ALLOWED_TONES:
                continue
            if k == "language_register" and v not in _ALLOWED_REGISTERS:
                continue
            if k == "response_length" and v not in _ALLOWED_LENGTHS:
                continue
            if k == "callback_comfort":
                try:
                    v = max(0.0, min(1.0, float(v)))
                except (TypeError, ValueError):
                    continue
            if k == "incognito_until":
                if v in (None, "", False):
                    cur[k] = None
                else:
                    cur[k] = str(v)
                continue
            if k in {"tone", "prefers_listening", "callback_comfort",
                     "language_register", "response_length", "notes"}:
                cur[k] = v
        cur["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.repo.upsert(cur)
        return _row_to_prefs(cur)


def _row_to_prefs(row: Dict[str, Any]) -> UserPreferences:
    return UserPreferences(
        user_id=row["user_id"],
        tone=row.get("tone") or "warm",
        prefers_listening=bool(row.get("prefers_listening")),
        callback_comfort=float(row.get("callback_comfort") or 0.6),
        language_register=row.get("language_register") or "auto",
        response_length=row.get("response_length") or "auto",
        notes=row.get("notes") or "",
        incognito_until=row.get("incognito_until"),
        updated_at=row.get("updated_at"),
    )
