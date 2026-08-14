"""Unit tests for app.services.anam_quota — the 10 min/24h Anam video cap.

What is pinned here:
  * a fresh user/day starts with the full daily quota,
  * debits reduce the remaining balance and never go negative,
  * a missing Redis key (fresh day OR eviction) is NOT treated as "nothing
    spent" when the Supabase ledger says otherwise — eviction must not be a
    free quota reset,
  * heartbeat accounting is server-clock based: the elapsed time between
    calls is what gets debited, clamped to a ceiling, never a client-supplied
    value,
  * the IST (not UTC) day boundary is what resets the counter,
  * total Redis unavailability degrades to reading/writing the Supabase
    ledger directly rather than losing enforcement.

Route-level tests for how GET /anam/session-token and POST /anam/heartbeat
use this module live in test_anam_session_token.py.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pytest

from app.services import anam_quota

USER = "quota-test-user"


# ── Fakes ─────────────────────────────────────────────────────────────────────

class _FakePipeline:
    """Mirrors the subset of a redis-py async Pipeline anam_quota.py uses."""

    def __init__(self, store: Dict[str, str]):
        self._store = store
        self._ops: List[tuple] = []

    def incrby(self, key: str, amount: int):
        self._ops.append(("incrby", key, amount))
        return self

    def expire(self, key: str, ttl: int):
        self._ops.append(("expire", key, ttl))
        return self

    async def execute(self) -> List[Any]:
        results: List[Any] = []
        for op, key, arg in self._ops:
            if op == "incrby":
                new_val = int(self._store.get(key, "0")) + arg
                self._store[key] = str(new_val)
                results.append(new_val)
            else:  # expire
                results.append(True)
        self._ops = []
        return results


class _FakeRedis:
    """In-memory async Redis double — supports get/exists/set/pipeline only."""

    def __init__(self):
        self.store: Dict[str, str] = {}

    async def get(self, key: str) -> Optional[str]:
        return self.store.get(key)

    async def exists(self, key: str) -> bool:
        return key in self.store

    async def set(self, key: str, value: Any, nx: bool = False, ex: Optional[int] = None) -> bool:
        if nx and key in self.store:
            return False
        self.store[key] = str(value)
        return True

    def pipeline(self, transaction: bool = True) -> _FakePipeline:
        return _FakePipeline(self.store)


class _Result:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data


class _FakeSupabaseTable:
    def __init__(self, rows: List[Dict[str, Any]]):
        self._rows = rows
        self._filters: Dict[str, Any] = {}
        self._upsert_payload: Optional[Dict[str, Any]] = None

    def select(self, _cols: str):
        return self

    def eq(self, col: str, value: Any):
        self._filters[col] = value
        return self

    def limit(self, _n: int):
        return self

    def upsert(self, payload: Dict[str, Any], on_conflict: Optional[str] = None):
        self._upsert_payload = payload
        return self

    def execute(self) -> _Result:
        if self._upsert_payload is not None:
            payload = self._upsert_payload
            for row in self._rows:
                if row["user_id"] == payload["user_id"] and row["usage_date"] == payload["usage_date"]:
                    row.update(payload)
                    return _Result([])
            self._rows.append(dict(payload))
            return _Result([])
        matched = [r for r in self._rows if all(r.get(k) == v for k, v in self._filters.items())]
        return _Result(matched)


class _FakeSupabase:
    def __init__(self):
        self.rows: List[Dict[str, Any]] = []

    def table(self, name: str) -> _FakeSupabaseTable:
        assert name == "anam_usage_daily"
        return _FakeSupabaseTable(self.rows)


def _frozen_now(monkeypatch, instant: datetime):
    """Patch anam_quota's `datetime` name so datetime.now(tz) returns a fixed
    instant. Subclassing the real class keeps .replace()/.timestamp()/etc.
    working normally — only `.now()` is overridden."""
    class _Frozen(datetime):
        @classmethod
        def now(cls, tz=None):  # noqa: ANN001
            return instant if tz is None else instant.astimezone(tz)

    monkeypatch.setattr(anam_quota, "datetime", _Frozen)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def fake_redis(monkeypatch):
    redis = _FakeRedis()
    monkeypatch.setattr(anam_quota, "get_redis", lambda: redis)
    return redis


@pytest.fixture
def fake_supabase(monkeypatch):
    supa = _FakeSupabase()
    monkeypatch.setattr(anam_quota, "get_supabase", lambda: supa)
    return supa


@pytest.fixture(autouse=True)
def fixed_quota_config(monkeypatch):
    """Decouple these tests from whatever config.yaml currently says."""
    monkeypatch.setattr(anam_quota, "_daily_limit_seconds", lambda: 600)
    monkeypatch.setattr(anam_quota, "min_session_seconds", lambda: 30)
    monkeypatch.setattr(anam_quota, "_heartbeat_max_delta_s", lambda: 30)


# ── Basic spend accounting ────────────────────────────────────────────────────

async def test_full_quota_when_nothing_spent(fake_redis, fake_supabase):
    assert await anam_quota.get_remaining_seconds(USER) == 600


async def test_debit_reduces_remaining(fake_redis, fake_supabase):
    remaining = await anam_quota.debit_seconds(USER, 100)
    assert remaining == 500
    assert await anam_quota.get_remaining_seconds(USER) == 500


async def test_debit_never_goes_negative(fake_redis, fake_supabase):
    remaining = await anam_quota.debit_seconds(USER, 10_000)
    assert remaining == 0


async def test_debit_of_zero_is_a_no_op_read(fake_redis, fake_supabase):
    remaining = await anam_quota.debit_seconds(USER, 0)
    assert remaining == 600


# ── Eviction must not be a free reset ─────────────────────────────────────────

async def test_missing_redis_key_rehydrates_from_ledger_not_zero(fake_redis, fake_supabase):
    """A key can be missing either because the day just started or because
    Redis evicted it after real spend. Only the ledger can tell them apart."""
    today = anam_quota._ist_today()
    fake_supabase.rows.append(
        {"user_id": USER, "usage_date": today.isoformat(), "seconds_spent": 550}
    )
    # fake_redis.store has no key for this user/day — simulates eviction.

    assert await anam_quota.get_remaining_seconds(USER) == 50  # 600 - 550, not 600


async def test_debit_after_eviction_continues_from_ledger_total(fake_redis, fake_supabase):
    today = anam_quota._ist_today()
    fake_supabase.rows.append(
        {"user_id": USER, "usage_date": today.isoformat(), "seconds_spent": 550}
    )

    remaining = await anam_quota.debit_seconds(USER, 40)

    assert remaining == 10  # 600 - (550 + 40)


def test_mirror_write_upserts_the_running_total(fake_supabase):
    today = anam_quota._ist_today()
    anam_quota._upsert_ledger_seconds_sync(USER, today, 123)

    assert len(fake_supabase.rows) == 1
    row = fake_supabase.rows[0]
    assert row["user_id"] == USER
    assert row["usage_date"] == today.isoformat()
    assert row["seconds_spent"] == 123


# ── Heartbeat: server-clock elapsed time, not client-reported ────────────────

async def test_heartbeat_first_call_anchors_baseline_and_debits_nothing(fake_redis, fake_supabase, monkeypatch):
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    await anam_quota.mark_session_start(USER)

    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 600
    assert exhausted is False


async def test_heartbeat_debits_real_elapsed_seconds(fake_redis, fake_supabase, monkeypatch):
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    await anam_quota.mark_session_start(USER)

    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 15, tzinfo=timezone.utc))
    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 585  # 600 - 15s
    assert exhausted is False


async def test_heartbeat_baseline_advances_each_call(fake_redis, fake_supabase, monkeypatch):
    """The second heartbeat must measure from the first heartbeat's timestamp,
    not accumulate the whole session's elapsed time again."""
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    await anam_quota.mark_session_start(USER)

    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 10, tzinfo=timezone.utc))
    remaining1, _ = await anam_quota.record_heartbeat(USER)
    assert remaining1 == 590

    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 20, tzinfo=timezone.utc))
    remaining2, _ = await anam_quota.record_heartbeat(USER)
    assert remaining2 == 580  # another 10s, not 20s


