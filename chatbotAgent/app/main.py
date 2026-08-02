"""
app/main.py — FastAPI factory for the MindMitra backend.

This file is the deploy entrypoint Railway / Uvicorn import. The chat surface
lives behind simple HTTP ``POST /chat`` (see ``app/api/chat_ws.py``). The
legacy SSE chat / ``MITRA v2`` pipeline has been removed.

Build order is intentional — health must be reachable before any heavy
import so Railway's startup probes don't time out.

Routers registered:

* ``GET  /health``                  — Railway healthcheck
* ``POST /chat``                    — request/response chat (Layer 1..8 pipeline)
* ``POST /onboarding``              — 3-turn onboarding flow
* ``POST /transcribe``              — Groq Whisper STT for voice input
* ``POST /admin/crisis-templates/{id}/approve`` — 2-approver governance
* ``GET  /me/snapshot``             — landing-page ambience signals (Redis-cached 60s)
* ``/therapist-bridge/*``           — separate product feature (clinician handoff)
"""

# LIVE REQUEST PATH MAP (audit: MHA chat HTTP)
#
# Process boot:
#   app.main
#     -> load dotenv from chatbotAgent/.env
#     -> app.core.logging.configure_logging()
#     -> FastAPI(lifespan=lifespan)
#     -> request_logging_middleware for HTTP routes only
#     -> include health, chat, onboarding, audio, admin,
#        and therapist-bridge routers
#
# Lifespan startup:
#   app.core.monitoring.init_sentry()
#   app.core.env.env()
#   _log_startup_report() -> health_check("redis") (PING) when REDIS_URL set;
#     non-dev ENV aborts startup if ping fails
#   app.services.session_service.verify_keyspace_notifications()
#     -> app.core.connections.get_redis()
#   if keyspace notifications are enabled:
#     session_service.keyspace_listener(_on_expired)
#   else:
#     session_service.expiry_sweep(_on_expired)
#   _on_expired(user_id, session_id)
#     -> app.jobs.session_end_worker.handle_session_end()
#
# Live HTTP chat path for a user message:
#   POST /chat
#     -> app.api.chat_ws.chat_http()
#     -> app.core.env.env()
#     -> app.core.auth.decode_supabase_jwt()
#        -> decode Supabase JWT with SUPABASE_JWT_SECRET, or dev SKIP_AUTH
#     -> app.services.profile_service.ensure_user_row()
#     -> app.services.session_service.session_startup()
#        -> load/resume Redis session, or create a new SessionObject
#        -> parallel profile loads:
#           profile_service.load_semantic_profile()
#           profile_service.load_procedural_profile()
#           profile_service.load_longitudinal()
#           profile_service.fetch_most_recent_episodic()
#     -> _process_turn()
#        Layer 1: app.pipeline.ingestion.ingest_input()
#        Dependency signal update: app.core.fallback.update_dependency_signals()
#        Crisis pre-check: app.pipeline.crisis_bypass.crisis_bypass_check()
#        Parallel L2:
#          app.pipeline.signal_extraction.extract_signals()
#          app.memory.embedding.get_or_compute_embedding()
#        Fresh crisis check:
#          app.pipeline.crisis_bypass.crisis_bypass_check()
#        Layer 3: app.pipeline.orchestrator.run_orchestrator()
#        Parallel L4/L5 partial:
#          app.pipeline.memory_retrieval.retrieve_memory()
#          app.pipeline.prompt_builder.build_partial_prompt()
#        Layer 5 complete:
#          app.pipeline.prompt_builder.build_full_prompt()
#        Layer 6:
#          app.pipeline.llm_core.generate_response()
#          -> Azure / Groq / GLM clients from app.core.connections
#        Layer 7:
#          app.pipeline.safety_gate.run_safety_gate()
#          -> optional llm_core.generate_safety_retry()
#          -> app.core.fallback.select_static_fallback()
#        Layer 8:
#          append user + assistant turns to SessionObject
#          app.services.session_service.save_session()
#          fire-and-forget app.services.profile_service.write_audit_log()
#          app.core.monitoring.posthog_event()
#
# Session-end path:
#   explicit close hooks, Redis keyspace expiry, or sorted-set sweep
#     -> app.jobs.session_end_worker.handle_session_end()
#     -> session_service.acquire_session_end_lock()
#     -> session_service.load_session()
#     -> concurrently:
#        profile_service.write_session_record()
#        app.memory.episodic_write.generate_and_store_episodic()
#        app.memory.semantic_write.extract_and_merge_semantic()
#        app.memory.procedural_update.compute_procedural_ema()
#        app.memory.longitudinal_update.update_trajectory()
#     -> session_service.mark_session_ended()
from __future__ import annotations

