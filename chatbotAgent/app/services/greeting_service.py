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
                    "morning":    ["Good morning! How are you feeling today?"],
                    "day":        ["Hey! What's on your mind?"],
                    "evening":    ["Hey! How was your day?"],
                    "night":      ["Hi there! How are you doing tonight?"],
                    "late_night": ["Hey! Still up? How are you feeling?"],
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
    "mitra": "Namaste. I'm {name}, and I'm really glad you're here. This is your safe space — no rush, no pressure. How are you feeling today?",
    "arjun": "Hey! I'm {name}. Let's figure out what's weighing on you and tackle it together — one step at a time. What's the biggest thing on your mind right now?",
    "diya":  "Hi, I'm {name}! I love exploring the 'why' behind our feelings — because understanding them is the first step to changing them. What's been on your mind lately?",
    "riya":  "Hey hey hey! I'm {name} and I'm SO glad you're here! Seriously, just showing up today? That takes courage. Now tell me — what's going on with you?",
    "zen":   "Welcome... I'm {name}. Before anything else, let's just take one slow breath together. In... and out. There's nowhere else you need to be right now. What would you like to explore today?",
}

_PERSONALITY_NAMES: Dict[str, str] = {
    "mitra": "Mitra", "arjun": "Arjun", "diya": "Diya",
    "riya": "Riya", "zen": "Zen",
}

# ── Cross-session continuity references (theme → natural callback) ─────
# Maps common session themes to low-latency personalized continuity lines
# that get appended to greetings. No LLM call — pure Python lookup.
_THEME_CONTINUITY_HINTS: Dict[str, str] = {
    "exam": "Last time we talked about exams — how's that going?",
    "academic": "You were dealing with some academic pressure before — any updates?",
    "family": "I remember we talked about family stuff — how are things at home?",
    "relationship": "Last time we chatted about relationships — how's that been?",
    "anxiety": "You mentioned feeling anxious last time — how are you feeling now?",
    "stress": "I remember you were stressed about some things — has anything shifted?",
    "sleep": "You mentioned sleep troubles before — getting any better?",
    "loneliness": "Last time you shared about feeling lonely — how's it been since?",
    "career": "You were thinking about career stuff — anything new?",
    "self-esteem": "I remember you were working through some self-esteem stuff — how are you feeling about yourself lately?",
    "anger": "Last time there was some frustration — has that eased up?",
    "sadness": "You were going through a tough time before — how are things now?",
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
            greeting_text = _PERSONALITY_GREETINGS[personality].format(name=name)
            language_style = _resolve_language_style(user_id)

            # Cross-session continuity: append personalized callback if available
            continuity = _get_continuity_reference(user_id, session_id)
            if continuity:
                greeting_text += continuity

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
            "greeting":      "Hey! What's on your mind?",
            "show_greeting": True,
            "language_used": "english",
            "time_slot":     "day",
        }
