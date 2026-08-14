"""Anam AI avatar session-token proxy.

Exposes ``GET /anam/session-token`` so the React frontend can start an
Anam avatar session without ever seeing the ANAM_API_KEY.

Flow:
    Browser  →  GET /anam/session-token?avatar_id=… (with Supabase JWT)
    Backend  →  POST {anam_api_base}/auth/session-token  (with ANAM_API_KEY)
    Backend  →  returns short-lived sessionToken to browser
    Browser  →  createClient(sessionToken) — safe, no secret exposed

Auth: same Supabase JWT used by /chat.

The persona is built server-side by ``app.api.avatar.build_persona_config``
from the ``avatar:`` block of ``config.yaml`` — voice, turn-taking, greeting,
director notes and system tools included. The client supplies at most an avatar
id, never a ``personaConfig``: a browser-supplied system prompt on a
mental-health surface is a prompt-injection hole.

This is **turnkey** mode — Anam's own LLM writes the replies, so
``app/pipeline/crisis_bypass.py`` is not inline. ``POST /anam/crisis-check``
below is the compensating control and the frontend must call it on every user
utterance. See ``docs/anam-avatar.md``.

The session token issued by Anam is short-lived. Clients should re-fetch when
they receive a session-expired error from the SDK.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from ..core.auth import AuthError, decode_supabase_jwt
from ..core.config import config
from ..core.env import env
from ..services import anam_quota
from .avatar import build_persona_config, build_session_options

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/anam", tags=["anam"])


class AnamSessionTokenResponse(BaseModel):
    sessionToken: str
    avatarId: str
    #: Daily (IST) Anam video quota remaining as of this mint, before this
    #: session spends any of it. Lets the frontend show "N left today"
    #: immediately, without waiting for the first heartbeat.
    remainingSeconds: int
    #: The per-session ceiling actually placed on this token — the smaller of
    #: the configured max and the caller's remaining daily quota. Anam itself
    #: enforces this and will close the connection when it elapses.
    maxSessionLengthSeconds: int


def _default_avatar_id() -> str:
    return config.get_str("avatar.default_persona", "brunette")


# Anam's languageCode is fixed for the life of a session — only the
# change_language system tool can move it mid-call. Seeding it from the user's
# chosen language means the first utterance transcribes correctly instead of
# needing the persona to notice and switch. Allow-listed rather than passed
# through: this reaches a vendor's transcription config, and "whatever the
# client sent" is not a thing we forward.
_ALLOWED_LANGUAGE_CODES = frozenset({"en", "hi", "ta", "te", "kn", "ja"})


def _resolve_language_code(requested: Optional[str]) -> Optional[str]:
    """Map a UI language hint onto an ISO 639-1 code Anam accepts."""
    raw = (requested or "").strip().lower()
    if not raw:
        return None
    primary = raw.split("-", 1)[0].split("_", 1)[0]
    return primary if primary in _ALLOWED_LANGUAGE_CODES else None


def _resolve_user_id(authorization: Optional[str]) -> str:
    e = env()
    # In dev with SKIP_AUTH=true, bypass all JWT validation unconditionally.
    # This matches the behaviour of validate_user_token in app/core/auth.py.
    if e.skip_auth_effective:
        return e.dev_user_id
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    try:
        return decode_supabase_jwt(authorization.removeprefix("Bearer "))
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=f"JWT invalid: {exc}")


@router.get("/session-token", response_model=AnamSessionTokenResponse)
async def get_anam_session_token(
    authorization: Optional[str] = Header(default=None),
    avatar_id: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
):
    """Issue a short-lived Anam session token for the browser to start an avatar session.

    The frontend calls this before initialising the @anam-ai/js-sdk client.
    The ANAM_API_KEY never leaves the server.

    ``avatar_id`` selects a persona from the server-side table; anything not in
    that table is a 400. It is only a key, never config. ``language`` seeds the
    transcription language and is allow-listed; anything unrecognised falls back
    to the configured default rather than erroring.

    Gated by the daily (IST) Anam video quota (``app.services.anam_quota``):
    a 429 below ``min_session_seconds`` remaining, and otherwise
    ``maxSessionLengthSeconds`` is clamped to whatever quota is left so Anam's
    own session timer is the hard backstop even if the client stops sending
    heartbeats.
    """
    user_id = _resolve_user_id(authorization)

    e = env()
    if not e.anam_api_key:
        raise HTTPException(
            status_code=503,
            detail="ANAM_API_KEY is not configured on the server.",
        )

    remaining = await anam_quota.get_remaining_seconds(user_id)
    if remaining < anam_quota.min_session_seconds():
        raise HTTPException(
            status_code=429,
            detail="Daily avatar video limit reached. Come back after midnight IST.",
        )

    resolved_avatar_id = (avatar_id or "").strip() or _default_avatar_id()
    persona_config = build_persona_config(resolved_avatar_id)

    language_code = _resolve_language_code(language)
    if language_code:
        persona_config["languageCode"] = language_code

    # Anam enforces this server-side and closes the WebRTC connection when it
    # elapses (CONNECTION_CLOSED / SERVER_CLOSED_CONNECTION) — the backstop
    # that holds even if the client's heartbeat loop dies or lies.
    configured_max = persona_config.get("maxSessionLengthSeconds")
    session_cap = min(int(configured_max), remaining) if configured_max is not None else remaining
    persona_config["maxSessionLengthSeconds"] = session_cap

    body: dict = {"personaConfig": persona_config}
    session_options = build_session_options()
    if session_options:
        body["sessionOptions"] = session_options

    url = f"{e.anam_api_base.rstrip('/')}/auth/session-token"

    try:
        async with httpx.AsyncClient(timeout=e.anam_timeout_s) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {e.anam_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
    except httpx.TimeoutException as exc:
        logger.error("[anam] session-token request timed out: %s", exc)
        raise HTTPException(status_code=504, detail="Anam API timed out") from exc
    except httpx.HTTPError as exc:
        logger.error("[anam] session-token request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Anam API unreachable") from exc

    if response.status_code != 200:
        # Never echo the upstream body: Anam mirrors the request back on
        # validation errors, and the request carries the persona system prompt.
        logger.error("[anam] session-token non-200: status=%d", response.status_code)
        raise HTTPException(
            status_code=502,
            detail=f"Anam API returned {response.status_code}",
        )

    try:
        data = response.json()
        session_token = data["sessionToken"]
    except (KeyError, ValueError) as exc:
        logger.error("[anam] session-token response malformed: %s", exc)
        raise HTTPException(status_code=502, detail="Anam API returned unexpected response format") from exc

    await anam_quota.mark_session_start(user_id)

    logger.info(
        "[anam] session token issued for avatar=%s session_cap_s=%d remaining_s=%d",
        resolved_avatar_id, session_cap, remaining,
    )

    return AnamSessionTokenResponse(
        sessionToken=session_token,
        avatarId=resolved_avatar_id,
        remainingSeconds=remaining,
        maxSessionLengthSeconds=session_cap,
    )


# ── Daily video quota: heartbeat ──────────────────────────────────────────────
#
# The frontend calls this on a fixed ~15s interval while the Anam <video> is
# actually playing (started on VIDEO_PLAY_STARTED, stopped on unmount/close —
# see useAnamAvatar.ts). The request carries no duration: anam_quota computes
# elapsed time itself from a server-side "last seen" timestamp anchored at
# token mint, so a client cannot inflate its remaining balance by reporting a
# fabricated duration or by polling faster than the interval.


class AnamHeartbeatRequest(BaseModel):
    """No duration field on purpose — see module note above."""
    session_id: Optional[str] = None  # logging only; quota is keyed by user_id


class AnamHeartbeatResponse(BaseModel):
    remaining_seconds: int
    exhausted: bool


@router.post("/heartbeat", response_model=AnamHeartbeatResponse)
async def anam_heartbeat(
    payload: AnamHeartbeatRequest,
    authorization: Optional[str] = Header(default=None),
) -> AnamHeartbeatResponse:
    """Debit real elapsed Anam video time against the caller's daily quota."""
    user_id = _resolve_user_id(authorization)
    remaining, exhausted = await anam_quota.record_heartbeat(user_id)
    if exhausted:
        logger.info(
            "[anam/heartbeat] quota exhausted user=%s session=%s",
            user_id[:8], (payload.session_id or "")[:8],
        )
    return AnamHeartbeatResponse(remaining_seconds=remaining, exhausted=exhausted)


