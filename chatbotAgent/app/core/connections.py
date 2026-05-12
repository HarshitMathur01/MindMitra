"""Lazy singleton connection factories for the v3 stack.

Every external dependency (Redis, Supabase, Qdrant, Groq, Azure, Gemini, GLM)
is constructed on first access so importing this module is cheap (no network
calls at import time). Each accessor returns ``None`` if the relevant env vars
are missing — callers are responsible for falling back through the graceful
degradation tree in :mod:`app.core.fallback`.
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Any, Awaitable, Callable, Deque, Dict, Optional, TypeVar

from .env import env
from .logging import get_logger, log_context

logger = get_logger(__name__)

T = TypeVar("T")

SERVICE_TIMEOUTS: Dict[str, float] = {
    "redis": 2.0,
    "supabase": 5.0,
    "qdrant": 4.0,
    "azure": 8.0,
    "groq": 5.0,
    "gemini": 8.0,
    "glm": 8.0,
}
CIRCUIT_FAILURE_THRESHOLD = 3
CIRCUIT_WINDOW_S = 60.0
HALF_OPEN_AFTER_S = 60.0


@dataclass
class CircuitState:
    state: str = "closed"  # closed | open | half-open
    failures: Deque[float] = field(default_factory=deque)
    opened_at: Optional[float] = None


CIRCUIT_BREAKERS: Dict[str, CircuitState] = {
    service: CircuitState() for service in SERVICE_TIMEOUTS
}
_SUPABASE_CLIENT: Any | None = None
_REDIS_POOLS: Dict[int, Any] = {}
_ASYNC_CLIENTS: Dict[tuple[str, int], Any] = {}
_LOOP_EXCEPTION_HANDLERS_INSTALLED: set[int] = set()


def _loop_id() -> int:
    """Return the current event-loop id, or 0 outside async code."""
    try:
        return id(asyncio.get_running_loop())
    except RuntimeError:
        return 0


def install_async_client_cleanup_filter() -> None:
    """Suppress one known benign SDK cleanup exception.

    OpenAI/Groq SDKs wrap ``httpx.AsyncClient``. When short-lived SDK clients
    are garbage-collected, their wrapper may schedule ``AsyncClient.aclose()``
    after uvloop has already closed the underlying transport. The request has
    already completed successfully; the default asyncio handler then logs a
    scary "Task exception was never retrieved" RuntimeError.

    We still fix ownership by caching provider clients per event loop. This
    filter is a last-mile guard for the exact closed-transport cleanup path
    and forwards every other exception to the previous/default handler.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop_id = id(loop)
    if loop_id in _LOOP_EXCEPTION_HANDLERS_INSTALLED:
        return

    previous_handler = loop.get_exception_handler()

    def _handler(loop: asyncio.AbstractEventLoop, context: Dict[str, Any]) -> None:
        exc = context.get("exception")
        future = context.get("future")
        message = str(context.get("message", ""))
        coro_name = ""
        if future is not None:
            coro = getattr(future, "get_coro", lambda: None)()
            coro_name = getattr(coro, "__qualname__", "") or getattr(coro, "__name__", "")

        if (
            isinstance(exc, RuntimeError)
            and "Task exception was never retrieved" in message
            and "AsyncClient.aclose" in coro_name
            and "handler is closed" in str(exc)
        ):
            logger.debug(
                "suppressed closed httpx client cleanup exception",
                extra=log_context(exception_type=type(exc).__name__, cleanup="httpx_async_client"),
            )
            return

        if previous_handler is not None:
            previous_handler(loop, context)
        else:
            loop.default_exception_handler(context)

    loop.set_exception_handler(_handler)
    _LOOP_EXCEPTION_HANDLERS_INSTALLED.add(loop_id)


def _state(service: str) -> CircuitState:
    return CIRCUIT_BREAKERS.setdefault(service, CircuitState())


def circuit_allows_call(service: str) -> bool:
    state = _state(service)
    if state.state != "open":
        return True
    opened_at = state.opened_at or 0.0
    if time.monotonic() - opened_at >= HALF_OPEN_AFTER_S:
        state.state = "half-open"
        logger.warning(
            "circuit breaker half-open",
            extra=log_context(service=service, state="half-open", reason="cooldown_elapsed"),
        )
        return True
    return False


def is_degraded(service: str) -> bool:
    return not circuit_allows_call(service)


