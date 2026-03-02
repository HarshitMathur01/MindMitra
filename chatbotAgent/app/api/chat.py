"""
Chat routes — POST /chat, POST /chat/stream, GET /chat/greeting.
"""
import json
import logging
import threading
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from ..core.auth import validate_user_token
from ..models.request_models import ChatRequest
from ..models.response_models import ChatResponse
from ..pipeline.workflow import get_workflow_instance, process_user_chat
from ..services.greeting_service import generate_greeting, _greeting_cache
from ..services.lipsync_service import generate_lipsync_from_audio, generate_lipsync_from_text
from ..services.supabase_service import (
    fetch_user_context,
    get_hybrid_message_count,
    session_message_counters,
    supabase_client,
)
from ..services.tts_service import generate_tts_audio_v2
from ..utils.constants import MEMORY_TRIGGER_INTERVAL

router = APIRouter()
logger = logging.getLogger(__name__)


# ── helpers ────────────────────────────────────────────────────────────────
def _detect_emotion(text: str) -> Dict[str, str]:
    text_lower = text.lower()
    if any(w in text_lower for w in ["happy", "great", "wonderful", "amazing", "excited", "proud", "joy"]):
        return {"emotion": "happy", "facial_expression": "smile"}
    if any(w in text_lower for w in ["sad", "sorry", "difficult", "hard", "anxious", "worried"]):
        return {"emotion": "sad", "facial_expression": "sad"}
    if any(w in text_lower for w in ["angry", "frustrated", "annoyed"]):
        return {"emotion": "angry", "facial_expression": "angry"}
    if any(w in text_lower for w in ["wow", "really", "surprised", "incredible"]):
        return {"emotion": "surprised", "facial_expression": "surprised"}
    return {"emotion": "neutral", "facial_expression": "default"}


def _build_avatar_package(ai_text: str, result: Dict[str, Any], avatar_visible: bool) -> Dict[str, Any]:
    """Generate TTS + lipsync and return avatar fields."""
    audio_base64 = None
    lipsync_data = None
    animation = "Idle"
    facial_expression = "default"

    if not avatar_visible:
        logger.info("⚡ [AVATAR] Avatar hidden — skipping TTS (latency optimization)")
        return {
            "audio": None, "lipsync": None,
            "animation": "Idle", "facial_expression": "default",
        }

    if ai_text:
        mood = _detect_emotion(ai_text)
        emotion = mood["emotion"]
        facial_expression = mood["facial_expression"]

        lang_style = (
            result.get("session_insights", {})
            .get("cultural_context", {})
            .get("language_style", "english")
        )

        audio_base64 = generate_tts_audio_v2(ai_text, emotion, lang_style)
        animation = "Talking_0"

        if audio_base64:
            lipsync_data = generate_lipsync_from_audio(audio_base64, ai_text)
        else:
            logger.warning("⚠️ [AVATAR] TTS failed — using text-based lipsync")
            lipsync_data = generate_lipsync_from_text(ai_text)

        if not lipsync_data or not lipsync_data.get("mouthCues"):
            lipsync_data = None
            animation = "Idle"

    return {
        "audio": audio_base64,
        "lipsync": lipsync_data,
        "animation": animation,
        "facial_expression": facial_expression,
    }


def _maybe_trigger_memory(session_id: str, user_id: str) -> None:
    """Increment counter and trigger memory extraction every MEMORY_TRIGGER_INTERVAL messages."""
    try:
        session_message_counters[session_id] += 1
        count = get_hybrid_message_count(session_id)
        logger.info(f"📊 [MEMORY] Session count: {count}")
        if count > 0 and count % MEMORY_TRIGGER_INTERVAL == 0:
            logger.info(f"🔔 [MEMORY] Triggering extraction at message #{count}")
            workflow = get_workflow_instance()
            threading.Thread(
                target=workflow.trigger_memory_extraction,
                args=(session_id, user_id),
                daemon=True,
            ).start()
    except Exception as e:
        logger.error(f"❌ [MEMORY] Trigger failed: {e}")


