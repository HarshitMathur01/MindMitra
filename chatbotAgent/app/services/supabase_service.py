"""
Supabase Service — session counters, user context, message helpers.
"""
import json
import logging
import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import threading
from typing import Any, Dict, List, Optional, Tuple

from supabase import create_client, Client, ClientOptions

logger = logging.getLogger(__name__)

# ── Supabase client ────────────────────────────────────────────────────────
_SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_KEY", "")

_thread_local = threading.local()

def get_supabase_client() -> Optional[Client]:
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return None
    if not hasattr(_thread_local, "client"):
        try:
            # ClientOptions quiets the 'timeout' deprecation warning in newer supabase-py
            options = ClientOptions(postgrest_client_timeout=15.0)
            _thread_local.client = create_client(_SUPABASE_URL, _SUPABASE_KEY, options=options)
            logger.debug("✅ [Supabase] Thread-local Client initialised")
        except Exception as _e:
            logger.error(f"❌ [Supabase] Client init failed: {_e}")
            return None
    return _thread_local.client

class SupabaseProxy:
    """Thread-safe proxy for the Supabase sync client.
    Prevents 'Server disconnected' httpx connection pool races when using asyncio.gather/asyncio.to_thread."""
    def __bool__(self):
        return bool(_SUPABASE_URL and _SUPABASE_KEY)
    
    def __getattr__(self, name):
        client = get_supabase_client()
        if not client:
            raise Exception("Supabase client not initialized")
        return getattr(client, name)

supabase_client = SupabaseProxy()

if not _SUPABASE_URL or not _SUPABASE_KEY:
    logger.warning("⚠️ [Supabase] SUPABASE_URL or SUPABASE_KEY missing — DB features disabled")

# ── In-memory fallback counter ─────────────────────────────────────────────
session_message_counters: Dict[str, int] = defaultdict(int)

# ── Screening scores cache — PHQ-9/GAD-7 change rarely between messages ───
_screening_cache: Dict[str, Tuple[Dict, float]] = {}  # user_id -> (scores, timestamp)
_SCREENING_CACHE_TTL_S: float = 300.0  # 5 minutes


# ── helpers ────────────────────────────────────────────────────────────────
def get_session_message_count(session_id: str) -> int:
    """Return total message count for a session from the database."""
    if not supabase_client or not session_id:
        return 0
    try:
        response = (
            supabase_client.table("chat_messages")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )
        count = response.count if hasattr(response, "count") else len(response.data or [])
        logger.info(f"📊 [DB_COUNT] {count} messages for session {session_id}")
        return count
    except Exception as exc:
        logger.error(f"❌ [DB_COUNT] {exc}")
        return 0


def get_hybrid_message_count(session_id: str) -> int:
    """Return message count using both DB and in-memory counter (whichever is higher).

    Optimization: when the in-memory counter is warm (non-zero), skip the DB
    COUNT(*) query entirely — the local counter is incremented per message and
    is reliable within the same process lifetime.
    """
    if not session_id:
        return 0
    mem_count = session_message_counters.get(session_id, 0)
    if mem_count > 0:
        logger.debug(f"🔢 [HYBRID_COUNT] session={session_id[:8]} warm-counter={mem_count} (DB skip)")
        return mem_count
    # Cold start — fall back to DB
    db_count = get_session_message_count(session_id)
    logger.info(f"🔢 [HYBRID_COUNT] session={session_id[:8]} cold-start db={db_count}")
    return db_count


def _fetch_activities_sync(user_id: str) -> List[Dict]:
    """Synchronous helper — fetch recent user activities (last 24 h)."""
    if not supabase_client:
        return []
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    resp = (
        supabase_client.table("user_activities")
        .select("*")
        .eq("user_id", user_id)
        .gte("completed_at", cutoff)
        .order("completed_at", desc=True)
        .limit(50)
        .execute()
    )
    return resp.data or []


