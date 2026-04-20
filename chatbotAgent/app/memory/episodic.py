"""
Episodic memory service.

Vectors live in Qdrant (`mitra_episodic_v2`); structured metadata + verbatim
quote + provenance live in Postgres (`mitra_episodic_memories`).

Public API:
    write(user_id, text, summary, ...) -> EpisodeRecord
    retrieve(user_id, query, top_k=8) -> List[EpisodeRecord]
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .decay import reinforce_on_recall
from .qdrant_v2 import QdrantLike, COLLECTION_EPISODIC, new_qdrant_id, HitV2
from .repositories import EpisodicRepo, SupabaseLike
from .salience import SalienceWeights, salience as compute_salience

logger = logging.getLogger(__name__)


@dataclass
class EpisodeRecord:
    id: Optional[str]
    user_id: str
    qdrant_id: str
    summary: str
    verbatim_quote: Optional[str] = None
    affect_vad: Optional[Dict[str, float]] = None
    affect_label: Optional[str] = None
    themes: List[str] = field(default_factory=list)
    importance: float = 0.5
    strength: float = 1.0
    score: Optional[float] = None  # set on retrieval
    salience_breakdown: Optional[Dict[str, float]] = None  # per-term diagnostics
    created_at: Optional[str] = None

    def render_for_prompt(self) -> str:
        head = self.summary or (self.verbatim_quote or "")[:200]
        ts = (self.created_at or "")[:10]
        affect = f" [{self.affect_label}]" if self.affect_label else ""
        return f"- ({ts}){affect} {head}"


class EpisodicService:
    def __init__(
        self,
        *,
        sb: SupabaseLike,
        qdrant: QdrantLike,
        embed_fn,
    ):
        """`embed_fn` is an async callable: `async (List[str]) -> List[List[float]]`."""
        self.repo = EpisodicRepo(sb)
        self.qdrant = qdrant
        self.embed_fn = embed_fn

    async def write(
        self,
        *,
        user_id: str,
        summary: str,
        verbatim_quote: Optional[str] = None,
        affect_vad: Optional[Dict[str, float]] = None,
        affect_label: Optional[str] = None,
        themes: Optional[List[str]] = None,
        importance: float = 0.5,
        source_session: Optional[str] = None,
        source_turn_ids: Optional[List[str]] = None,
        incognito: bool = False,
    ) -> Optional[EpisodeRecord]:
        """Persist an episodic memory.

        Returns None when `incognito=True` (Memory Mirror "pause writes"
        active) — the caller should treat that as a successful no-op so the
        turn still completes normally.
        """
        if incognito:
            logger.info("episodic write skipped: incognito mode active for user=%s", user_id)
            return None
        # We embed the summary (more semantic) and store verbatim separately.
        vecs = await self.embed_fn([summary])
        if not vecs or not vecs[0]:
            raise RuntimeError("embedding failed; refusing to write episodic memory")
        qid = new_qdrant_id()
        payload = {
            "user_id": user_id,
            "summary": summary,
            "affect_label": affect_label,
            "themes": list(themes or []),
            "importance": float(importance),
        }
        self.qdrant.upsert_point(COLLECTION_EPISODIC, point_id=qid, vector=vecs[0], payload=payload)

        row = {
            "user_id": user_id,
            "qdrant_id": qid,
            "summary": summary,
            "verbatim_quote": verbatim_quote,
            "affect_vad": affect_vad,
            "affect_label": affect_label,
            "themes": list(themes or []),
            "importance": float(importance),
            "strength": 1.0,
            "source_session": source_session,
            "source_turn_ids": list(source_turn_ids or []),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        saved = self.repo.insert(row)
        return _row_to_episode(saved)

    async def retrieve(
        self,
        *,
        user_id: str,
        query: str,
        top_k: int = 8,
        overfetch: int = 32,
        current_vad: Optional[Dict[str, float]] = None,
        weights: Optional[SalienceWeights] = None,
        half_life_days: float = 14.0,
    ) -> List[EpisodeRecord]:
        """Hybrid retrieval scored with the four-term Park-style salience blend
        (recency × importance × affective_resonance × relevance).

        Args:
            current_vad: optional VAD vector of the user's *current* affective
                state. Enables affective_resonance term; without it that term
                is neutralised to 0.5.
            weights: per-stage weight overrides; defaults to SalienceWeights().
        """
        if not query.strip():
            return []
        vecs = await self.embed_fn([query])
        if not vecs:
            return []
        hits: List[HitV2] = self.qdrant.search(
            COLLECTION_EPISODIC, vector=vecs[0], user_id=user_id, top_k=overfetch,
        )
        if not hits:
            return []

        meta_rows = self.repo.by_qdrant_ids(user_id, [h.id for h in hits])
        by_qid: Dict[str, Dict[str, Any]] = {r["qdrant_id"]: r for r in meta_rows}

        episodes: List[EpisodeRecord] = []
        for h in hits:
            meta = by_qid.get(h.id) or {}
            if meta and meta.get("archived_at"):
                continue  # decayed-out memories shouldn't surface
            ep = _row_to_episode(meta) if meta else EpisodeRecord(
                id=None, user_id=user_id, qdrant_id=h.id,
                summary=str(h.payload.get("summary") or ""),
                affect_label=h.payload.get("affect_label"),
                themes=list(h.payload.get("themes") or []),
                importance=float(h.payload.get("importance") or 0.5),
            )
            sal, breakdown = compute_salience(
                dense_score=h.score,
                importance=ep.importance,
                created_at=ep.created_at,
                memory_vad=ep.affect_vad,
                current_vad=current_vad,
                weights=weights,
                half_life_days=half_life_days,
            )
            ep.score = sal * (0.5 + 0.5 * ep.strength)  # archived/weak memories sink
            ep.salience_breakdown = breakdown
            episodes.append(ep)

        episodes.sort(key=lambda e: e.score or 0.0, reverse=True)
        return episodes[:top_k]

    def mark_recalled(self, episode_ids: List[str]) -> None:
        """Reinforce strength + bump `last_recalled_at` for the given memory ids.
        Best-effort; never raises (memory recall is hot-path)."""
        if not episode_ids:
            return
        from datetime import datetime as _dt, timezone as _tz
        now_iso = _dt.now(_tz.utc).isoformat()
        for ep_id in episode_ids:
            try:
                rows = self.repo.t.select("*").eq("id", ep_id).limit(1).execute().data or []
                if not rows:
                    continue
                row = rows[0]
                new_strength = reinforce_on_recall(float(row.get("strength") or 1.0))
                self.repo.t.update({
                    "strength": new_strength,
                    "last_recalled_at": now_iso,
                    "recall_count": int(row.get("recall_count") or 0) + 1,
                }).eq("id", ep_id).execute()
            except Exception as exc:  # noqa: BLE001
                logger.debug("mark_recalled(%s) failed: %s", ep_id, exc)


def _row_to_episode(row: Dict[str, Any]) -> EpisodeRecord:
    return EpisodeRecord(
        id=str(row.get("id")) if row.get("id") else None,
        user_id=row["user_id"],
        qdrant_id=row["qdrant_id"],
        summary=row.get("summary") or "",
        verbatim_quote=row.get("verbatim_quote"),
        affect_vad=row.get("affect_vad"),
        affect_label=row.get("affect_label"),
        themes=list(row.get("themes") or []),
        importance=float(row.get("importance") or 0.5),
        strength=float(row.get("strength") or 1.0),
        created_at=row.get("created_at"),
    )
