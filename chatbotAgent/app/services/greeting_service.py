"""
Greeting Service — time-aware, language-aware, memory-enhanced greeting pool.
"""
import json
import logging
import os
import random
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from ..services.supabase_service import fetch_previous_session_summary

logger = logging.getLogger(__name__)

# greeting_pool.json lives at chatbotAgent/ root (two levels above this file)
_POOL_PATH = Path(__file__).parent.parent.parent / "greeting_pool.json"

_greeting_pool: Optional[Dict[str, Any]] = None
_greeting_cache: Dict[str, Dict[str, Any]] = {}  # cache_key → greeting dict


# ── helpers ────────────────────────────────────────────────────────────────
def _load_greeting_pool() -> Dict[str, Any]:
    global _greeting_pool
    if _greeting_pool is None:
        try:
            with open(_POOL_PATH, "r", encoding="utf-8") as fh:
                _greeting_pool = json.load(fh)
            logger.info(f"✅ [GREETING] Pool loaded from {_POOL_PATH}")
        except Exception as exc:
            logger.error(f"❌ [GREETING] Pool load failed: {exc} — using minimal fallback")
            _greeting_pool = {
                "english": {
                    "morning":    ["Good morning. Hope last night treated you well. ☀️"],
                    "day":        ["Hey. Glad you're here."],
                    "evening":    ["Hey. The day's winding down. You made it through."],
                    "night":      ["Hey. Good time to check in with yourself."],
                    "late_night": ["Still up? No judgment. Sometimes the brain doesn't have an off switch."],
                }
            }
    return _greeting_pool


def _get_time_slot() -> str:
    hour = datetime.now().hour
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 16:
        return "day"
    if 16 <= hour < 21:
        return "evening"
    if 21 <= hour < 24:
        return "night"
    return "late_night"  # 0-4


def _resolve_language_style(user_id: str) -> str:
    """Try to read user's preferred language from cached context file (best effort)."""
    try:
        ctx_file = f"user_contexts/user_context_{user_id}.json"
        if os.path.exists(ctx_file):
            with open(ctx_file, "r") as fh:
                ctx = json.load(fh)
            lang = ctx.get("cultural_context", {}).get("language_style", "english")
            mapping = {"hindi-mixed": "hindi_mixed", "hinglish": "hinglish"}
            return mapping.get(lang, "english")
    except Exception as exc:
        logger.debug(f"[GREETING] Could not load user context: {exc}")
    return "english"


# ── personality greetings ──────────────────────────────────────────────────
# Maps companion personality id → greeting template. {name} is replaced at runtime.
_PERSONALITY_GREETINGS: Dict[str, str] = {
    "mitra": "Hey. I'm {name}, and I'm really glad you're here. This is your space — no rush, no pressure. 🫶",
    "arjun": "Hey, I'm {name}. Whatever brought you here — let's figure it out together.",
    "diya":  "Hi! I'm {name}. Something tells me you and I are going to have some interesting conversations.",
    "riya":  "Hiii! I'm {name} and honestly? Just the fact that you showed up today? Already iconic. 💛",
    "zen":   "Welcome. I'm {name}. Take a breath. There's nowhere else you need to be right now.",
}

# Returning user greetings — memory-powered, no trailing questions
_RETURNING_GREETINGS: Dict[str, str] = {
    "mitra": "Hey, welcome back. I've been thinking about what you shared last time.",
    "arjun": "Good to see you. Last time we were working on something — I remember.",
    "diya":  "Oh hey! I had a thought about something you said before...",
    "riya":  "You're BACK! Okay I actually remembered something from our last chat. 😄",
    "zen":   "Welcome back. Something from last time stayed with me.",
}

_PERSONALITY_NAMES: Dict[str, str] = {
    "mitra": "Mitra", "arjun": "Arjun", "diya": "Diya",
    "riya": "Riya", "zen": "Zen",
}

# ── Cross-session continuity references (theme → natural callback) ─────
# Maps common session themes to low-latency personalized continuity lines
# that get appended to greetings. No LLM call — pure Python lookup.
_THEME_CONTINUITY_HINTS: Dict[str, str] = {
    "exam": "I've been thinking about what you said about exams.",
    "academic": "I remember the academic pressure you were dealing with.",
    "family": "I remember we talked about family stuff — that stayed with me.",
    "relationship": "I kept thinking about what you shared about relationships.",
    "anxiety": "I remember the anxiety you mentioned last time.",
    "stress": "I've been thinking about what was stressing you out.",
    "sleep": "I remember you mentioned sleep troubles — that's been on my mind.",
    "loneliness": "What you shared about feeling lonely last time stayed with me.",
    "career": "I've been thinking about the career stuff you mentioned.",
    "self-esteem": "I remember what you were working through with self-esteem.",
    "anger": "I remember the frustration from last time.",
    "sadness": "I've been thinking about what you were going through.",
}


