from __future__ import annotations

import logging
import re
from dataclasses import replace
from typing import Any, Callable, List, Optional, Tuple

from .memory_pipeline_types import MemoryCandidate, QualityGateResult

logger = logging.getLogger(__name__)

_TAG_RE = re.compile(r"<[^>]+>", re.IGNORECASE)

_INJECTION_FRAGMENTS = (
    "ignore previous",
    "ignore all",
    "system:",
    "assistant:",
    "human:",
    "system",
    "disregard",
    "forget everything",
)

# "SYSTEM" as keyword - match word boundary
_INJECTION_RE = re.compile(
    r"\b(system|disregard|forget everything|ignore previous|ignore all)\b",
    re.IGNORECASE,
)

_NEGATION_HINTS = (
    "quit",
    "lost my job",
    "lost job",
    "no longer",
    "don't work",
    "dont work",
    "stopped working",
    "fired",
    "laid off",
    "resigned",
    "not anymore",
    "don't have that job",
)

_EMPLOYMENT_HINTS = ("work", "works", "job", "employed", "engineer", "teacher", "at ", "startup", "company")


def _sanitize_text(s: str) -> str:
    return _TAG_RE.sub("", s or "").strip()


def _has_injection(text: str) -> bool:
    lower = (text or "").lower()
    if _INJECTION_RE.search(lower):
        return True
    if "system:" in lower or "assistant:" in lower or "human:" in lower:
        return True
    for frag in _INJECTION_FRAGMENTS:
        if frag in lower:
            return True
    return False


def _possible_contradiction(new_text: str, existing_text: str) -> bool:
    nl = (new_text or "").lower()
    el = (existing_text or "").lower()
    if not nl or not el:
        return False
    if not any(n in nl for n in _NEGATION_HINTS):
        return False
    if not any(e in el for e in _EMPLOYMENT_HINTS):
        return False
    if any(e in nl for e in _EMPLOYMENT_HINTS):
        return True
    return False


class QualityGate:
    """
    Filters MemoryCandidate objects. Requires vector similarity callbacks
    from the host (MemoryStore) for deduplication / contradiction context.
    """

    def __init__(
        self,
        *,
        embed_document: Callable[[str], List[float]],
        search_similar: Callable[[List[float], str, int], List[Any]],
    ) -> None:
        self._embed_document = embed_document
        self._search_similar = search_similar

    def filter(
        self,
        candidates: List[MemoryCandidate],
        user_id: str,
        existing_memories: List[dict],
    ) -> QualityGateResult:
        approved: List[MemoryCandidate] = []
        reinforce: List[Tuple[MemoryCandidate, str]] = []
        rejected: List[Tuple[MemoryCandidate, str]] = []
        contradictions: List[Tuple[MemoryCandidate, str]] = []

        for cand in candidates:
            conf = float(cand.confidence)
            if cand.is_sensitive and cand.emotional_intensity > 0.8:
                conf = max(conf, 1.0)

            if conf < 0.5:
                reason = "human_review_candidate" if conf < 0.4 else "low_confidence"
                rejected.append((cand, reason))
                continue

            anchor = (cand.verbatim_anchor or "").strip()
            if not anchor:
                rejected.append((cand, "no_anchor"))
                continue

            blob = f"{cand.content}\n{anchor}"
            if _has_injection(blob):
                logger.warning(
                    "[QUALITY_GATE] injection_detected user_id=%s content_prefix=%r",
                    user_id,
                    (cand.content or "")[:120],
                )
                rejected.append((cand, "injection_detected"))
                continue

            sanitized_content = _sanitize_text(cand.content)
            if not sanitized_content.strip():
                rejected.append((cand, "no_anchor"))
                continue

            cand_use = replace(cand, content=sanitized_content)

            try:
                vec = self._embed_document(sanitized_content)
            except Exception as exc:
                logger.warning("[QUALITY_GATE] embed failed: %s", exc)
                rejected.append((cand, "low_confidence"))
                continue

            hits = self._search_similar(vec, user_id, 5)
            top = hits[0] if hits else None
            top_score = float(getattr(top, "score", 0.0) or 0.0) if top is not None else 0.0
            top_id = str(getattr(top, "id", "") or "") if top is not None else ""
            top_payload = getattr(top, "payload", None) or {}
            if isinstance(top_payload, dict):
                existing_body = str(top_payload.get("data", "") or "")
            else:
                existing_body = ""

            if top_score > 0.92 and top_id:
                reinforce.append((cand_use, top_id))
                continue

            if 0.75 < top_score <= 0.92:
                contradictions.append((cand_use, "possible_duplicate"))
                continue

            flagged = False
            for h in hits[:3]:
                hid = str(getattr(h, "id", "") or "")
                pl = getattr(h, "payload", None) or {}
                ex_text = str(pl.get("data", "")) if isinstance(pl, dict) else ""
                if _possible_contradiction(sanitized_content, ex_text):
                    contradictions.append(
                        (cand_use, f"contradicts:{hid}:{(ex_text or '')[:120]}"),
                    )
                    flagged = True
                    break
            if flagged:
                approved.append(cand_use)
                continue

            approved.append(cand_use)

        return QualityGateResult(
            approved=approved,
            rejected=rejected,
            contradictions=contradictions,
            reinforce=reinforce,
        )
