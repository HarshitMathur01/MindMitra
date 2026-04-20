"""
LLM-backed candidate-memory extractor + reflection generator for the
Consolidation Worker.

We deliberately keep prompts tiny and JSON-mode strict so the worker can run
on cheap, fast models (gemini-2.5-flash by default) without blowing latency
or cost.

Public callables (signatures match `ConsolidationWorker.{extract_fn, reflect_fn}`):

    extract_candidates(supabase, llm_complete, importance_score_fn) -> ExtractFn
    reflect_over_episodes(supabase, llm_complete) -> ReflectFn
"""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from ..jobs.consolidation_worker import CandidateMemory
from ..memory.episodic import EpisodeRecord
from ..memory.importance import score_turn
from ..services.supabase_service import fetch_last_n_messages

logger = logging.getLogger(__name__)


# ── Extractor ──────────────────────────────────────────────────────────────

_EXTRACT_SYSTEM = (
    "You are a careful memory-extractor for a mental-wellness chatbot for "
    "Indian youth. From the conversation transcript below, extract at most 6 "
    "MEMORABLE moments worth remembering long-term. A memorable moment is a "
    "self-disclosure, a recurring theme, an emotional peak, a decision, a "
    "named person/place/event, or a specific commitment.\n\n"
    "Return STRICT JSON with shape: "
    '{"memories": [{"summary": str, "verbatim_quote": str|null, '
    '"affect_label": str|null, "themes": [str], '
    '"importance_hint": float (0..1)}]}\n\n'
    "Rules:\n"
    "- summary is one short sentence in third person ('User said exam stress is back').\n"
    "- importance_hint reflects how much it should anchor future turns.\n"
    "- Skip greetings, generic chit-chat, and bot replies.\n"
    "- If nothing is memorable, return {\"memories\": []}.\n"
    "- Do NOT invent details. If unsure, omit.\n"
)


def build_extractor(
    *,
    llm_complete: Callable[..., Awaitable[str]],
    model: str,
    max_messages: int = 30,
) -> Callable[[str, str], Awaitable[List[CandidateMemory]]]:
    """Returns an `ExtractFn` that pulls the last N messages of a session and
    asks the model for memorable moments."""

    async def _extract(user_id: str, session_id: str) -> List[CandidateMemory]:
        try:
            msgs = fetch_last_n_messages(session_id, user_id, n=max_messages)
        except Exception as exc:
            logger.warning("extractor: fetch_last_n_messages failed: %s", exc)
            return []
        if not msgs:
            return []

        transcript = "\n".join(
            f"{(m.get('role') or 'user').upper()}: {(m.get('content') or '').strip()}"
            for m in msgs if (m.get('content') or "").strip()
        )
        if not transcript:
            return []

        user_payload = (
            f"# Transcript (most recent first)\n"
            f"{transcript[:6000]}\n\n"
            "Return JSON now."
        )

        try:
            raw = await llm_complete(
                system=_EXTRACT_SYSTEM, user=user_payload,
                model=model, json_mode=True,
            )
        except Exception as exc:
            logger.warning("extractor: LLM call failed: %s", exc)
            return []

        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError:
            logger.warning("extractor: non-JSON output: %s", (raw or "")[:200])
            return []

        out: List[CandidateMemory] = []
        for m in (data.get("memories") or [])[:6]:
            summary = (m.get("summary") or "").strip()
            if not summary:
                continue
            quote = (m.get("verbatim_quote") or "").strip() or None
            themes = [t.strip().lower() for t in (m.get("themes") or []) if isinstance(t, str)][:6]
            importance_hint = float(m.get("importance_hint") or 0.5)
            heuristic = score_turn(summary).score
            importance_hint = max(importance_hint, heuristic)
            out.append(CandidateMemory(
                summary=summary,
                verbatim_quote=quote,
                affect_label=(m.get("affect_label") or None),
                themes=themes,
                importance_hint=importance_hint,
                source_session=session_id,
            ))
        return out

    return _extract


# ── Reflection ─────────────────────────────────────────────────────────────

_REFLECT_SYSTEM = (
    "You are a reflective journaler for a mental-wellness chatbot. From the "
    "list of recent memories below, identify at most 3 SECOND-ORDER insights "
    "— patterns, recurring themes, or trajectories the user has lived through "
    "but not necessarily named.\n\n"
    "Return STRICT JSON: "
    '{"insights": [{"insight_text": str, "themes": [str], '
    '"confidence": float (0..1)}]}\n\n'
    "Rules:\n"
    "- insight_text is one or two sentences in third person.\n"
    "- Be conservative — only surface things grounded in MULTIPLE memories.\n"
    "- Never claim a clinical diagnosis.\n"
    "- If no patterns emerge, return {\"insights\": []}.\n"
)


def build_reflector(
    *,
    llm_complete: Callable[..., Awaitable[str]],
    model: str,
) -> Callable[[str, List[EpisodeRecord]], Awaitable[List[Dict[str, Any]]]]:
    """Returns a `ReflectFn` that summarises top-K memories into insights."""

    async def _reflect(user_id: str, eps: List[EpisodeRecord]) -> List[Dict[str, Any]]:
        if not eps:
            return []
        bullets = []
        for ep in eps[:30]:
            ts = (ep.created_at or "")[:10]
            label = f" [{ep.affect_label}]" if ep.affect_label else ""
            bullets.append(f"- ({ts}){label} {ep.summary}")
        user_payload = (
            "# Recent memories\n"
            + "\n".join(bullets)
            + "\n\nReturn JSON now."
        )

        try:
            raw = await llm_complete(
                system=_REFLECT_SYSTEM, user=user_payload,
                model=model, json_mode=True,
            )
        except Exception as exc:
            logger.warning("reflector: LLM call failed: %s", exc)
            return []

        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError:
            return []

        out: List[Dict[str, Any]] = []
        for i in (data.get("insights") or [])[:3]:
            text = (i.get("insight_text") or "").strip()
            if not text:
                continue
            out.append({
                "user_id": user_id,
                "insight_text": text,
                "themes": [t.strip().lower() for t in (i.get("themes") or []) if isinstance(t, str)][:6],
                "confidence": float(i.get("confidence") or 0.6),
                "source_episode_ids": [ep.id for ep in eps if ep.id][:30],
            })
        return out

    return _reflect


# ── Persistence helper for the reflection insights ─────────────────────────

def persist_reflection_insights(
    *, supabase, insights: List[Dict[str, Any]],
) -> int:
    """Write reflection insights to `mitra_reflection_insights`. Returns count."""
    if not insights or supabase is None:
        return 0
    try:
        rows = [
            {
                "user_id": ins["user_id"],
                "insight_text": ins["insight_text"],
                "themes": ins.get("themes") or [],
                "confidence": float(ins.get("confidence") or 0.6),
                "source_episode_ids": ins.get("source_episode_ids") or [],
            }
            for ins in insights
        ]
        supabase.table("mitra_reflection_insights").insert(rows).execute()
        return len(rows)
    except Exception as exc:
        logger.warning("persist_reflection_insights failed: %s", exc)
        return 0