# ── routes ─────────────────────────────────────────────────────────────────
@router.get("/chat/greeting")
async def get_greeting(
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    authorization: str = Header(None),
):
    """Generate a personalised greeting for a new chat session."""
    try:
        authenticated_user_id = await validate_user_token(authorization, supabase_client)

        if not session_id:
            return {"greeting": "Hey! What's on your mind?", "show_greeting": True, "language_used": "english", "time_slot": "day"}

        cache_key = f"{session_id}_{authenticated_user_id}"
        if cache_key in _greeting_cache:
            logger.info(f"✅ [GREETING] Cache hit for session {session_id[:8]}…")
            return _greeting_cache[cache_key]

        greeting_data = generate_greeting(authenticated_user_id, session_id)
        return greeting_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [GREETING] {e}")
        return {"greeting": "Hey! What's on your mind?", "show_greeting": True, "language_used": "english", "time_slot": "day"}


@router.post("/chat", response_model=ChatResponse)
async def process_chat(
    request: ChatRequest,
    authorization: str = Header(None),
):
    """Main chat endpoint — executes full pipeline and returns response with optional avatar data."""
    try:
        logger.info("=" * 70)
        logger.info("🚀 [CHAT] New request received")
        user_id = await validate_user_token(authorization, supabase_client)
        logger.info(f"👤 [CHAT] user={user_id} session={request.session_id}")

        context = await fetch_user_context(user_id, request.session_id)

        result = process_user_chat(
            user_message=request.user_message,
            recent_messages=context["recent_messages"],
            conversation_summary=context["conversation_summary"],
            user_activities=context["user_activities"],
            user_patterns={},
            voice_analysis=request.voice_analysis or {},
            user_id=user_id,
            session_id=request.session_id,
        )

        ai_text = result.get("message", "")
        avatar = _build_avatar_package(ai_text, result, request.avatar_visible)

        if request.session_id:
            _maybe_trigger_memory(request.session_id, user_id)

        return ChatResponse(
            message=ai_text,
            audio=avatar["audio"],
            lipsync=avatar["lipsync"],
            animation=avatar["animation"],
            facial_expression=avatar["facial_expression"],
            modality=result.get("modality", "therapy"),
            confidence=result.get("confidence", 0.8),
            session_insights=result.get("session_insights"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [CHAT] {e}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@router.post("/chat/stream")
async def process_chat_stream(
    request: ChatRequest,
    authorization: str = Header(None),
):
    """
    Streaming endpoint (SSE) — sends AI text immediately, then TTS/lipsync asynchronously.
    Events: text_chunk | audio_ready | lipsync_ready | complete | error
    """
    try:
        user_id = await validate_user_token(authorization, supabase_client)
        logger.info(f"🚀 [STREAM] user={user_id} session={request.session_id} avatar={request.avatar_visible}")

        async def event_generator():
            try:
                context = await fetch_user_context(user_id, request.session_id)
                result = process_user_chat(
                    user_message=request.user_message,
                    recent_messages=context["recent_messages"],
                    conversation_summary=context["conversation_summary"],
                    user_activities=context["user_activities"],
                    user_patterns={},
                    voice_analysis=request.voice_analysis or {},
                    user_id=user_id,
                    session_id=request.session_id,
                )

                ai_text = result.get("message", "")
                logger.info(f"✅ [STREAM] Text ready ({len(ai_text)} chars)")

                yield (
                    f"event: text_chunk\ndata: {json.dumps({'message': ai_text, 'modality': result.get('modality'), 'confidence': result.get('confidence', 0.8)})}\n\n"
                )

                if request.avatar_visible and ai_text:
                    mood = _detect_emotion(ai_text)
                    audio_b64 = generate_tts_audio_v2(ai_text, mood["emotion"])

                    if audio_b64:
                        yield (
                            f"event: audio_ready\ndata: {json.dumps({'audio': audio_b64, 'animation': 'Talking_0', 'facial_expression': mood['facial_expression']})}\n\n"
                        )
                        lipsync = generate_lipsync_from_audio(audio_b64, ai_text)
                        if lipsync:
                            yield f"event: lipsync_ready\ndata: {json.dumps({'lipsync': lipsync})}\n\n"

                # Memory trigger (uses constant — no stream/non-stream discrepancy)
                if request.session_id:
                    _maybe_trigger_memory(request.session_id, user_id)

                yield f"event: complete\ndata: {json.dumps({'status': 'success'})}\n\n"

            except Exception as exc:
                logger.error(f"❌ [STREAM] Generator error: {exc}")
                yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [STREAM] Setup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")
