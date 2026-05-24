"""Session lifecycle: startup, resume, save, expire.

Layer above ``app/core/session.SessionObject`` that owns every Redis
interaction. Request handlers should never reach into Redis directly — go
through these helpers so TTL resets, lock acquisition, and expiry handling
stay consistent.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, Optional
from urllib.parse import urlparse

from ..core.connections import get_redis, guarded_call
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..core.session import (
    SessionObject,
    active_session_key,
    session_key,
    session_lock_key,
)
from . import profile_service

logger = get_logger(__name__, layer="ingestion")
SESSION_EXPIRY_INDEX_KEY = "session_expiry_index"
_EXPIRY_SWEEP_WARN_AT: float = 0.0


# ── in-memory fallback (used only when Redis is unavailable) ──────────────
_INMEM_SESSIONS: Dict[str, str] = {}
_INMEM_ACTIVE: Dict[str, str] = {}
_INMEM_RATE: Dict[str, int] = {}


# ── core helpers ──────────────────────────────────────────────────────────
async def _redis_get(key: str) -> Optional[str]:
    r = get_redis()
    if r is None:
        return _INMEM_SESSIONS.get(key) or _INMEM_ACTIVE.get(key)
    try:
        return await guarded_call("redis", lambda: r.get(key), timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis unavailable — using connection-local in-memory session state", extra=log_context(exception_type=type(exc).__name__, consequence="no_persistence_this_session"))
        return None


async def _redis_setex(key: str, ttl_s: int, value: str) -> bool:
    r = get_redis()
    if r is None:
        _INMEM_SESSIONS[key] = value
        return True
    try:
        await guarded_call("redis", lambda: r.setex(key, ttl_s, value), timeout_s=2.0, retries=1)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis unavailable — session write not persisted", extra=log_context(exception_type=type(exc).__name__, key=key.split(":")[0], consequence="in_memory_only"))
        return False


async def _redis_delete(key: str) -> None:
    r = get_redis()
    if r is None:
        _INMEM_SESSIONS.pop(key, None)
        _INMEM_ACTIVE.pop(key, None)
        return
    try:
        await guarded_call("redis", lambda: r.delete(key), timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 session] redis del failed: %s", exc)


async def _redis_set_nx(key: str, value: str, ttl_s: int) -> bool:
    r = get_redis()
    if r is None:
        if key in _INMEM_SESSIONS:
            return False
        _INMEM_SESSIONS[key] = value
        return True
    try:
        result = await guarded_call("redis", lambda: r.set(key, value, nx=True, ex=ttl_s), timeout_s=2.0, retries=1)
        return bool(result)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 session] redis set_nx failed: %s", exc)
        return False


# ── startup: 4-load parallel session bootstrap ───────────────────────────
async def session_startup(
    user_id: str,
    *,
    requested_session_id: Optional[str] = None,
    device_locale: Optional[str] = None,
) -> SessionObject:
    """Build a fresh session object or resume an existing one.

    The 4 parallel loads (semantic, procedural, longitudinal, previous
    episodic summary) target a <150ms total wall-clock budget. All loads
    degrade silently to empty defaults so a Supabase outage cannot wedge
    chat startup.
    """
    e = env()
    await apply_pending_profile_updates(user_id)

    # ── 1) Resume existing session, if one is still live in Redis ────────
    if requested_session_id and requested_session_id != "new":
        existing = await load_session(user_id, requested_session_id)
        if existing is not None:
            existing.is_new_session = False
            existing.touch()
            await save_session(existing)
            await _redis_setex(active_session_key(user_id), e.session_ttl_seconds, existing.session_id)
            logger.info(
                "session resolved",
                extra=log_context(
                    session_id=existing.session_id,
                    user_id=user_id,
                    outcome="resumed_requested",
                    turns=existing.turn_count,
                    ttl_s=e.session_ttl_seconds,
                ),
            )
            return existing

    # Active session pointer may still be valid even if caller said "new".
    active_id = await _redis_get(active_session_key(user_id))
    if active_id:
        existing = await load_session(user_id, active_id)
        if existing is not None and not requested_session_id:
            existing.is_new_session = False
            existing.touch()
            await save_session(existing)
            await _redis_setex(active_session_key(user_id), e.session_ttl_seconds, existing.session_id)
            logger.info(
                "session resolved",
                extra=log_context(
                    session_id=existing.session_id,
                    user_id=user_id,
                    outcome="resumed_active_pointer",
                    turns=existing.turn_count,
                    ttl_s=e.session_ttl_seconds,
                ),
            )
            return existing

    # ── 2) Build a new session. Parallel load the 4 caches. ──────────────
    new_session_id = str(uuid.uuid4())
    profile_timeout_s = max(0.1, e.session_profile_load_timeout_s)
    logger.info(
        "session startup parallel loads started",
        extra=log_context(
            user_id=user_id,
            loads="semantic,procedural,longitudinal,previous_episodic",
            timeout_s=profile_timeout_s,
            why="new_session_context",
        ),
    )
    t0 = datetime.now(timezone.utc).timestamp()
    # Each profile service offloads its sync Supabase work internally. Keep
    # the outer orchestration on the request loop so Redis/httpx clients stay
    # bound to one event loop and cancellation is observable.
    semantic, procedural, longitudinal, prev_episodic = await asyncio.gather(
        _load_with_timeout(
            "semantic",
            lambda: profile_service.load_semantic_profile(user_id),
            _empty_semantic(user_id),
            profile_timeout_s,
        ),
        _load_with_timeout(
            "procedural",
            lambda: profile_service.load_procedural_profile(user_id),
            _empty_procedural(user_id),
            profile_timeout_s,
        ),
        _load_with_timeout(
            "longitudinal",
            lambda: profile_service.load_longitudinal(user_id),
            _empty_longitudinal(user_id),
            profile_timeout_s,
        ),
        _load_with_timeout(
            "previous_episodic",
            lambda: profile_service.fetch_most_recent_episodic(user_id),
            None,
            profile_timeout_s,
        ),
        return_exceptions=False,
    )
    logger.info(
        "session startup parallel loads complete",
        extra=log_context(
            user_id=user_id,
            cultural_frame=(semantic or {}).get("cultural_frame_id", "metro_social"),
            risk_flag=(longitudinal or {}).get("longitudinal_risk_flag", False),
            prev_urgency=(prev_episodic or {}).get("peak_urgency") if prev_episodic else "none",
            latency_ms=(datetime.now(timezone.utc).timestamp() - t0) * 1000,
            outcome="loaded_with_fallbacks",
        ),
    )

    # If the user's last session left a crisis-cooldown flag set, give the
    # SanctuaryHome landing page a chance to come back to normal once they
    # have stabilised (valence > 0, urgency 0, and at least 6h elapsed).
    # The 6h floor avoids same-session whiplash where a single positive
    # affect snapshot inside the cooldown window would unquiet the room
    # prematurely.
    await _maybe_clear_crisis_cooldown(user_id, longitudinal)

    starting_mode = _determine_starting_mode(prev_episodic)

    session = SessionObject(
        session_id=new_session_id,
        user_id=user_id,
        current_mode=starting_mode,
        cultural_frame_id=semantic.get("cultural_frame_id") or "metro_social",
        longitudinal_risk_flag=bool(longitudinal.get("longitudinal_risk_flag", False)),
        total_sessions_at_start=int(semantic.get("total_sessions", 0) or 0),
        previous_session_peak_urgency=int((prev_episodic or {}).get("peak_urgency", 0) or 0),
        semantic_profile=semantic,
        procedural_profile=procedural,
        is_new_session=True,
    )
    if device_locale:
        session.procedural_profile.setdefault("device_locale", device_locale)

    await save_session(session)
    await _redis_setex(active_session_key(user_id), e.session_ttl_seconds, new_session_id)
    logger.info(
        "session resolved",
        extra=log_context(
            session_id=new_session_id,
            user_id=user_id,
            outcome="created",
            turns=0,
            mode=starting_mode,
            ttl_s=e.session_ttl_seconds,
        ),
    )
    return session


async def _load_with_timeout(
    name: str,
    factory: Callable[[], Awaitable[Any]],
    default: Any,
    timeout_s: float,
) -> Any:
    started = datetime.now(timezone.utc).timestamp()
    try:
        result = await asyncio.wait_for(factory(), timeout=timeout_s)
        logger.debug(
            "[v3 session] profile cache %s loaded in %.0fms",
            name,
            (datetime.now(timezone.utc).timestamp() - started) * 1000,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning(
            "[v3 session] profile cache %s timed out after %.1fs; using default",
            name,
            timeout_s,
        )
        return default
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 session] profile cache %s failed: %s; using default", name, exc)
        return default


def _empty_semantic(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "display_name": None,
        "occupation_detail": None,
        "city": None,
        "recurring_themes": {},
        "relationship_map": [],
        "comfort_topics": [],
        "discomfort_topics": [],
        "language_baseline": {"code_mix_mean": 0.5, "formality_mean": 0.4},
        "cultural_frame_id": "metro_social",
        "total_sessions": 0,
        "first_session_at": None,
    }


def _empty_procedural(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "style_vector": dict(profile_service.DEFAULT_STYLE_VECTOR),
        "deflection_topics": [],
        "engagement_topics": [],
        "response_length_pref": 0.5,
        "dependency_risk_counter": 0,
        "social_mentions_count": 0,
        "sessions_this_week": 0,
        "last_session_date": None,
        "consecutive_high_urgency_sessions": 0,
        "preferred_time_slots": [],
    }


def _empty_longitudinal(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "longitudinal_risk_flag": False,
        "affect_series": [],
        "phq2_scores": [],
    }


_CRISIS_COOLDOWN_FLOOR_HOURS = 6


async def _maybe_clear_crisis_cooldown(
    user_id: str, longitudinal: Dict[str, Any]
) -> None:
    """Clear `recent_crisis_flag` once the user has stabilised.

    Conditions (all must hold):
      * `recent_crisis_flag` is true on the loaded longitudinal row,
      * at least `_CRISIS_COOLDOWN_FLOOR_HOURS` (6) have passed since
        `crisis_flag_set_at` — protects against same-session whiplash where
        a single positive turn during the immediate aftermath would unquiet
        the landing page,
      * the most recent affect_series entry shows valence > 0 and urgency 0.

    The Supabase write is best-effort; the in-memory `longitudinal` dict is
    mutated regardless so the rest of session_startup sees the cleared
    state without an extra round-trip.
    """
    if not longitudinal or not longitudinal.get("recent_crisis_flag"):
        return

    set_at = longitudinal.get("crisis_flag_set_at")
    if not set_at:
        return

    try:
        if isinstance(set_at, datetime):
            set_at_dt = set_at if set_at.tzinfo else set_at.replace(tzinfo=timezone.utc)
        else:
            set_at_dt = datetime.fromisoformat(str(set_at).replace("Z", "+00:00"))
    except (ValueError, TypeError) as exc:
        logger.warning(
            "crisis cooldown clear skipped — unparseable timestamp",
            extra=log_context(user_id=user_id, exception_type=type(exc).__name__, raw=str(set_at)[:32]),
        )
        return

    elapsed_h = (datetime.now(timezone.utc) - set_at_dt).total_seconds() / 3600.0
    if elapsed_h < _CRISIS_COOLDOWN_FLOOR_HOURS:
        return

    affect_series = longitudinal.get("affect_series") or []
    if not affect_series:
        return
    last_affect = affect_series[-1] if isinstance(affect_series, list) else None
    if not isinstance(last_affect, dict):
        return
    try:
        last_valence = float(last_affect.get("valence", 0.0) or 0.0)
        last_urgency = int(last_affect.get("urgency", 0) or 0)
    except (TypeError, ValueError):
        return
    if last_valence <= 0 or last_urgency != 0:
        return

    # Conditions met — fire-and-forget the Supabase clear and update the
    # in-memory snapshot so downstream code observes the cleared state.
    longitudinal["recent_crisis_flag"] = False
    longitudinal["crisis_flag_set_at"] = None

    async def _persist_clear() -> None:
        ok = await profile_service.upsert_longitudinal(
            user_id,
            {"recent_crisis_flag": False, "crisis_flag_set_at": None},
        )
        if ok:
            logger.info(
                "crisis cooldown cleared at session startup",
                extra=log_context(
                    user_id=user_id,
                    elapsed_h=round(elapsed_h, 1),
                    last_valence=last_valence,
                    outcome="cooldown_cleared",
                ),
            )
        else:
            logger.warning(
                "crisis cooldown clear write failed",
                extra=log_context(user_id=user_id, outcome="clear_pending"),
            )

    asyncio.create_task(_persist_clear())


def _determine_starting_mode(prev_episodic: Optional[Dict[str, Any]]) -> str:
    if not prev_episodic:
        return "companion"
    try:
        if int(prev_episodic.get("peak_urgency", 0) or 0) >= 2:
            return "recovery_check"
    except (TypeError, ValueError):
        pass
    return "companion"


# ── load / save ──────────────────────────────────────────────────────────
async def load_session(user_id: str, session_id: str) -> Optional[SessionObject]:
    payload = await _redis_get(session_key(user_id, session_id))
    if not payload:
        return None
    try:
        session = SessionObject.from_json(payload)
        if session.user_id != user_id:
            logger.warning(
                "session integrity user mismatch",
                extra=log_context(session_id=session_id, user_id=user_id, stored_user_id=session.user_id[:8], outcome="rebuild"),
            )
            return await _rebuild_corrupt_session(user_id, session_id)
        return session
    except Exception as exc:  # noqa: BLE001
        logger.warning("session integrity failed; rebuilding from defaults", extra=log_context(session_id=session_id, user_id=user_id, exception_type=type(exc).__name__, outcome="rebuild"))
        return await _rebuild_corrupt_session(user_id, session_id)


async def save_session(session: SessionObject) -> bool:
    e = env()
    session.touch()
    r = get_redis()
    session_payload = session.to_json()
    if r is None:
        _INMEM_SESSIONS[session_key(session.user_id, session.session_id)] = session_payload
        _INMEM_ACTIVE[active_session_key(session.user_id)] = session.session_id
        logger.error("Redis unavailable — session kept in memory only", extra=log_context(session_id=session.session_id, user_id=session.user_id, consequence="no_persistence_this_session"))
        return True
    try:
        async def _write_atomic() -> bool:
            pipe = r.pipeline(transaction=True)
            pipe.setex(session_key(session.user_id, session.session_id), e.session_ttl_seconds, session_payload)
            if session.status == "active":
                pipe.setex(active_session_key(session.user_id), e.session_ttl_seconds, session.session_id)
                due_at = datetime.now(timezone.utc).timestamp() + e.session_ttl_seconds
                pipe.zadd(SESSION_EXPIRY_INDEX_KEY, {f"{session.user_id}:{session.session_id}": due_at})
            await pipe.execute()
            return True
        return await guarded_call("redis", _write_atomic, timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis atomic session write failed — in-memory copy retained", extra=log_context(session_id=session.session_id, user_id=session.user_id, exception_type=type(exc).__name__, consequence="no_persistence_this_session"))
        _INMEM_SESSIONS[session_key(session.user_id, session.session_id)] = session_payload
        _INMEM_ACTIVE[active_session_key(session.user_id)] = session.session_id
        return False


async def _rebuild_corrupt_session(user_id: str, session_id: str) -> SessionObject:
    semantic, procedural, longitudinal = await asyncio.gather(
        _load_with_timeout("semantic_rebuild", lambda: profile_service.load_semantic_profile(user_id), _empty_semantic(user_id), 2.0),
        _load_with_timeout("procedural_rebuild", lambda: profile_service.load_procedural_profile(user_id), _empty_procedural(user_id), 2.0),
        _load_with_timeout("longitudinal_rebuild", lambda: profile_service.load_longitudinal(user_id), _empty_longitudinal(user_id), 2.0),
    )
    session = SessionObject(
        session_id=session_id,
        user_id=user_id,
        cultural_frame_id=(semantic or {}).get("cultural_frame_id") or "metro_social",
        longitudinal_risk_flag=bool((longitudinal or {}).get("longitudinal_risk_flag", False)),
        semantic_profile=semantic or _empty_semantic(user_id),
        procedural_profile=procedural or _empty_procedural(user_id),
        is_new_session=False,
    )
    await save_session(session)
    return session


async def check_and_increment_rate_limit(user_id: str, *, limit: Optional[int] = None) -> tuple[bool, int]:
    """Return (allowed, count_today_after_increment)."""
    if limit is None:
        limit = env().chat_daily_limit
    if limit <= 0:
        return True, 0
    key = f"rate:{user_id}"
    r = get_redis()
    if r is None:
        current = _INMEM_RATE.get(key, 0)
        if current >= limit:
            logger.warning("validation failed", extra=log_context(user_id=user_id, reason="rate_limit_exceeded", count=current, limit=limit))
            return False, current
        _INMEM_RATE[key] = current + 1
        logger.error("Redis unavailable — rate limit using in-memory counter only", extra=log_context(user_id=user_id, consequence="not_shared_across_instances"))
        return True, _INMEM_RATE[key]
    try:
        async def _increment() -> int:
            pipe = r.pipeline(transaction=True)
            pipe.incr(key)
            pipe.expire(key, _seconds_until_next_utc_day())
            values = await pipe.execute()
            return int(values[0])
        count = await guarded_call("redis", _increment, timeout_s=2.0, retries=1)
        if count > limit:
            logger.warning("validation failed", extra=log_context(user_id=user_id, reason="rate_limit_exceeded", count=count, limit=limit))
            return False, count
        return True, count
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis unavailable — rate limit bypassed for availability", extra=log_context(user_id=user_id, exception_type=type(exc).__name__, consequence="allow_turn"))
        return True, 0


def _seconds_until_next_utc_day() -> int:
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    next_day = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(60, int((next_day - now).total_seconds()))


async def cache_pending_profile_update(user_id: str, update_type: str, payload: Dict[str, Any]) -> bool:
    key = f"pending_profile_update:{user_id}"
    r = get_redis()
    if r is None:
        logger.error("Redis unavailable — pending profile update could not be cached", extra=log_context(user_id=user_id, update_type=update_type, consequence="profile_update_risk"))
        return False
    try:
        existing_raw = await r.get(key)
        existing = json.loads(existing_raw) if existing_raw else {}
        existing[update_type] = payload
        await guarded_call("redis", lambda: r.setex(key, 86400, json.dumps(existing, default=str)), timeout_s=2.0, retries=1)
        logger.warning("pending profile update cached", extra=log_context(user_id=user_id, update_type=update_type, ttl_s=86400, outcome="cached_for_retry"))
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("pending profile update cache failed", extra=log_context(user_id=user_id, update_type=update_type, exception_type=type(exc).__name__))
        return False


async def apply_pending_profile_updates(user_id: str) -> None:
    e = env()
    if e.skip_auth_effective and user_id == e.dev_user_id:
        # Local SKIP_AUTH uses a synthetic user id that often does not exist in
        # Supabase public.users. Do not keep retrying profile upserts that are
        # guaranteed to fail FK checks in this mode.
        return
    key = f"pending_profile_update:{user_id}"
    r = get_redis()
    if r is None:
        return
    try:
        raw = await r.get(key)
        if not raw:
            return
        pending = json.loads(raw)
        ok = True
        if "procedural" in pending:
            ok = await profile_service.upsert_procedural(user_id, pending["procedural"]) and ok
        if "longitudinal" in pending:
            ok = await profile_service.upsert_longitudinal(user_id, pending["longitudinal"]) and ok
        if ok:
            await r.delete(key)
            logger.info("pending profile updates applied", extra=log_context(user_id=user_id, updates=",".join(pending.keys()), outcome="applied"))
        else:
            logger.warning("pending profile updates retained", extra=log_context(user_id=user_id, updates=",".join(pending.keys()), outcome="retry_later"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("pending profile update apply failed", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))


async def mark_session_ended(session: SessionObject) -> None:
    session.status = "ended"
    await save_session(session)
    await _redis_delete(active_session_key(session.user_id))
    await _remove_from_expiry_index(session.user_id, session.session_id)


async def _remove_from_expiry_index(user_id: str, session_id: str) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await guarded_call(
            "redis",
            lambda: r.zrem(SESSION_EXPIRY_INDEX_KEY, f"{user_id}:{session_id}"),
            timeout_s=2.0,
            retries=0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("[v3 session] expiry index zrem failed: %s", exc)


# ── distributed lock for session-end pipeline ────────────────────────────
async def acquire_session_end_lock(session_id: str) -> bool:
    e = env()
    return await _redis_set_nx(
        session_lock_key(session_id),
        value=os.getenv("HOSTNAME", "host"),
        ttl_s=e.redis_session_lock_ttl_s,
    )


async def release_session_end_lock(session_id: str) -> None:
    await _redis_delete(session_lock_key(session_id))


# ── keyspace expiry listener ─────────────────────────────────────────────
async def verify_keyspace_notifications() -> bool:
    """Confirm Redis is configured to publish ``Ex`` keyspace events.

    Returns ``True`` when the running config contains both ``E`` and ``x``
    flags (or the ``A`` aggregate). The caller decides whether to raise.
    """
    r = get_redis()
    if r is None:
        return False
    try:
        cfg = await guarded_call(
            "redis",
            lambda: r.config_get("notify-keyspace-events"),
            timeout_s=1.0,
            retries=0,
        )
        value = (cfg or {}).get("notify-keyspace-events", "") if isinstance(cfg, dict) else ""
        return ("E" in value and "x" in value) or "A" in value
    except Exception as exc:  # noqa: BLE001
        # Managed Redis providers (e.g. Upstash) often restrict CONFIG. This is
        # not fatal — the caller can fall back to the expiry sweep worker.
        logger.info(
            "[v3 session] keyspace config_get unavailable; treating as disabled",
            extra=log_context(
                service="redis",
                exception_type=type(exc).__name__,
                error=str(exc)[:160],
                consequence="use_expiry_sweep",
            ),
        )
        return False


async def keyspace_listener(
    on_expired: Callable[[str, str], Awaitable[None]],
    *,
    db_index: Optional[int] = None,
) -> None:
    """Background task: subscribes to expired-key notifications and dispatches
    to ``on_expired(user_id, session_id)`` whenever a ``session:*:*`` key TTLs.
    """
    r = get_redis()
    if r is None:
        logger.warning("[v3 session] keyspace_listener disabled — no Redis")
        return

    redis_db = _redis_db_index() if db_index is None else db_index
    channel = f"__keyevent@{redis_db}__:expired"
    try:
        pubsub = r.pubsub()
        await pubsub.subscribe(channel)
        logger.info("[v3 session] subscribed to %s", channel)
        async for message in pubsub.listen():
            if message is None or message.get("type") != "message":
                continue
            key = message.get("data")
            if isinstance(key, bytes):
                key = key.decode("utf-8", errors="ignore")
            if not key or not key.startswith("session:"):
                continue
            try:
                _, user_id, session_id = key.split(":", maxsplit=2)
            except ValueError:
                continue
            try:
                await on_expired(user_id, session_id)
            except Exception as exc:  # noqa: BLE001
                logger.exception("[v3 session] on_expired raised: %s", exc)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("[v3 session] keyspace_listener crashed: %s", exc)


# ── sweep fallback (used when keyspace notifications are disabled) ───────
async def expiry_sweep(
    on_expired: Callable[[str, str], Awaitable[None]],
    *,
    interval_s: int = 60,
) -> None:
    """Poll a Redis expiry index when keyspace notifications are unavailable.

    Redis cannot ``SCAN`` keys that have already expired. ``save_session``
    therefore writes a sorted-set deadline for each active session; this
    worker consumes due entries and dispatches session-end exactly once.
    """
    r = get_redis()
    if r is None:
        logger.warning("[v3 session] expiry_sweep disabled — no Redis")
        return
    try:
        while True:
            await asyncio.sleep(interval_s)
            try:
                now = datetime.now(timezone.utc).timestamp()
                due = await guarded_call(
                    "redis",
                    lambda: r.zrangebyscore(SESSION_EXPIRY_INDEX_KEY, min=0, max=now, start=0, num=200),
                    timeout_s=2.0,
                    retries=0,
                )
                for member in due or []:
                    if isinstance(member, bytes):
                        member = member.decode("utf-8", errors="ignore")
                    try:
                        user_id, session_id = str(member).split(":", maxsplit=1)
                    except ValueError:
                        await r.zrem(SESSION_EXPIRY_INDEX_KEY, member)
                        continue
                    key = session_key(user_id, session_id)
                    ttl = await r.ttl(key)
                    if ttl and ttl > 0:
                        await r.zadd(SESSION_EXPIRY_INDEX_KEY, {member: now + ttl})
                        continue
                    await r.zrem(SESSION_EXPIRY_INDEX_KEY, member)
                    await on_expired(user_id, session_id)
            except Exception as exc:  # noqa: BLE001
                global _EXPIRY_SWEEP_WARN_AT
                now_m = time.monotonic()
                if now_m - _EXPIRY_SWEEP_WARN_AT >= 300.0:
                    _EXPIRY_SWEEP_WARN_AT = now_m
                    logger.warning(
                        "[v3 session] expiry_sweep iteration failed (throttled to 1/5min): %s",
                        exc,
                    )
    except asyncio.CancelledError:
        raise


def _redis_db_index() -> int:
    try:
        path = urlparse(env().redis_url).path.strip("/")
        return int(path or "0")
    except Exception:
        return 0

