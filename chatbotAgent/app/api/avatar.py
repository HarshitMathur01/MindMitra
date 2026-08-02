"""Anam.ai avatar session-token broker.

Exposes ``POST /avatar/session-token`` so the browser can open a WebRTC
session with an Anam hosted avatar without ever seeing ``ANAM_API_KEY``.

Mirrors the ``GET /speech/token`` broker in ``app/api/audio.py``: same
Supabase JWT auth, same 503-when-unconfigured / 502-on-upstream-failure
contract, same ``httpx`` server-to-server call.

Two things this module deliberately owns rather than the client:

1. **The persona config.** The client sends only an avatar id. If the browser
   supplied ``personaConfig`` a user could inject an arbitrary system prompt
   into a mental-health companion, so the id is looked up against a
   server-side table built from ``config.yaml``.
2. **The system prompt.** Reuses ``system_identity.txt`` — the same block the
   v3 pipeline puts in prompt block 1 — so the avatar and the text chat share
   one identity.

Scope note: this route serves Anam **turnkey** mode, where Anam's own LLM
generates the replies. That path does not run ``app/pipeline/crisis_bypass.py``
or ``safety_gate.py``. The frontend keeps ``VITE_AVATAR_PROVIDER`` defaulted to
the local TalkingHead renderer for that reason; see the crisis-layer follow-up
before enabling Anam for real users.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.config import config
from ..core.env import env
from ..core.prompts import load_block

# Reused rather than re-implemented: audio.py and chat_ws.py already keep two
# copies of the same "Bearer <supabase jwt> -> user_id" logic. A third copy
# would be one more place for the SKIP_AUTH guard to drift.
from .audio import _resolve_user_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["avatar"])


class AvatarSessionTokenRequest(BaseModel):
    avatar_id: str


class AvatarSessionTokenResponse(BaseModel):
    session_token: str
    avatar_id: str
    expires_in: int


# Anam does not return a TTL with the token; its session tokens are documented
# as short-lived. Report a conservative value so the client refreshes rather
# than reusing a dead token after a long idle.
DEFAULT_SESSION_TOKEN_TTL_S = 300

# In turnkey mode Anam's LLM answers directly, so the pre-screening promise in
# system_identity.txt ("Crisis is handled before you see the message") is not
# true on this path. Replacing that paragraph is the minimum honest handling —
# a prompt that claims crisis was already filtered would be worse than silence.
_CRISIS_PARAGRAPH_MARKER = "Crisis is handled before you see the message."

_ANAM_CRISIS_GUIDANCE = """
If someone describes self-harm, suicidal intent, or immediate danger, do not
explore it as a topic. Say plainly that you are worried, that you are not able
to help with this alone, and direct them to Tele-MANAS 14416 (India, free,
24x7) or their local emergency number. Stay warm and stay with them, but make
the handoff clear. Never discuss methods.
""".strip()


def _persona_system_prompt() -> str:
    """Companion identity, adapted for the turnkey path.

    Swaps only the crisis paragraph and leaves every other block intact — the
    length guidance that follows it matters more for a spoken avatar than for
    text, so it must survive the substitution.
    """
    identity = load_block("system_identity")
    if not identity:
        return _ANAM_CRISIS_GUIDANCE

    paragraphs = identity.split("\n\n")
    replaced = False
    for index, paragraph in enumerate(paragraphs):
        if _CRISIS_PARAGRAPH_MARKER in paragraph:
            paragraphs[index] = _ANAM_CRISIS_GUIDANCE
            replaced = True
            break
    if not replaced:
        # Prompt file changed shape; append rather than silently shipping a
        # persona with no crisis guidance at all.
        paragraphs.append(_ANAM_CRISIS_GUIDANCE)
    return "\n\n".join(paragraphs)


def _persona_for(avatar_id: str) -> dict:
    """Resolve a client-supplied avatar id against the server-side table.

    Raises 400 for an unknown id and 503 for a known id with no Anam
    ``avatar_id`` yet — a mis-configured session is worse than a clear failure
    on a mental-health surface.

    ``voice_id`` is optional: omitting it lets Anam use the avatar's default
    voice. ``llm_id`` is likewise omitted unless configured.
    """
    personas = config.get_section("avatar").get("personas") or {}
    persona = personas.get(avatar_id)
    if not isinstance(persona, dict):
        raise HTTPException(status_code=400, detail=f"Unknown avatar id: {avatar_id}")

    anam_avatar_id = str(persona.get("avatar_id") or "").strip()
    if not anam_avatar_id:
        raise HTTPException(
            status_code=503,
            detail=f"Anam persona '{avatar_id}' is not configured (avatar_id missing)",
        )

    persona_config: dict = {
        "name": str(persona.get("name") or avatar_id),
        "avatarId": anam_avatar_id,
        "systemPrompt": _persona_system_prompt(),
    }
    anam_voice_id = str(persona.get("voice_id") or "").strip()
    if anam_voice_id:
        persona_config["voiceId"] = anam_voice_id
    llm_id = env().anam_llm_id
    if llm_id:
        persona_config["llmId"] = llm_id
    return persona_config


@router.post("/avatar/session-token", response_model=AvatarSessionTokenResponse)
async def avatar_session_token(
    request: AvatarSessionTokenRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Exchange the server-held Anam API key for a short-lived session token.

    Unlike the Azure speech token this is intentionally **not** cached: Anam
    session tokens are per-session, and sharing one across users would let two
    students land in the same avatar conversation.
    """
    user_id = _resolve_user_id(authorization)
    e = env()
    if not e.anam_api_key:
        raise HTTPException(status_code=503, detail="Anam avatar is not configured")

    persona_config = _persona_for(request.avatar_id)
    url = f"{e.anam_api_base.rstrip('/')}/auth/session-token"

    try:
        async with httpx.AsyncClient(timeout=e.anam_timeout_s) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {e.anam_api_key}",
                    "Content-Type": "application/json",
                },
                json={"personaConfig": persona_config},
            )
    except httpx.HTTPError as exc:
        logger.warning("Anam session-token request failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Anam session token request failed: {exc}") from exc

    if response.status_code != 200:
        # Never surface the upstream body: it can echo the request, and the
        # request carries the persona system prompt.
        logger.warning("Anam session-token upstream status=%s", response.status_code)
        raise HTTPException(status_code=502, detail="Anam session token request failed")

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Anam session token response was not JSON") from exc

    session_token = str(payload.get("sessionToken") or "").strip()
    if not session_token:
        raise HTTPException(status_code=502, detail="Anam session token missing from response")

    logger.info(
        "anam session token issued",
        extra={"user_id": user_id, "avatar_id": request.avatar_id},
    )
    return AvatarSessionTokenResponse(
        session_token=session_token,
        avatar_id=request.avatar_id,
        expires_in=DEFAULT_SESSION_TOKEN_TTL_S,
    )