def record_success(service: str) -> None:
    state = _state(service)
    if state.state in ("open", "half-open"):
        logger.info(
            "circuit breaker closed",
            extra=log_context(service=service, previous_state=state.state, state="closed"),
        )
    state.state = "closed"
    state.failures.clear()
    state.opened_at = None


def record_failure(service: str, exc: BaseException | str) -> None:
    now = time.monotonic()
    state = _state(service)
    state.failures.append(now)
    while state.failures and now - state.failures[0] > CIRCUIT_WINDOW_S:
        state.failures.popleft()

    if state.state == "half-open" or len(state.failures) >= CIRCUIT_FAILURE_THRESHOLD:
        if state.state != "open":
            logger.error(
                "circuit breaker opened",
                extra=log_context(
                    service=service,
                    state="open",
                    failures=len(state.failures),
                    window_s=CIRCUIT_WINDOW_S,
                    error=str(exc)[:160],
                ),
            )
        state.state = "open"
        state.opened_at = now


def _is_transient_error(exc: BaseException) -> bool:
    status = getattr(exc, "status_code", None)
    if status is None:
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", None)
    if status in (429, 503):
        return True
    text = str(exc).lower()
    return "429" in text or "503" in text or "temporarily unavailable" in text


async def guarded_call(
    service: str,
    operation: Callable[[], Awaitable[T] | T],
    *,
    timeout_s: Optional[float] = None,
    retries: int = 2,
) -> T:
    """Run one external-service operation with timeout, retry, and circuit state."""
    if not circuit_allows_call(service):
        raise RuntimeError(f"{service} circuit open")

    last_exc: BaseException | None = None
    attempts = max(1, retries + 1)
    for attempt in range(attempts):
        try:
            value = operation()
            if hasattr(value, "__await__"):
                result = await asyncio.wait_for(value, timeout=timeout_s or SERVICE_TIMEOUTS.get(service, 5.0))
            else:
                result = value
            record_success(service)
            return result
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            retryable = _is_transient_error(exc) and attempt < attempts - 1
            logger.warning(
                "external call failed",
                extra=log_context(
                    service=service,
                    attempt=attempt + 1,
                    retry=retryable,
                    exception_type=type(exc).__name__,
                    error=str(exc)[:160],
                ),
            )
            if not retryable:
                record_failure(service, exc)
                raise
            await asyncio.sleep(0.5 * (2 ** attempt))

    assert last_exc is not None
    record_failure(service, last_exc)
    raise last_exc


async def health_check(service: str) -> Dict[str, Any]:
    """Return health status and latency for one configured external service."""
    started = time.perf_counter()
    try:
        if service == "redis":
            client = get_redis()
            if client is None:
                raise RuntimeError("redis client unavailable")
            await guarded_call("redis", lambda: client.ping(), timeout_s=SERVICE_TIMEOUTS["redis"], retries=0)
        elif service == "supabase":
            client = get_supabase()
            if client is None:
                raise RuntimeError("supabase client unavailable")
            await guarded_call("supabase", lambda: asyncio.to_thread(lambda: client.table("users").select("id").limit(1).execute()), timeout_s=SERVICE_TIMEOUTS["supabase"], retries=0)
        elif service == "qdrant":
            client = get_qdrant()
            if client is None:
                raise RuntimeError("qdrant client unavailable")
            await guarded_call("qdrant", lambda: client.get_collections(), timeout_s=SERVICE_TIMEOUTS["qdrant"], retries=0)
        elif service == "azure":
            if get_azure() is None:
                raise RuntimeError("azure client unavailable")
        elif service == "groq":
            if get_groq() is None:
                raise RuntimeError("groq client unavailable")
        elif service == "gemini":
            if get_gemini() is None:
                raise RuntimeError("gemini client unavailable")
        else:
            raise ValueError(f"unknown service {service!r}")
        latency_ms = (time.perf_counter() - started) * 1000.0
        record_success(service)
        return {"service": service, "ok": True, "latency_ms": latency_ms, "error": None}
    except Exception as exc:  # noqa: BLE001
        latency_ms = (time.perf_counter() - started) * 1000.0
        record_failure(service, exc)
        return {"service": service, "ok": False, "latency_ms": latency_ms, "error": str(exc)}


async def health_check_all() -> Dict[str, Dict[str, Any]]:
    results = await asyncio.gather(*(health_check(service) for service in ("redis", "supabase", "qdrant", "azure", "groq", "gemini")))
    return {str(item["service"]): item for item in results}


