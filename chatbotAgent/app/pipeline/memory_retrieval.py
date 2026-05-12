"""Layer 4 — Dual-channel memory retrieval.

Channel 1 (topic similarity): Qdrant vector search on the current embedding,
filtered to ``user_id``, returns up to 5 candidates with their scores.

Channel 2 (affect distance): for each candidate compute the L2 distance
between the current ``(valence, arousal)`` and the stored
``affect_mean.(valence, arousal)``, normalise to [0,1].

Combined: harmonic mean of the two channels — biases against memories that
match on topic but feel emotionally distant, and vice versa.

Thresholds (spec):
  * memory_gate_strength == "full"  → top 2 where score > 0.62
  * memory_gate_strength == "light" → top 1 where score > 0.75

Also returns ``semantic_facts_injection`` — a short natural-language
paragraph distilled from the cached semantic profile that's always safe to
inject (no Qdrant call required).
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..core.connections import get_qdrant, guarded_call
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..core.session import SessionObject
from ..models.signals import (
    EpisodicMemory,
    MemoryResult,
    OrchestratorOutput,
    RetrievalScores,
)

logger = get_logger(__name__)

SEMANTIC_FACTS_TOKEN_BUDGET = 80


async def retrieve_memory(
    *,
    user_id: str,
    embedding: List[float],
    orchestrator: OrchestratorOutput,
    session: SessionObject,
    trace_id: str | None = None,
) -> MemoryResult:
    if not orchestrator.memory_gate or not embedding:
        logger.info(
            "memory gate closed",
            extra=log_context(
                session_id=session.session_id,
                user_id=user_id,
                trace_id=trace_id,
                gate=orchestrator.memory_gate,
                reason="orchestrator_closed" if not orchestrator.memory_gate else "missing_embedding",
                semantic_facts="available" if _semantic_facts_injection(session, orchestrator.topic_keywords_for_retrieval) else "empty",
            ),
        )
        return MemoryResult(
            semantic_facts_injection=_semantic_facts_injection(session, orchestrator.topic_keywords_for_retrieval),
        )

    threshold, limit = (
        (0.62, 2) if orchestrator.memory_gate_strength == "full" else (0.75, 1)
    )
    logger.info(
        "memory gate open",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=trace_id,
            gate=orchestrator.memory_gate_strength,
            threshold=threshold,
            limit=limit,
            embedding="precomputed",
        ),
    )

    try:
        raw_hits = await _qdrant_search(user_id, embedding, limit_candidates=5, session_id=session.session_id, trace_id=trace_id)
    except TypeError as exc:
        if "unexpected keyword" not in str(exc):
            raise
        raw_hits = await _qdrant_search(user_id, embedding, limit_candidates=5)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "memory retrieval unavailable — degraded to semantic facts only",
            extra=log_context(
                session_id=session.session_id,
                user_id=user_id,
                trace_id=trace_id,
                exception_type=type(exc).__name__,
                consequence="block3_episodic_empty",
            ),
        )
        raw_hits = []
    if not raw_hits:
        logger.info(
            "no memories retrieved",
            extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=trace_id, candidates=0, reason="qdrant_empty_or_unavailable"),
        )
        return MemoryResult(
            semantic_facts_injection=_semantic_facts_injection(session, orchestrator.topic_keywords_for_retrieval),
        )

    valence_now = float(orchestrator.affect_for_retrieval.get("valence", 0.0))
    arousal_now = float(orchestrator.affect_for_retrieval.get("arousal", 0.5))

    scored: List[Tuple[float, EpisodicMemory, float, float]] = []
    for payload, topic_score in raw_hits:
        affect_mean = payload.get("affect_mean") or {}
        v = float(affect_mean.get("valence", 0.0))
        a = float(affect_mean.get("arousal", 0.5))
        dist = math.sqrt((valence_now - v) ** 2 + (arousal_now - a) ** 2)
        affect_sim = max(0.0, 1.0 - min(dist / 2.0, 1.0))
        harmonic = _harmonic(topic_score, affect_sim)

        if harmonic < threshold:
            continue
        scored.append((
            harmonic,
            EpisodicMemory(
                summary_text=str(payload.get("summary_text", "")).strip(),
                relative_date=_relative_date(payload.get("session_date")),
                ending_affect={
                    "valence": float((payload.get("ending_affect") or {}).get("valence", v)),
                    "arousal": float((payload.get("ending_affect") or {}).get("arousal", a)),
                },
                named_entities=list(payload.get("named_entities") or []),
                techniques_used=list(payload.get("techniques_used") or []),
                harmonic_score=round(harmonic, 4),
            ),
            topic_score,
            affect_sim,
        ))

    scored.sort(key=lambda t: t[0], reverse=True)
    selected = scored[:limit]

    top_score = round(selected[0][0], 4) if selected else 0.0
    top_affect_sim = round(selected[0][3], 4) if selected else 0.0
    top_topic = round(selected[0][2], 4) if selected else round(max((hit[1] for hit in raw_hits), default=0.0), 4)
    logger.info(
        "retrieval scored candidates",
        extra=log_context(
            session_id=session.session_id,
            user_id=user_id,
            trace_id=trace_id,
            candidates=len(raw_hits),
            top_topic_score=top_topic,
            top_harmonic_score=top_score,
            passed_threshold=len(selected),
            threshold=threshold,
        ),
    )
    if not selected:
        logger.info(
            "no memories retrieved",
            extra=log_context(session_id=session.session_id, user_id=user_id, trace_id=trace_id, candidates=len(raw_hits), reason="below_threshold"),
        )
    for harmonic, memory, _, _ in selected:
        logger.info(
            "retrieved memory",
            extra=log_context(
                session_id=session.session_id,
                user_id=user_id,
                trace_id=trace_id,
                harmonic_score=round(harmonic, 4),
                relative_date=memory.relative_date,
                summary_len=len(memory.summary_text),
            ),
        )

    return MemoryResult(
        episodic_memories=[s[1] for s in selected],
        semantic_facts_injection=_semantic_facts_injection(session, orchestrator.topic_keywords_for_retrieval),
        retrieval_scores=RetrievalScores(
            episodic_count=len(selected),
            top_score=top_score,
            affect_similarity=top_affect_sim,
        ),
        memory_retrieved=bool(selected),
    )


# ── Qdrant search ────────────────────────────────────────────────────────
async def _qdrant_search(
    user_id: str, embedding: List[float], limit_candidates: int = 5, session_id: str | None = None, trace_id: str | None = None
) -> List[Tuple[Dict[str, Any], float]]:
    client = get_qdrant()
    if client is None:
        logger.warning(
            "memory retrieval unavailable — context window running without episodic memory",
            extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, consequence="block3_episodic_empty"),
        )
        return []
    try:
        from qdrant_client.http import models as qmodels

        logger.info(
            "→ Qdrant",
            extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, filter="user_id", gate="open", limit=limit_candidates),
        )
        results = await guarded_call(
            "qdrant",
            lambda: client.search(
                collection_name=env().qdrant_episodic_collection,
                query_vector=embedding,
                query_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="user_id", match=qmodels.MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=limit_candidates,
                with_payload=True,
            ),
            timeout_s=4.0,
        )
        return [(r.payload or {}, float(r.score or 0.0)) for r in results]
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "memory retrieval unavailable — context window running without episodic memory",
            extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, exception_type=type(exc).__name__, error=str(exc), consequence="block3_episodic_empty"),
        )
        return []


# ── helpers ──────────────────────────────────────────────────────────────
def _harmonic(topic: float, affect: float) -> float:
    return 2 * (topic * affect) / (topic + affect + 0.001)


def _relative_date(stored: Any) -> str:
    if not stored:
        return "recently"
    try:
        when = datetime.fromisoformat(str(stored).replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - when
        days = delta.days
        if days <= 0:
            return "earlier today"
        if days == 1:
            return "yesterday"
        if days < 7:
            return f"{days} days ago"
        if days < 14:
            return "last week"
        if days < 30:
            return "a few weeks ago"
        if days < 90:
            return "a couple of months ago"
        return "a while ago"
    except Exception:  # noqa: BLE001
        return "recently"


def _semantic_facts_injection(session: SessionObject, topic_keywords: List[str]) -> str:
    """A short natural-language fact block. Always safe to inject."""
    semantic = session.semantic_profile or {}
    if not semantic:
        return ""

    parts: List[str] = []
    name = semantic.get("display_name")
    if name:
        parts.append(f"Their name is {name}.")
    occ = semantic.get("occupation_detail")
    if occ:
        parts.append(f"They are {occ}.")

    # Pull recurring themes that overlap with the current topic keywords
    themes: Dict[str, float] = semantic.get("recurring_themes") or {}
    keyword_set = {k.lower() for k in (topic_keywords or [])}
    overlap_themes = [t for t, s in themes.items() if t.lower() in keyword_set or any(k in t.lower() for k in keyword_set)]
    if overlap_themes:
        parts.append("Recurring topics for them: " + ", ".join(overlap_themes[:3]) + ".")

    # Relationship map: include only matches against named entities in keywords
    rels = semantic.get("relationship_map") or []
    matched_rels = []
    for r in rels:
        nm = (r.get("name") or "").lower()
        if not nm:
            continue
        if any(k in nm or nm in k for k in keyword_set):
            matched_rels.append(f"{r.get('name')} ({r.get('relation') or 'someone they mentioned'})")
    if matched_rels:
        parts.append("They've spoken about: " + "; ".join(matched_rels[:2]) + ".")

    text = " ".join(parts).strip()
    # crude token budget: 80 tokens ≈ 320 chars
    if len(text) > SEMANTIC_FACTS_TOKEN_BUDGET * 4:
        text = text[: SEMANTIC_FACTS_TOKEN_BUDGET * 4].rsplit(".", 1)[0] + "."
    return text