def _get_continuity_reference(user_id: str, session_id: str) -> str:
    """
    Low-latency cross-session continuity: if the user has a previous session
    with known themes, return a natural callback line. Zero LLM calls.
    
    Returns "" if no previous data or if fetch takes >200ms.
    """
    try:
        _t = time.monotonic()
        prev = fetch_previous_session_summary(user_id, session_id)
        elapsed_ms = (time.monotonic() - _t) * 1000

        if elapsed_ms > 200:
            logger.info(f"⚠️ [GREETING] Session summary fetch too slow ({elapsed_ms:.0f}ms), skipping continuity")
            return ""

        if not prev or not prev.get("themes"):
            return ""

        themes = prev["themes"]
        if not isinstance(themes, list) or not themes:
            return ""

        # Find best matching theme
        for theme in themes:
            theme_lower = str(theme).lower()
            for key, hint in _THEME_CONTINUITY_HINTS.items():
                if key in theme_lower:
                    logger.info(f"✅ [GREETING] Continuity reference: theme='{theme}' → '{hint[:40]}…'")
                    return f" {hint}"

        return ""
    except Exception as exc:
        logger.debug(f"[GREETING] Continuity reference failed (non-blocking): {exc}")
        return ""


# ── public API ─────────────────────────────────────────────────────────────
def generate_greeting(
    user_id: str,
    session_id: str,
    personality: Optional[str] = None,
    companion_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a personalised greeting based on user context, time of day,
    and selected companion personality.

    Returns:
        {
            "greeting":      str,
            "show_greeting": bool,
            "language_used": str,
            "time_slot":     str,
        }
    """
    cache_key = f"{session_id}_{user_id}_{personality or ''}"
    if cache_key in _greeting_cache:
        logger.info(f"✅ [GREETING] Cache hit for session {session_id[:8]}…")
        return _greeting_cache[cache_key]

    try:
        time_slot = _get_time_slot()

        # If a companion personality is set, use its dedicated greeting
        if personality and personality in _PERSONALITY_GREETINGS:
            name = (companion_name or "").strip() or _PERSONALITY_NAMES.get(personality, "Mitra")
            language_style = _resolve_language_style(user_id)

            # Cross-session continuity: use returning greeting + continuity hint
            continuity = _get_continuity_reference(user_id, session_id)
            if continuity and personality in _RETURNING_GREETINGS:
                # Returning user — use memory-powered greeting
                greeting_text = _RETURNING_GREETINGS[personality].format(name=name)
                greeting_text += continuity
            else:
                greeting_text = _PERSONALITY_GREETINGS[personality].format(name=name)

            logger.info(
                f"✅ [GREETING] personality={personality} name={name} "
                f"time={time_slot} continuity={'yes' if continuity else 'no'} text={greeting_text[:40]}…"
            )
            result: Dict[str, Any] = {
                "greeting":      greeting_text,
                "show_greeting": True,
                "language_used": language_style,
                "time_slot":     time_slot,
            }
            _greeting_cache[cache_key] = result
            return result

        # Fallback: time-of-day greeting from pool
        pool = _load_greeting_pool()

        language_style = _resolve_language_style(user_id)
        if language_style not in pool:
            language_style = "english"

        if time_slot not in pool[language_style]:
            time_slot = "day"

        greeting_text = random.choice(pool[language_style][time_slot])
        logger.info(
            f"✅ [GREETING] lang={language_style} time={time_slot} "
            f"text={greeting_text[:40]}…"
        )

        result = {
            "greeting":      greeting_text,
            "show_greeting": True,
            "language_used": language_style,
            "time_slot":     time_slot,
        }
        _greeting_cache[cache_key] = result
        return result

    except Exception as exc:
        logger.error(f"❌ [GREETING] Generation failed: {exc}")
        return {
            "greeting":      "Hey. Glad you're here.",
            "show_greeting": True,
            "language_used": "english",
            "time_slot":     "day",
        }
