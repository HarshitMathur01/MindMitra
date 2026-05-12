"""Voice transcription endpoint.

Exposes ``POST /transcribe`` so the React voice-input flow has a STT
fallback while chat traffic uses HTTP ``POST /chat``.
Uses Groq Whisper (whisper-large-v3-turbo) — fast, free-tier friendly,
and good enough for short Hinglish utterances at MVP scale.

Auth: the same Supabase JWT used by HTTP chat.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import tempfile
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.auth import AuthError, decode_supabase_jwt
from ..core.env import env

logger = logging.getLogger(__name__)

router = APIRouter(tags=["audio"])
DEFAULT_MAX_AUDIO_BYTES = 6 * 1024 * 1024
DEFAULT_TRANSCRIBE_TIMEOUT_S = 15.0
SPEECH_TOKEN_REFRESH_MARGIN_S = 60


class TranscribeRequest(BaseModel):
    audio_data: str  # base64-encoded WAV (sent as data URL or pure base64)
    language: Optional[str] = None
    locale: Optional[str] = None


class SpeechTokenResponse(BaseModel):
    token: str
    region: str
    expires_in: int


_groq_singleton = None
_speech_token_cache: dict[str, float | str] = {"token": "", "expires_at": 0.0}
_transcribe_semaphore: asyncio.Semaphore | None = None
_transcribe_semaphore_limit: int | None = None


def _get_groq_blocking_client():
    """Lazy-construct the sync Groq client used by the audio endpoint.

    We keep this sync (vs ``app/core/connections.get_groq`` which is
    async) because ``groq`` SDK's ``audio.transcriptions.create`` is sync
    and we want to wrap it in ``asyncio.to_thread`` instead of holding the
    event loop.
    """
    global _groq_singleton
    if _groq_singleton is not None:
        return _groq_singleton
    try:
        from groq import Groq
    except ImportError:  # pragma: no cover - groq pinned in requirements
        return None
    api_key = env().groq_api_key
    if not api_key:
        return None
    _groq_singleton = Groq(api_key=api_key)
    return _groq_singleton


def _decode_audio(audio_b64: str) -> bytes:
    payload = (audio_b64 or "").strip()
    if not payload:
        return b""
    if "," in payload and payload.lstrip().startswith("data:"):
        payload = payload.split(",", 1)[1]
    try:
        return base64.b64decode(payload, validate=False)
    except Exception:  # noqa: BLE001
        return b""


def _max_audio_bytes() -> int:
    return env().transcribe_max_audio_bytes or DEFAULT_MAX_AUDIO_BYTES


def _transcribe_timeout_s() -> float:
    return env().transcribe_timeout_s or DEFAULT_TRANSCRIBE_TIMEOUT_S


def _transcribe_gate() -> asyncio.Semaphore:
    global _transcribe_semaphore, _transcribe_semaphore_limit
    limit = max(1, env().transcribe_concurrency_limit)
    if _transcribe_semaphore is None or _transcribe_semaphore_limit != limit:
        _transcribe_semaphore = asyncio.Semaphore(limit)
        _transcribe_semaphore_limit = limit
    return _transcribe_semaphore


def _resolve_user_id(authorization: Optional[str]) -> str:
    e = env()
    if not authorization:
        if e.skip_auth_effective:
            return e.dev_user_id
        raise HTTPException(status_code=401, detail="Authorization header required")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    try:
        return decode_supabase_jwt(authorization.removeprefix("Bearer "))
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=f"JWT invalid: {exc}")


def _language_hint(language: Optional[str], locale: Optional[str]) -> Optional[str]:
    raw = (language or locale or "").strip().lower()
    if not raw:
        return None
    primary = raw.split("-", 1)[0].split("_", 1)[0]
    return primary or None


@router.get("/speech/token", response_model=SpeechTokenResponse)
async def speech_token(authorization: Optional[str] = Header(default=None)):
    """Issue a short-lived Azure Speech auth token for browser STT/TTS."""
    _resolve_user_id(authorization)
    e = env()
    if not e.azure_speech_key:
        raise HTTPException(status_code=503, detail="Azure Speech is not configured")

    now = time.time()
    cached_token = str(_speech_token_cache.get("token") or "")
    cached_expires_at = float(_speech_token_cache.get("expires_at") or 0.0)
    if cached_token and cached_expires_at - now > SPEECH_TOKEN_REFRESH_MARGIN_S:
        return SpeechTokenResponse(
            token=cached_token,
            region=e.azure_speech_region,
            expires_in=max(60, int(cached_expires_at - now)),
        )

    url = f"https://{e.azure_speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                url,
                headers={"Ocp-Apim-Subscription-Key": e.azure_speech_key},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Azure Speech token request failed: {exc}") from exc

    if response.status_code != 200 or not response.text:
        raise HTTPException(status_code=502, detail="Azure Speech token request failed")

    expires_in = max(60, e.azure_speech_token_ttl_s)
    _speech_token_cache.update({"token": response.text, "expires_at": now + expires_in})
    return SpeechTokenResponse(token=response.text, region=e.azure_speech_region, expires_in=expires_in)


@router.post("/transcribe")
async def transcribe(
    request: TranscribeRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Transcribe a short WAV via Groq Whisper. Returns ``{transcript, model}``."""
    _resolve_user_id(authorization)

    max_audio_bytes = _max_audio_bytes()
    if len(request.audio_data or "") > max_audio_bytes * 2:
        raise HTTPException(status_code=413, detail="audio_data is too large")

    wav_bytes = _decode_audio(request.audio_data)
    if not wav_bytes:
        raise HTTPException(status_code=400, detail="audio_data is empty or invalid")
    if len(wav_bytes) > max_audio_bytes:
        raise HTTPException(status_code=413, detail="audio_data is too large")

    client = _get_groq_blocking_client()
    if client is None:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    language_hint = _language_hint(request.language, request.locale)

    def _run_groq_transcription() -> str:
        tmp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(wav_bytes)
                tmp_path = tmp.name
            with open(tmp_path, "rb") as fh:
                kwargs = {
                    "model": "whisper-large-v3-turbo",
                    "file": fh,
                    "response_format": "text",
                }
                if language_hint:
                    kwargs["language"] = language_hint
                result = client.audio.transcriptions.create(**kwargs)
            text = result if isinstance(result, str) else getattr(result, "text", "")
            return (text or "").strip()
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    try:
        async with _transcribe_gate():
            transcript = await asyncio.wait_for(
                asyncio.to_thread(_run_groq_transcription),
                timeout=_transcribe_timeout_s(),
            )
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Transcription timed out") from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("[v3 transcribe] groq failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}")

    if transcript:
        logger.info("[v3 transcribe] ok len=%d", len(transcript))
    else:
        logger.warning("[v3 transcribe] empty transcript")

    return {
        "transcript": transcript,
        "model": "groq-whisper-large-v3-turbo",
        "provider": "groq",
        "language": language_hint,
    }
