"""Simple HTTP chat endpoint backed by the MHA v3 pipeline.

Route: ``POST /chat``. We resolve user_id from the JWT instead of trusting a
URL parameter so a stolen URL cannot impersonate a user.

The WebSocket route is intentionally not registered for now. The product only
needs request/response chat while we stabilise latency and dependencies.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, ValidationError, field_validator

from ..core import fallback as fb_mod
from ..core.auth import AuthError, authenticate_websocket, decode_supabase_jwt
from ..core.env import env
from ..core.logging import get_logger, log_context, session_id_var, trace_id_var, user_id_var
from ..core.monitoring import capture_exception, posthog_event
from ..core.session import SessionObject
from ..jobs import session_end_worker
from ..memory.embedding import get_or_compute_embedding
from ..models.signals import (
    ActivitySuggestion,
    AffectVector,
    IngestedInput,
    LLMResult,
    MemoryResult,
    OrchestratorOutput,
    PassiveSignals,
    SafetyFlags,
    SafetyResult,
    Signals,
    TurnResult,
)
from ..pipeline import (
    activity_suggestion as activity_mod,
    crisis_bypass,
    ingestion,
    llm_core,
    memory_retrieval,
    orchestrator as orch_mod,
    prompt_builder,
    safety_gate,
    signal_extraction,
)
from ..services import profile_service, session_service

logger = get_logger(__name__, layer="delivery")

router = APIRouter()


def _create_logged_task(
    coro: Any,
    *,
    name: str,
    extra: Optional[Dict[str, Any]] = None,
    log_success: bool = False,
) -> asyncio.Task[Any]:
    """Create a task and log if it fails (optionally on success)."""
    task = asyncio.create_task(coro, name=name)
    ctx = dict(extra or {})

    def _done(t: asyncio.Task[Any]) -> None:
        try:
            if t.cancelled():
                return
            exc = t.exception()
            if exc is None:
                if log_success:
                    logger.debug(
                        "background task complete",
                        extra=log_context(task=name, outcome="ok", async_task=True, **ctx),
                    )
                return
            logger.warning(
                "background task failed",
                extra=log_context(
                    task=name,
                    outcome="failed",
                    async_task=True,
                    exception_type=type(exc).__name__,
                    error=str(exc)[:160],
                    **ctx,
                ),
            )
            capture_exception(exc)
        except Exception:  # noqa: BLE001
            # Never let task callbacks crash the loop.
            return

    task.add_done_callback(_done)
    return task


SUPPORTED_RESPONSE_LANGUAGES = frozenset(
    {"english", "hindi", "hinglish", "japanese", "telugu", "kannada", "tamil"}
)


class ChatRequest(BaseModel):
    content: str
    session_id: Optional[str] = None
    device_locale: Optional[str] = None
    language: Optional[str] = None

    @field_validator("language")
    @classmethod
    def _coerce_language(cls, v: Optional[str]) -> Optional[str]:
        # Defensive: never 400 on language — silently coerce unknown values
        # to None so the pipeline falls back to the existing Hinglish path.
        if not v:
            return None
        normalised = v.strip().lower()
        return normalised if normalised in SUPPORTED_RESPONSE_LANGUAGES else None


class ChatResponse(BaseModel):
    text: str
    session_id: str
    is_new_session: bool
    mode: str
    urgency: int
    source: str
    meta: Dict[str, Any]
    timings_ms: Dict[str, float]
    trace_id: Optional[str] = None


class _HttpEventSink:
    """Tiny adapter so the existing pipeline can emit events without a socket."""

    def __init__(self) -> None:
        self.events: list[Dict[str, Any]] = []

    async def send_json(self, payload: Dict[str, Any]) -> None:
        self.events.append(payload)


async def _resolve_http_user_id(authorization: Optional[str]) -> str:
    e = env()
    if e.skip_auth_effective:
        logger.warning("[auth] HTTP SKIP_AUTH active — using DEV_USER_ID=%.8s", e.dev_user_id)
        return e.dev_user_id

    auth_uuid: Optional[str] = None
    auth_header = authorization or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[len("Bearer "):].strip()
        if token:
            try:
                auth_uuid = decode_supabase_jwt(token)
                logger.info("[auth] HTTP JWT accepted uid=%.8s", auth_uuid)
            except AuthError as exc:
                raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if auth_uuid is None:
        raise HTTPException(status_code=401, detail="Authorization header required")

    if auth_uuid == e.dev_user_id and e.skip_auth_effective:
        return auth_uuid
    return await profile_service.ensure_user_row(auth_uuid)


@router.post("/chat", response_model=ChatResponse)
async def chat_http(
    payload: ChatRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> ChatResponse:
    e = env()
    if not e.enabled:
        raise HTTPException(status_code=503, detail="MHA disabled (set MHA_V3_ENABLED=1)")

    user_id = await _resolve_http_user_id(authorization)
    content = payload.content or ""
    requested_session_id = payload.session_id or "new"
    try:
        ingestion.validate_message_content(content, user_id=user_id)
        ingestion.validate_requested_session_id(requested_session_id, user_id=user_id)
    except ingestion.InputValidationError as exc:
        raise HTTPException(status_code=400, detail={"message": exc.client_message, "reason": exc.reason}) from exc

    allowed, rate_count = await session_service.check_and_increment_rate_limit(user_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Daily chat limit reached. Please come back tomorrow.",
                "reason": "rate_limit_exceeded",
                "count": rate_count,
            },
        )

    session_t0 = time.perf_counter()
    session = await session_service.session_startup(
        user_id,
        requested_session_id=requested_session_id,
        device_locale=payload.device_locale,
        response_language=payload.language,
    )
    logger.info(
        "HTTP session ready",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            new_session=session.is_new_session,
            mode=session.current_mode,
            startup_ms=(time.perf_counter() - session_t0) * 1000,
            outcome="ready",
        ),
    )
    is_new_session = session.is_new_session

    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Session does not belong to this user.")

    sink = _HttpEventSink()
    try:
        result = await _process_turn(
            websocket=sink,  # adapter with send_json(); no actual WebSocket
            user_id=user_id,
            session=session,
            raw_message=content,
        )
    except ingestion.InputValidationError as exc:
        raise HTTPException(status_code=400, detail={"message": exc.client_message, "reason": exc.reason}) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid message payload.") from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("HTTP chat turn crashed", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))
        capture_exception(exc)
        raise HTTPException(status_code=500, detail="Something went wrong, but I’m still here. Please try again.") from exc

    final_event = next(
        (
            event
            for event in reversed(sink.events)
            if event.get("type") in {"confirmed", "replace", "crisis"}
        ),
        {},
    )
    meta = dict(final_event.get("meta") or {})
    meta.setdefault("session_id", session.session_id)
    meta.setdefault("response_source", result.source)
    return ChatResponse(
        text=str(final_event.get("text") or result.response),
        session_id=session.session_id,
        is_new_session=is_new_session,
        mode=result.mode,
        urgency=result.urgency,
        source=result.source,
        meta=meta,
        timings_ms=result.timings_ms,
        trace_id=result.trace_id,
    )


# ── activity feedback endpoint (accept | dismiss | complete) ─────────────
class ActivityFeedbackRequest(BaseModel):
    activity_id: str = Field(min_length=1, max_length=120)
    action: Literal["accepted", "dismissed", "completed"]
    trace_id: Optional[str] = None
    session_id: Optional[str] = None
    reason_code: Optional[str] = Field(default=None, max_length=80)


@router.post("/chat/activity-feedback", status_code=204)
async def chat_activity_feedback(
    payload: ActivityFeedbackRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> Response:
    """Persist a single accept/dismiss/complete event for an activity card.

    Best-effort: a Supabase outage MUST NOT block the user's chat flow, so
    failures are logged at warn but the endpoint still returns 204. The
    session-end worker rolls these rows into ``activity_affinity``.
    """
    user_id = await _resolve_http_user_id(authorization)
    row = {
        "user_id": user_id,
        "activity_id": payload.activity_id[:120],
        "action": payload.action,
        "trace_id": (payload.trace_id or "")[:64] or None,
        "session_id": (payload.session_id or "")[:64] or None,
        "reason_code": (payload.reason_code or "")[:80] or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    ok = await profile_service.write_activity_feedback(row)
    if not ok:
        logger.warning(
            "[activity-feedback] write skipped or failed",
            extra=log_context(user_id=user_id, activity_id=payload.activity_id, action=payload.action),
        )
    else:
        logger.info(
            f"[activity-feedback] {payload.action}: {payload.activity_id}",
            extra=log_context(
                user_id=user_id,
                activity_id=payload.activity_id,
                action=payload.action,
                reason_code=payload.reason_code,
            ),
        )
    return Response(status_code=204)


# ── public WebSocket route ───────────────────────────────────────────────
# WebSocket intentionally disabled. Keep the legacy handler unregistered while
# the product uses the simpler HTTP `/chat` path.
async def chat_ws(websocket: WebSocket):
    e = env()
    if not e.enabled:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "MHA disabled (set MHA_V3_ENABLED=1)"})
        await websocket.close(code=4503)
        logger.warning("[v3 ws] rejected — MHA_V3_ENABLED=0")
        return

    # ── Auth + user resolution ─────────────────────────────────────────────
    auth_uuid = await authenticate_websocket(websocket)
    if auth_uuid is None:
        return  # socket already closed by authenticate_websocket

    # Map auth UUID → internal v3 user_id.
    # For DEV_USER_ID (pure SKIP_AUTH, no real JWT) skip the Supabase lookup
    # to avoid a guaranteed FK-violation warning on every dev connection.
    if auth_uuid == e.dev_user_id and e.skip_auth_effective:
        user_id = auth_uuid
        logger.info("SKIP_AUTH dev mode — user resolved without Supabase lookup", extra=log_context(user_id=user_id, auth="skip"))
    else:
        user_id = await profile_service.ensure_user_row(auth_uuid)
        logger.info("user resolved", extra=log_context(user_id=user_id, auth_uuid=auth_uuid[:8], source="supabase"))

    logger.info("connection established", extra=log_context(user_id=user_id, remote=str(websocket.client)))

    session: Optional[SessionObject] = None
    turn_count = 0
    last_pong = time.monotonic()
    closed_by_keepalive = False
    pipeline_running = False  # suppress pong timeout while processing a turn

    async def _keepalive() -> None:
        nonlocal closed_by_keepalive
        # Ping every 30s. If no pong arrives within 90s AND the pipeline
        # is idle (not actively generating a response), close the connection.
        # During pipeline execution the client can't send pongs, so we skip
        # the timeout check — we'll close on the next idle cycle instead.
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping", "ts": int(time.time())})
                await asyncio.sleep(10)
                if pipeline_running:
                    # Reset the timer; we'll re-check next cycle.
                    last_pong_ref = time.monotonic()  # noqa: F841
                    continue
                if time.monotonic() - last_pong > 90:
                    closed_by_keepalive = True
                    logger.warning("pong timeout — closing WebSocket", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, timeout_s=90))
                    await websocket.close(code=4000, reason="pong_timeout")
                    return
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.info("keepalive stopped", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, exception_type=type(exc).__name__))
                return

    keepalive_task = asyncio.create_task(_keepalive(), name="ws.keepalive")
    try:
        while True:
            raw_event = await websocket.receive_json()
            etype = raw_event.get("type")

            # ── Protocol control frames ────────────────────────────────────
            if etype == "session_close":
                logger.info("session_close received", extra=log_context(user_id=user_id, session_id=session.session_id if session else None))
                if session:
                    _create_logged_task(
                        session_end_worker.handle_session_end(user_id, session.session_id),
                        name="session_end_worker.handle_session_end",
                        extra=log_context(user_id=user_id, session_id=session.session_id),
                    )
                await websocket.send_json({
                    "type": "session_closed",
                    "session_id": getattr(session, "session_id", None),
                })
                await websocket.close()
                return

            # Auth frames are consumed by authenticate_websocket; if any stray
            # auth frame leaks through (e.g. client re-sends), ignore it.
            if etype == "auth":
                logger.debug("ignoring stray auth frame", extra=log_context(user_id=user_id))
                continue

            if etype == "pong":
                last_pong = time.monotonic()
                logger.debug("pong received", extra=log_context(user_id=user_id, session_id=session.session_id if session else None))
                continue

            if etype != "message":
                logger.warning("unknown event type", extra=log_context(user_id=user_id, event_type=etype))
                await websocket.send_json({"type": "error", "message": f"Unknown event type {etype!r}"})
                continue

            content: str = raw_event.get("content") or ""
            turn_count += 1
            requested_session_id: Optional[str] = raw_event.get("session_id")
            try:
                ingestion.validate_message_content(content, user_id=user_id)
                ingestion.validate_requested_session_id(requested_session_id, user_id=user_id)
            except ingestion.InputValidationError as exc:
                await websocket.send_json({"type": "error", "message": exc.client_message, "reason": exc.reason})
                continue
            logger.info(
                "message frame received",
                extra=log_context(user_id=user_id, turn=turn_count, session_req=(requested_session_id or "new")[:8], len=len(content)),
            )

            # ── Lazy session startup ────────────────────────────────────────
            if session is None or (
                requested_session_id and requested_session_id not in ("new", session.session_id)
            ):
                session_t0 = time.perf_counter()
                try:
                    session = await session_service.session_startup(
                        user_id,
                        requested_session_id=requested_session_id,
                        device_locale=raw_event.get("device_locale"),
                    )
                except WebSocketDisconnect:
                    raise
                except Exception as exc:  # noqa: BLE001
                    logger.exception("session_startup crashed", extra=log_context(user_id=user_id, exception_type=type(exc).__name__))
                    capture_exception(exc)
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Failed to start session — please reconnect",
                        })
                    except Exception:  # noqa: BLE001
                        pass
                    continue

                logger.info(
                    "session_ready sent",
                    extra=log_context(
                        session_id=session.session_id,
                        user_id=user_id,
                        new_session=session.is_new_session,
                        mode=session.current_mode,
                        startup_ms=(time.perf_counter() - session_t0) * 1000,
                        outcome="ready",
                    ),
                )
                await websocket.send_json({
                    "type": "session_ready",
                    "session_id": session.session_id,
                    "is_new_session": session.is_new_session,
                    "mode": session.current_mode,
                })

            if session.user_id != user_id:
                logger.warning("validation failed", extra=log_context(session_id=session.session_id, user_id=user_id, reason="session_user_mismatch", stored_user_id=session.user_id[:8]))
                await websocket.send_json({"type": "error", "message": "Session does not belong to this user.", "reason": "session_user_mismatch"})
                continue

            allowed, rate_count = await session_service.check_and_increment_rate_limit(user_id)
            if not allowed:
                await websocket.send_json({"type": "error", "message": "Daily chat limit reached. Please come back tomorrow.", "reason": "rate_limit_exceeded", "count": rate_count})
                continue

            # ── Per-turn pipeline ───────────────────────────────────────────
            # Receiving a message proves the connection is alive; reset the
            # keepalive timer so the pong timeout cannot fire mid-pipeline.
            last_pong = time.monotonic()
            pipeline_running = True
            try:
                result = await _process_turn(
                    websocket=websocket,
                    user_id=user_id,
                    session=session,
                    raw_message=content,
                )
            except WebSocketDisconnect:
                # Client disconnected mid-turn — not an error, just exit the loop.
                raise
            except ingestion.InputValidationError as exc:
                logger.warning("turn validation rejected", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, reason=exc.reason))
                await websocket.send_json({"type": "error", "message": exc.client_message, "reason": exc.reason})
                continue
            except ValidationError as exc:
                logger.warning("turn validation rejected", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, reason="schema_validation", exception_type=type(exc).__name__))
                await websocket.send_json({"type": "error", "message": "Invalid message payload.", "reason": "schema_validation"})
                continue
            except TimeoutError:
                logger.warning("turn timeout recovered", extra=log_context(user_id=user_id, session_id=session.session_id if session else None))
                await websocket.send_json({"type": "error", "message": "taking a moment, hang on", "reason": "timeout"})
                continue
            except Exception as exc:  # noqa: BLE001
                logger.exception("turn processing crashed", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, turn=turn_count, exception_type=type(exc).__name__))
                capture_exception(exc)
                try:
                    await websocket.send_json({"type": "error", "message": "Something went wrong, but I’m still here. Please try again.", "reason": "internal_error"})
                except Exception:  # noqa: BLE001
                    pass  # socket already closed; nothing to send
                continue
            finally:
                pipeline_running = False

            memory_hits = len(result.memory.episodic_memories) if result.memory else 0
            tokens_used = result.llm.tokens_used.get("total", 0) if result.llm else 0
            llm_used = result.llm.llm_used if result.llm else "none"
            safety_state = "clean" if result.safety and not (result.safety.safety_flags.harm or result.safety.safety_flags.sycophancy) else "flagged"
            logger.info(
                f"[TURN] session={session.session_id[:8]} turn={turn_count} mode={result.mode} urgency={result.urgency} "
                f"memory={memory_hits}hits tokens={tokens_used} llm={llm_used} TTFT={result.timings_ms.get('ttft', 0):.0f}ms "
                f"total={result.timings_ms.get('total', 0):.0f}ms source={result.source} safety={safety_state}",
                extra=log_context(session_id=session.session_id, user_id=user_id, turn=turn_count),
            )

            posthog_event(
                user_id=user_id,
                name="turn_completed",
                properties={
                    "session_id": session.session_id,
                    "mode": result.mode,
                    "urgency": result.urgency,
                    "response_source": result.source,
                    "latency_total_ms": result.timings_ms.get("total"),
                    "latency_ttft_ms": result.timings_ms.get("ttft"),
                    "tokens_used": (result.llm.tokens_used.get("total") if result.llm else 0),
                    "llm_used": (result.llm.llm_used if result.llm else "none"),
                    "memory_retrieved": (result.memory.memory_retrieved if result.memory else False),
                    "safety_flags": (result.safety.safety_flags.model_dump() if result.safety else None),
                },
            )

    except WebSocketDisconnect as exc:
        logger.info(
            "disconnect",
            extra=log_context(
                user_id=user_id,
                session_id=session.session_id if session else None,
                turns=turn_count,
                close_reason="client_disconnect" if not closed_by_keepalive else "keepalive_timeout",
                close_code=getattr(exc, "code", None),
            ),
        )
    except Exception as exc:  # noqa: BLE001
        # Only log as error if it's not a client-disconnect masquerading as
        # a generic exception (uvicorn raises ClientDisconnected in some paths).
        err_str = str(type(exc).__name__)
        if "ClientDisconnected" in err_str or "ConnectionClosed" in err_str:
            logger.info("disconnect via exception", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, turns=turn_count))
        else:
            logger.exception("outer loop crashed", extra=log_context(user_id=user_id, session_id=session.session_id if session else None, exception_type=type(exc).__name__))
            capture_exception(exc)
    finally:
        keepalive_task.cancel()
        if session is not None:
            _create_logged_task(
                session_end_worker.handle_session_end(user_id, session.session_id),
                name="session_end_worker.handle_session_end",
                extra=log_context(user_id=user_id, session_id=session.session_id),
            )


# ── per-turn pipeline ────────────────────────────────────────────────────
async def _process_turn(
    *,
    websocket: WebSocket,
    user_id: str,
    session: SessionObject,
    raw_message: str,
) -> TurnResult:
    timings: Dict[str, float] = {}
    started = time.perf_counter()
    e = env()
    user_id_var.set(user_id[:8])
    session_id_var.set(session.session_id[:8])
    logger.debug(
        "turn pipeline start",
        extra=log_context(session_id=session.session_id, user_id=user_id, len=len(raw_message), why="process_user_message"),
    )

    # Refresh at turn start so Redis-side integrity recovery and safety drills
    # (e.g. manually setting urgency_history=[3]) affect the next message.
    fresh_session = await session_service.load_session(user_id, session.session_id)
    if fresh_session is not None:
        session.__dict__.update(fresh_session.__dict__)

    # ── Layer 1: ingestion (sync, <5 ms) ───────────────────────────────────
    ingested = ingestion.ingest_input(
        raw_message,
        user_id=user_id,
        session_id=session.session_id,
        is_new_session=session.is_new_session,
    )
    trace_id_var.set(ingested.trace_id)
    session.is_new_session = False
    logger.info(
        "L1 ingestion complete",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            len=len(ingested.normalised_message),
            pii=ingested.pii_detected,
            lang=ingested.language_hint,
            outcome="ready_for_signal",
        ),
    )

    # Track social mentions before downstream layers see the text
    fb_mod.update_dependency_signals(session, ingested.normalised_message)

    # ── Crisis pre-check from urgency history (cheapest, no I/O) ──────────
    if session.urgency_history and session.urgency_history[-1] == 3:
        logger.warning(
            "CRISIS PRE-CHECK TRIGGERED",
            extra=log_context(
                session_id=session.session_id,
                user_id=user_id,
                trace_id=ingested.trace_id,
                source="history",
                urgency_history=session.urgency_history[-10:],
            ),
        )
        crisis_resp = await crisis_bypass.crisis_bypass_check(
            urgency_score=3,
            user_id=user_id,
            session_id=session.session_id,
            code_mix_ratio=session.code_mix_ratio,
            response_language=session.response_language,
            trace_id=ingested.trace_id,
        )
        if crisis_resp:
            await _emit_crisis(websocket, crisis_resp.content, crisis_resp.crisis_numbers)
            await _append_turns(session, ingested, crisis_resp.content,
                                source="crisis_template", urgency=3, mode="crisis_bypass")
            _create_logged_task(
                session_service.save_session(session),
                name="session_service.save_session",
                extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id),
            )
            timings["total"] = (time.perf_counter() - started) * 1000.0
            return TurnResult(response=crisis_resp.content, source="crisis_template",
                              urgency=3, mode="crisis_bypass", ingested=ingested, timings_ms=timings, trace_id=ingested.trace_id)

    # ── PARALLEL A: Groq signal extraction + embedding ─────────────────────
    logger.debug(
        "L2 parallel block started",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            tasks="signal_extraction,embedding",
            signal_timeout_s=e.signal_extraction_timeout_s,
            embedding_timeout_s=e.embedding_timeout_s,
        ),
    )
    sig_t0 = time.perf_counter()
    signals_task = asyncio.create_task(
        signal_extraction.extract_signals(ingested, session=session)
    )
    embed_task = asyncio.create_task(get_or_compute_embedding(ingested.normalised_message))
    signals, embedding = await asyncio.gather(
        _await_or_default(
            "signal_extraction",
            signals_task,
            _fallback_signals(session),
            e.signal_extraction_timeout_s,
        ),
        _await_or_default(
            "embedding",
            embed_task,
            [0.0] * 384,
            e.embedding_timeout_s,
        ),
    )
    timings["signals"] = signals.extraction_latency_ms or 0.0

    logger.info(
        "L2 signals ready",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            urgency=signals.urgency_score,
            code_mix=signals.code_mix_ratio,
            lang=signals.language_register,
            fallback=signals.fallback_used,
            latency_ms=timings["signals"],
        ),
    )

    session.code_mix_ratio = signals.code_mix_ratio
    session.language_register = signals.language_register
    session.current_topic_keywords = list(signals.topic_keywords)

    # ── Crisis check on fresh urgency score ────────────────────────────────
    if signals.urgency_score == 3:
        logger.warning(
            "CRISIS POST-SIGNAL CHECK TRIGGERED",
            extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id, source="fresh_signal", urgency=3),
        )
        crisis_resp = await crisis_bypass.crisis_bypass_check(
            urgency_score=3,
            user_id=user_id,
            session_id=session.session_id,
            code_mix_ratio=signals.code_mix_ratio,
            response_language=session.response_language,
            trace_id=ingested.trace_id,
        )
        if crisis_resp:
            await _emit_crisis(websocket, crisis_resp.content, crisis_resp.crisis_numbers)
            await _append_turns(session, ingested, crisis_resp.content,
                                source="crisis_template", urgency=3, mode="crisis_bypass",
                                signals=signals)
            _create_logged_task(
                session_service.save_session(session),
                name="session_service.save_session",
                extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id),
            )
            timings["total"] = (time.perf_counter() - started) * 1000.0
            return TurnResult(response=crisis_resp.content, source="crisis_template",
                              urgency=3, mode="crisis_bypass", ingested=ingested, signals=signals, timings_ms=timings, trace_id=ingested.trace_id)

    # ── Layer 3: orchestrator (pure Python) ────────────────────────────────
    orchestrator = orch_mod.run_orchestrator(signals, session, trace_id=ingested.trace_id)
    logger.info(
        "L3 orchestrator ready",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            mode=orchestrator.selected_mode,
            tone_warmth=getattr(orchestrator.tone_params, "warmth", 0),
            max_tokens=orchestrator.max_response_tokens,
            outcome="ready_for_memory_prompt",
        ),
    )

    # ── Layer 3.5: activity suggestion (pure Python, deterministic) ────────
    # Conservative bias: this returns None far more often than it returns
    # a suggestion. Episodic memory is filled in below; the rule engine reads
    # session.suggestion_history for cooldown but does NOT use episodic yet —
    # we pass an empty list and let memory retrieval inform future turns.
    suggested_activity = activity_mod.suggest_activity(
        signals=signals,
        orchestrator=orchestrator,
        session=session,
        episodic_techniques_used=[],
        trace_id=ingested.trace_id,
    )

    # ── PARALLEL C: memory retrieval ───────────────────────────────────────
    logger.debug("L4 memory retrieval started", extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id))
    mem_t0 = time.perf_counter()
    memory_task = asyncio.create_task(
        memory_retrieval.retrieve_memory(
            user_id=user_id,
            embedding=embedding,
            orchestrator=orchestrator,
            session=session,
            trace_id=ingested.trace_id,
        )
    )
    partial = prompt_builder.build_partial_prompt(
        orchestrator=orchestrator,
        tone=orchestrator.tone_params,
        urgency_score=signals.urgency_score,
        trace_id=ingested.trace_id,
    )
    memory = await _await_or_default(
        "memory_retrieval",
        memory_task,
        MemoryResult(memory_retrieved=False),
        e.memory_retrieval_timeout_s,
    )
    timings["memory_ms"] = (time.perf_counter() - mem_t0) * 1000.0
    logger.info(
        "L4 memory complete",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            retrieved=memory.memory_retrieved,
            episodic=len(memory.episodic_memories),
            semantic=1 if memory.semantic_facts_injection else 0,
            latency_ms=timings["memory_ms"],
        ),
    )

    # ── Layer 3.5b: enrich activity suggestion with episodic context ───────
    # Now that memory is available, re-bias against techniques the user has
    # already done very recently in episodic history. We keep the original
    # rule decision but suppress if the chosen technique appears in the most
    # recent successful episode (avoids "didn't we just do this?").
    if suggested_activity is not None and memory.episodic_memories:
        latest_techniques = {
            t.lower()
            for t in (memory.episodic_memories[0].techniques_used or [])
        }
        # rough match on activity_id substring (e.g. "breath-sphere" ↔ "breathing")
        aid_short = suggested_activity.activity_id.lstrip("/").split("-")[0]
        if any(aid_short in t for t in latest_techniques):
            logger.info(
                f"activity suppressed — already used recently: {suggested_activity.activity_id}",
                extra=log_context(
                    session_id=session.session_id,
                    user_id=user_id,
                    trace_id=ingested.trace_id,
                    activity_id=suggested_activity.activity_id,
                ),
            )
            suggested_activity = None

    # ── Layer 5: full prompt build ──────────────────────────────────────────
    bundle = prompt_builder.build_full_prompt(
        partial=partial,
        memory=memory,
        session=session,
        ingested=ingested,
        orchestrator=orchestrator,
        signals=signals,
        suggested_activity=suggested_activity,
        max_total_tokens=e.max_total_tokens,
        trace_id=ingested.trace_id,
    )
    logger.info(
        "L5 prompt ready",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            system_len=len(bundle.system_text),
            user_len=len(bundle.user_text),
            hash=bundle.prompt_version_hash[:8],
            total_tokens=bundle.prompt_token_count,
        ),
    )

    # ── Layer 6: LLM streaming ─────────────────────────────────────────────
    logger.debug(
        "L6 LLM generation started",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            urgency=signals.urgency_score,
            mode=orchestrator.selected_mode,
            timeout_s=e.llm_generation_timeout_s,
        ),
    )
    ttft_marker: Dict[str, float] = {}
    chunk_count = [0]

    async def _send_turn_event(payload: Dict[str, Any]) -> None:
        try:
            await websocket.send_json(payload)
        except RuntimeError as exc:
            err = str(exc)
            if "close message has been sent" in err or "WebSocket is not connected" in err:
                raise WebSocketDisconnect(code=1001) from exc
            raise

    async def _on_chunk(chunk: str) -> None:
        if "ttft" not in ttft_marker:
            ttft_marker["ttft"] = (time.perf_counter() - started) * 1000.0
            logger.debug("first token streamed to client", extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id, TTFT_ms=ttft_marker["ttft"]))
        chunk_count[0] += 1
        await _send_turn_event({"type": "chunk", "text": chunk})

    llm_started = time.perf_counter()
    llm_task = asyncio.create_task(
        llm_core.generate_response(
            prompt=bundle,
            orchestrator=orchestrator,
            urgency=signals.urgency_score,
            trace_id=ingested.trace_id,
            on_chunk=_on_chunk,
        )
    )
    llm_result = await _await_or_default(
        "llm_generation",
        llm_task,
        _timeout_llm_result(),
        e.llm_generation_timeout_s,
    )
    timings["llm_ms"] = (time.perf_counter() - llm_started) * 1000.0
    timings["ttft"] = ttft_marker.get("ttft", timings["llm_ms"])

    logger.info(
        "L6 LLM complete",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            llm=llm_result.llm_used,
            tokens=llm_result.tokens_used.get("total", 0),
            finish=llm_result.finish_reason,
            chunks=chunk_count[0],
            latency_ms=timings["llm_ms"],
            fallback_chain=llm_result.fallback_chain,
        ),
    )

    # ── Layer 7: safety gate ───────────────────────────────────────────────
    logger.debug("L7 safety gate started", extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id, response_len=len(llm_result.raw_response)))

    async def _regenerate(prepend: str, temperature: float) -> str:
        """Safety-gate regeneration always uses Groq (fast, <2s).

        Using the primary Azure GPT-5 chain here would add 4-8s per retry,
        making it impossible to stay inside the safety gate timeout. Groq is
        used even when Azure is primary for chat — this is intentional.
        """
        try:
            retry_prompt = bundle.model_copy(
                update={"system_text": bundle.system_text + "\n\n" + prepend}
            )
            retry_orchestrator = orchestrator.model_copy(
                update={"temperature": temperature}
            )
            retry = await llm_core.generate_safety_retry(
                prompt=retry_prompt,
                orchestrator=retry_orchestrator,
                urgency=signals.urgency_score,
            )
            if retry.finish_reason == "error":
                return ""
            return retry.raw_response.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("safety regeneration failed", extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id, exception_type=type(exc).__name__))
            return ""

    def _hardcoded_static_fallback() -> str:
        if signals.code_mix_ratio >= 0.35:
            return "Main yahin hoon. Dheere se batao, iss waqt sabse heavy kya lag raha hai?"
        return "I'm here with you. What feels heaviest right now?"

    async def _static_fallback() -> str:
        async def _fetch_template() -> str:
            return await fb_mod.select_static_fallback(
                session_id=session.session_id,
                turn_count=session.turn_count,
                mode=orchestrator.selected_mode,
                code_mix_ratio=signals.code_mix_ratio,
                response_language=session.response_language,
            )

        try:
            return await asyncio.wait_for(
                _fetch_template(),
                timeout=1.0,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("static fallback fetch failed/timed out", extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id, exception_type=type(exc).__name__))
            return _hardcoded_static_fallback()

    default_safety = SafetyResult(
        approved=False,
        approved_response=_hardcoded_static_fallback(),
        safety_flags=SafetyFlags(),
        safety_check_result={
            "harm": False,
            "sycophancy": False,
            "hallucination": False,
            "conformance_score": 1.0,
            "length_ok": True,
            "retries_used": 0,
            "final_source": "static_fallback",
        },
        retries_used=0,
        response_source="static_fallback",
        conformance_score=1.0,
    )
    if llm_result.finish_reason == "content_filter":
        logger.warning("Azure content_filter — static fallback selected and safety gate skipped", extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id, finish="content_filter"))
        fallback = await _static_fallback()
        safety = SafetyResult(
            approved=False,
            approved_response=fallback,
            safety_flags=SafetyFlags(harm=True, harm_category="azure_content_filter"),
            safety_check_result={
                "harm": True,
                "harm_category": "azure_content_filter",
                "sycophancy": False,
                "sycophancy_type": None,
                "hallucination": False,
                "conformance_score": 1.0,
                "length_ok": True,
                "retries_used": 0,
                "final_source": "static_fallback",
            },
            retries_used=0,
            response_source="static_fallback",
            conformance_score=1.0,
        )
    else:
        safety_task = asyncio.create_task(
            safety_gate.run_safety_gate(
                raw_response=llm_result.raw_response,
                orchestrator=orchestrator,
                signals=signals,
                finish_reason=llm_result.finish_reason,
                regenerate=_regenerate,
                static_fallback=_static_fallback,
                trace_id=ingested.trace_id,
            )
        )
        safety = await _await_or_default(
            "safety_gate",
            safety_task,
            default_safety,
            e.safety_gate_timeout_s,
        )

    logger.info(
        "L7 safety complete",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            approved=safety.approved,
            source=safety.response_source,
            harm=getattr(safety.safety_flags, "harm", False),
            sycophancy=getattr(safety.safety_flags, "sycophancy", False),
            retries=safety.retries_used,
            conformance=safety.conformance_score,
        ),
    )

    # ── Emit confirmed or replace ──────────────────────────────────────────
    payload_meta = {
        "session_id": session.session_id,
        "mode": orchestrator.selected_mode,
        "urgency": signals.urgency_score,
        "response_source": safety.response_source,
        "fallback_chain": llm_result.fallback_chain,
        "memory_retrieved": memory.memory_retrieved,
        "trace_id": ingested.trace_id,
        # Personalization signals consumed by the chat surface's
        # useChatPersonalization hook (mode-adaptive treatment, warmth-tuned
        # animations, affect-reactive ambience). The client's crisis-safe
        # gate yields to a calm-clinical default on urgency >= 2 regardless.
        "tone_params": orchestrator.tone_params.model_dump(),
        "affect_vector": signals.affect_vector.model_dump(),
        "cultural_frame_id": orchestrator.cultural_frame_id,
    }
    if suggested_activity is not None and signals.urgency_score < 3:
        # Defense-in-depth: never leak a suggestion on a crisis turn even if
        # an upstream bug let one through. The rule engine already refuses
        # crisis but this is the second kill switch on the wire.
        payload_meta["suggested_activity"] = suggested_activity.model_dump(exclude_none=True)
        # Update session state so the cooldown counts against this turn and
        # the panel's "recently shown" rail can render past suggestions.
        session.last_suggestion_turn = session.turn_count
        session.last_suggestion_id = suggested_activity.activity_id
        session.suggestion_history.append({
            "turn": session.turn_count,
            "activity_id": suggested_activity.activity_id,
            "reason_code": suggested_activity.reason_code,
            "shown_at": datetime.now(timezone.utc).isoformat(),
        })
        # Keep only the last 5 entries — the panel only renders 2.
        if len(session.suggestion_history) > 5:
            session.suggestion_history = session.suggestion_history[-5:]
    event_type = "confirmed" if (safety.approved and safety.response_source == "llm_primary") else "replace"
    await _send_turn_event({"type": event_type, "text": safety.approved_response, "meta": payload_meta})
    logger.info(
        "L8 response delivery",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            sent=event_type,
            response_len=len(safety.approved_response),
            outcome="delivered",
        ),
    )

    # ── Persist turn + session ─────────────────────────────────────────────
    await _append_turns(
        session,
        ingested,
        safety.approved_response,
        source=safety.response_source,
        urgency=signals.urgency_score,
        mode=orchestrator.selected_mode,
        signals=signals,
        safety=safety,
    )
    if llm_result.tokens_used:
        session.llm_tokens_used += int(llm_result.tokens_used.get("total", 0))
    session.set_mode(orchestrator.selected_mode, orchestrator.mode_change_reason)
    _create_logged_task(
        session_service.save_session(session),
        name="session_service.save_session",
        extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id),
    )

    # ── Async audit log (fire and forget) ──────────────────────────────────
    if llm_result.finish_reason == "content_filter":
        _create_logged_task(
            profile_service.write_audit_log({
                "session_id": session.session_id,
                "user_id": user_id,
                "event_type": "azure_content_filter",
                "urgency_score": signals.urgency_score,
                "mode": orchestrator.selected_mode,
                "memory_used": memory.memory_retrieved,
                "tokens_used": int(llm_result.tokens_used.get("total", 0)),
                "llm_used": llm_result.llm_used,
                "safety_flags": safety.safety_flags.model_dump(),
            }),
            name="profile_service.write_audit_log.azure_content_filter",
            extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id),
        )
    _create_logged_task(
        profile_service.write_audit_log({
            "session_id": session.session_id,
            "user_id": user_id,
            "event_type": "turn_completed",
            "urgency_score": signals.urgency_score,
            "mode": orchestrator.selected_mode,
            "memory_used": memory.memory_retrieved,
            "tokens_used": int(llm_result.tokens_used.get("total", 0)),
            "llm_used": llm_result.llm_used,
            "safety_flags": safety.safety_flags.model_dump(),
            "extra": {
                "fallback_chain": llm_result.fallback_chain,
                "conformance_score": safety.conformance_score,
                "safety_check_result": safety.safety_check_result,
                "retries_used": safety.retries_used,
                "prompt_version_hash": bundle.prompt_version_hash,
                "blocks_used": bundle.blocks_used,
                "pii_detected": ingested.pii_detected,
                "pii_categories": ingested.pii_categories,
                "server_timestamp": ingested.server_timestamp.isoformat(),
                "mode_change_reason": orchestrator.mode_change_reason,
                "retrieval_scores": memory.retrieval_scores.model_dump(),
                "implicit_distress_signals": signals.implicit_distress_signals,
                "topic_keywords": signals.topic_keywords,
                "llm_finish_reason": llm_result.finish_reason,
                "trace_id": ingested.trace_id,
            },
        }),
        name="profile_service.write_audit_log.turn_completed",
        extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=ingested.trace_id),
    )
    logger.debug(
        "post-turn writes scheduled",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=ingested.trace_id,
            tasks="save_session,audit_log",
            async_task=True,
            outcome="scheduled",
        ),
    )

    timings["total"] = (time.perf_counter() - started) * 1000.0
    return TurnResult(
        response=safety.approved_response,
        source=safety.response_source,
        urgency=signals.urgency_score,
        mode=orchestrator.selected_mode,
        ingested=ingested,
        signals=signals,
        orchestrator=orchestrator,
        memory=memory,
        llm=llm_result,
        safety=safety,
        prompt=bundle,
        suggested_activity=suggested_activity,
        timings_ms=timings,
        trace_id=ingested.trace_id,
    )


# ── helpers ──────────────────────────────────────────────────────────────
async def _await_or_default(
    name: str,
    task: asyncio.Task[Any],
    default: Any,
    timeout_s: float,
) -> Any:
    # asyncio.shield lets wait_for cancel its own wrapper on timeout without
    # immediately cancelling the underlying task.  We then cancel the task
    # ourselves so it dies cleanly in the background while we proceed with
    # the fallback value.  This returns control to the caller promptly —
    # critical so that keepalive timers and other event-loop callbacks fire
    # on schedule rather than being delayed by slow external dependencies.
    try:
        return await asyncio.wait_for(asyncio.shield(task), timeout=max(0.1, timeout_s))
    except asyncio.TimeoutError:
        if not task.done():
            task.cancel()
            task.add_done_callback(_consume_cancelled_task)
        logger.warning(
            "pipeline dependency timed out; fallback selected",
            extra=log_context(stage=name, timeout_s=timeout_s, outcome="fallback"),
        )
        return default
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "pipeline dependency failed; fallback selected",
            extra=log_context(stage=name, exception_type=type(exc).__name__, error=str(exc), outcome="fallback"),
        )
        return default


def _consume_cancelled_task(task: asyncio.Task[Any]) -> None:
    try:
        if not task.cancelled():
            task.exception()
    except Exception:
        pass


def _fallback_signals(session: SessionObject) -> Signals:
    return Signals(
        affect_vector=AffectVector(valence=0.0, arousal=0.3, dominance=0.5),
        urgency_score=session.urgency_history[-1] if session.urgency_history else 0,
        language_register="casual",
        code_mix_ratio=session.code_mix_ratio,
        sarcasm_detected=False,
        implicit_distress_signals=["signal_extraction_timeout"],
        topic_keywords=[],
        passive_signals=PassiveSignals(),
        fallback_used=True,
        extraction_latency_ms=0.0,
    )


def _timeout_llm_result() -> LLMResult:
    return LLMResult(
        raw_response="",
        tokens_used={"prompt_tokens": 0, "completion_tokens": 0, "total": 0},
        finish_reason="error",
        llm_used="timeout",
        latency_ms=0.0,
        fallback_chain=["llm_generation_timeout"],
    )


async def _emit_crisis(websocket: WebSocket, content: str, numbers: list[str]) -> None:
    """Stream a crisis response so the frontend's streaming UI lights up."""
    await websocket.send_json({"type": "chunk", "text": content})
    await websocket.send_json({
        "type": "crisis",
        "text": content,
        "crisis_numbers": numbers,
        "meta": {"response_source": "crisis_template"},
    })
    logger.warning(
        "crisis response delivered",
        extra=log_context(sent="crisis", response_len=len(content), numbers=len(numbers), outcome="delivered"),
    )


