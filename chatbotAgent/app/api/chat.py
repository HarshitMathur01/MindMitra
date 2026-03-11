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
from ..agents.memory_manager import memory_manager
from ..services.greeting_service import generate_greeting
from ..services.lipsync_service import generate_lipsync_from_audio, generate_lipsync_from_text
from ..services.supabase_service import (
    fetch_last_n_messages,
    fetch_latest_screening_scores,
    fetch_previous_session_summary,
    fetch_user_context,
    get_hybrid_message_count,
    save_screening_scores,
    session_message_counters,
    supabase_client,
)
from ..services.tts_service import generate_tts_audio_v2
from ..utils.constants import MEMORY_TRIGGER_INTERVAL, SCREENING_EMA_ALPHA, SCREENING_MIN_MESSAGES

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


def _build_avatar_package(
    ai_text: str,
    result: Dict[str, Any],
    avatar_visible: bool,
    personality_id: str | None = None,
) -> Dict[str, Any]:
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

        audio_base64 = generate_tts_audio_v2(ai_text, emotion, lang_style, personality_id)
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
            logger.info(f"🔔 [MEMORY] Triggering mem0 extraction at message #{count}")
            # Fetch recent unprocessed messages
            messages = fetch_last_n_messages(session_id, n=MEMORY_TRIGGER_INTERVAL)
            if messages:
                threading.Thread(
                    target=memory_manager.add_memories,
                    args=(messages, user_id, session_id),
                    daemon=True,
                ).start()
    except Exception as e:
        logger.error(f"❌ [MEMORY] Trigger failed: {e}")


def _run_session_end_jobs(session_id: str, user_id: str) -> None:
    """Background: save session summary + run PHQ-9/GAD-7 screening at session-end intervals."""
    try:
        messages = fetch_last_n_messages(session_id, n=30)
        if messages and len(messages) >= 5:
            memory_manager.save_session_summary(user_id, session_id, messages)

        # PHQ-9/GAD-7 session-level screening with EMA
        if messages and len(messages) >= SCREENING_MIN_MESSAGES:
            try:
                workflow = get_workflow_instance()
                if workflow.screening_agent:
                    previous = fetch_latest_screening_scores(user_id)
                    scores = workflow.screening_agent.generate_session_assessment(
                        messages, previous_scores=previous, ema_alpha=SCREENING_EMA_ALPHA
                    )
                    if scores:
                        save_screening_scores(user_id, session_id, scores)
                        logger.info(
                            f"\u2705 [SCREENING] Session assessment complete | "
                            f"PHQ-9={scores.get('phq9',{}).get('score','?')} "
                            f"GAD-7={scores.get('gad7',{}).get('score','?')}"
                        )
            except Exception as screen_exc:
                logger.error(f"\u274c [SCREENING] Session assessment failed: {screen_exc}")
    except Exception as e:
        logger.error(f"❌ [SESSION-END] Summary job failed: {e}")


def _extract_game_insights_for_memory(activities: list, user_id: str) -> None:
    """
    Extract therapeutic insights from game/assessment activities and store as mem0 memories.
    Bridges the gap between the game data system and the memory system so that
    game-derived observations persist beyond the 24h activity window.
    Runs in a background thread — fire and forget.
    """
    if not activities or not memory_manager.is_ready:
        return

    insight_messages = []
    for act in activities:
        atype = act.get("activity_type", "")
        insights = act.get("insights_generated", {}) if isinstance(act.get("insights_generated"), dict) else {}
        eval_data = act.get("evaluation_data", {}) if isinstance(act.get("evaluation_data"), dict) else {}
        user_resp = act.get("user_response_data", {}) if isinstance(act.get("user_response_data"), dict) else {}

        if atype == "emotion_match":
            confusion = user_resp.get("confusion_patterns", [])
            if confusion:
                patterns = ", ".join(
                    f"{c.get('expected', '?')} mistaken for {c.get('chosen', '?')}"
                    for c in confusion[:3]
                )
                insight_messages.append({
                    "role": "assistant",
                    "content": f"In the Emotion Match game, the user struggled with: {patterns}. "
                               f"This may indicate difficulty distinguishing these emotions in real life.",
                })
        elif atype == "thought_detective":
            distortions = user_resp.get("identified_distortions", [])
            if distortions:
                insight_messages.append({
                    "role": "assistant",
                    "content": f"In the Thought Detective CBT game, the user identified cognitive distortions: "
                               f"{', '.join(distortions[:5])}. They show awareness of these thinking patterns.",
                })
        elif atype == "wellness_checkin":
            wellness_level = eval_data.get("wellness_level", "")
            focus_areas = eval_data.get("focus_areas", [])
            if wellness_level:
                msg = f"User completed a wellness check-in. Overall wellness level: {wellness_level}."
                if focus_areas:
                    msg += f" Areas needing attention: {', '.join(focus_areas[:5])}."
                insight_messages.append({"role": "assistant", "content": msg})
        elif atype == "mood_mountain":
            emotions = user_resp.get("emotional_vocabulary", [])
            if emotions:
                insight_messages.append({
                    "role": "assistant",
                    "content": f"User's recent mood self-report: {', '.join(emotions[:3])}.",
                })
        elif atype == "balloon_positivity":
            discrimination = eval_data.get("emotional_discrimination", "")
            resilience = eval_data.get("resilience_indicator", "")
            if discrimination or resilience:
                parts = []
                if discrimination:
                    parts.append(f"emotional discrimination: {discrimination}")
                if resilience:
                    parts.append(f"resilience: {resilience}")
                insight_messages.append({
                    "role": "assistant",
                    "content": f"Balloon Positivity game results — {', '.join(parts)}.",
                })

    if insight_messages:
        try:
            memory_manager.add_memories(
                insight_messages, user_id,
                metadata={"source": "game_insights", "category": "therapeutic"},
            )
            logger.info(f"✅ [GAME→MEM0] Stored {len(insight_messages)} game insight(s) as memories")
        except Exception as exc:
            logger.error(f"❌ [GAME→MEM0] Failed: {exc}")