import base64
import asyncio
import os
import socket
import tempfile
import time
import uuid
import warnings
from contextlib import asynccontextmanager
from pathlib import Path

warnings.filterwarnings("ignore", category=FutureWarning)
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _port_is_available(host: str, port: int) -> bool:
    bind_host = "" if host in {"0.0.0.0", "::"} else host
    family = socket.AF_INET6 if ":" in host and host != "0.0.0.0" else socket.AF_INET
    try:
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((bind_host, port))
        return True
    except OSError:
        return False

from dotenv import load_dotenv

_DOTENV_PATH = Path(__file__).resolve().parents[1] / ".env"
_RUNTIME_ENV_OVERRIDES = {
    key: value
    for key in ("PORT", "HOST", "UVICORN_RELOAD")
    if (value := os.getenv(key))
}
if _DOTENV_PATH.exists():
    load_dotenv(dotenv_path=_DOTENV_PATH, override=True)
else:
    load_dotenv()
os.environ.update(_RUNTIME_ENV_OVERRIDES)

# Logging must be configured before any other app import.
from app.core.logging import configure_logging, get_logger, log_context, request_id_var  # noqa: E402

configure_logging()
logger = get_logger(__name__, layer="startup")

if __name__ == "__main__":
    _early_port = int(os.getenv("PORT", 8000))
    _early_host = os.getenv("HOST", "0.0.0.0")
    if not _port_is_available(_early_host, _early_port):
        logger.error(
            "backend port already in use",
            extra=log_context(
                host=_early_host,
                port=_early_port,
                consequence="stop_existing_backend_or_choose_a_different_PORT",
            ),
        )
        raise SystemExit(f"Port {_early_port} is already in use. Stop the old backend process or set PORT to another value.")

# Heavy imports come after cheap env + port validation for the dev entrypoint.
from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402


async def _startup_check(label: str, check, *, consequence: str, timeout_s: float = 2.0) -> tuple[str, bool, float, str]:
    started = time.perf_counter()
    try:
        result = await asyncio.wait_for(_maybe_await(check()), timeout=timeout_s)
        ok = bool(result)
        detail = "connected" if ok else consequence
    except Exception as exc:  # noqa: BLE001
        ok = False
        detail = f"{consequence} ({type(exc).__name__})"
    return label, ok, (time.perf_counter() - started) * 1000, detail


async def _maybe_await(value):
    if hasattr(value, "__await__"):
        return await value
    return value


