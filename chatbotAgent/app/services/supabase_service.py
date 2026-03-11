"""
Supabase Service — session counters, user context, message helpers.
"""
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from supabase import create_client, Client

logger = logging.getLogger(__name__)

# ── Supabase client ────────────────────────────────────────────────────────
_SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_KEY", "")

supabase_client: Optional[Client] = None

if _SUPABASE_URL and _SUPABASE_KEY:
    try:
        supabase_client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
        logger.info("✅ [Supabase] Client initialised")
    except Exception as _e:
        logger.error(f"❌ [Supabase] Client init failed: {_e}")
else:
    logger.warning("⚠️ [Supabase] SUPABASE_URL or SUPABASE_KEY missing — DB features disabled")

# ── In-memory fallback counter ─────────────────────────────────────────────
session_message_counters: Dict[str, int] = defaultdict(int)


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
    """Return message count using both DB and in-memory counter (whichever is higher)."""
    if not session_id:
        return 0
    db_count = get_session_message_count(session_id)
    mem_count = session_message_counters.get(session_id, 0)
    final = max(db_count, mem_count)
    logger.info(f"🔢 [HYBRID_COUNT] session={session_id} db={db_count} mem={mem_count} → {final}")
    return final


async def fetch_user_context(user_id: str, session_id: str) -> Dict[str, Any]:
    """Fetch user activities, recent messages, and conversation summary from Supabase."""
    logger.info(f"🔍 [CONTEXT] Fetching context user={user_id} session={session_id}")

    if not supabase_client:
        logger.warning("⚠️ [CONTEXT] Supabase unavailable")
        return {"user_activities": [], "recent_messages": [], "conversation_summary": {}}

    try:
        # Activities from last 24 hours only (recent game/QNA insights)
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        act_resp = (
            supabase_client.table("user_activities")
            .select("*")
            .eq("user_id", user_id)
            .gte("completed_at", cutoff)
            .order("completed_at", desc=True)
            .limit(50)
            .execute()
        )
        user_activities: List[Dict] = act_resp.data or []
        logger.info(f"📊 [CONTEXT] {len(user_activities)} activities (last 24h)")

        # Messages (last 10, chronological)
        msg_resp = (
            supabase_client.table("chat_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        recent_messages: List[Dict] = [
            {"role": m.get("role", "user"), "content": m.get("content", "")}
            for m in reversed(msg_resp.data or [])
        ]
        logger.info(f"💬 [CONTEXT] {len(recent_messages)} messages")

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
    """Fetch the most recent PHQ-9/GAD-7 scores from user_contexts."""
    if not supabase_client or not user_id:
        return {}
    try:
        resp = (
            supabase_client.table("user_contexts")
            .select("context")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if resp.data:
            ctx = resp.data[0].get("context", {})
            if isinstance(ctx, dict):
                return ctx.get("screening_assessments", {})
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
