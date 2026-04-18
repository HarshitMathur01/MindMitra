"""
Chat routes — POST /chat, POST /chat/stream, GET /chat/greeting, POST /transcribe.
"""
import asyncio
import json
import logging
import os
import queue
import re
import tempfile
import threading
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel

from ..core.auth import validate_user_token
from ..core.logging import log_timing, request_id_var, log_event
from ..models.request_models import ChatRequest, EndSessionRequest
from ..models.response_models import ChatResponse
from ..pipeline.workflow import get_workflow_instance, process_user_chat
from ..agents.memory_manager import memory_manager
from ..services.greeting_service import generate_greeting
from ..services.voice_prosody import analyze_prosody, decode_audio_data
from ..services.supabase_service import (
    fetch_last_n_messages,
    fetch_latest_screening_scores,
    fetch_previous_session_summary,
    fetch_user_context,
    get_hybrid_message_count,
    save_screening_scores,
    session_message_counters,
    bump_session_message_count,
    supabase_client,
)
from ..core.emotional_arc_updater import EmotionalArcUpdater
from ..core.output_safety_auditor import OutputSafetyAuditor
from ..utils.constants import (
    MEMORY_TRIGGER_INTERVAL,
    SCREENING_EMA_ALPHA,
    SCREENING_MIN_MESSAGES,
    STAGE_TRUST_WINDOW_MAX,
    STAGE_DEEPENING_MAX,
    STAGE_INSIGHT_MAX,
    QUESTION_CAP_TRUST,
    QUESTION_CAP_DEEPENING,
    QUESTION_CAP_INSIGHT,
    QUESTION_CAP_COMPANION,
)

router = APIRouter()
logger = logging.getLogger(__name__)

output_safety_auditor = OutputSafetyAuditor()
emotional_arc_updater = EmotionalArcUpdater()

# ── Compiled regex for sentence-boundary detection in SSE chunk buffer ──────
# Matches end of a sentence: punctuation followed by a space.
_SENTENCE_BOUNDARY_RE = re.compile(r'[.!?]\s')

# ── Module-level Groq singleton for /transcribe (avoids reconnect per call) ─
_groq_transcribe_client: Optional[Groq] = None


def _get_groq_transcribe_client() -> Optional[Groq]:
    """Return a cached Groq client for transcription, creating it once."""
    global _groq_transcribe_client
    if _groq_transcribe_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            _groq_transcribe_client = Groq(api_key=api_key)
    return _groq_transcribe_client


# ── Pydantic models ────────────────────────────────────────────────────────
class TranscribeRequest(BaseModel):
    """Request body for the /transcribe endpoint."""
    audio_data: str  # Base64-encoded WAV audio