async def _log_startup_report() -> None:
    from app.core.connections import health_check
    from app.core.env import env as _env, validate_required_env

    ok_env, missing_env, config_errors, prefixes, optional_warnings = validate_required_env()
    if not ok_env:
        logger.error(
            "environment validation failed — refusing to start",
            extra=log_context(
                missing=",".join(missing_env),
                config_errors=" | ".join(config_errors) if config_errors else "",
                outcome="startup_blocked",
            ),
        )
        parts: list[str] = []
        if missing_env:
            parts.append(f"missing: {', '.join(missing_env)}")
        if config_errors:
            parts.append("; ".join(config_errors))
        raise RuntimeError("Invalid or incomplete environment: " + " — ".join(parts))

    e = _env()

    # Real TCP check: env validation only parses REDIS_URL; wrong TLS (e.g. redis://
    # to Upstash) still used to pass startup then fail in background workers.
    redis_row: tuple[str, bool, float, str]
    if e.redis_url.strip():
        rh = await health_check("redis")
        redis_ok = bool(rh.get("ok"))
        redis_ms = float(rh.get("latency_ms") or 0.0)
        err = str(rh.get("error") or "")
        if redis_ok:
            redis_row = ("Redis", True, redis_ms, f"ping ok ({redis_ms:.1f}ms)")
        else:
            redis_row = ("Redis", False, redis_ms, f"ping failed: {err[:160]}" if err else "ping failed")
        if not redis_ok:
            logger.error(
                "Redis startup PING failed",
                extra=log_context(
                    component="Redis",
                    error=err[:200],
                    env_name=e.env_name,
                    consequence="sessions_and_session_end_degraded",
                ),
            )
            if not e.is_non_prod:
                raise RuntimeError(
                    "Redis unreachable at startup (non-dev ENV). "
                    "Fix REDIS_URL — Upstash requires rediss:// — then redeploy."
                )
    else:
        redis_row = ("Redis", False, 0.0, "REDIS_URL missing")

    checks: list[tuple[str, bool, float, str]] = [
        redis_row,
        ("Supabase", bool(e.supabase_url and e.supabase_service_key), 0.0, "configured; client initializes lazily"),
        ("Qdrant", bool(e.qdrant_url), 0.0, "configured; vector client initializes lazily"),
        ("Azure OpenAI", bool(e.azure_endpoint and e.azure_api_key), 0.0, "configured; client initializes lazily"),
        ("Groq", bool(e.groq_api_key), 0.0, "configured; client initializes lazily"),
        ("Gemini", bool(e.gemini_api_key), 0.0, "configured; writer client initializes lazily"),
        ("Embedding model", bool(e.embedding_model), 0.0, "configured; model loads on first retrieval"),
        # Optional: only needed when the frontend runs VITE_AVATAR_PROVIDER=anam.
        # Absence is not fatal — the avatar falls back to the local TalkingHead renderer.
        ("Anam avatar", bool(e.anam_api_key), 0.0, "configured; POST /avatar/session-token enabled"),
    ]
    logger.info("━━━━━━ MHA AGENT STARTING ━━━━━━", extra=log_context())
    logger.info(
        "environment validated",
        extra=log_context(
            key_prefixes={k: v for k, v in prefixes.items() if not k.endswith("_loaded_from")},
            aliases={k: v for k, v in prefixes.items() if k.endswith("_loaded_from")},
            outcome="required_present",
        ),
    )
    for optional_name, warning in optional_warnings.items():
        logger.warning(warning, extra=log_context(env_var=optional_name, consequence=warning))
    logger.info("checking connections...", extra=log_context())
    for label, ok, latency_ms, detail in checks:
        marker = "✓" if ok else "✗"
        logger.info(
            f"{label:<15} {marker} {detail} ({latency_ms:.0f}ms)",
            extra=log_context(component=label, ok=ok, latency_ms=latency_ms, consequence="none" if ok else detail),
        )
    logger.info(
        "Crisis templates configured for lazy DB verification",
        extra=log_context(component="crisis_templates", verification="lazy"),
    )
    logger.info(
        "Fallback templates configured for lazy DB verification",
        extra=log_context(component="fallback_templates", verification="lazy"),
    )
    logger.info("feature flags:", extra=log_context())
    logger.info(f"psychoeducation_mode = {'ENABLED' if e.psychoeducation_enabled else 'DISABLED'}", extra=log_context())
    logger.info(f"skill_coach_mode = {'ENABLED' if e.skill_coach_enabled else 'DISABLED'}", extra=log_context())
    logger.info(f"counsellor_dashboard = {'ENABLED' if e.counsellor_dashboard_enabled else 'DISABLED'}", extra=log_context())
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", extra=log_context())
    logger.info(f"MHA Agent ready on http://localhost:{os.getenv('PORT', '8000')}/chat", extra=log_context(outcome="ready"))


async def _count_active_templates(table: str) -> int:
    from app.core.connections import get_supabase

    sb = get_supabase()
    if sb is None:
        return 0

    def _query() -> int:
        try:
            resp = sb.table(table).select("id", count="exact").eq("active", True).limit(1).execute()
            return int(getattr(resp, "count", 0) or 0)
        except Exception:
            return 0

    return await asyncio.to_thread(_query)


# ── lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.connections import install_async_client_cleanup_filter

    install_async_client_cleanup_filter()
    await _log_startup_report()

    # Monitoring (Sentry / PostHog) — safe no-ops when keys absent.
    try:
        from app.core.monitoring import init_sentry as _v3_init_sentry

        _v3_init_sentry()
    except Exception as exc:  # noqa: BLE001
        logger.info("monitoring init skipped: %s", exc)

    # Prewarm embedding model in a background thread so first-turn latency
    # doesn't include ~1–3s model load time. Fire-and-forget; startup completes
    # before warm-up finishes — the model is thread-safe once loaded.
    try:
        from app.core.connections import get_embedding_executor, get_embedding_model

        def _prewarm_embedding() -> None:
            m = get_embedding_model()
            if m is not None:
                m.encode("warm", show_progress_bar=False)
                logger.info("embedding model warm-up complete", extra=log_context(outcome="prewarm_ok"))

        import asyncio as _asyncio
        _asyncio.get_event_loop().run_in_executor(get_embedding_executor(), _prewarm_embedding)
        logger.info("embedding model warm-up started in background", extra=log_context(outcome="prewarm_started"))
    except Exception as exc:  # noqa: BLE001
        logger.info("embedding model pre-warm skipped; model loads lazily on first retrieval", extra=log_context(outcome="lazy_embedding_load", error=str(exc)))


    # Start the Redis keyspace listener (or polling fallback) outside the
    # startup critical path. Importing redis.asyncio can load jwt/cryptography
    # and has been observed to block app startup on macOS.
    try:
        from app.core.env import env as _v3_env
        from app.jobs import session_end_worker as _v3_session_end_worker
        from app.services import session_service as _v3_session_service

        if _v3_env().enabled:
            async def _on_expired(user_id: str, session_id: str) -> None:
                await _v3_session_end_worker.handle_session_end(user_id, session_id)

            async def _start_session_expiry_worker() -> None:
                try:
                    await asyncio.wait_for(
                        asyncio.to_thread(lambda: __import__("redis.asyncio")),
                        timeout=2.0,
                    )
                    mode = (_v3_env().redis_keyspace_mode or "auto").lower()
                    if mode not in ("auto", "listener", "sweep"):
                        logger.warning(
                            "Invalid REDIS_KEYSPACE_MODE; defaulting to auto",
                            extra=log_context(value=mode, consequence="auto_mode"),
                        )
                        mode = "auto"

                    if mode == "sweep":
                        logger.info(
                            "Redis session expiry worker: sweep mode",
                            extra=log_context(consequence="session_end_may_run_up_to_60s_late", outcome="started"),
                        )
                        await _v3_session_service.expiry_sweep(_on_expired)
                        return

                    if mode == "listener":
                        logger.info("Redis session expiry worker: listener mode", extra=log_context(outcome="started"))
                        await _v3_session_service.keyspace_listener(_on_expired)
                        return

                    ok = await _v3_session_service.verify_keyspace_notifications()
                    if not ok:
                        logger.info(
                            "Redis session expiry worker: keyspace unavailable; using sweep fallback",
                            extra=log_context(consequence="session_end_may_run_up_to_60s_late", outcome="fallback"),
                        )
                        await _v3_session_service.expiry_sweep(_on_expired)
                    else:
                        logger.info("Redis session expiry worker: keyspace ok; using listener", extra=log_context(outcome="started"))
                        await _v3_session_service.keyspace_listener(_on_expired)
                except asyncio.CancelledError:
                    raise
                except TimeoutError:
                    logger.warning(
                        "Redis import timed out; session expiry worker disabled for this process",
                        extra=log_context(consequence="disconnect_only_session_end"),
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "session expiry worker stopped",
                        extra=log_context(exception_type=type(exc).__name__, consequence="disconnect_only_session_end"),
                    )

            app.state.session_expiry_task = asyncio.create_task(_start_session_expiry_worker())
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "session expiry listener failed to start",
            extra=log_context(exception_type=type(exc).__name__, consequence="disconnect_only_session_end"),
        )

    yield

    # Cancel any background tasks at shutdown.
    task = getattr(app.state, "session_expiry_task", None)
    if task is not None and not task.done():
        task.cancel()
    try:
        from app.core.connections import close_async_clients

        await close_async_clients()
    except Exception as exc:  # noqa: BLE001
        logger.debug("async client shutdown cleanup failed: %s", exc)


