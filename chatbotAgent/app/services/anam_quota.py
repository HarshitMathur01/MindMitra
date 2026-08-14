"""Daily Anam avatar video quota — 10 minutes per account per 24h (IST).

Redis holds the hot per-user, per-day spend counter (seconds). Every debit
also mirrors the running total into Supabase `anam_usage_daily` so that a
Redis eviction is not a free quota reset and so there is a durable audit
trail (DPDP). On a Redis miss the counter is rehydrated from Supabase before
any increment happens.

Accounting is heartbeat-based: the caller (POST /anam/heartbeat) reports
nothing itself — this module computes elapsed seconds from its own stored
"last seen" timestamp, so a client cannot inflate its remaining time by
sending a fabricated duration. See ``mark_session_start`` / ``record_heartbeat``.

The day boundary is IST midnight (UTC+5:30, fixed offset — India has no DST,
so this needs no IANA tzdata dependency, unlike the UTC-day chat rate limit
in ``session_service.check_and_increment_rate_limit``).
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

from ..core.config import config
from ..core.connections import get_redis, get_supabase, guarded_call
from ..core.logging import get_logger, log_context

logger = get_logger(__name__, layer="avatar")

IST = timezone(timedelta(hours=5, minutes=30))

_SPEND_KEY_PREFIX = "anam:sec:"
_HEARTBEAT_KEY_PREFIX = "anam:hb:"
# Generous relative to the ~15s client interval — covers jitter and a couple
# of missed beats without letting the baseline go stale enough to matter.
_HEARTBEAT_KEY_TTL_S = 60


def _daily_limit_seconds() -> int:
    return config.get_int("avatar.session.daily_limit_seconds", 600, env="ANAM_DAILY_LIMIT_SECONDS")


def min_session_seconds() -> int:
    """Below this many remaining seconds, don't mint a token at all."""
    return config.get_int("avatar.session.min_session_seconds", 30)


def _heartbeat_max_delta_s() -> int:
    """Ceiling on how much a single heartbeat can debit.

    2x the expected client interval — enough to absorb one missed beat,
    not enough for a client to fabricate a large delta by delaying calls.
    """
    return 2 * config.get_int("avatar.session.heartbeat_interval_seconds", 15)


def _ist_today() -> date:
    return datetime.now(IST).date()


def _seconds_until_ist_midnight() -> int:
    now = datetime.now(IST)
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(60, int((next_midnight - now).total_seconds()))


def _spend_key(user_id: str, day: date) -> str:
    return f"{_SPEND_KEY_PREFIX}{user_id}:{day.isoformat()}"


def _heartbeat_key(user_id: str) -> str:
    return f"{_HEARTBEAT_KEY_PREFIX}{user_id}"


# ── Supabase ledger ─────────────────────────────────────────────────────────

async def _read_ledger_seconds(user_id: str, day: date) -> int:
    row = await _read_ledger_row(user_id, day)
    return int(row["seconds_spent"]) if row else 0


async def _read_ledger_row(user_id: str, day: date) -> Optional[Dict[str, Any]]:
    """Full row (spend + last-write timestamp), not just the spend total.

    The Redis-down heartbeat fallback needs ``updated_at`` as its elapsed-time
    baseline — there is nowhere else to anchor "when was this last touched"
    once Redis (which normally holds that via the ``anam:hb:`` key) is gone.
    """
    sb = get_supabase()
    if sb is None:
        return None

    def _read() -> Optional[Dict[str, Any]]:
        try:
            res = (
                sb.table("anam_usage_daily")
                .select("seconds_spent,updated_at")
                .eq("user_id", user_id)
                .eq("usage_date", day.isoformat())
                .limit(1)
                .execute()
            )
            rows = res.data or []
            return rows[0] if rows else None
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "ledger read failed — treating as zero spend",
                extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
            )
            return None

    return await asyncio.to_thread(_read)


def _upsert_ledger_seconds_sync(user_id: str, day: date, total_seconds: int) -> None:
    """Blocking upsert — run via ``asyncio.to_thread``, never called directly."""
    sb = get_supabase()
    if sb is None:
        return
    try:
        sb.table("anam_usage_daily").upsert(
            {
                "user_id": user_id,
                "usage_date": day.isoformat(),
                "seconds_spent": total_seconds,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id,usage_date",
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "ledger write failed",
            extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
        )


def _mirror_ledger_seconds(user_id: str, day: date, total_seconds: int) -> None:
    """Fire-and-forget mirror write — Redis already holds the authoritative
    total, so this is never on the request hot path (invariant #4)."""
    asyncio.create_task(asyncio.to_thread(_upsert_ledger_seconds_sync, user_id, day, total_seconds))


# ── Redis-backed spend counter ──────────────────────────────────────────────

async def _ensure_hydrated(user_id: str, day: date, key: str, r: object) -> None:
    """If `key` is absent (fresh day or evicted), seed it from the Supabase
    ledger rather than implicitly starting a spent user back at zero."""
    try:
        exists = await guarded_call("redis", lambda: r.exists(key), timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "redis EXISTS failed during hydration check", extra=log_context(user_id=user_id, exception_type=type(exc).__name__)
        )
        return
    if exists:
        return
    seeded = await _read_ledger_seconds(user_id, day)
    try:
        # NX: if a concurrent request already seeded it, don't clobber.
        await guarded_call(
            "redis", lambda: r.set(key, seeded, nx=True, ex=_seconds_until_ist_midnight()), timeout_s=2.0, retries=1
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("redis hydration write failed", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))


async def get_remaining_seconds(user_id: str) -> int:
    """Non-mutating read of how many seconds are left in today's (IST) quota."""
    day = _ist_today()
    limit = _daily_limit_seconds()
    if limit <= 0:
        return 10 ** 9  # quota disabled

    r = get_redis()
    if r is None:
        spent = await _read_ledger_seconds(user_id, day)
        return max(0, limit - spent)

    key = _spend_key(user_id, day)
    try:
        await _ensure_hydrated(user_id, day, key, r)
        raw = await guarded_call("redis", lambda: r.get(key), timeout_s=2.0, retries=1)
        spent = int(raw) if raw is not None else 0
        return max(0, limit - spent)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Redis unavailable — reading Anam quota from Supabase ledger",
            extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
        )
        spent = await _read_ledger_seconds(user_id, day)
        return max(0, limit - spent)


