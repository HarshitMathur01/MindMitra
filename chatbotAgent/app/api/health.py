"""
Health routes — registered first so Railway startup checks pass immediately.

Also hosts ``/debug/memory``, an operator-only memory connectivity probe.
That route is gated behind both an environment flag and a shared secret so it
is unreachable in production by default.
"""
import logging
import os
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)


def _env_truthy(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).lower() in ("1", "true", "yes")


def _debug_memory_enabled() -> bool:
    """Return True iff /debug/memory should serve any data.

    Enabled only when DEBUG=1 / DEBUG_ROUTES=1, OR when ENV is dev/local/test.
    """
    env_name = os.getenv("ENV", os.getenv("ENVIRONMENT", "")).strip().lower()
    if env_name in ("dev", "development", "local", "test", "testing"):
        return True
    return _env_truthy("DEBUG") or _env_truthy("DEBUG_ROUTES")


def _debug_memory_token() -> Optional[str]:
    """Optional shared-secret to gate the route even in non-prod."""
    token = os.getenv("DEBUG_MEMORY_TOKEN", "").strip()
    return token or None


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "MindMitra Chatbot Agent",
        "version": "2.0.0",
    }


@router.get("/")
async def root():
    payload = {
        "message": "MindMitra Chatbot Agent v2 is running",
        "docs": "/docs",
        "health": "/health",
    }
    # Only advertise the debug probe in environments where it actually serves.
    if _debug_memory_enabled():
        payload["debug_memory"] = "/debug/memory?user_id=<uid> (admin only)"
    return payload


@router.get("/debug/memory")
async def debug_memory(
    user_id: str = "test_user",
    x_debug_token: Optional[str] = Header(default=None, alias="X-Debug-Token"),
):
    """Operator-only mem0 / Qdrant connectivity probe.

    Security:
      - 404 in production unless ``DEBUG=1`` / ``DEBUG_ROUTES=1`` is set.
      - 401 if ``DEBUG_MEMORY_TOKEN`` is configured and the request is missing
        / does not match the ``X-Debug-Token`` header.
    """
    if not _debug_memory_enabled():
        # Pretend the route doesn't exist in prod rather than leak its shape.
        raise HTTPException(status_code=404, detail="Not Found")

    expected_token = _debug_memory_token()
    if expected_token and x_debug_token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        from app.memory.qdrant_v2 import (
            COLLECTION_EPISODIC,
            COLLECTION_REFLECTIONS,
            get_qdrant,
        )

        qdrant = get_qdrant()
        qdrant_ready = qdrant is not None
        qdrant_kind = type(qdrant).__name__ if qdrant else None

        stats: dict[str, Any] = {}
        recent: list[dict[str, Any]] = []
        if qdrant_ready:
            try:
                from app.services.supabase_service import supabase_client

                if supabase_client is not None:
                    res = (
                        supabase_client.table("episodic_memories")
                        .select("id, summary, importance, status, created_at")
                        .eq("user_id", user_id)
                        .order("created_at", desc=True)
                        .limit(5)
                        .execute()
                    )
                    rows = getattr(res, "data", None) or []
                    stats["episodic_recent_rows"] = len(rows)
                    recent = [
                        {
                            "id": r.get("id", ""),
                            "summary": (r.get("summary") or "")[:120],
                            "importance": r.get("importance"),
                            "status": r.get("status"),
                        }
                        for r in rows
                    ]
            except Exception as inner_exc:
                logger.warning(f"⚠️  [DEBUG/MEMORY] supabase probe failed: {inner_exc}")

        return {
            "qdrant_ready": qdrant_ready,
            "qdrant_kind": qdrant_kind,
            "qdrant_host": os.getenv("QDRANT_HOST", "localhost"),
            "qdrant_port": os.getenv("QDRANT_PORT", "6333"),
            "collections": {
                "episodic": COLLECTION_EPISODIC,
                "reflections": COLLECTION_REFLECTIONS,
            },
            "user_id": user_id,
            "stats": stats,
            "recent_memories_preview": recent,
        }
    except Exception as exc:
        logger.error(f"❌ [DEBUG/MEMORY] {exc}")
        return {
            "qdrant_ready": False,
            "error": str(exc),
            "user_id": user_id,
        }
