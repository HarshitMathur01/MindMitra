"""Anam AI avatar session-token proxy.

Exposes ``GET /anam/session-token`` so the React frontend can start an
Anam avatar session without ever seeing the ANAM_API_KEY.

Flow:
    Browser  →  GET /anam/session-token (with Supabase JWT)
    Backend  →  POST https://api.anam.ai/v1/auth/session-token  (with ANAM_API_KEY)
    Backend  →  returns short-lived sessionToken to browser
    Browser  →  createClient(sessionToken) — safe, no secret exposed

Auth: same Supabase JWT used by /chat.

The session token issued by Anam is valid for ~10 minutes. Clients should
re-fetch when they receive a session-expired error from the SDK.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.auth import AuthError, decode_supabase_jwt
from ..core.env import env

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/anam", tags=["anam"])

# Anam avatar config — single persona for MVP.
ANAM_API_BASE = "https://api.anam.ai"
ANAM_PERSONA_ID = "39a9715a-fe26-471f-a8f2-346e4e50d0b4"


class AnamSessionTokenResponse(BaseModel):
    sessionToken: str
    personaId: str


def _get_anam_api_key() -> str:
    key = os.getenv("ANAM_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="ANAM_API_KEY is not configured on the server.",
        )
    return key


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
):
    """Issue a short-lived Anam session token for the browser to start an avatar session.

    The frontend calls this before initialising the @anam-ai/js-sdk client.
    The ANAM_API_KEY never leaves the server.
    """
    _resolve_user_id(authorization)

    anam_api_key = _get_anam_api_key()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{ANAM_API_BASE}/v1/auth/session-token",
                headers={
                    "Authorization": f"Bearer {anam_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personaConfig": {
                        "personaId": ANAM_PERSONA_ID,
                        "avatarOnly": True,  # Bypass Anam LLM/TTS — MindMitra owns the pipeline
                    }
                },
            )
    except httpx.TimeoutException as exc:
        logger.error("[anam] session-token request timed out: %s", exc)
        raise HTTPException(status_code=504, detail="Anam API timed out") from exc
    except httpx.HTTPError as exc:
        logger.error("[anam] session-token request failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Anam API unreachable: {exc}") from exc

    if response.status_code != 200:
        body = response.text[:400]
        logger.error("[anam] session-token non-200: status=%d body=%s", response.status_code, body)
        raise HTTPException(
            status_code=502,
            detail=f"Anam API returned {response.status_code}: {body}",
        )

    try:
        data = response.json()
        session_token = data["sessionToken"]
    except (KeyError, ValueError) as exc:
        logger.error("[anam] session-token response malformed: %s | body=%s", exc, response.text[:200])
        raise HTTPException(status_code=502, detail="Anam API returned unexpected response format") from exc

    logger.info("[anam] session token issued for persona=%s", ANAM_PERSONA_ID)

    return AnamSessionTokenResponse(
        sessionToken=session_token,
        personaId=ANAM_PERSONA_ID,
    )



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
#   - No safety checks
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
