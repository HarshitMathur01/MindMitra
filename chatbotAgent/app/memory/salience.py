"""
Park-style salience scoring (four-term linear blend) for episodic retrieval.

    salience = w_recency   * recency
             + w_importance * importance
             + w_affect     * affective_resonance(current_mood, memory_mood)
             + w_relevance  * relevance(query, memory)

All terms are clamped to [0, 1]. Weights live in `_DEFAULT_WEIGHTS` and can be
overridden per call (we tune them per stage in the assembler).

References:
- Park et al. 2023, *Generative Agents* (recency · importance · relevance).
- Russell 1980 — circumplex of affect (V/A) for affective_resonance.
- Ebbinghaus 1885 — exponential decay shape.

Pure-function module; safe to import anywhere.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple


# ── Weights ────────────────────────────────────────────────────────────────

_DEFAULT_WEIGHTS = {
    "recency": 0.20,
    "importance": 0.25,
    "affect": 0.20,
    "relevance": 0.35,
}


@dataclass(frozen=True)
class SalienceWeights:
    recency: float = _DEFAULT_WEIGHTS["recency"]
    importance: float = _DEFAULT_WEIGHTS["importance"]
    affect: float = _DEFAULT_WEIGHTS["affect"]
    relevance: float = _DEFAULT_WEIGHTS["relevance"]

    def normalised(self) -> "SalienceWeights":
        s = max(1e-9, self.recency + self.importance + self.affect + self.relevance)
        return SalienceWeights(
            recency=self.recency / s,
            importance=self.importance / s,
            affect=self.affect / s,
            relevance=self.relevance / s,
        )


# ── Term computations ──────────────────────────────────────────────────────

def recency_score(created_at: Optional[str], *, half_life_days: float = 14.0,
                  now: Optional[datetime] = None) -> float:
    """Exponential decay → 1.0 if very recent; ~0.5 at the half-life; → 0 over time."""
    if not created_at:
        return 0.0
    try:
        ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    now = now or datetime.now(timezone.utc)
    elapsed_days = max(0.0, (now - ts).total_seconds() / 86400.0)
    return float(math.pow(0.5, elapsed_days / max(0.1, half_life_days)))


def importance_score(importance: Optional[float]) -> float:
    """Clamp the stored importance to [0, 1]."""
    if importance is None:
        return 0.5
    return max(0.0, min(1.0, float(importance)))


def affective_resonance(current_vad: Optional[Dict[str, float]],
                        memory_vad: Optional[Dict[str, float]]) -> float:
    """Cosine-style resonance between two VAD vectors (each on [-1, 1]).

    1.0 = identical mood, 0.0 = orthogonal, ~0 (clamped) when opposite.
    Returns 0.5 when either is missing — neutral, doesn't bias retrieval.
    """
    if not current_vad or not memory_vad:
        return 0.5
    a = (
        float(current_vad.get("v") or 0.0),
        float(current_vad.get("a") or 0.0),
        float(current_vad.get("d") or 0.0),
    )
    b = (
        float(memory_vad.get("v") or 0.0),
        float(memory_vad.get("a") or 0.0),
        float(memory_vad.get("d") or 0.0),
    )
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na < 1e-9 or nb < 1e-9:
        return 0.5
    cos = sum(x * y for x, y in zip(a, b)) / (na * nb)
    return max(0.0, (cos + 1.0) / 2.0)  # remap [-1,1] → [0,1]


def relevance_score(dense_score: Optional[float]) -> float:
    """Map a Qdrant cosine similarity into [0, 1]. We assume `dense_score` is
    already cosine in [-1, 1] (Qdrant's default). Clamp safely."""
    if dense_score is None:
        return 0.0
    s = float(dense_score)
    if s <= -1.0:
        return 0.0
    if s >= 1.0:
        return 1.0
    return (s + 1.0) / 2.0


# ── Public scorer ──────────────────────────────────────────────────────────

def salience(
    *,
    dense_score: Optional[float],
    importance: Optional[float],
    created_at: Optional[str],
    memory_vad: Optional[Dict[str, float]] = None,
    current_vad: Optional[Dict[str, float]] = None,
    weights: Optional[SalienceWeights] = None,
    half_life_days: float = 14.0,
    now: Optional[datetime] = None,
) -> Tuple[float, Dict[str, float]]:
    """Return the linear-blend salience score and the per-term breakdown."""
    w = (weights or SalienceWeights()).normalised()
    rec = recency_score(created_at, half_life_days=half_life_days, now=now)
    imp = importance_score(importance)
    aff = affective_resonance(current_vad, memory_vad)
    rel = relevance_score(dense_score)
    score = (
        w.recency * rec
        + w.importance * imp
        + w.affect * aff
        + w.relevance * rel
    )
    return score, {"recency": rec, "importance": imp, "affect": aff, "relevance": rel}