# ── Redis ─────────────────────────────────────────────────────────────────
def get_redis_pool() -> Any:
    """Returns an aioredis-compatible connection pool, or ``None`` if unset."""
    if is_degraded("redis"):
        logger.warning("Redis circuit open — sessions will use in-memory fallback", extra=log_context(service="redis", consequence="in_memory_sessions"))
        return None
    loop_id = _loop_id()
    cached = _REDIS_POOLS.get(loop_id)
    if cached is not None:
        return cached
    e = env()
    if not e.redis_url:
        logger.warning("[v3 conn] REDIS_URL missing — Redis disabled, sessions will be in-memory only")
        return None
    try:
        import redis.asyncio as redis_asyncio
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] redis.asyncio import failed: %s", exc)
        return None
    pool = redis_asyncio.ConnectionPool.from_url(
        e.redis_url, max_connections=20, decode_responses=True
    )
    _REDIS_POOLS[loop_id] = pool
    return pool


def get_redis() -> Any:
    """Returns an async Redis client, or ``None`` if unavailable."""
    if is_degraded("redis"):
        logger.warning("Redis circuit open — sessions will use in-memory fallback", extra=log_context(service="redis", consequence="in_memory_sessions"))
        return None
    pool = get_redis_pool()
    if pool is None:
        return None
    try:
        import redis.asyncio as redis_asyncio
    except Exception:  # noqa: BLE001
        return None
    return redis_asyncio.Redis(connection_pool=pool)


# ── Supabase (sync client, run in threadpool from async code) ────────────
def get_supabase() -> Any:
    global _SUPABASE_CLIENT
    if is_degraded("supabase"):
        logger.warning("Supabase circuit open — DB features degraded", extra=log_context(service="supabase", consequence="profile_audit_defaults"))
        return None
    if _SUPABASE_CLIENT is not None:
        return _SUPABASE_CLIENT
    e = env()
    if not e.supabase_url or not e.supabase_service_key:
        logger.warning("[v3 conn] Supabase env missing — DB features disabled")
        return None
    try:
        from supabase import ClientOptions, create_client
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] supabase sdk import failed: %s", exc)
        return None
    try:
        options = ClientOptions(postgrest_client_timeout=SERVICE_TIMEOUTS["supabase"])
        _SUPABASE_CLIENT = create_client(e.supabase_url, e.supabase_service_key, options=options)
        return _SUPABASE_CLIENT
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] supabase create_client failed: %s", exc)
        return None


# ── Qdrant ───────────────────────────────────────────────────────────────
def get_qdrant() -> Any:
    if is_degraded("qdrant"):
        logger.warning("Qdrant circuit open — memory retrieval skipped", extra=log_context(service="qdrant", consequence="episodic_memory_disabled"))
        return None
    e = env()
    if not e.qdrant_url:
        logger.warning("[v3 conn] QDRANT_URL missing — vector recall disabled")
        return None
    try:
        from qdrant_client import AsyncQdrantClient
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] qdrant-client import failed: %s", exc)
        return None
    try:
        return AsyncQdrantClient(url=e.qdrant_url, api_key=e.qdrant_api_key, timeout=SERVICE_TIMEOUTS["qdrant"])
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] AsyncQdrantClient init failed: %s", exc)
        return None


# ── Groq (async) ─────────────────────────────────────────────────────────
def get_groq() -> Any:
    """Return a Groq async client bound to the caller's event loop."""
    if is_degraded("groq"):
        logger.warning("Groq circuit open — signal/safety use degraded paths", extra=log_context(service="groq", consequence="signal_safety_degraded"))
        return None
    e = env()
    if not e.groq_api_key:
        return None
    cache_key = ("groq", _loop_id())
    cached = _ASYNC_CLIENTS.get(cache_key)
    if cached is not None:
        return cached
    try:
        from groq import AsyncGroq
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] groq sdk import failed: %s", exc)
        return None
    client = AsyncGroq(api_key=e.groq_api_key, timeout=SERVICE_TIMEOUTS["groq"], max_retries=0)
    _ASYNC_CLIENTS[cache_key] = client
    return client