# ── /transcribe — Groq Whisper STT fallback ────────────────────────────────
@router.post("/transcribe")
async def transcribe_audio(
    request: TranscribeRequest,
    authorization: str = Header(None),
):
    """
    Fallback speech-to-text via Groq Whisper (whisper-large-v3-turbo).

    Called by the frontend when Azure Speech SDK returns an empty transcript
    despite audio being captured (typically caused by heavy background noise).

    Accepts a base64-encoded WAV payload, writes it to a temporary file, and
    calls the Groq audio-transcriptions API.  Returns the transcript text.
    """
    try:
        await validate_user_token(authorization, supabase_client)

        wav_bytes = decode_audio_data(request.audio_data)
        if not wav_bytes:
            logger.warning("⚠️ [TRANSCRIBE] Empty audio data received")
            raise HTTPException(status_code=400, detail="audio_data is empty or invalid")

        groq_client = _get_groq_transcribe_client()
        if groq_client is None:
            logger.error("❌ [TRANSCRIBE] GROQ_API_KEY not configured")
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

        # Write to a temp file — Groq SDK requires a real file object
        tmp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(wav_bytes)
                tmp_path = tmp.name

            logger.info(f"🔄 [TRANSCRIBE] Sending {len(wav_bytes)//1024}KB WAV to Groq Whisper")

            with open(tmp_path, "rb") as f:
                result = groq_client.audio.transcriptions.create(
                    model="whisper-large-v3-turbo",
                    file=f,
                    response_format="text",
                    language="en",
                )

            transcript = result if isinstance(result, str) else getattr(result, "text", "")
            transcript = (transcript or "").strip()

            if transcript:
                logger.info(f"✅ [TRANSCRIBE] Whisper transcript ({len(transcript)} chars): \"{transcript[:80]}\"")
            else:
                logger.warning("⚠️ [TRANSCRIBE] Groq Whisper returned empty transcript")

            return {"transcript": transcript, "model": "groq-whisper-large-v3-turbo"}

        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [TRANSCRIBE] {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ── helpers ────────────────────────────────────────────────────────────────
def _detect_emotion(text: str) -> Dict[str, str]:
    """Detect therapeutic emotion from AI response text.

    Returns facial_expression aligned with MindMitraBridge mood names:
    empathy, concern, encouragement, acknowledgment, calm, listening, or default.
    """
    t = text.lower()

    # ── Therapeutic emotions (multi-word phrases → more specific, check first) ──
    if any(p in t for p in [
        "i understand", "i hear you", "that must be", "i'm sorry you",
        "your feelings", "it makes sense", "you're not alone",
        "i can see how", "must have been", "that sounds really",
    ]):
        return {"emotion": "empathy", "facial_expression": "empathy"}

    if any(p in t for p in [
        "i'm concerned", "worried about", "that sounds serious",
        "be careful", "important to note", "want to make sure",
        "pay attention to",
    ]):
        return {"emotion": "concern", "facial_expression": "concern"}

    if any(p in t for p in [
        "great job", "well done", "proud of", "wonderful progress",
        "that's wonderful", "that's amazing", "congratulations",
        "you did it", "keep it up", "brilliant",
    ]):
        return {"emotion": "encouragement", "facial_expression": "encouragement"}

    if any(p in t for p in [
        "tell me more", "go on", "can you share", "what happened",
        "how did that", "i'd like to hear", "continue",
    ]):
        return {"emotion": "acknowledgment", "facial_expression": "acknowledgment"}

    if any(p in t for p in [
        "take a deep breath", "let's breathe", "let's slow down",
        "grounding exercise", "at your own pace", "gentle reminder",
    ]):
        return {"emotion": "calm", "facial_expression": "calm"}

    if any(p in t for p in [
        "can you describe", "what was that like", "tell me about",
        "how does that feel", "what comes to mind",
    ]):
        return {"emotion": "listening", "facial_expression": "listening"}

    # ── Standard emotions → map to closest therapeutic expression ──
    if any(w in t for w in ["happy", "great", "wonderful", "amazing", "excited", "proud", "joy"]):
        return {"emotion": "happy", "facial_expression": "encouragement"}
    if any(w in t for w in ["sad", "sorry", "difficult", "hard", "anxious", "worried"]):
        return {"emotion": "sad", "facial_expression": "empathy"}
    if any(w in t for w in ["angry", "frustrated", "annoyed"]):
        return {"emotion": "angry", "facial_expression": "concern"}
    if any(w in t for w in ["wow", "really", "surprised", "incredible"]):
        return {"emotion": "surprised", "facial_expression": "acknowledgment"}

    return {"emotion": "neutral", "facial_expression": "default"}


def _build_avatar_package(
    ai_text: str,
    result: Dict[str, Any],
    avatar_visible: bool,
    personality_id: str | None = None,
) -> Dict[str, Any]:
    """Return avatar animation + emotion fields. TTS/lipsync handled by TalkingHead internally."""
    if not avatar_visible:
        logger.info("⚡ [AVATAR] Avatar hidden — skipping emotion detection")
        return {"animation": "Idle", "facial_expression": "default"}

    if ai_text:
        mood = _detect_emotion(ai_text)
        return {"animation": "Talking_0", "facial_expression": mood["facial_expression"]}

    return {"animation": "Idle", "facial_expression": "default"}


def _maybe_trigger_memory(
    session_id: str,
    user_id: str,
    content_locale: str | None = None,
    emotional_intensity: float | None = None,
) -> None:
    """Hybrid message counter hint + MemoryManager session lifecycle (extraction at 12)."""
    try:
        count = bump_session_message_count(session_id, ttl_seconds=3600)
        will_extract = count > 0 and count % 12 == 0
        will_checkpoint = count > 0 and count % 36 == 0
        logger.info(
            "📊 [MEMORY-TRIGGER] session=%s user=%s count=%d interval=%d "
            "extract_trigger=%s checkpoint_trigger=%s locale=%s",
            session_id[-8:], user_id[-8:], count, MEMORY_TRIGGER_INTERVAL,
            will_extract, will_checkpoint, content_locale or "none",
        )
        n_fetch = min(MEMORY_TRIGGER_INTERVAL, max(count, 1))
        messages = fetch_last_n_messages(session_id, n=n_fetch) or []
        memory_manager.on_message(
            messages,
            user_id,
            session_id,
            count,
            content_locale,
            emotional_intensity=emotional_intensity,
        )
    except Exception as e:
        logger.error("❌ [MEMORY-TRIGGER] Failed | session=%s error=%s", session_id[-8:], e)


def _run_session_checkpoint_jobs(session_id: str, user_id: str) -> None:
    """Mid-session checkpoint: structured extraction + optional summary; screening."""
    try:
        cnt = get_hybrid_message_count(session_id) or 0
        cap = max(cnt, 1)
        messages = fetch_last_n_messages(session_id, n=min(cap, 200)) or []
        memory_manager.on_session_checkpoint(messages, user_id, session_id)

        recent = fetch_last_n_messages(session_id, n=30)
        if recent and len(recent) >= SCREENING_MIN_MESSAGES:
            try:
                workflow = get_workflow_instance()
                if workflow.screening_agent:
                    previous = fetch_latest_screening_scores(user_id)
                    scores = workflow.screening_agent.generate_session_assessment(
                        recent, previous_scores=previous, ema_alpha=SCREENING_EMA_ALPHA
                    )
                    if scores:
                        save_screening_scores(user_id, session_id, scores)
                        logger.info(
                            f"\u2705 [SCREENING] Checkpoint assessment complete | "
                            f"PHQ-9={scores.get('phq9',{}).get('score','?')} "
                            f"GAD-7={scores.get('gad7',{}).get('score','?')}"
                        )
            except Exception as screen_exc:
                logger.error(f"\u274c [SCREENING] Checkpoint assessment failed: {screen_exc}")
    except Exception as e:
        logger.error(f"❌ [SESSION-CHECKPOINT] Job failed: {e}")


def _run_session_end_jobs(session_id: str, user_id: str) -> None:
    """Background: session-end memory pipeline + procedural + reflections + screening."""
    try:
        cnt = get_hybrid_message_count(session_id) or 0
        cap = max(cnt, 1)
        messages_all = fetch_last_n_messages(session_id, n=min(cap, 400)) or []
        if messages_all:
            threading.Thread(
                target=memory_manager.on_session_end,
                args=(messages_all, user_id, session_id),
                daemon=True,
                name="session-end-memory",
            ).start()

        recent = fetch_last_n_messages(session_id, n=30) or []
        if recent and len(recent) >= 5:
            try:
                _trigger_procedural_synthesis(user_id, recent)
            except Exception as proc_exc:
                logger.error(f"❌ [PROCEDURAL] Synthesis failed: {proc_exc}")

            try:
                if memory_manager.should_generate_reflections(user_id):
                    threading.Thread(
                        target=memory_manager.generate_reflections,
                        args=(user_id,),
                        daemon=True,
                    ).start()
                    logger.info("🔮 [REFLECTION] Triggered reflection generation")
            except Exception as ref_exc:
                logger.error(f"❌ [REFLECTION] Trigger failed: {ref_exc}")

        if recent and len(recent) >= SCREENING_MIN_MESSAGES:
            try:
                workflow = get_workflow_instance()
                if workflow.screening_agent:
                    previous = fetch_latest_screening_scores(user_id)
                    scores = workflow.screening_agent.generate_session_assessment(
                        recent, previous_scores=previous, ema_alpha=SCREENING_EMA_ALPHA
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


def _trigger_procedural_synthesis(user_id: str, messages: list) -> None:
    """
    Analyze recent conversation for coping strategies / therapeutic techniques
    and store as procedural memories. Runs only if substantive therapeutic
    content is detected (keywords: breathe, exercise, journal, cope, strategy, etc.)
    """
    _PROCEDURAL_KEYWORDS = (
        "breathing", "breathe", "exercise", "journal", "meditat",
        "technique", "strategy", "cope", "coping", "grounding",
        "mindful", "relax", "calm", "practice", "routine", "habit",
        "sleep", "self-care", "selfcare", "walk", "yoga",
    )

    # Quick scan: only synthesize if therapeutic techniques were discussed
    full_text = " ".join(m.get("content", "").lower() for m in messages[-15:])
    if not any(kw in full_text for kw in _PROCEDURAL_KEYWORDS):
        return

    # Determine topic from message content
    topic = "coping strategies"
    for kw_pair in [("breathing", "breathing exercises"), ("journal", "journaling"),
                    ("meditat", "meditation"), ("grounding", "grounding techniques"),
                    ("sleep", "sleep hygiene"), ("exercise", "physical exercise")]:
        if kw_pair[0] in full_text:
            topic = kw_pair[1]
            break

    memory_manager.synthesize_procedural_memory(user_id, topic, messages[-15:])


def _extract_game_insights_for_memory(activities: list, user_id: str) -> None:
    """
    Extract therapeutic insights from game/assessment activities and store as long-term memories.
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
    language: Optional[str] = Query(None),
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
            language=language,
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
    x_mindmitra_eval_trace: Optional[str] = Header(None, alias="X-MindMitra-Eval-Trace"),
):
    """Main chat endpoint — executes full pipeline and returns response with optional avatar data."""
    _rid = uuid.uuid4().hex[:12]
    request_id_var.set(_rid)
    try:
        logger.info(
            "═" * 60 + "\n"
            "🚀 [CHAT] Incoming request\n"
            "  request_id=%s  session=%s  msg_len=%d",
            _rid, request.session_id or "none", len(request.user_message),
        )
        user_id = await validate_user_token(authorization, supabase_client)
        log_event(
            logger,
            "chat_request",
            endpoint="/chat",
            user=str(user_id)[:12],
            session=str(request.session_id or "none")[:16],
            avatar_visible=bool(request.avatar_visible),
            has_audio=bool(request.audio_data),
            personality=request.personality,
            language=request.language,
            msg_len=len(request.user_message or ""),
        )
        logger.info("👤 [CHAT] Authenticated | user=%s session=%s", user_id[:12], request.session_id or "none")

        threading.Thread(
            target=memory_manager.get_emotional_trend,
            args=(user_id,),
            daemon=True,
            name="trend-prewarm-chat",
        ).start()

        def _load_session_summary_safe(sid: Optional[str]) -> Dict[str, Any]:
            if not sid:
                return {}
            try:
                return memory_manager.load_session_summary(sid)
            except Exception as sum_exc:
                logger.warning(f"⚠️ [CHAT] Session summary load failed: {sum_exc}")
                return {}

        def _prev_summary_safe(uid: str, sid: Optional[str]) -> Dict[str, Any]:
            try:
                return fetch_previous_session_summary(uid, sid)
            except Exception as prev_exc:
                logger.warning(f"\u26a0\ufe0f [CHAT] Previous session summary load failed: {prev_exc}")
                return {}

        context, session_summary, prev_session_summary = await asyncio.gather(
            fetch_user_context(user_id, request.session_id),
            asyncio.to_thread(_load_session_summary_safe, request.session_id),
            asyncio.to_thread(_prev_summary_safe, user_id, request.session_id),
        )

        conv_summary = context["conversation_summary"]
        if session_summary:
            conv_summary = {**conv_summary, **session_summary}

        # ── Prosodic analysis: enrich voice_analysis with Praat features ──
        voice_analysis = dict(request.voice_analysis or {})
        if request.audio_data:
            try:
                wav_bytes = decode_audio_data(request.audio_data)
                if wav_bytes:
                    prosody = analyze_prosody(wav_bytes)
                    if prosody:
                        voice_analysis["prosody"] = prosody
                        logger.info(f"✅ [CHAT] Prosodic analysis added to voice_analysis")
            except Exception as prosody_exc:
                logger.warning(f"⚠️ [CHAT] Prosody analysis failed: {prosody_exc}")

        allow_eval = os.getenv("ALLOW_EVAL_TRACE", "").lower() in ("1", "true", "yes")
        _hdr = (x_mindmitra_eval_trace or "").strip().lower()
        want_trace = allow_eval and _hdr in ("1", "true", "yes")

        with log_timing("Workflow Pipeline: process_user_chat", session_id=request.session_id, user_id=user_id):
            result = process_user_chat(
                user_message=request.user_message,
                recent_messages=context["recent_messages"],
                conversation_summary=conv_summary,
                user_activities=context["user_activities"],
                user_patterns={},
                voice_analysis=voice_analysis,
                user_id=user_id,
                session_id=request.session_id,
                personality=request.personality,
                companion_name=request.companion_name,
                language=request.language,
                previous_session_summary=prev_session_summary,
                eval_trace=want_trace,
            )

        ai_text = result.get("message", "")
        avatar = _build_avatar_package(ai_text, result, request.avatar_visible, request.personality)

        if request.session_id:
            _maybe_trigger_memory(
                request.session_id,
                user_id,
                content_locale=request.language,
                emotional_intensity=float(result.get("cl_emotional_intensity", 0.0) or 0.0),
            )
            final_response_text = (
                result.get("ai_response") or result.get("message", "") or ai_text
            )
            if final_response_text:
                post_ctx = {
                    "ai_response": final_response_text,
                    "session_id": request.session_id or "",
                    "user_id": user_id,
                    "cl_intent": result.get("cl_intent", "unknown"),
                    "cl_intervention_sequence": result.get("cl_intervention_sequence", []),
                    "cl_arc_trajectory": result.get("cl_arc_trajectory", "stable"),
                    "cl_risk_level": result.get("cl_risk_level", "low"),
                }
                output_safety_auditor.run_async(final_response_text, post_ctx, logger)
                emotional_arc_updater.update_async(
                    request.user_message,
                    final_response_text,
                    post_ctx,
                    supabase_client,
                    logger,
                )
            count = get_hybrid_message_count(request.session_id)
            if count > 0 and count % (MEMORY_TRIGGER_INTERVAL * 3) == 0:
                threading.Thread(
                    target=_run_session_checkpoint_jobs,
                    args=(request.session_id, user_id),
                    daemon=True,
                ).start()

            # Game → memory bridge (extract therapeutic insights from activities)
            if context["user_activities"]:
                threading.Thread(
                    target=_extract_game_insights_for_memory,
                    args=(context["user_activities"], user_id),
                    daemon=True,
                ).start()

        return ChatResponse(
            message=ai_text,
            animation=avatar["animation"],
            facial_expression=avatar["facial_expression"],
            modality=result.get("modality", "therapy"),
            confidence=result.get("confidence", 0.8),
            session_insights=result.get("session_insights"),
            eval_trace=result.get("eval_trace") if want_trace else None,
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
    Streaming endpoint (SSE) — emits incremental text deltas and completes with final metadata.
    Events: text_chunk_delta | complete | error
    """
    _rid = uuid.uuid4().hex[:12]
    request_id_var.set(_rid)
    try:
        user_id = await validate_user_token(authorization, supabase_client)
        log_event(
            logger,
            "chat_request",
            endpoint="/chat/stream",
            request_id=_rid,
            user=str(user_id)[:12],
            session=str(request.session_id or "none")[:16],
            avatar_visible=bool(request.avatar_visible),
            has_audio=bool(request.audio_data),
            personality=request.personality,
            language=request.language,
            msg_len=len(request.user_message or ""),
        )

        async def event_generator():
            try:

                threading.Thread(
                    target=memory_manager.get_emotional_trend,
                    args=(user_id,),
                    daemon=True,
                    name="trend-prewarm",
                ).start()

                # Fetch context, previous session summary, and message count in parallel
                async def _zero():
                    return 0

                context, prev_session_summary, _stream_msg_count = await asyncio.gather(
                    fetch_user_context(user_id, request.session_id),
                    asyncio.to_thread(fetch_previous_session_summary, user_id, request.session_id),
                    asyncio.to_thread(get_hybrid_message_count, request.session_id) if request.session_id else _zero(),
                )

                # ── Prosodic analysis: enrich voice_analysis with Praat features ──
                voice_analysis = dict(request.voice_analysis or {})
                if request.audio_data:
                    try:
                        wav_bytes = decode_audio_data(request.audio_data)
                        if wav_bytes:
                            prosody = analyze_prosody(wav_bytes)
                            if prosody:
                                voice_analysis["prosody"] = prosody
                    except Exception as prosody_exc:
                        logger.warning(f"⚠️ [STREAM] Prosody analysis failed: {prosody_exc}")

                # Determine question cap for stream-time filtering (count already fetched above)
                if _stream_msg_count <= STAGE_TRUST_WINDOW_MAX:
                    _stream_q_cap = QUESTION_CAP_TRUST
                elif _stream_msg_count <= STAGE_DEEPENING_MAX:
                    _stream_q_cap = QUESTION_CAP_DEEPENING
                elif _stream_msg_count <= STAGE_INSIGHT_MAX:
                    _stream_q_cap = QUESTION_CAP_INSIGHT
                else:
                    _stream_q_cap = QUESTION_CAP_COMPANION

                q = queue.Queue()

                def bg_process():
                    try:
                        def on_chunk(chunk):
                            q.put(("chunk", chunk))
                        res = process_user_chat(
                            user_message=request.user_message,
                            recent_messages=context["recent_messages"],
                            conversation_summary=context["conversation_summary"],
                            user_activities=context["user_activities"],
                            user_patterns={},
                            voice_analysis=voice_analysis,
                            user_id=user_id,
                            session_id=request.session_id,
                            personality=request.personality,
                            companion_name=request.companion_name,
                            language=request.language,
                            previous_session_summary=prev_session_summary,
                            chunk_callback=on_chunk,
                            message_count=_stream_msg_count,
                        )
                        q.put(("done", res))
                    except Exception as e:
                        q.put(("error", str(e)))

                thread = threading.Thread(target=bg_process)
                thread.start()

                result = {}
                _chunk_buffer = ""  # Buffer for sentence-boundary streaming
                while True:
                    try:
                        # Avoid busy-waiting: block briefly for new items.
                        item = await asyncio.to_thread(q.get, True, 0.25)
                    except queue.Empty:
                        continue

                    kind, data = item
                    if kind == "chunk":
                        _chunk_buffer += data
                        # Emit only complete sentences (up to the last sentence boundary)
                        _last_boundary = -1
                        for _m in _SENTENCE_BOUNDARY_RE.finditer(_chunk_buffer):
                            _last_boundary = _m.end() - 1  # position of the space after punctuation
                        if _last_boundary > 0:
                            _emit_text = _chunk_buffer[:_last_boundary + 1]
                            _chunk_buffer = _chunk_buffer[_last_boundary + 1:]
                            # Quick question scrub for zero-question stages
                            if _stream_q_cap == 0 and "?" in _emit_text:
                                _emit_text = _emit_text.replace("?", ".")
                                _emit_text = re.sub(r"\.{2,}", ".", _emit_text)
                            yield f"event: text_chunk_delta\ndata: {json.dumps({'chunk': _emit_text})}\n\n"
                    elif kind == "error":
                        raise Exception(data)
                    elif kind == "done":
                        # Flush remaining buffer
                        if _chunk_buffer.strip():
                            _flush = _chunk_buffer
                            if _stream_q_cap == 0 and "?" in _flush:
                                _flush = _flush.replace("?", ".")
                                _flush = re.sub(r"\.{2,}", ".", _flush)
                            yield f"event: text_chunk_delta\ndata: {json.dumps({'chunk': _flush})}\n\n"
                        result = data
                        break

                ai_text = result.get("message", "")
                logger.info(f"✅ [STREAM] Full text ready ({len(ai_text)} chars)")

                if request.session_id:
                    _maybe_trigger_memory(
                        request.session_id,
                        user_id,
                        content_locale=request.language,
                        emotional_intensity=float(result.get("cl_emotional_intensity", 0.0) or 0.0),
                    )
                    final_response_text = (
                        result.get("ai_response")
                        or result.get("message", "")
                        or ai_text
                    )
                    if final_response_text:
                        post_ctx = {
                            "ai_response": final_response_text,
                            "session_id": request.session_id or "",
                            "user_id": user_id,
                            "cl_intent": result.get("cl_intent", "unknown"),
                            "cl_intervention_sequence": result.get("cl_intervention_sequence", []),
                            "cl_arc_trajectory": result.get("cl_arc_trajectory", "stable"),
                            "cl_risk_level": result.get("cl_risk_level", "low"),
                        }
                        output_safety_auditor.run_async(
                            final_response_text, post_ctx, logger
                        )
                        emotional_arc_updater.update_async(
                            request.user_message,
                            final_response_text,
                            post_ctx,
                            supabase_client,
                            logger,
                        )
                    count = get_hybrid_message_count(request.session_id)
                    if count > 0 and count % (MEMORY_TRIGGER_INTERVAL * 3) == 0:
                        threading.Thread(
                            target=_run_session_checkpoint_jobs,
                            args=(request.session_id, user_id),
                            daemon=True,
                        ).start()

                    # Game → memory bridge
                    if context["user_activities"]:
                        threading.Thread(
                            target=_extract_game_insights_for_memory,
                            args=(context["user_activities"], user_id),
                            daemon=True,
                        ).start()

                yield f"event: complete\ndata: {json.dumps({'status': 'success', 'message': ai_text, 'modality': result.get('modality'), 'confidence': result.get('confidence', 0.8)})}\n\n"

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


@router.post("/chat/end-session")
async def end_session(
    request: EndSessionRequest,
    authorization: str = Header(None),
):
    """Trigger session-end jobs (save summary, procedural synthesis, reflections) explicitly when chat closes."""
    try:
        user_id = await validate_user_token(authorization, supabase_client)
        logger.info(f"🏁 [END-SESSION] Explicit user closure: user={user_id}, session={request.session_id}")
        
        # Fire-and-forget background jobs normally deferred by Modulo 36
        import threading
        threading.Thread(
            target=_run_session_end_jobs,
            args=(request.session_id, user_id),
            daemon=True,
        ).start()

        return {"status": "queued", "session_id": request.session_id, "message": "Session wrap-up jobs initiated successfully."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [END-SESSION] Failed to queue jobs: {e}")
        raise HTTPException(status_code=500, detail=f"End session failed: {str(e)}")
