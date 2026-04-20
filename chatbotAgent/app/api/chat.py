"""
app.api.chat — Chat HTTP routes (MITRA v2 only).

Endpoints
---------
GET    /chat/greeting          — time-aware greeting for a fresh session
POST   /chat                   — single-shot turn (JSON in, JSON out)
POST   /chat/stream            — Server-Sent Events stream of the response
POST   /chat/end-session       — explicit close (kicks the consolidation worker)
POST   /transcribe             — Groq Whisper STT fallback (used when Azure
                                 SDK returns an empty transcript)

All chat traffic flows through the MITRA pipeline (`mitra_dispatch.run_mitra_turn`).
The legacy `process_user_chat` workflow has been removed; if `MITRA_STACK_ENABLED`
is off the route returns 503 rather than silently falling back to dead code.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from typing import Any, AsyncIterator, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel

from ..core.auth import validate_user_token
from ..core.logging import log_banner, log_timing, spawn_correlated_thread
from ..core.pii import redact_text
from ..models.request_models import ChatRequest, EndSessionRequest
from ..models.response_models import ChatResponse
from ..pipeline.mitra import dispatch as mitra_dispatch
from ..services.greeting_service import generate_greeting
from ..services.supabase_service import (
    fetch_last_n_messages,
    fetch_previous_session_summary,
    fetch_user_context,
    get_hybrid_message_count,
    session_message_counters,
    supabase_client,
)
from ..services.voice_prosody import decode_audio_data

router = APIRouter()
logger = logging.getLogger("app.api.chat")

# Module-level Groq singleton for /transcribe (avoids reconnect per call).
_groq_transcribe_client: Optional[Groq] = None


def _get_groq_transcribe_client() -> Optional[Groq]:
    global _groq_transcribe_client
    if _groq_transcribe_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            _groq_transcribe_client = Groq(api_key=api_key)
    return _groq_transcribe_client


# ── Pydantic models ────────────────────────────────────────────────────────
class TranscribeRequest(BaseModel):
    audio_data: str  # Base64-encoded WAV audio


# ── /transcribe ────────────────────────────────────────────────────────────
@router.post("/transcribe")
async def transcribe_audio(
    request: TranscribeRequest,
    authorization: str = Header(None),
):
    """Fallback STT via Groq Whisper (whisper-large-v3-turbo)."""
    try:
        await validate_user_token(authorization, supabase_client)

        wav_bytes = decode_audio_data(request.audio_data)
        if not wav_bytes:
            logger.warning("⚠️  [TRANSCRIBE] empty audio payload")
            raise HTTPException(status_code=400, detail="audio_data is empty or invalid")

        groq_client = _get_groq_transcribe_client()
        if groq_client is None:
            logger.error("❌ [TRANSCRIBE] GROQ_API_KEY not configured")
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

        tmp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(wav_bytes)
                tmp_path = tmp.name

            logger.info(f"🎙️  [TRANSCRIBE] forwarding {len(wav_bytes)//1024}KB WAV to Groq Whisper")

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
                logger.info(f"✅ [TRANSCRIBE] Whisper transcript {redact_text(transcript)}")
            else:
                logger.warning("⚠️  [TRANSCRIBE] Whisper returned empty transcript")

            return {"transcript": transcript, "model": "groq-whisper-large-v3-turbo"}
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"❌ [TRANSCRIBE] failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")


# ── helpers ────────────────────────────────────────────────────────────────
def _detect_emotion(text: str) -> Dict[str, str]:
    """Light, deterministic emotion classifier used by the avatar.

    Maps a few therapeutic phrases to facial expressions consumed by the
    TalkingHead component. Pure heuristics, no LLM call.
    """
    t = (text or "").lower()

    if any(p in t for p in (
        "i understand", "i hear you", "that must be", "i'm sorry you",
        "your feelings", "it makes sense", "you're not alone",
        "i can see how", "must have been", "that sounds really",
    )):
        return {"emotion": "empathy", "facial_expression": "empathy"}

    if any(p in t for p in (
        "i'm concerned", "worried about", "that sounds serious",
        "be careful", "important to note", "want to make sure",
        "pay attention to",
    )):
        return {"emotion": "concern", "facial_expression": "concern"}

    if any(p in t for p in (
        "great job", "well done", "proud of", "wonderful progress",
        "that's wonderful", "that's amazing", "congratulations",
        "you did it", "keep it up", "brilliant",
    )):
        return {"emotion": "encouragement", "facial_expression": "encouragement"}

    if any(p in t for p in (
        "tell me more", "go on", "can you share", "what happened",
        "how did that", "i'd like to hear", "continue",
    )):
        return {"emotion": "acknowledgment", "facial_expression": "acknowledgment"}

    if any(p in t for p in (
        "take a deep breath", "let's breathe", "let's slow down",
        "grounding exercise", "at your own pace", "gentle reminder",
    )):
        return {"emotion": "calm", "facial_expression": "calm"}

    if any(p in t for p in (
        "can you describe", "what was that like", "tell me about",
        "how does that feel", "what comes to mind",
    )):
        return {"emotion": "listening", "facial_expression": "listening"}

    if any(w in t for w in ("happy", "great", "wonderful", "amazing", "excited", "proud", "joy")):
        return {"emotion": "happy", "facial_expression": "encouragement"}
    if any(w in t for w in ("sad", "sorry", "difficult", "hard", "anxious", "worried")):
        return {"emotion": "sad", "facial_expression": "empathy"}
    if any(w in t for w in ("angry", "frustrated", "annoyed")):
        return {"emotion": "angry", "facial_expression": "concern"}
    if any(w in t for w in ("wow", "really", "surprised", "incredible")):
        return {"emotion": "surprised", "facial_expression": "acknowledgment"}

    return {"emotion": "neutral", "facial_expression": "default"}


def _build_avatar_package(ai_text: str, avatar_visible: bool) -> Dict[str, Any]:
    """Animation + facial expression for the TalkingHead avatar."""
    if not avatar_visible:
        return {"animation": "Idle", "facial_expression": "default"}
    if ai_text:
        mood = _detect_emotion(ai_text)
        return {"animation": "Talking_0", "facial_expression": mood["facial_expression"]}
    return {"animation": "Idle", "facial_expression": "default"}


def _maybe_kick_consolidation(session_id: str, user_id: str, message_count: int) -> None:
    """Every N messages, fire the consolidation worker for this user.

    The worker pulls candidate memories from the latest turns, dedupes them
    against existing episodics, applies Ebbinghaus decay, and (nightly) runs
    the higher-order reflection pass. Always non-blocking — failures only
    affect future recall, never the live response.
    """
    interval = int(os.getenv("MITRA_CONSOLIDATION_INTERVAL", "12"))
    if message_count <= 0 or message_count % interval != 0:
        return

    def _run() -> None:
        try:
            from ..core.models import ModelRegistry, Role
            from ..jobs.consolidation_worker import ConsolidationWorker
            from ..jobs.extractor import build_extractor
            from ..memory.episodic import EpisodicService
            from ..memory.qdrant_v2 import get_qdrant
            from ..memory.repositories import EpisodicRepo
            from ..providers import get_embeddings_provider, get_llm_provider

            cfg = ModelRegistry.for_role(Role.EXTRACTOR)
            provider = get_llm_provider(cfg.provider.value)

            async def _llm_complete(
                *,
                system: str,
                user: str,
                model: Optional[str] = None,
                json_mode: bool = False,
                **kwargs: Any,
            ) -> str:
                """Adapter matching `build_extractor`'s expected signature.

                The extractor calls `llm_complete(system=..., user=...,
                model=..., json_mode=True)`. We translate that into the
                provider's `complete(messages, ...)` shape and request
                JSON-object response format when the extractor asks for it.
                """
                messages = [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ]
                call_kwargs: Dict[str, Any] = {
                    "model": model or cfg.model,
                    "max_tokens": cfg.max_tokens,
                    "temperature": cfg.temperature,
                    "timeout_s": cfg.timeout_s,
                }
                if json_mode:
                    call_kwargs["response_format"] = {"type": "json_object"}
                call_kwargs.update(kwargs)
                result = await provider.complete(messages, **call_kwargs)
                return result if isinstance(result, str) else str(result or "")

            embed_cfg = ModelRegistry.for_role(Role.EMBEDDINGS)
            embedder = get_embeddings_provider(embed_cfg.provider.value)

            async def _embed(texts):
                return await embedder.embed(texts)

            qdrant = get_qdrant()
            if not (qdrant and supabase_client):
                logger.info("🧪 [CONSOLIDATE] skipped (qdrant or supabase unavailable)")
                return

            episodic = EpisodicService(sb=supabase_client, qdrant=qdrant, embed_fn=_embed)
            repo = EpisodicRepo(supabase_client)
            extractor = build_extractor(llm_complete=_llm_complete, model=cfg.model)
            worker = ConsolidationWorker(
                episodic=episodic, episodic_repo=repo, extract_fn=extractor,
            )
            report = asyncio.run(worker.run_once_for_user(user_id, session_id=session_id))
            logger.info(
                f"🧪 [CONSOLIDATE] user={user_id[:8]} candidates={report.n_candidates} "
                f"written={report.n_written} archived={report.n_archived} "
                f"reflections={report.n_reflections}"
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"⚠️  [CONSOLIDATE] worker failed: {exc}")

    spawn_correlated_thread(_run, name="consolidation-worker")


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
            return {
                "greeting": "Hey! What's on your mind?",
                "show_greeting": True,
                "language_used": "english",
                "time_slot": "day",
            }
        return generate_greeting(
            authenticated_user_id, session_id,
            personality=personality, companion_name=companion_name, language=language,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"❌ [GREETING] {exc}")
        return {
            "greeting": "Hey! What's on your mind?",
            "show_greeting": True,
            "language_used": "english",
            "time_slot": "day",
        }


def _ensure_mitra_enabled() -> None:
    """Refuse to serve chat traffic when the new pipeline is disabled."""
    if not mitra_dispatch.is_enabled():
        raise HTTPException(
            status_code=503,
            detail=(
                "MITRA stack disabled (set MITRA_STACK_ENABLED=1). "
                "Legacy workflow has been removed in v2."
            ),
        )


def _annotate_voice_analysis(request: ChatRequest) -> Dict[str, Any]:
    """Synchronous passthrough — prosody extraction is OFF on the chat path.

    Returns the frontend-supplied ``voice_analysis`` dict (Azure SDK metrics
    such as WPM, pause counts, clarity) with ``acoustic_status`` stamped to
    document that no Praat features were extracted server-side. See
    `docs/MITRA.md` → "Future Work" for the recipe to
    re-enable on-line prosody via a sandboxed subprocess.
    """
    voice_analysis = dict(request.voice_analysis or {})
    if request.audio_data:
        voice_analysis["audio_received_bytes_b64"] = len(request.audio_data)
    voice_analysis["acoustic_status"] = "not_extracted"
    return voice_analysis


@router.post("/chat", response_model=ChatResponse)
async def process_chat(
    request: ChatRequest,
    authorization: str = Header(None),
    x_mindmitra_eval_trace: Optional[str] = Header(None, alias="X-MindMitra-Eval-Trace"),
):
    """Single-shot chat turn — runs the MITRA pipeline and returns one JSON body.

    Use this for non-streaming clients (curl, mobile) or for evaluation runs
    where the eval-trace header is set. For interactive UIs use `/chat/stream`.
    """
    _ensure_mitra_enabled()
    user_id = await validate_user_token(authorization, supabase_client)
    log_banner(
        "📥 POST /chat",
        [
            f"user        : {user_id[:8]}",
            f"session     : {(request.session_id or '-')[:8]}",
            f"persona     : {request.personality or 'mitra'}",
            f"language    : {request.language or 'en'}",
            f"msg_len     : {len(request.user_message)} chars",
        ],
        logger=logger,
    )

    # Voice metadata is a sync passthrough; only DB fetches need parallelism.
    context, prev_summary = await asyncio.gather(
        fetch_user_context(user_id, request.session_id),
        asyncio.to_thread(fetch_previous_session_summary, user_id, request.session_id),
    )
    voice_analysis = _annotate_voice_analysis(request)
    if voice_analysis:
        context.setdefault("voice_analysis", voice_analysis)

    allow_eval = os.getenv("ALLOW_EVAL_TRACE", "").lower() in ("1", "true", "yes")
    want_trace = allow_eval and (x_mindmitra_eval_trace or "").strip().lower() in ("1", "true", "yes")

    with log_timing("chat_turn", session_id=request.session_id, user_id=user_id[:8]):
        try:
            result = await mitra_dispatch.run_mitra_turn(
                user_message=request.user_message,
                user_id=user_id,
                session_id=request.session_id or "",
                recent_messages=context.get("recent_messages") or [],
                persona=(request.personality or "mitra"),
                language=(request.language or "en"),
            )
        except Exception as exc:
            logger.exception(f"❌ [CHAT] MITRA pipeline failed: {exc}")
            raise HTTPException(status_code=500, detail=f"Chat processing failed: {exc}")

    ai_text = result.get("message", "")
    avatar = _build_avatar_package(ai_text, request.avatar_visible)

    if request.session_id:
        session_message_counters[request.session_id] += 1
        count = get_hybrid_message_count(request.session_id, user_id)
        _maybe_kick_consolidation(request.session_id, user_id, count)

    return ChatResponse(
        message=ai_text,
        animation=avatar["animation"],
        facial_expression=avatar["facial_expression"],
        modality=result.get("modality", "therapy"),
        confidence=result.get("confidence", 0.85),
        session_insights=result.get("session_insights"),
        eval_trace=result.get("eval_trace") if want_trace else None,
    )


@router.post("/chat/stream")
async def process_chat_stream(
    request: ChatRequest,
    authorization: str = Header(None),
):
    """Streaming chat turn (Server-Sent Events).

    Event protocol::

        event: text_chunk_delta   { "chunk": "...partial text..." }
        event: text_chunk         { "message": "...full final text..." }
        event: avatar_ready       { "animation": "Talking_0", "facial_expression": "..." }
        event: complete           { "status": "success" }
        event: error              { "error": "..." }

    The pipeline runs as an asyncio task; tokens are pushed onto an
    `asyncio.Queue` and flushed to the SSE stream at sentence boundaries.
    """
    _ensure_mitra_enabled()
    user_id = await validate_user_token(authorization, supabase_client)
    log_banner(
        "📥 POST /chat/stream",
        [
            f"user        : {user_id[:8]}",
            f"session     : {(request.session_id or '-')[:8]}",
            f"persona     : {request.personality or 'mitra'}",
            f"language    : {request.language or 'en'}",
            f"avatar      : {request.avatar_visible}",
            f"msg_len     : {len(request.user_message)} chars",
        ],
        logger=logger,
    )

    async def _zero() -> int:
        return 0

    # Voice metadata is a sync passthrough (no Praat on the chat path);
    # only DB fetches need parallelism. See voice_prosody.py docstring.
    context, prev_summary, message_count = await asyncio.gather(
        fetch_user_context(user_id, request.session_id),
        asyncio.to_thread(fetch_previous_session_summary, user_id, request.session_id),
        (
            asyncio.to_thread(get_hybrid_message_count, request.session_id, user_id)
            if request.session_id
            else _zero()
        ),
    )
    voice_analysis = _annotate_voice_analysis(request)
    if voice_analysis:
        context.setdefault("voice_analysis", voice_analysis)

    async def event_generator() -> AsyncIterator[str]:
        chunk_q: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_chunk(chunk: str) -> None:
            # Called from the LLM provider's worker thread or the orchestrator.
            try:
                loop.call_soon_threadsafe(chunk_q.put_nowait, chunk)
            except RuntimeError:
                pass  # event loop closed — request was cancelled

        async def _run_pipeline() -> Dict[str, Any]:
            try:
                return await mitra_dispatch.run_mitra_turn(
                    user_message=request.user_message,
                    user_id=user_id,
                    session_id=request.session_id or "",
                    recent_messages=context.get("recent_messages") or [],
                    persona=(request.personality or "mitra"),
                    language=(request.language or "en"),
                    stream_callback=on_chunk,
                )
            except Exception as exc:
                logger.exception(f"❌ [STREAM] MITRA pipeline error: {exc}")
                raise

        pipeline_task = asyncio.create_task(_run_pipeline())

        try:
            # Forward every provider delta straight to the client. Frontends
            # that need sentence-level dispatch (Presence avatar TTS) do
            # their own Unicode-aware sentence segmentation client-side.
            # Doing it here as well only delays the first audible byte by
            # the length of a sentence (often 5-9 s on `gpt-5-mini`).
            while True:
                if pipeline_task.done() and chunk_q.empty():
                    break
                try:
                    chunk = await asyncio.wait_for(chunk_q.get(), timeout=0.05)
                except asyncio.TimeoutError:
                    continue
                yield f"event: text_chunk_delta\ndata: {json.dumps({'chunk': chunk})}\n\n"

            try:
                result = await pipeline_task
            except Exception as exc:
                yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"
                return

            ai_text = result.get("message", "")
            insights = result.get("session_insights") or {}
            logger.info(
                f"✅ [STREAM] response ready chars={len(ai_text)} "
                f"intent={insights.get('intent')} stance={insights.get('stance')}"
            )

            yield (
                "event: text_chunk\ndata: "
                + json.dumps({
                    "message": ai_text,
                    "modality": result.get("modality", "therapy"),
                    "confidence": result.get("confidence", 0.85),
                    "session_insights": insights,
                })
                + "\n\n"
            )

            if request.avatar_visible and ai_text:
                mood = _detect_emotion(ai_text)
                yield (
                    "event: avatar_ready\ndata: "
                    + json.dumps({
                        "animation": "Talking_0",
                        "facial_expression": mood["facial_expression"],
                    })
                    + "\n\n"
                )

            if request.session_id:
                session_message_counters[request.session_id] += 1
                count = get_hybrid_message_count(request.session_id, user_id)
                _maybe_kick_consolidation(request.session_id, user_id, count)

            yield "event: complete\ndata: " + json.dumps({"status": "success"}) + "\n\n"

        except Exception as exc:
            logger.exception(f"❌ [STREAM] generator crashed: {exc}")
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            if not pipeline_task.done():
                pipeline_task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/chat/end-session")
async def end_session(
    request: EndSessionRequest,
    authorization: str = Header(None),
):
    """Explicit session close — kicks the consolidation worker right now."""
    user_id = await validate_user_token(authorization, supabase_client)
    logger.info(f"🏁 [END-SESSION] user={user_id[:8]} session={(request.session_id or '-')[:8]}")
    if request.session_id:
        # Force a consolidation regardless of the message-count modulo.
        spawn_correlated_thread(
            target=lambda: _maybe_kick_consolidation(request.session_id, user_id, 12),
            name="end-session-consolidation",
        )
    return {"status": "queued", "session_id": request.session_id}