# ── routes ─────────────────────────────────────────────────────────────────
@router.get("/chat/greeting")
async def get_greeting(
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    personality: Optional[str] = None,
    companion_name: Optional[str] = None,
    authorization: str = Header(None),
):
    """Generate a personalised greeting for a new chat session."""
    try:
        authenticated_user_id = await validate_user_token(authorization, supabase_client)

        if not session_id:
            return {"greeting": "Hey! What's on your mind?", "show_greeting": True, "language_used": "english", "time_slot": "day"}

        greeting_data = generate_greeting(
            authenticated_user_id, session_id,
            personality=personality, companion_name=companion_name,
        )
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

        # Load session summary from mem0 system (non-blocking)
        session_summary = {}
        try:
            session_summary = memory_manager.load_session_summary(request.session_id) if request.session_id else {}
        except Exception as sum_exc:
            logger.warning(f"⚠️ [CHAT] Session summary load failed: {sum_exc}")

        # Merge mem0 session summary with DB conversation summary
        conv_summary = context["conversation_summary"]
        if session_summary:
            conv_summary = {**conv_summary, **session_summary}

        # Load previous session summary for cross-session continuity
        prev_session_summary = {}
        try:
            prev_session_summary = fetch_previous_session_summary(user_id, request.session_id)
        except Exception as prev_exc:
            logger.warning(f"\u26a0\ufe0f [CHAT] Previous session summary load failed: {prev_exc}")

        result = process_user_chat(
            user_message=request.user_message,
            recent_messages=context["recent_messages"],
            conversation_summary=conv_summary,
            user_activities=context["user_activities"],
            user_patterns={},
            voice_analysis=request.voice_analysis or {},
            user_id=user_id,
            session_id=request.session_id,
            personality=request.personality,
            companion_name=request.companion_name,
            language=request.language,
            previous_session_summary=prev_session_summary,
        )

        ai_text = result.get("message", "")
        avatar = _build_avatar_package(ai_text, result, request.avatar_visible, request.personality)

        if request.session_id:
            _maybe_trigger_memory(request.session_id, user_id)
            # Session summary (runs every 3x memory trigger intervals)
            count = get_hybrid_message_count(request.session_id)
            if count > 0 and count % (MEMORY_TRIGGER_INTERVAL * 3) == 0:
                threading.Thread(
                    target=_run_session_end_jobs,
                    args=(request.session_id, user_id),
                    daemon=True,
                ).start()

            # Game → mem0 memory bridge (extract therapeutic insights from activities)
            if context["user_activities"]:
                threading.Thread(
                    target=_extract_game_insights_for_memory,
                    args=(context["user_activities"], user_id),
                    daemon=True,
                ).start()

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

                # Load previous session summary for cross-session continuity
                prev_session_summary = {}
                try:
                    prev_session_summary = fetch_previous_session_summary(user_id, request.session_id)
                except Exception:
                    pass

                result = process_user_chat(
                    user_message=request.user_message,
                    recent_messages=context["recent_messages"],
                    conversation_summary=context["conversation_summary"],
                    user_activities=context["user_activities"],
                    user_patterns={},
                    voice_analysis=request.voice_analysis or {},
                    user_id=user_id,
                    session_id=request.session_id,
                    personality=request.personality,
                    companion_name=request.companion_name,
                    language=request.language,
                    previous_session_summary=prev_session_summary,
                )

                ai_text = result.get("message", "")
                logger.info(f"✅ [STREAM] Text ready ({len(ai_text)} chars)")

                yield (
                    f"event: text_chunk\ndata: {json.dumps({'message': ai_text, 'modality': result.get('modality'), 'confidence': result.get('confidence', 0.8)})}\n\n"
                )

                if request.avatar_visible and ai_text:
                    mood = _detect_emotion(ai_text)
                    audio_b64 = generate_tts_audio_v2(ai_text, mood["emotion"], personality_id=request.personality)

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
                    # Session summary (runs every 3x memory trigger intervals)
                    count = get_hybrid_message_count(request.session_id)
                    if count > 0 and count % (MEMORY_TRIGGER_INTERVAL * 3) == 0:
                        threading.Thread(
                            target=_run_session_end_jobs,
                            args=(request.session_id, user_id),
                            daemon=True,
                        ).start()

                    # Game → mem0 memory bridge
                    if context["user_activities"]:
                        threading.Thread(
                            target=_extract_game_insights_for_memory,
                            args=(context["user_activities"], user_id),
                            daemon=True,
                        ).start()

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
