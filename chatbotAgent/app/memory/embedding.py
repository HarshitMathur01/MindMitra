"""MiniLM-based embedding with Redis cache and CPU thread pool.

CPU-bound work runs inside the cached ``ThreadPoolExecutor`` from
``connections.get_embedding_executor`` so the asyncio loop stays responsive
under load.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
from typing import List, Optional

from ..core.connections import (
    get_embedding_executor,
    get_embedding_model,
    get_redis,
)
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..core.session import embedding_cache_key

logger = get_logger(__name__, layer="memory")


def _hash16(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _zero_vector() -> List[float]:
    return [0.0] * 384


def _encode_blocking(text: str) -> List[float]:
    model = get_embedding_model()
    if model is None:
        return _zero_vector()
    vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False)
    return vec.tolist()


async def compute_embedding(text: str) -> List[float]:
    """Lower-level: always recomputes (no cache lookup)."""
    if not text:
        return _zero_vector()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(get_embedding_executor(), _encode_blocking, text)


async def get_or_compute_embedding(text: str) -> List[float]:
    """Redis-cached embedding lookup with graceful fallback."""
    if not text:
        return _zero_vector()
    key = embedding_cache_key(_hash16(text))
    r = get_redis()
    if r is not None:
        try:
            cached = await r.get(key)
            if cached:
                logger.info(
                    "embedding cache HIT",
                    extra=log_context(cache_key=key, outcome="reuse_precomputed_embedding"),
                )
                return json.loads(cached)
        except Exception as exc:  # noqa: BLE001
            logger.debug(
                "embedding cache lookup failed",
                extra=log_context(cache_key=key, exception_type=type(exc).__name__),
            )

    logger.info("embedding cache MISS — computing", extra=log_context(cache_key=key, model=env().embedding_model))
    vec = await compute_embedding(text)

    if r is not None:
        e = env()
        try:
            await r.setex(key, e.embedding_cache_ttl_s, json.dumps(vec))
        except Exception as exc:  # noqa: BLE001
            logger.debug(
                "embedding cache write failed",
                extra=log_context(cache_key=key, exception_type=type(exc).__name__),
            )
    return vec
