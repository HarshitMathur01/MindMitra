"""
Health routes — registered first so Railway startup checks pass immediately.

Also hosts ``/debug/memory``, an operator-only memory connectivity probe.
That route is gated behind both an environment flag and a shared secret so it
is unreachable in production by default.

Both routes are intentionally lightweight: they must not import any v3
pipeline modules that would slow down a Railway cold start. The memory
probe lazily imports v3 helpers only when it actually runs.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)


def _debug_memory_enabled() -> bool:
    from app.core.env import env

    e = env()
    if e.is_non_prod:
        return True
    return e.debug_routes_enabled


def _debug_memory_token() -> Optional[str]:
    from app.core.env import env

    return env().debug_memory_token


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "MindMitra Chatbot Agent",
        "version": "3.0.0",
    }


@router.get("/")
async def root():
    payload = {
        "message": "MindMitra Chatbot Agent is running",
        "docs": "/docs",
        "health": "/health",
        "chat": "POST /chat",
    }
    if _debug_memory_enabled():
        payload["debug_memory"] = "/debug/memory?user_id=<uid> (admin only)"
    return payload


@router.get("/debug/memory")
async def debug_memory(
    user_id: str = "test_user",
    x_debug_token: Optional[str] = Header(default=None, alias="X-Debug-Token"),
):
    """Operator-only Qdrant connectivity probe.

    Reports whether the v3 Qdrant client is reachable and surfaces the
    latest episodic memories for ``user_id``. Returns 404 in production
    unless the operator explicitly opts in.
    """
    if not _debug_memory_enabled():
        raise HTTPException(status_code=404, detail="Not Found")

    expected_token = _debug_memory_token()
    if expected_token and x_debug_token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        from app.core.connections import get_qdrant
        from app.core.env import env as v3_env

        e = v3_env()
        qdrant = get_qdrant()
        qdrant_ready = qdrant is not None
        recent: list[dict[str, Any]] = []
        episodic_count: int = 0

        if qdrant_ready:
            try:
                from qdrant_client import models as qdrant_models

                resp = await qdrant.scroll(
                    collection_name=e.qdrant_episodic_collection,
                    scroll_filter=qdrant_models.Filter(
                        must=[
                            qdrant_models.FieldCondition(
                                key="user_id",
                                match=qdrant_models.MatchValue(value=user_id),
                            )
                        ]
                    ),
                    limit=5,
                    with_payload=True,
                )
                points = (resp or (None, None))[0] or []
                episodic_count = len(points)
                for p in points:
                    payload = getattr(p, "payload", None) or {}
                    recent.append(
                        {
                            "id": str(getattr(p, "id", "")),
                            "session_date": payload.get("session_date"),
                            "summary": (payload.get("summary_text") or "")[:160],
                            "topics": payload.get("topic_keywords") or [],
                            "peak_urgency": payload.get("peak_urgency"),
                        }
                    )
            except Exception as inner:  # noqa: BLE001
                logger.warning("[debug/memory] qdrant scroll failed: %s", inner)

        return {
            "qdrant_ready": qdrant_ready,
            "qdrant_url": e.qdrant_url,
            "collections": {
                "episodic": e.qdrant_episodic_collection,
                "knowledge_base": e.qdrant_kb_collection,
            },
            "user_id": user_id,
            "episodic_recent_count": episodic_count,
            "recent_memories_preview": recent,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("[debug/memory] failed: %s", exc)
        return {"qdrant_ready": False, "error": str(exc), "user_id": user_id}