# ── Anam Pipeline Mode: lightweight session turn recording ───────────────────
#
# When VITE_ANAM_PIPELINE_MODE=true the frontend (AnamAvatar) calls this after
# every completed Anam turn (MESSAGE_HISTORY_UPDATED). We save the turn into the
# Redis-backed SessionObject so context is available if the user later switches
# back to MindMitra pipeline or for longitudinal memory retrieval.
#
# WHAT THIS DOES:
#   - session_startup  → resolve/create a Redis session (no DB write)
#   - session.append_turn x2 → append user + assistant turns (lightweight)
#   - session_service.save_session → persist updated session to Redis
#
# WHAT THIS DOES NOT DO:
#   - No MindMitra LLM call
#   - No signal extraction
#   - No embeddings / Qdrant writes
#   - No safety checks — crisis screening happens earlier, in
#     POST /anam/crisis-check, which the client calls the moment the user stops
#     speaking rather than after the persona has already answered.
#
# Supabase chat_messages persistence is handled entirely on the frontend by
# ChatGPTInterface.handleAnamTurn(), which calls saveMessage() directly using
# the user's own Supabase client — same as normal chat turns.


class AnamConversationTurnRequest(BaseModel):
    """One completed turn from an Anam pipeline conversation."""
    user_message: str
    agent_message: str
    session_id: Optional[str] = None
    language: Optional[str] = None