async def debit_seconds(user_id: str, seconds: int) -> int:
    """Atomically add `seconds` (clamped >= 0) to today's spend.

    Returns remaining seconds after the debit (never negative). Mirrors the
    new total into the Supabase ledger asynchronously.
    """
    seconds = max(0, int(seconds))
    day = _ist_today()
    limit = _daily_limit_seconds()

    if seconds == 0:
        return await get_remaining_seconds(user_id)

    r = get_redis()
    if r is None:
        # No Redis at all: Supabase is the only source of truth, so this must
        # be a synchronous read-modify-write rather than fire-and-forget —
        # there is nothing else holding the authoritative value between calls.
        current = await _read_ledger_seconds(user_id, day)
        total = current + seconds
        await asyncio.to_thread(_upsert_ledger_seconds_sync, user_id, day, total)
        logger.error(
            "Redis unavailable — Anam quota debited via Supabase only (degraded)",
            extra=log_context(user_id=user_id, exception_type="NoRedisClient"),
        )
        return max(0, limit - total) if limit > 0 else 10 ** 9

    key = _spend_key(user_id, day)
    try:
        await _ensure_hydrated(user_id, day, key, r)

        async def _increment() -> int:
            pipe = r.pipeline(transaction=True)
            pipe.incrby(key, seconds)
            pipe.expire(key, _seconds_until_ist_midnight())
            values = await pipe.execute()
            return int(values[0])

        total = await guarded_call("redis", _increment, timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Redis unavailable mid-debit — falling back to Supabase for this call",
            extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
        )
        current = await _read_ledger_seconds(user_id, day)
        total = current + seconds
        await asyncio.to_thread(_upsert_ledger_seconds_sync, user_id, day, total)
        return max(0, limit - total) if limit > 0 else 10 ** 9

    _mirror_ledger_seconds(user_id, day, total)
    return max(0, limit - total) if limit > 0 else 10 ** 9


# ── Heartbeat accounting ─────────────────────────────────────────────────────

async def mark_session_start(user_id: str) -> None:
    """Anchor the next heartbeat's elapsed-time calculation to now.

    Called once, at token mint. The first heartbeat's delta is measured from
    this timestamp, not from a client-supplied duration.
    """
    r = get_redis()
    now = datetime.now(timezone.utc).timestamp()
    if r is None:
        # No Redis to hold a ``anam:hb:`` baseline key — anchor in Supabase
        # instead by touching the ledger row's updated_at without changing
        # its spend. record_heartbeat's no-redis branch reads that back as
        # its "last seen" timestamp. Without this, heartbeat accounting is a
        # silent no-op whenever Redis is unavailable (e.g. local dev without
        # REDIS_URL set) — the balance never moves.
        day = _ist_today()
        current = await _read_ledger_seconds(user_id, day)
        await asyncio.to_thread(_upsert_ledger_seconds_sync, user_id, day, current)
        return
    try:
        await guarded_call(
            "redis", lambda: r.set(_heartbeat_key(user_id), now, ex=_HEARTBEAT_KEY_TTL_S), timeout_s=2.0, retries=1
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("failed to anchor heartbeat baseline", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))


async def record_heartbeat(user_id: str) -> tuple[int, bool]:
    """Debit real elapsed seconds since the last heartbeat/mint (server clock).

    Returns (remaining_seconds, exhausted). If there is no prior baseline
    (missed the mint, or the key expired), this call seeds a fresh baseline
    and debits nothing — better to lose a few seconds of accounting than to
    charge a large, meaningless delta.
    """
    r = get_redis()
    now_ts = datetime.now(timezone.utc).timestamp()
    if r is None:
        day = _ist_today()
        row = await _read_ledger_row(user_id, day)
        if row is None or not row.get("updated_at"):
            # No baseline yet — seed one (same policy as the Redis path).
            current = int(row["seconds_spent"]) if row else 0
            await asyncio.to_thread(_upsert_ledger_seconds_sync, user_id, day, current)
            limit = _daily_limit_seconds()
            remaining = max(0, limit - current) if limit > 0 else 10 ** 9
            return remaining, remaining <= 0
        last_seen = datetime.fromisoformat(row["updated_at"]).timestamp()
        delta = max(0, min(now_ts - last_seen, _heartbeat_max_delta_s()))
        remaining = await debit_seconds(user_id, round(delta))
        return remaining, remaining <= 0

    hb_key = _heartbeat_key(user_id)
    try:
        raw_prev = await guarded_call("redis", lambda: r.get(hb_key), timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.warning("heartbeat baseline read failed", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))
        raw_prev = None

    try:
        await guarded_call("redis", lambda: r.set(hb_key, now_ts, ex=_HEARTBEAT_KEY_TTL_S), timeout_s=2.0, retries=1)
    except Exception as exc:  # noqa: BLE001
        logger.warning("heartbeat baseline write failed", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))

    if raw_prev is None:
        remaining = await get_remaining_seconds(user_id)
        return remaining, remaining <= 0

    delta = max(0, min(now_ts - float(raw_prev), _heartbeat_max_delta_s()))
    remaining = await debit_seconds(user_id, round(delta))
    return remaining, remaining <= 0
