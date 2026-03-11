"""
Health routes — registered first so Railway startup checks pass immediately.
"""
import logging
import os

from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "MindMitra Chatbot Agent",
        "version": "2.0.0",
    }


@router.get("/")
async def root():
    return {
        "message": "MindMitra Chatbot Agent v2 is running",
        "docs": "/docs",
        "health": "/health",
        "debug_memory": "/debug/memory?user_id=<uid>",
    }


@router.get("/debug/memory")
async def debug_memory(user_id: str = "test_user"):
    """
    Quick mem0 / Qdrant connectivity probe.
    Returns memory system readiness + per-user stats.
    Usage: GET /debug/memory?user_id=<user_id>
    """
    try:
        from app.agents.memory_manager import memory_manager  # lazy import

        ready = memory_manager.is_ready   # @property — no parentheses
        stats = memory_manager.get_user_memory_stats(user_id) if ready else {}
        recent = []
        if ready:
            try:
                all_mems = memory_manager.get_all_memories(user_id, limit=5)
                recent = [
                    {"id": m.get("id", ""), "memory": m.get("memory", "")[:120]}
                    for m in all_mems
                ]
            except Exception:
                pass

        return {
            "mem0_ready": ready,
            "qdrant_host": os.getenv("QDRANT_HOST", "localhost"),
            "qdrant_port": os.getenv("QDRANT_PORT", "6333"),
            "collection": os.getenv("QDRANT_COLLECTION", "companion_memories"),
            "user_id": user_id,
            "stats": stats,
            "recent_memories_preview": recent,
        }
    except Exception as exc:
        logger.error(f"❌ [DEBUG/MEMORY] {exc}")
        return {
            "mem0_ready": False,
            "error": str(exc),
            "user_id": user_id,
        }