async def test_heartbeat_delta_is_clamped_not_client_controlled(fake_redis, fake_supabase, monkeypatch):
    """A suspended tab (or a client trying to game it by delaying calls) must
    not be able to debit more than the configured per-heartbeat ceiling."""
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    await anam_quota.mark_session_start(USER)

    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 10, 0, tzinfo=timezone.utc))  # 10 min gap
    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 570  # clamped to 30s (fixed_quota_config), not 600s
    assert exhausted is False


async def test_heartbeat_reports_exhausted_at_zero(fake_redis, fake_supabase, monkeypatch):
    monkeypatch.setattr(anam_quota, "_daily_limit_seconds", lambda: 20)
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    await anam_quota.mark_session_start(USER)

    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 25, tzinfo=timezone.utc))
    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 0
    assert exhausted is True


async def test_heartbeat_without_a_baseline_seeds_one_and_debits_nothing(fake_redis, fake_supabase, monkeypatch):
    """A heartbeat that arrives without a prior mark_session_start (missed
    mint, or the baseline key expired) must not charge a large, meaningless
    delta — it re-anchors instead."""
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))

    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 600
    assert exhausted is False


async def test_heartbeat_without_redis_seeds_baseline_on_first_call(fake_supabase, monkeypatch):
    """Regression: mark_session_start / record_heartbeat used to just `return`
    when Redis was unavailable (e.g. local dev without REDIS_URL set), so the
    counter never moved at all — this pins the fixed behaviour end to end."""
    monkeypatch.setattr(anam_quota, "get_redis", lambda: None)
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))

    await anam_quota.mark_session_start(USER)
    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 600  # baseline just seeded — nothing to debit yet
    assert exhausted is False
    today = anam_quota._ist_today()
    assert fake_supabase.rows[0]["usage_date"] == today.isoformat()
    assert fake_supabase.rows[0]["updated_at"]  # the anchor record_heartbeat will diff against


