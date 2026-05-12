"""Task B — generate an episodic memory and persist it to Qdrant.

Pipeline:
  1. Gemini 1.5 Flash summarises the full session transcript (80–120 words,
     supportive-friend voice). Fallback: Groq Llama 3.1 8B same prompt.
  2. MiniLM embeds the summary text.
  3. Qdrant upsert into ``episodic_memories`` with the payload spec:
        user_id, session_id, session_date, summary_text, affect_mean,
        topic_keywords, peak_urgency, ending_affect, mode_sequence,
        named_entities, techniques_used
  4. UPDATE sessions.episodic_memory_written = TRUE
"""
from __future__ import annotations

import asyncio
import json
import logging
import statistics
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..core.connections import get_gemini, get_groq, get_qdrant, get_supabase, guarded_call
from ..core.env import env
from ..core.session import SessionObject
from ..memory.embedding import compute_embedding
from ..services import profile_service

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = (
    "Summarise this conversation between a young Indian adult and a mental "
    "health companion in 80–120 words. Write as a supportive friend who "
    "wants to remember:\n"
    " • the emotional arc (where they started, where they ended)\n"
    " • what was weighing on them (concrete topics, NOT a diagnosis)\n"
    " • any names mentioned and their relation\n"
    " • techniques or topics discussed (e.g. breathing, journaling, sleep)\n"
    "Do NOT moralise, do NOT add advice, do NOT include personal identifiers "
    "(phone, email, addresses). Keep tone warm and factual.\n\n"
    "Conversation:\n"
)


async def generate_and_store_episodic(session: SessionObject) -> bool:
    transcript = _format_transcript(session)
    summary = await _summarise_gemini(transcript) or await _summarise_groq(transcript)
    if not summary:
        logger.error("[v3 episodic] Gemini and Groq summary failed; writing raw transcript to failed_summaries")
        await profile_service.write_failed_summary(session.user_id, session.session_id, transcript)
        return False

    vector = await compute_embedding(summary)
    if not vector or all(v == 0.0 for v in vector):
        logger.error("[v3 episodic] embedding unavailable; writing raw transcript to failed_summaries")
        await profile_service.write_failed_summary(session.user_id, session.session_id, transcript)
        return False

    payload = _build_payload(session, summary)
    point_id = str(uuid.uuid4())

    if not await _upsert_qdrant(point_id, vector, payload):
        logger.error("[v3 episodic] Qdrant write failed; writing raw transcript to failed_summaries")
        await profile_service.write_failed_summary(session.user_id, session.session_id, transcript)
        return False

    return await _mark_session_written(session.session_id)


# ── summary helpers ──────────────────────────────────────────────────────
async def _summarise_gemini(transcript: str) -> Optional[str]:
    model = get_gemini()
    if model is None:
        return None

    def _call() -> Optional[str]:
        try:
            resp = model.generate_content(
                SUMMARY_PROMPT + transcript,
                generation_config={"temperature": 0.4, "max_output_tokens": 256},
            )
            text = getattr(resp, "text", None)
            if text:
                return text.strip()
            return None
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 episodic] gemini summary failed: %s", exc)
            return None

    return await asyncio.to_thread(_call)


async def _summarise_groq(transcript: str) -> Optional[str]:
    client = get_groq()
    if client is None:
        return None
    e = env()
    try:
        resp = await guarded_call(
            "groq",
            lambda: client.chat.completions.create(
                model=e.groq_signal_model,
                messages=[
                    {"role": "system", "content": "You summarise mental-health conversations as a supportive friend."},
                    {"role": "user", "content": SUMMARY_PROMPT + transcript},
                ],
                temperature=0.4,
                max_tokens=256,
            ),
            timeout_s=5.0,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 episodic] groq summary fallback failed: %s", exc)
        return None


# ── Qdrant ───────────────────────────────────────────────────────────────
async def _upsert_qdrant(point_id: str, vector: List[float], payload: Dict[str, Any]) -> bool:
    client = get_qdrant()
    if client is None:
        return False
    try:
        from qdrant_client.http import models as qmodels

        await guarded_call(
            "qdrant",
            lambda: client.upsert(
                collection_name=env().qdrant_episodic_collection,
                points=[qmodels.PointStruct(id=point_id, vector=vector, payload=payload)],
            ),
            timeout_s=4.0,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 episodic] qdrant upsert failed: %s", exc)
        return False


# ── Supabase mark-written ────────────────────────────────────────────────
async def _mark_session_written(session_id: str) -> bool:
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            sb.table("sessions").update({"episodic_memory_written": True}).eq("id", session_id).execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 episodic] sessions update failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


# ── payload builders ─────────────────────────────────────────────────────
def _format_transcript(session: SessionObject) -> str:
    lines: List[str] = []
    for t in session.turns:
        role = "User" if t.get("role") == "user" else "Agent"
        lines.append(f"{role}: {t.get('content', '')}")
    return "\n".join(lines)


def _build_payload(session: SessionObject, summary: str) -> Dict[str, Any]:
    valences = [float(a.get("valence", 0.0)) for a in session.affect_history if "valence" in a]
    arousals = [float(a.get("arousal", 0.5)) for a in session.affect_history if "arousal" in a]
    affect_mean = {
        "valence": statistics.fmean(valences) if valences else 0.0,
        "arousal": statistics.fmean(arousals) if arousals else 0.5,
    }
    ending_affect = (
        {
            "valence": valences[-1] if valences else 0.0,
            "arousal": arousals[-1] if arousals else 0.5,
        }
    )
    modes = [m.get("mode") for m in session.mode_history] or [session.current_mode]

    return {
        "user_id": session.user_id,
        "session_id": session.session_id,
        "session_date": _now_iso(),
        "summary_text": summary,
        "affect_mean": affect_mean,
        "topic_keywords": _aggregate_keywords(session),
        "peak_urgency": session.session_peak_urgency,
        "ending_affect": ending_affect,
        "mode_sequence": modes,
        "named_entities": _aggregate_entities(session),
        "techniques_used": [],
    }


def _aggregate_keywords(session: SessionObject) -> List[str]:
    seen: List[str] = []
    for a in session.affect_history:
        for k in a.get("topic_keywords") or []:
            if k and k not in seen:
                seen.append(str(k))
    return seen[:8]


def _aggregate_entities(session: SessionObject) -> List[str]:
    out: List[str] = []
    rels = (session.semantic_profile.get("relationship_map") or [])
    for r in rels:
        nm = r.get("name")
        if nm and nm not in out:
            out.append(nm)
    return out[:5]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