# ── Azure OpenAI (async) ─────────────────────────────────────────────────
def get_azure() -> Any:
    """Return an Azure async client bound to the caller's event loop."""
    if is_degraded("azure"):
        logger.warning("Azure circuit open — routing to fallback LLM", extra=log_context(service="azure", consequence="llm_fallback"))
        return None
    e = env()
    if not e.azure_endpoint or not e.azure_api_key:
        return None
    cache_key = ("azure", _loop_id())
    cached = _ASYNC_CLIENTS.get(cache_key)
    if cached is not None:
        return cached
    try:
        from openai import AsyncAzureOpenAI
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] openai sdk import failed: %s", exc)
        return None
    client = AsyncAzureOpenAI(
        azure_endpoint=e.azure_endpoint,
        api_key=e.azure_api_key,
        api_version=e.azure_api_version,
        timeout=SERVICE_TIMEOUTS["azure"],
        max_retries=0,
    )
    _ASYNC_CLIENTS[cache_key] = client
    return client


# ── Gemini (sync — used for async session-end tasks via to_thread) ───────
def get_gemini() -> Any:
    if is_degraded("gemini"):
        logger.warning("Gemini circuit open — session summaries use fallback", extra=log_context(service="gemini", consequence="summary_fallback"))
        return None
    e = env()
    if not e.gemini_api_key:
        return None
    try:
        import google.generativeai as genai
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] google-generativeai import failed: %s", exc)
        return None
    try:
        genai.configure(api_key=e.gemini_api_key)
        return genai.GenerativeModel(e.gemini_model)
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] gemini configure failed: %s", exc)
        return None


# ── GLM-4-Flash (async, OpenAI-compatible base URL) ──────────────────────
def get_glm() -> Any:
    """Returns an OpenAI-compatible async client pointed at GLM's API.

    The GLM-4 ChatCompletions endpoint accepts the OpenAI v1 schema; routing
    through the official ``openai`` client lets us reuse the streaming
    plumbing without writing a bespoke HTTP wrapper.
    """
    if is_degraded("glm"):
        logger.warning("GLM circuit open — static fallback may be used", extra=log_context(service="glm", consequence="static_fallback"))
        return None
    e = env()
    if not e.glm_api_key:
        return None
    cache_key = ("glm", _loop_id())
    cached = _ASYNC_CLIENTS.get(cache_key)
    if cached is not None:
        return cached
    try:
        from openai import AsyncOpenAI
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] openai sdk import failed: %s", exc)
        return None
    client = AsyncOpenAI(api_key=e.glm_api_key, base_url=e.glm_api_base, timeout=e.glm_timeout_s, max_retries=0)
    _ASYNC_CLIENTS[cache_key] = client
    return client


# ── Embedding ThreadPool ─────────────────────────────────────────────────
@lru_cache(maxsize=1)
def get_embedding_executor() -> ThreadPoolExecutor:
    e = env()
    return ThreadPoolExecutor(max_workers=max(1, e.embedding_pool_workers), thread_name_prefix="v3-embed")


# ── Embedding model (lazy load — first hit takes ~1s, after that warm) ──
_embedding_model = None


def get_embedding_model() -> Any:
    """Returns a SentenceTransformer instance, or ``None`` if unavailable."""
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    e = env()
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] sentence-transformers import failed: %s", exc)
        return None
    try:
        _embedding_model = SentenceTransformer(e.embedding_model)
        logger.info("[v3 conn] loaded embedding model %s", e.embedding_model)
        return _embedding_model
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 conn] embedding model load failed: %s", exc)
        return None


# ── Shutdown / test helpers ──────────────────────────────────────────────
def reset_all() -> None:
    """Test helper — clear every cached client. Don't call in production."""
    for fn in (get_redis_pool, get_supabase, get_qdrant, get_gemini, get_embedding_executor):
        if hasattr(fn, "cache_clear"):
            fn.cache_clear()
    _REDIS_POOLS.clear()
    _ASYNC_CLIENTS.clear()
    global _embedding_model, _SUPABASE_CLIENT
    _embedding_model = None
    _SUPABASE_CLIENT = None


async def close_async_clients() -> None:
    """Close cached async SDK clients during FastAPI shutdown."""
    clients = list(_ASYNC_CLIENTS.values())
    _ASYNC_CLIENTS.clear()
    for client in clients:
        close = getattr(client, "close", None) or getattr(client, "aclose", None)
        if close is None:
            continue
        try:
            value = close()
            if hasattr(value, "__await__"):
                await value
        except RuntimeError as exc:
            if "handler is closed" in str(exc):
                logger.debug("ignored closed transport while closing async client")
                continue
            raise
        except Exception as exc:  # noqa: BLE001
            logger.debug("async client close failed", extra=log_context(exception_type=type(exc).__name__))