def _fetch_messages_sync(session_id: str, user_id: str) -> List[Dict]:
    """Synchronous helper — fetch last 10 chat messages for the session."""
    if not supabase_client or not session_id:
        return []
    resp = (
        supabase_client.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    return [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in reversed(resp.data or [])
    ]


async def fetch_user_context(user_id: str, session_id: str) -> Dict[str, Any]:
    """Fetch user activities and recent messages from Supabase in parallel."""
    import asyncio
    logger.info(f"🔍 [CONTEXT] Fetching context user={user_id[:8]} session={str(session_id)[:8]}")

    if not supabase_client:
        logger.warning("⚠️ [CONTEXT] Supabase unavailable")
        return {"user_activities": [], "recent_messages": [], "conversation_summary": {}}

    try:
        # Fire both queries concurrently instead of sequentially
        act_task = asyncio.to_thread(_fetch_activities_sync, user_id)
        msg_task = asyncio.to_thread(_fetch_messages_sync, session_id, user_id)
        user_activities, recent_messages = await asyncio.gather(act_task, msg_task)

        logger.info(
            f"📊 [CONTEXT] {len(user_activities)} activities | "
            f"💬 {len(recent_messages)} messages (parallel fetch)"
        )
        return {
            "user_activities": user_activities,
            "recent_messages": recent_messages,
            "conversation_summary": {},
        }

    except Exception as exc:
        logger.error(f"❌ [CONTEXT] {exc}")
        return {"user_activities": [], "recent_messages": [], "conversation_summary": {}}


def fetch_last_n_messages(session_id: str, n: int = 10) -> List[Dict[str, str]]:
    """Return the last *n* messages for a session in chronological order."""
    if not supabase_client or not session_id:
        return []
    try:
        resp = (
            supabase_client.table("chat_messages")
            .select("role, content, created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(n)
            .execute()
        )
        return [{"role": m["role"], "content": m["content"]} for m in reversed(resp.data or [])]
    except Exception as exc:
        logger.error(f"❌ [CONTEXT] fetch_last_n_messages: {exc}")
        return []


def fetch_latest_screening_scores(user_id: str) -> Dict[str, Any]:
    """Fetch the most recent PHQ-9/GAD-7 scores from user_contexts.

    Results are cached in-process for 5 minutes per user — PHQ-9/GAD-7 scores
    are updated only at session-end intervals and do not change message-to-message.
    """
    if not supabase_client or not user_id:
        return {}

    # Cache check
    cached = _screening_cache.get(user_id)
    if cached is not None:
        scores, ts = cached
        if (time.monotonic() - ts) < _SCREENING_CACHE_TTL_S:
            logger.debug(f"✅ [SCREENING] Cache hit for user {user_id[:8]}")
            return scores

    try:
        resp = (
            supabase_client.table("user_contexts")
            .select("context")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        scores: Dict[str, Any] = {}
        if resp.data:
            ctx = resp.data[0].get("context", {})
            if isinstance(ctx, dict):
                scores = ctx.get("screening_assessments", {})
        _screening_cache[user_id] = (scores, time.monotonic())
        return scores
    except Exception as exc:
        logger.error(f"❌ [CONTEXT] fetch_latest_screening_scores: {exc}")
    return {}


def save_screening_scores(user_id: str, session_id: str, scores: Dict[str, Any]) -> None:
    """Save screening scores to user_contexts table (merges into existing context)."""
    if not supabase_client or not user_id or not scores:
        return
    try:
        resp = (
            supabase_client.table("user_contexts")
            .select("context")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        existing_ctx: Dict = {}
        if resp.data:
            existing_ctx = resp.data[0].get("context", {})
            if not isinstance(existing_ctx, dict):
                existing_ctx = {}

        existing_ctx["screening_assessments"] = scores
        existing_ctx["screening_session_id"] = session_id

        supabase_client.table("user_contexts").upsert(
            {
                "user_id": user_id,
                "context": existing_ctx,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id",
        ).execute()
        logger.info(f"✅ [SCREENING] Scores saved for user {user_id[:8]}…")
    except Exception as exc:
        logger.error(f"❌ [SCREENING] save_screening_scores: {exc}")


def fetch_previous_session_summary(
    user_id: str, current_session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetch the most recent session summary for cross-session continuity.
    Excludes the current session to get the PREVIOUS session's context.
    """
    if not supabase_client or not user_id:
        return {}
    try:
        resp = (
            supabase_client.table("session_summaries")
            .select("summary_text, themes, emotional_arc, session_id")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(2)
            .execute()
        )
        if not resp.data:
            return {}

        for row in resp.data:
            if current_session_id and row.get("session_id") == current_session_id:
                continue  # Skip current session, get previous one

            themes = row.get("themes", "[]")
            emotional_arc = row.get("emotional_arc", "[]")
            if isinstance(themes, str):
                try:
                    themes = json.loads(themes)
                except (json.JSONDecodeError, TypeError):
                    themes = []
            if isinstance(emotional_arc, str):
                try:
                    emotional_arc = json.loads(emotional_arc)
                except (json.JSONDecodeError, TypeError):
                    emotional_arc = []

            return {
                "summary": row.get("summary_text", ""),
                "themes": themes,
                "emotional_arc": emotional_arc,
            }
    except Exception as exc:
        logger.error(f"❌ [CONTEXT] fetch_previous_session_summary: {exc}")
    return {}
