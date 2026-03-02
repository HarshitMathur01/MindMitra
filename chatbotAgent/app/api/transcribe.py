"""
Transcription route — POST /api/transcribe (Whisper API).
"""
import logging
import os

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()
logger = logging.getLogger(__name__)

_VALID_AUDIO_TYPES = {
    "audio/webm", "audio/wav", "audio/mp3", "audio/mp4",
    "audio/mpeg", "audio/mpga", "audio/m4a", "audio/ogg",
}
_MAX_BYTES = 25 * 1024 * 1024  # 25 MB (Whisper API limit)


@router.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio using OpenAI Whisper API.

    Accepts: audio/webm, audio/wav, audio/mp3, audio/mp4, audio/mpeg, audio/mpga, audio/m4a, audio/ogg
    Returns: {"text": str, "success": bool}
    """
    try:
        logger.info(f"🎤 [TRANSCRIBE] file={audio.filename} type={audio.content_type}")

        openai_api_key = os.getenv("OPENAI_API_KEY", "")
        if not openai_api_key:
            logger.error("❌ [TRANSCRIBE] OPENAI_API_KEY not set")
            raise HTTPException(status_code=503, detail="Speech transcription service unavailable.")

        if audio.content_type not in _VALID_AUDIO_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format '{audio.content_type}'. Supported: {', '.join(sorted(_VALID_AUDIO_TYPES))}",
            )

        content = await audio.read()
        if len(content) > _MAX_BYTES:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25 MB)")

        logger.info(f"📊 [TRANSCRIBE] Size: {len(content)/1024:.1f} KB")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {openai_api_key}"},
                files={"file": (audio.filename or "audio.webm", content, audio.content_type)},
                data={"model": "whisper-1", "language": "en", "response_format": "json"},
            )

        if response.status_code != 200:
            logger.error(f"❌ [TRANSCRIBE] Whisper {response.status_code}: {response.text[:200]}")
            raise HTTPException(status_code=response.status_code, detail=f"Transcription failed: {response.text[:100]}")

        transcript = response.json().get("text", "").strip()
        if not transcript:
            return {"text": "", "success": False, "error": "No speech detected"}

        logger.info(f"✅ [TRANSCRIBE] '{transcript[:80]}…'")
        return {"text": transcript, "success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [TRANSCRIBE] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
