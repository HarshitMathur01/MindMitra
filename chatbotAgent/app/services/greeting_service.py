"""
Greeting Service — time-aware, language-aware greeting pool.
"""
import json
import logging
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

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


# ── public API ─────────────────────────────────────────────────────────────
def generate_greeting(user_id: str, session_id: str) -> Dict[str, Any]:
    """
    Generate a personalised greeting based on user context and time of day.

    Returns:
        {
            "greeting":      str,
            "show_greeting": bool,
            "language_used": str,
            "time_slot":     str,
        }
    """
    cache_key = f"{session_id}_{user_id}"
    if cache_key in _greeting_cache:
        logger.info(f"✅ [GREETING] Cache hit for session {session_id[:8]}…")
        return _greeting_cache[cache_key]

    try:
        pool = _load_greeting_pool()

        language_style = _resolve_language_style(user_id)
        if language_style not in pool:
            language_style = "english"

        time_slot = _get_time_slot()
        if time_slot not in pool[language_style]:
            time_slot = "day"

        greeting_text = random.choice(pool[language_style][time_slot])
        logger.info(
            f"✅ [GREETING] lang={language_style} time={time_slot} "
            f"text={greeting_text[:40]}…"
        )

        result: Dict[str, Any] = {
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