class AnamConversationTurnResponse(BaseModel):
    session_id: str
    persisted: bool


@router.post("/conversation", response_model=AnamConversationTurnResponse)
async def record_anam_conversation_turn(
    payload: AnamConversationTurnRequest,
    authorization: Optional[str] = Header(default=None),
) -> AnamConversationTurnResponse:
    """Lightweight turn recorder for Anam pipeline mode.

    Appends user + agent messages to the Redis session so conversation context
    is available for future turns or if the user switches back to MindMitra
    pipeline mode. Does NOT call MindMitra's LLM or any heavy pipeline stage.

    Supabase chat_messages persistence is done on the frontend by
    ChatGPTInterface.handleAnamTurn() using the user's own supabase client.
    """
    from ..services import session_service as ss  # noqa: PLC0415
    from datetime import datetime, timezone  # noqa: PLC0415

    user_id = _resolve_user_id(authorization)

    user_text  = (payload.user_message  or "").strip()
    agent_text = (payload.agent_message or "").strip()

    if not user_text and not agent_text:
        raise HTTPException(status_code=400, detail="Both user_message and agent_message are empty")

    requested_session_id = payload.session_id or "new"
    try:
        session = await ss.session_startup(
            user_id,
            requested_session_id=requested_session_id,
            response_language=payload.language,
        )
    except Exception as exc:
        logger.error("[anam/conversation] session_startup failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to start session") from exc

    now = datetime.now(timezone.utc).isoformat()

    try:
        # Append user turn
        if user_text:
            session.append_turn({
                "role": "user",
                "content": user_text,
                "timestamp": now,
                "source": "anam_stt",
            })
        # Append agent turn
        if agent_text:
            session.append_turn({
                "role": "assistant",
                "content": agent_text,
                "timestamp": now,
                "source": "anam_llm",
                "mode": "anam_pipeline",
            })
        session.touch()
        await ss.save_session(session)

        logger.info(
            "[anam/conversation] turn saved session=%s user=%d agent=%d",
            session.session_id[:8], len(user_text), len(agent_text),
        )
        return AnamConversationTurnResponse(
            session_id=session.session_id,
            persisted=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[anam/conversation] save failed (non-fatal): %s", exc)
        # Return 200 with persisted=False — never block the browser conversation
        return AnamConversationTurnResponse(
            session_id=session.session_id,
            persisted=False,
        )


# ── Crisis interceptor for turnkey mode ──────────────────────────────────────
#
# Invariant #1 (CLAUDE.md): crisis responses are fixed, clinician-reviewed
# templates and are never LLM-generated. In turnkey mode Anam's LLM writes the
# replies, so ``crisis_bypass`` is no longer inline on the turn — this route is
# what puts it back.
#
# The client calls this as soon as the user stops speaking (the user-only
# MESSAGE_HISTORY_UPDATED), in parallel with Anam composing its own answer. On a
# tier-3 result the client interrupts the persona mid-sentence and makes it
# speak ``content`` verbatim. The template text still comes from Supabase
# ``crisis_templates`` / the hardcoded env fallback — the same source /chat uses.
#
# Failure policy: on any internal error this returns crisis=false rather than
# 500. Claiming a crisis on a transient Groq timeout would fire the helpline
# script at students who did not need it, which erodes trust in the one response
# that has to be believed. It mirrors ``_fallback_signals`` in chat_ws.py, which
# also degrades to the session's last known urgency.


class AnamCrisisCheckRequest(BaseModel):
    """One user utterance, screened before the persona is allowed to continue."""
    user_message: str
    session_id: Optional[str] = None
    language: Optional[str] = None


class AnamCrisisCheckResponse(BaseModel):
    crisis: bool
    session_id: str
    urgency: int = 0
    content: Optional[str] = None
    crisis_numbers: list[str] = []


@router.post("/crisis-check", response_model=AnamCrisisCheckResponse)
async def anam_crisis_check(
    payload: AnamCrisisCheckRequest,
    authorization: Optional[str] = Header(default=None),
) -> AnamCrisisCheckResponse:
    """Run MindMitra's crisis path over an Anam-transcribed user utterance."""
    from ..pipeline import crisis_bypass, ingestion, signal_extraction  # noqa: PLC0415
    from ..services import session_service as ss  # noqa: PLC0415

    user_id = _resolve_user_id(authorization)
    text = (payload.user_message or "").strip()

    session = await ss.session_startup(
        user_id,
        requested_session_id=payload.session_id or "new",
        response_language=payload.language,
    )

    if not text:
        return AnamCrisisCheckResponse(crisis=False, session_id=session.session_id)

    try:
        ingested = ingestion.ingest_input(
            text,
            user_id=user_id,
            session_id=session.session_id,
            is_new_session=session.is_new_session,
        )
        session.is_new_session = False

        # Cheapest check first, exactly as chat_ws._process_turn does: once a
        # session has gone tier-3 it stays in crisis handling without another
        # Groq round-trip.
        if session.urgency_history and session.urgency_history[-1] == 3:
            urgency = 3
            code_mix_ratio = session.code_mix_ratio
        else:
            signals = await signal_extraction.extract_signals(ingested, session=session)
            urgency = signals.urgency_score
            code_mix_ratio = signals.code_mix_ratio

        crisis_resp = await crisis_bypass.crisis_bypass_check(
            urgency_score=urgency,
            user_id=user_id,
            session_id=session.session_id,
            code_mix_ratio=code_mix_ratio,
            response_language=session.response_language,
            trace_id=ingested.trace_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[anam/crisis-check] screening failed (fail-open): %s", exc)
        return AnamCrisisCheckResponse(crisis=False, session_id=session.session_id)

    if crisis_resp is None:
        return AnamCrisisCheckResponse(
            crisis=False, session_id=session.session_id, urgency=urgency
        )

    # Persist the tier-3 marker so the next utterance short-circuits above and
    # the session-end worker sees the crisis, same as the /chat path.
    try:
        session.append_affect({"urgency": 3, "source": "anam_crisis_check"})
        session.touch()
        await ss.save_session(session)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[anam/crisis-check] session persist failed (non-fatal): %s", exc)

    logger.warning(
        "[anam/crisis-check] TIER 3 — interrupting persona session=%s",
        session.session_id[:8],
    )
    return AnamCrisisCheckResponse(
        crisis=True,
        session_id=session.session_id,
        urgency=3,
        content=crisis_resp.content,
        crisis_numbers=crisis_resp.crisis_numbers,
    )
