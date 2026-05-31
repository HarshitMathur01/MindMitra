"""Graceful degradation utilities.

The v3 spec lists 5 failure modes that must each have a hand-built path. This
module centralises:

  * ``select_static_fallback`` — deterministic per-session random index over
    the static_fallback_templates table.
  * ``social_mentions_in_message`` — increments session.dependency_signals
    during signal extraction.
  * ``empty_session_defaults`` — used by session_startup when Supabase is
    unreachable.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Optional

from .session import SessionObject
from ..services import profile_service

logger = logging.getLogger(__name__)


# ── Static fallback selection ────────────────────────────────────────────
def template_index(session_id: str, turn_count: int) -> int:
    seed = f"{session_id}:{turn_count}".encode("utf-8")
    return int(hashlib.sha256(seed).hexdigest(), 16) % 6


# Map a user-selected response language to an available static-fallback
# variant. Static templates exist only for English and the two Hinglish
# registers (no pure-Hindi variant), so Hindi maps to the most Hindi-heavy
# register available and languages without a dedicated template fall back to
# English. This path only runs after the LLM has already failed.
_FALLBACK_VARIANT_BY_LANGUAGE = {
    "english": "en",
    "hindi": "hinglish_casual",
    "tamil": "en",
    "telugu": "en",
    "kannada": "en",
    "japanese": "en",
}


async def select_static_fallback(
    *,
    session_id: str,
    turn_count: int,
    mode: str,
    code_mix_ratio: float,
    response_language: Optional[str] = None,
) -> str:
    variant = _FALLBACK_VARIANT_BY_LANGUAGE.get((response_language or "").strip().lower())
    if variant is None:
        # Hinglish / None / unknown → historical code-mix-driven selection.
        variant = "en"
        if code_mix_ratio >= 0.5:
            variant = "hinglish_casual"
        elif code_mix_ratio >= 0.2:
            variant = "hinglish_formal"

    idx = template_index(session_id, turn_count)
    content = await profile_service.fetch_static_fallback(mode, variant, idx)
    if content:
        return content

    # Walk variants and indexes as a last-ditch effort
    for fallback_variant in (variant, "en", "hinglish_casual"):
        for fallback_idx in (idx, (idx + 1) % 6, (idx + 2) % 6):
            content = await profile_service.fetch_static_fallback(mode, fallback_variant, fallback_idx)
            if content:
                return content

    return (
        "I'm here. Whatever's going on — I'm listening."
    )


# ── Social mention detection (used during signal extraction or post-turn)
_PERSON_KEYWORDS = (
    "mom", "dad", "papa", "mummy", "mother", "father", "bhaiya", "didi", "behen",
    "friend", "yaar", "dost", "girlfriend", "boyfriend", "partner", "wife",
    "husband", "fiance", "sister", "brother", "cousin", "uncle", "aunty",
    "colleague", "teammate", "manager", "boss", "roommate", "flatmate",
    "classmate", "neighbour", "neighbor",
)


def social_mentions_in_message(text: str) -> int:
    if not text:
        return 0
    t = text.lower()
    return sum(1 for kw in _PERSON_KEYWORDS if re.search(rf"\b{re.escape(kw)}\b", t))


def update_dependency_signals(session: SessionObject, user_message: str) -> None:
    mentions = social_mentions_in_message(user_message)
    sigs = dict(session.dependency_signals or {})
    sigs["social_mentions_count"] = int(sigs.get("social_mentions_count", 0) or 0) + mentions
    sigs["sessions_this_week"] = int(sigs.get("sessions_this_week", 0) or 0)
    session.dependency_signals = sigs

