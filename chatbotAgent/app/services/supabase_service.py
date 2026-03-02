"""
Supabase Service — session counters, user context, message helpers.
"""
import logging
import os
from collections import defaultdict
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
        # Activities (last 50)
        act_resp = (
            supabase_client.table("user_activities")
            .select("*")
            .eq("user_id", user_id)
            .order("completed_at", desc=True)
            .limit(50)
            .execute()
        )
        user_activities: List[Dict] = act_resp.data or []
        logger.info(f"📊 [CONTEXT] {len(user_activities)} activities")

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

        # Summary (optional table)
        conversation_summary: Dict[str, Any] = {}
        try:
            sum_resp = (
                supabase_client.table("message_summaries")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if sum_resp.data:
                d = sum_resp.data[0]
                conversation_summary = {
                    "summary":          d.get("summary", ""),
                    "key_points":       d.get("key_points", []),
                    "emotional_state":  d.get("emotional_state", "neutral"),
                    "topics_discussed": d.get("topics_discussed", []),
                }
                logger.info("📝 [CONTEXT] Conversation summary loaded")
        except Exception as exc:
            err = str(exc)
            if "PGRST205" in err or "does not exist" in err:
                logger.warning("⚠️ [CONTEXT] 'message_summaries' table not found — skipping")
            else:
                logger.warning(f"⚠️ [CONTEXT] Summary fetch error: {exc}")

        return {
            "user_activities": user_activities,
            "recent_messages": recent_messages,
            "conversation_summary": conversation_summary,
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
