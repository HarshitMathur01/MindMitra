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
or ``safety_gate.py`` inline. The compensating control is
``POST /anam/crisis-check`` in ``app/api/anam.py``, which the browser calls on
every user utterance before the persona is allowed to keep talking — see
``docs/anam-avatar.md``. Do not ship this route without that interceptor live.

The conversation surface (voice, turn-taking, greeting, director notes, system
tools) is built from the ``avatar:`` block of ``config.yaml``; the client only
ever supplies an avatar id.
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
from ..services import anam_quota

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

# system_identity.txt is written for the text surface. Everything here is
# specific to being *spoken aloud*: the reply goes straight to TTS, so anything
# that only makes sense on screen gets read out literally.
_ANAM_VOICE_GUIDANCE = """
You are speaking out loud, not typing. Everything you say is read by a
text-to-speech voice, so write it the way you would say it: plain sentences, no
asterisks, no emoji, no numbered lists, no headings. Write numbers and symbols
as words — "fourteen thousand four hundred sixteen", not "14416"; "rupees five
hundred", not "Rs 500".

Keep turns shorter than you would in text. Two or three sentences is usually
enough, and it is fine to say one line and wait. Leave room for them to
interrupt you — they can, at any time.

If the student switches to Hindi or Hinglish, switch with them and use the
change_language tool so their speech keeps being understood correctly. If they
ask for quiet, or to stop, use the pause or end-call tools rather than talking
through it.
""".strip()


def _persona_system_prompt() -> str:
    """Companion identity, adapted for the turnkey path.

    Swaps the crisis paragraph and appends spoken-delivery guidance, leaving
    every other block intact — the length guidance that follows the crisis
    paragraph matters more for a spoken avatar than for text, so it must
    survive the substitution.
    """
    identity = load_block("system_identity")
    if not identity:
        return f"{_ANAM_CRISIS_GUIDANCE}\n\n{_ANAM_VOICE_GUIDANCE}"

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
    paragraphs.append(_ANAM_VOICE_GUIDANCE)
    return "\n\n".join(paragraphs)


# snake_case in config.yaml -> camelCase in the Anam request body. Kept as
# explicit tables rather than a generic converter so an unknown YAML key is
# dropped instead of being forwarded to Anam as a silently-ignored field.
_SESSION_FIELDS = {
    "max_session_length_seconds": "maxSessionLengthSeconds",
    "skip_greeting": "skipGreeting",
    "uninterruptible_greeting": "uninterruptibleGreeting",
    "initial_message": "initialMessage",
    "language_code": "languageCode",
}

_VOICE_DETECTION_FIELDS = {
    "end_of_speech_sensitivity": "endOfSpeechSensitivity",
    "silence_before_auto_end_turn_seconds": "silenceBeforeAutoEndTurnSeconds",
    "silence_before_skip_turn_seconds": "silenceBeforeSkipTurnSeconds",
    "silence_before_session_end_seconds": "silenceBeforeSessionEndSeconds",
    "speech_enhancement_level": "speechEnhancementLevel",
}

# Cartesia and ElevenLabs take disjoint parameter sets; Anam ignores the ones
# that do not apply to the configured voice, so both are mapped here.
_VOICE_GENERATION_FIELDS = {
    "speed": "speed",
    "volume": "volume",
    "emotion": "emotion",
    "stability": "stability",
    "similarity_boost": "similarityBoost",
    "style": "style",
    "use_speaker_boost": "useSpeakerBoost",
}

# Director notes apply to cara-4 avatars only; older models ignore them and the
# session still starts. ``presetStyle`` must be one of the SDK's PresetStyle
# union — cue-only tags such as "curious" or "concerned" work inline in speech
# but are rejected as session presets.
_DIRECTOR_NOTE_FIELDS = {
    "preset_style": "presetStyle",
    "custom_style_prompt": "customStylePrompt",
    "expressivity": "expressivity",
}

_DIRECTOR_PRESET_STYLES = frozenset(
    {"happy", "warm", "playful", "supportive", "sad", "angry", "distressed"}
)


def _mapped(source: dict, fields: dict[str, str]) -> dict:
    """Project a config sub-section onto its Anam field names.

    Blank and missing values are dropped rather than sent, so Anam's own
    default applies. ``0`` and ``False`` are meaningful here (silence timeouts
    of ``0`` disable a behaviour, ``skip_greeting: false`` is a real choice) and
    must survive.
    """
    out: dict = {}
    for yaml_key, anam_key in fields.items():
        value = source.get(yaml_key)
        if value is None or value == "":
            continue
        out[anam_key] = value
    return out


def _sanitise_director_notes(notes: dict, avatar_id: str) -> dict:
    """Keep director notes inside what the session-token API will accept.

    Two rules the API enforces and a YAML file cannot: ``presetStyle`` and
    ``customStylePrompt`` are mutually exclusive, and ``presetStyle`` must be a
    real preset rather than a cue-only tag like "curious". Both are dropped with
    a warning instead of raising — a mis-typed style should not cost a student
    their avatar session.
    """
    notes = dict(notes)

    preset = str(notes.get("presetStyle") or "").strip().lower()
    if preset and preset not in _DIRECTOR_PRESET_STYLES:
        logger.warning(
            "avatar '%s': director preset_style %r is not a valid preset; dropping",
            avatar_id, preset,
        )
        notes.pop("presetStyle", None)
        preset = ""
    elif preset:
        notes["presetStyle"] = preset

    if preset and "customStylePrompt" in notes:
        logger.warning(
            "avatar '%s': preset_style and custom_style_prompt are mutually "
            "exclusive; keeping preset_style",
            avatar_id,
        )
        notes.pop("customStylePrompt", None)

    return notes


