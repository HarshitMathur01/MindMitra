"""Embedding cache tests."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from app.memory import embedding


@pytest.mark.unit
@pytest.mark.asyncio
async def test_empty_text_returns_zero_vector_without_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(embedding, "get_redis", lambda: None)

    vector = await embedding.get_or_compute_embedding("")

    assert len(vector) == 384
    assert set(vector) == {0.0}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_redis_cache_hit_returns_cached_vector_without_computing(monkeypatch: pytest.MonkeyPatch) -> None:
    cached_vector = [0.5] * 384
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=json.dumps(cached_vector))

    async def fail_compute(_text: str):
        raise AssertionError("compute_embedding should not run on cache hit")

    monkeypatch.setattr(embedding, "get_redis", lambda: redis)
    monkeypatch.setattr(embedding, "compute_embedding", fail_compute)

    vector = await embedding.get_or_compute_embedding("hello cached")

    assert vector == cached_vector
    redis.get.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cache_write_failure_does_not_drop_computed_embedding(monkeypatch: pytest.MonkeyPatch) -> None:
    computed_vector = [0.25] * 384
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock(side_effect=RuntimeError("redis down"))

    async def compute(_text: str):
        return computed_vector

    monkeypatch.setattr(embedding, "get_redis", lambda: redis)
    monkeypatch.setattr(embedding, "compute_embedding", compute)

    vector = await embedding.get_or_compute_embedding("hello uncached")

    assert vector == computed_vector
    redis.setex.assert_called_once()
