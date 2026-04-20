"""
Reflective Consolidation Worker.

Runs offline, post-session and nightly. Implements the five stages of §5:

    A. Candidate extraction — pull turns flagged by the importance gate.
    B. Deduplication        — collapse near-duplicates against existing episodics.
    C. Importance re-scoring (LLM-optional; defaults to heuristic).
    D. Ebbinghaus decay     — sweep existing episodics, reduce strength,
                              archive those below threshold.
    E. Higher-order reflection — once per user per night: synthesise patterns
       across the last N episodes (theme co-occurrence, affect drift, etc.).

The worker is **dependency-injected**: pass it your IdentityCard / Episodic /
Affective / RelationalGraph services + an LLM extractor function. The
`run_once_for_user` entry point is testable offline with all stubs.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence

from ..memory.decay import apply_decay, ARCHIVE_THRESHOLD
from ..memory.episodic import EpisodeRecord, EpisodicService
from ..memory.repositories import EpisodicRepo

logger = logging.getLogger(__name__)


@dataclass
class CandidateMemory:
    """Raw, pre-write episodic candidate produced by extraction (Stage A)."""

    summary: str
    verbatim_quote: Optional[str] = None
    affect_label: Optional[str] = None
    affect_vad: Optional[Dict[str, float]] = None
    themes: List[str] = field(default_factory=list)
    importance_hint: float = 0.5
    source_session: Optional[str] = None
    source_turn_ids: List[str] = field(default_factory=list)


@dataclass
class ConsolidationReport:
    user_id: str
    n_candidates: int = 0
    n_dedup_skipped: int = 0
    n_written: int = 0
    n_decayed: int = 0
    n_archived: int = 0
    n_reflections: int = 0
    durations_ms: Dict[str, float] = field(default_factory=dict)


# Type aliases for injected callables.
ExtractFn = Callable[[str, str], Awaitable[List[CandidateMemory]]]   # (user_id, session_id) -> candidates
ReflectFn = Callable[[str, List[EpisodeRecord]], Awaitable[List[Dict[str, Any]]]]
SimilarityFn = Callable[[str, str], float]                            # (a, b) -> 0..1


class ConsolidationWorker:
    def __init__(
        self,
        *,
        episodic: EpisodicService,
        episodic_repo: EpisodicRepo,
        extract_fn: Optional[ExtractFn] = None,
        reflect_fn: Optional[ReflectFn] = None,
        similarity_fn: Optional[SimilarityFn] = None,
        importance_threshold: float = 0.55,
    ):
        self.episodic = episodic
        self.episodic_repo = episodic_repo
        self.extract_fn = extract_fn or _default_no_op_extract
        self.reflect_fn = reflect_fn or _default_no_op_reflect
        self.similarity_fn = similarity_fn or _default_jaccard_similarity
        self.importance_threshold = importance_threshold

    # ── Public entry point ──────────────────────────────────────────────────

    async def run_once_for_user(
        self,
        user_id: str,
        *,
        session_id: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> ConsolidationReport:
        report = ConsolidationReport(user_id=user_id)
        now = now or datetime.now(timezone.utc)

        # Stage A: extract candidates.
        candidates = await self.extract_fn(user_id, session_id or "")
        report.n_candidates = len(candidates)

        # Stage B + C: dedup against existing → write survivors.
        existing = self.episodic_repo.by_user(user_id, limit=200)
        existing_summaries = [r.get("summary") or "" for r in existing]

        for cand in candidates:
            if cand.importance_hint < self.importance_threshold:
                continue
            if any(self.similarity_fn(cand.summary, e) >= 0.8 for e in existing_summaries):
                report.n_dedup_skipped += 1
                continue
            await self.episodic.write(
                user_id=user_id,
                summary=cand.summary,
                verbatim_quote=cand.verbatim_quote,
                affect_vad=cand.affect_vad,
                affect_label=cand.affect_label,
                themes=cand.themes,
                importance=cand.importance_hint,
                source_session=cand.source_session,
                source_turn_ids=cand.source_turn_ids,
            )
            report.n_written += 1

        # Stage D: Ebbinghaus decay sweep on existing memories.
        for row in existing:
            new_s = apply_decay(
                current_strength=float(row.get("strength") or 1.0),
                importance=float(row.get("importance") or 0.5),
                last_recalled_at=row.get("last_recalled_at"),
                created_at=row.get("created_at"),
                now=now,
            )
            old_s = float(row.get("strength") or 1.0)
            if abs(new_s - old_s) < 1e-3 and not (new_s <= ARCHIVE_THRESHOLD and not row.get("archived_at")):
                continue
            update = {"strength": new_s}
            if new_s <= ARCHIVE_THRESHOLD and not row.get("archived_at"):
                update["archived_at"] = now.isoformat()
                report.n_archived += 1
            self.episodic_repo.t.update(update).eq("id", row["id"]).execute()
            report.n_decayed += 1

        # Stage E: higher-order reflection.
        try:
            top_memories = [_row_to_episode(r) for r in self.episodic_repo.by_user(user_id, limit=30)]
            insights = await self.reflect_fn(user_id, top_memories)
            report.n_reflections = len(insights)
            if insights and getattr(self, "persist_insights_fn", None):
                try:
                    self.persist_insights_fn(insights)  # type: ignore[misc]
                except Exception as p_exc:  # noqa: BLE001
                    logger.warning("persist insights failed for %s: %s", user_id, p_exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("reflection stage failed for %s: %s", user_id, exc)

        return report

    def with_persistence(self, fn: Callable[[List[Dict[str, Any]]], None]) -> "ConsolidationWorker":
        """Attach an optional sink that writes reflection insights to storage."""
        self.persist_insights_fn = fn
        return self


# ── Default stubs ───────────────────────────────────────────────────────────

async def _default_no_op_extract(user_id: str, session_id: str) -> List[CandidateMemory]:
    return []


async def _default_no_op_reflect(user_id: str, eps: List[EpisodeRecord]) -> List[Dict[str, Any]]:
    return []


def _default_jaccard_similarity(a: str, b: str) -> float:
    """Cheap token-bag Jaccard. Sufficient for dedup of short summaries."""
    sa = {t.lower() for t in (a or "").split() if len(t) > 2}
    sb = {t.lower() for t in (b or "").split() if len(t) > 2}
    if not sa or not sb:
        return 0.0
    inter = sa & sb
    union = sa | sb
    return len(inter) / max(1, len(union))


def _row_to_episode(row: Dict[str, Any]) -> EpisodeRecord:
    """Local helper to avoid importing the private module function."""
    from ..memory.episodic import _row_to_episode as _f
    return _f(row)