async def test_heartbeat_without_redis_debits_real_elapsed_seconds(fake_supabase, monkeypatch):
    monkeypatch.setattr(anam_quota, "get_redis", lambda: None)
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    await anam_quota.mark_session_start(USER)

    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 15, tzinfo=timezone.utc))
    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 585  # 600 - 15s, same arithmetic as the Redis path
    assert exhausted is False


async def test_heartbeat_without_redis_and_no_baseline_row_seeds_one(fake_supabase, monkeypatch):
    """No row at all yet (never minted through this path) — must seed rather
    than crash or silently report a stale value forever."""
    monkeypatch.setattr(anam_quota, "get_redis", lambda: None)
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))

    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 600
    assert exhausted is False
    assert len(fake_supabase.rows) == 1


async def test_heartbeat_without_redis_reports_exhausted_at_zero(fake_supabase, monkeypatch):
    monkeypatch.setattr(anam_quota, "get_redis", lambda: None)
    # Freeze time BEFORE computing today's IST date, so the seeded row's
    # usage_date matches what record_heartbeat looks up below.
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc))
    today = anam_quota._ist_today()
    fake_supabase.rows.append(
        {
            "user_id": USER,
            "usage_date": today.isoformat(),
            "seconds_spent": 600,
            "updated_at": datetime(2026, 6, 15, 10, 0, 0, tzinfo=timezone.utc).isoformat(),
        }
    )
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 10, 0, 5, tzinfo=timezone.utc))

    remaining, exhausted = await anam_quota.record_heartbeat(USER)

    assert remaining == 0
    assert exhausted is True


# ── IST day boundary ───────────────────────────────────────────────────────────

async def test_ist_midnight_boundary_resets_the_counter(fake_redis, fake_supabase, monkeypatch):
    # 18:29:50 UTC = 23:59:50 IST (still "today")
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 18, 29, 50, tzinfo=timezone.utc))
    remaining = await anam_quota.debit_seconds(USER, 100)
    assert remaining == 500

    # 18:30:10 UTC, 20s later — but 00:00:10 IST the *next* day.
    _frozen_now(monkeypatch, datetime(2026, 6, 15, 18, 30, 10, tzinfo=timezone.utc))
    assert await anam_quota.get_remaining_seconds(USER) == 600