async def _append_turns(
    session: SessionObject,
    ingested: IngestedInput,
    assistant_text: str,
    *,
    source: str,
    urgency: int,
    mode: str,
    signals: Any = None,
    safety: Any = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    session.append_turn({
        "role": "user",
        "content": ingested.normalised_message,
        "timestamp": ingested.server_timestamp.isoformat(),
        "urgency": urgency,
    })
    session.append_turn({
        "role": "assistant",
        "content": assistant_text,
        "timestamp": now,
        "source": source,
        "mode": mode,
        "urgency": urgency,
        "safety_flags": safety.safety_flags.model_dump() if safety is not None else None,
    })

    if signals is not None:
        session.append_affect({
            "turn": session.turn_count,
            "valence": signals.affect_vector.valence,
            "arousal": signals.affect_vector.arousal,
            "dominance": signals.affect_vector.dominance,
            "urgency": urgency,
            "code_mix_ratio": signals.code_mix_ratio,
            "topic_keywords": signals.topic_keywords,
        })
    else:
        session.append_affect({
            "turn": session.turn_count,
            "valence": 0.0,
            "arousal": 0.5,
            "dominance": 0.5,
            "urgency": urgency,
        })
    logger.debug(
        "session turns appended",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            source=source,
            mode=mode,
            urgency=urgency,
            turn_count=session.turn_count,
        ),
    )
