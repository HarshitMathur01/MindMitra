"""
Optional Redis: session transcript ring, memory_context cache, extraction throttle.
All paths no-op when REDIS_URL is unset or redis import fails.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

_CLIENT: Any = None
_DISABLED = False


def _client() -> Any:
    global _CLIENT, _DISABLED
    if _DISABLED:
        return None
    if _CLIENT is not None:
        return _CLIENT
    url = (os.getenv("REDIS_URL") or "").strip()
    if not url:
        _DISABLED = True
        return None
    try:
        import redis  # type: ignore

        r = redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=1.5)
        r.ping()
        _CLIENT = r
        logger.info("[REDIS_WM] Connected for working-memory helpers")
        return _CLIENT
    except Exception as exc:
        logger.debug("[REDIS_WM] unavailable: %s", exc)
        _DISABLED = True
        return None


def append_session_turn(session_id: str, role: str, content: str, max_turns: int = 20) -> None:
    r = _client()
    if not r or not session_id:
        return
    try:
        key = f"mm:sess:{session_id}:turns"
        payload = json.dumps({"role": role, "content": (content or "")[:4000]}, ensure_ascii=False)
        pipe = r.pipeline()
        pipe.rpush(key, payload)
        pipe.ltrim(key, -max_turns, -1)
        pipe.expire(key, 86400 * 7)
        pipe.execute()
    except Exception as exc:
        logger.debug("[REDIS_WM] append_session_turn failed: %s", exc)


def get_cached_memory_context(user_id: str, session_id: str, turn_key: str) -> Optional[str]:
    r = _client()
    if not r:
        return None
    try:
        raw = r.get(f"mm:ctx:{user_id}:{session_id}:{turn_key}")
        return raw if isinstance(raw, str) else None
    except Exception as exc:
        logger.debug("[REDIS_WM] get_cached_memory_context failed: %s", exc)
        return None


def set_cached_memory_context(
    user_id: str,
    session_id: str,
    turn_key: str,
    text: str,
    ttl_seconds: int = 300,
) -> None:
    r = _client()
    if not r or not text:
        return
    try:
        r.setex(f"mm:ctx:{user_id}:{session_id}:{turn_key}", max(30, int(ttl_seconds)), text[:12000])
    except Exception as exc:
        logger.debug("[REDIS_WM] set_cached_memory_context failed: %s", exc)


def extraction_rate_allow(session_id: str, max_per_hour: int = 24) -> bool:
    r = _client()
    if not r or not session_id:
        return True
    try:
        k = f"mm:extract:{session_id}:h"
        n = r.incr(k)
        if n == 1:
            r.expire(k, 3600)
        return int(n) <= int(max_per_hour)
    except Exception as exc:
        logger.debug("[REDIS_WM] extraction_rate_allow failed: %s", exc)
        return True


def recent_turns_json(session_id: str, max_items: int = 20) -> List[dict]:
    r = _client()
    if not r or not session_id:
        return []
    try:
        key = f"mm:sess:{session_id}:turns"
        raw_list = r.lrange(key, -max_items, -1) or []
        out: List[dict] = []
        for raw in raw_list:
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    out.append(obj)
            except json.JSONDecodeError:
                continue
        return out
    except Exception as exc:
        logger.debug("[REDIS_WM] recent_turns_json failed: %s", exc)
        return []

# ── Unified architecture (PDF) Redis key contract ──────────────────────────
# Keys:
# - user:{id}:has_memories (bool) TTL 120s
# - user:{id}:memory_context TTL 600s
# - user:{id}:session_buffer TTL session+30m (implemented elsewhere via append_session_turn)


def get_user_has_memories(user_id: str) -> Optional[bool]:
    r = _client()
    if not r or not user_id:
        return None
    try:
        raw = r.get(f"user:{user_id}:has_memories")
        if raw is None:
            return None
        s = str(raw).strip().lower()
        if s in ("1", "true", "t", "yes", "y"):
            return True
        if s in ("0", "false", "f", "no", "n"):
            return False
        return None
    except Exception as exc:
        logger.debug("[REDIS_WM] get_user_has_memories failed: %s", exc)
        return None


def set_user_has_memories(user_id: str, has_memories: bool, ttl_seconds: int = 120) -> None:
    r = _client()
    if not r or not user_id:
        return
    try:
        r.setex(f"user:{user_id}:has_memories", max(10, int(ttl_seconds)), "1" if has_memories else "0")
    except Exception as exc:
        logger.debug("[REDIS_WM] set_user_has_memories failed: %s", exc)


def get_user_memory_context(user_id: str) -> Optional[str]:
    r = _client()
    if not r or not user_id:
        return None
    try:
        raw = r.get(f"user:{user_id}:memory_context")
        return raw if isinstance(raw, str) else None
    except Exception as exc:
        logger.debug("[REDIS_WM] get_user_memory_context failed: %s", exc)
        return None


def set_user_memory_context(user_id: str, text: str, ttl_seconds: int = 600) -> None:
    r = _client()
    if not r or not user_id or not (text or "").strip():
        return
    try:
        r.setex(f"user:{user_id}:memory_context", max(30, int(ttl_seconds)), (text or "")[:24000])
    except Exception as exc:
        logger.debug("[REDIS_WM] set_user_memory_context failed: %s", exc)