app = FastAPI(title="MindMitra Chatbot Agent", version="3.0.0", lifespan=lifespan)


# ── request logging middleware ─────────────────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request_id_var.set(req_id)

    start = time.perf_counter()
    logger.info(f"==> [START] {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            f"<== [END] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)",
            extra={"metrics": {"status_code": response.status_code, "duration_ms": round(duration_ms, 2)}},
        )
        response.headers["X-Request-ID"] = req_id
        return response
    except Exception as exc:  # noqa: BLE001
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            f"❌ [CRASH] {request.method} {request.url.path} -> 500 ({duration_ms:.1f}ms) | ERROR: {exc}",
            extra={"metrics": {"status_code": 500, "duration_ms": round(duration_ms, 2)}},
        )
        raise


# ── /health first ──────────────────────────────────────────────────────────
from app.api.health import router as health_router  # noqa: E402

app.include_router(health_router)


# ── Google credentials passthrough (for any consumer that still uses gcloud) ─
_GOOGLE_B64 = os.getenv("GOOGLE_CREDENTIALS_BASE64", "")
_GOOGLE_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

if _GOOGLE_B64:
    try:
        creds_json = base64.b64decode(_GOOGLE_B64).decode("utf-8")
        _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
        _tmp.write(creds_json)
        _tmp.close()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name
        logger.info("✅ [INIT] Google credentials decoded → %s", _tmp.name)
    except Exception as exc:  # noqa: BLE001
        logger.error("❌ [INIT] Failed to decode GOOGLE_CREDENTIALS_BASE64: %s", exc)
elif _GOOGLE_PATH and os.path.exists(_GOOGLE_PATH):
    logger.info("✅ [INIT] Google credentials loaded from file: %s", _GOOGLE_PATH)


# ── CORS ───────────────────────────────────────────────────────────────────
from app.core.env import env as _runtime_env  # noqa: E402

_settings = _runtime_env()
cors_origins = list(dict.fromkeys(_settings.cors_allow_origins + _settings.cors_extra_allow_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=_settings.cors_allow_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── routers (MHA is the main stack; therapist-bridge is a sibling feature) ─
from app.api.therapist_bridge import router as therapist_bridge_router  # noqa: E402
from app.api.admin import router as v3_admin_router  # noqa: E402
from app.api.audio import router as v3_audio_router  # noqa: E402
from app.api.avatar import router as v3_avatar_router  # noqa: E402
from app.api.chat_ws import router as v3_chat_router  # noqa: E402
from app.api.onboarding import router as v3_onboarding_router  # noqa: E402
from app.api.snapshot import router as v3_snapshot_router  # noqa: E402
from app.api.anam import router as anam_router  # noqa: E402

app.include_router(v3_chat_router)
app.include_router(v3_onboarding_router)
app.include_router(v3_audio_router)
app.include_router(v3_avatar_router)
app.include_router(v3_admin_router)
app.include_router(v3_snapshot_router)
app.include_router(therapist_bridge_router)
app.include_router(anam_router)


# ── Dev entrypoint ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload_enabled = _env_bool("UVICORN_RELOAD", False)
    if not _port_is_available(host, port):
        logger.error(
            "backend port already in use",
            extra=log_context(
                host=host,
                port=port,
                consequence="stop_existing_backend_or_choose_a_different_PORT",
            ),
        )
        raise SystemExit(f"Port {port} is already in use. Stop the old backend process or set PORT to another value.")

    logger.info(
        "starting uvicorn",
        extra=log_context(host=host, port=port, reload=reload_enabled),
    )
    uvicorn.run(
        "app.main:app" if reload_enabled else app,
        host=host,
        port=port,
        log_level="info",
        reload=reload_enabled,
        reload_dirs=["app"] if reload_enabled else None,
    )
