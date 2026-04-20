"""
In-process rate limiter — token-bucket per key.

Designed for low-volume endpoints (onboarding LLM, debug routes) where adding
Redis is overkill. NOT a replacement for distributed rate limiting in a
multi-replica deployment — for that, swap the backing store with Redis or a
similar shared cache.

Usage::

    from .rate_limit import RateLimiter

    onboarding_limiter = RateLimiter(max_calls=20, window_s=60.0)

    if not onboarding_limiter.try_acquire(key):
        raise HTTPException(status_code=429, detail="Too many requests")

The limiter is thread-safe via a single lock — fine for FastAPI's threadpool
under typical onboarding traffic.
"""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Deque, Dict


class RateLimiter:
    """Sliding-window per-key rate limiter."""

    def __init__(self, max_calls: int, window_s: float) -> None:
        if max_calls <= 0:
            raise ValueError("max_calls must be > 0")
        if window_s <= 0:
            raise ValueError("window_s must be > 0")
        self._max_calls = int(max_calls)
        self._window_s = float(window_s)
        self._lock = threading.Lock()
        self._hits: Dict[str, Deque[float]] = {}
        # Periodic GC threshold: clean keys we have not seen recently.
        self._last_gc_at: float = time.monotonic()
        self._gc_interval_s: float = max(60.0, window_s * 4)

    def try_acquire(self, key: str) -> bool:
        """Return True if the call is allowed, False if it should be rejected."""
        if not key:
            # Anonymous callers share a single bucket by default — callers should
            # supply an IP fallback for unauthenticated routes.
            key = "_anonymous_"
        now = time.monotonic()
        cutoff = now - self._window_s
        with self._lock:
            self._maybe_gc(now)
            bucket = self._hits.get(key)
            if bucket is None:
                bucket = deque()
                self._hits[key] = bucket
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self._max_calls:
                return False
            bucket.append(now)
            return True

    def remaining(self, key: str) -> int:
        """How many more calls this key may make in the current window."""
        if not key:
            key = "_anonymous_"
        now = time.monotonic()
        cutoff = now - self._window_s
        with self._lock:
            bucket = self._hits.get(key)
            if not bucket:
                return self._max_calls
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            return max(0, self._max_calls - len(bucket))

    def _maybe_gc(self, now: float) -> None:
        if (now - self._last_gc_at) < self._gc_interval_s:
            return
        cutoff = now - self._window_s
        # Drop keys whose buckets are now empty after expiring old entries.
        empty_keys = []
        for k, bucket in self._hits.items():
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if not bucket:
                empty_keys.append(k)
        for k in empty_keys:
            del self._hits[k]
        self._last_gc_at = now