def _tool_ids(section: dict) -> list[str]:
    """Tools are referenced by id, never defined inline.

    The published OpenAPI spec claims ``tools[].type`` accepts ``"system"``, but
    the live session-token endpoint rejects it — inline tools may only be
    ``client`` or ``server``. System tools (``change_language``, ``end_call``,
    ``pause_conversation``) must be created once via ``POST /v1/tools`` with
    ``type: "SYSTEM"`` and then referenced here by id.

    ``scripts/anam_system_tools.py`` creates them and prints the ids to paste in.
    """
    ids = section.get("tool_ids") or []
    if not isinstance(ids, list):
        return []
    return [str(tool_id).strip() for tool_id in ids if str(tool_id).strip()]


def build_persona_config(avatar_id: str) -> dict:
    """Resolve a client-supplied avatar id into a full Anam ``personaConfig``.

    Raises 400 for an unknown id and 503 for a known id with no Anam
    ``avatar_id`` yet — a mis-configured session is worse than a clear failure
    on a mental-health surface.

    Everything except ``avatarId`` is optional. ``voice_id`` omitted lets Anam
    use the avatar's default voice; an absent ``session`` / ``voice_detection``
    / ``voice_generation`` / ``director_notes`` block leaves Anam's defaults in
    place. The one field the client may never influence is ``systemPrompt``.
    """
    section = config.get_section("avatar")
    personas = section.get("personas") or {}
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
        # Discriminator for an inline persona. Optional today — the endpoint
        # still accepts a bare config — but the server's own validation error
        # enumerates it, so state it rather than depend on the fallback.
        "type": "ephemeral",
        "name": str(persona.get("name") or avatar_id),
        "avatarId": anam_avatar_id,
        "systemPrompt": _persona_system_prompt(),
    }

    # Per-persona overrides win over the shared default.
    avatar_model = str(persona.get("avatar_model") or section.get("avatar_model") or "").strip()
    if avatar_model:
        persona_config["avatarModel"] = avatar_model

    anam_voice_id = str(persona.get("voice_id") or "").strip()
    if anam_voice_id:
        persona_config["voiceId"] = anam_voice_id

    llm_id = env().anam_llm_id
    if llm_id:
        persona_config["llmId"] = llm_id

    persona_config.update(_mapped(section.get("session") or {}, _SESSION_FIELDS))

    for yaml_section, anam_key, fields in (
        ("voice_detection", "voiceDetectionOptions", _VOICE_DETECTION_FIELDS),
        ("voice_generation", "voiceGenerationOptions", _VOICE_GENERATION_FIELDS),
        ("director_notes", "directorNotes", _DIRECTOR_NOTE_FIELDS),
    ):
        mapped = _mapped(section.get(yaml_section) or {}, fields)
        if anam_key == "directorNotes" and mapped:
            mapped = _sanitise_director_notes(mapped, avatar_id)
        if mapped:
            persona_config[anam_key] = mapped

    tool_ids = _tool_ids(section)
    if tool_ids:
        persona_config["toolIds"] = tool_ids

    return persona_config


def build_session_options() -> dict:
    """``sessionOptions`` sits alongside ``personaConfig``, not inside it.

    Session replay is the one that matters: Anam defaults it to **on**, which
    would put recordings of mental-health conversations on a vendor's disk
    unless we say otherwise.
    """
    session = config.get_section("avatar").get("session") or {}
    options: dict = {}

    video_quality = str(session.get("video_quality") or "").strip()
    if video_quality:
        options["videoQuality"] = video_quality

    replay = session.get("enable_session_replay")
    if replay is not None:
        options["sessionReplay"] = {"enableSessionReplay": bool(replay)}

    return options


@router.post("/avatar/session-token", response_model=AvatarSessionTokenResponse)
async def avatar_session_token(
    request: AvatarSessionTokenRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Exchange the server-held Anam API key for a short-lived session token.

    Unlike the Azure speech token this is intentionally **not** cached: Anam
    session tokens are per-session, and sharing one across users would let two
    students land in the same avatar conversation.

    Not called by the frontend today (see ``useAnamAvatar.ts``, which uses
    ``GET /anam/session-token`` instead) but reachable, so it is gated by the
    same daily Anam video quota rather than left as a bypass.
    """
    user_id = _resolve_user_id(authorization)
    e = env()
    if not e.anam_api_key:
        raise HTTPException(status_code=503, detail="Anam avatar is not configured")

    remaining = await anam_quota.get_remaining_seconds(user_id)
    if remaining < anam_quota.min_session_seconds():
        raise HTTPException(
            status_code=429,
            detail="Daily avatar video limit reached. Come back after midnight IST.",
        )

    persona_config = build_persona_config(request.avatar_id)
    configured_max = persona_config.get("maxSessionLengthSeconds")
    persona_config["maxSessionLengthSeconds"] = (
        min(int(configured_max), remaining) if configured_max is not None else remaining
    )
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

    await anam_quota.mark_session_start(user_id)

    logger.info(
        "anam session token issued",
        extra={"user_id": user_id, "avatar_id": request.avatar_id},
    )
    return AvatarSessionTokenResponse(
        session_token=session_token,
        avatar_id=request.avatar_id,
        expires_in=DEFAULT_SESSION_TOKEN_TTL_S,
    )
