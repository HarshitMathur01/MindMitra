"""
Procedural ledger — intervention × outcome tracking.

When the bot suggests an intervention (e.g. "4-7-8 breath", "2-min walk",
"5-3-1 grounding"), we log the suggestion and the user's affect before/after.
Over time we learn what works for THIS user vs. what doesn't.

Used by the assembler in Familiar+ stages to bias suggestions toward
proven-helpful interventions.
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .repositories import ProceduralRepo, SupabaseLike

logger = logging.getLogger(__name__)


# Approved intervention vocabulary — keeps logs clean and groupable.
KNOWN_INTERVENTIONS = {
    "478_breath", "box_breath", "diaphragmatic_breath",
    "5_4_3_2_1_grounding", "5_3_1_grounding",
    "body_scan", "progressive_muscle_relaxation",
    "self_compassion_break", "values_reflection",
    "behavioural_activation_micro", "social_reach_out",
    "journaling_prompt", "cold_water_face", "short_walk",
    "thought_record", "opposite_action",
}


@dataclass
class InterventionOutcome:
    intervention: str
    n: int
    avg_valence_delta: Optional[float]
    avg_arousal_delta: Optional[float]
    last_outcome_label: Optional[str]
    helpful: Optional[bool]


class ProceduralLedgerService:
    def __init__(self, client: SupabaseLike):
        self.repo = ProceduralRepo(client)

    def log(
        self, *, user_id: str, intervention: str,
        pre_affect_vad: Optional[Dict[str, float]] = None,
        post_affect_vad: Optional[Dict[str, float]] = None,
        outcome_label: Optional[str] = None, user_feedback: Optional[str] = None,
    ) -> None:
        if intervention not in KNOWN_INTERVENTIONS:
            logger.warning("procedural: unknown intervention %s — logging anyway", intervention)
        self.repo.insert({
            "user_id": user_id,
            "intervention": intervention,
            "used_at": datetime.now(timezone.utc).isoformat(),
            "pre_affect_vad": pre_affect_vad,
            "post_affect_vad": post_affect_vad,
            "outcome_label": outcome_label,
            "user_feedback": user_feedback,
        })

    def summary(self, user_id: str, intervention: str) -> InterventionOutcome:
        rows = self.repo.by_intervention(user_id, intervention)
        if not rows:
            return InterventionOutcome(intervention, 0, None, None, None, None)
        deltas_v: List[float] = []
        deltas_a: List[float] = []
        for r in rows:
            pre = r.get("pre_affect_vad") or {}
            post = r.get("post_affect_vad") or {}
            if "v" in pre and "v" in post:
                deltas_v.append(float(post["v"]) - float(pre["v"]))
            if "a" in pre and "a" in post:
                deltas_a.append(float(post["a"]) - float(pre["a"]))
        helpful: Optional[bool] = None
        if deltas_v:
            helpful = statistics.mean(deltas_v) > 0.05
        return InterventionOutcome(
            intervention=intervention,
            n=len(rows),
            avg_valence_delta=statistics.mean(deltas_v) if deltas_v else None,
            avg_arousal_delta=statistics.mean(deltas_a) if deltas_a else None,
            last_outcome_label=rows[0].get("outcome_label"),
            helpful=helpful,
        )

    def best_for(self, user_id: str, *, candidates: Optional[List[str]] = None) -> Optional[str]:
        """Return the intervention with the highest avg valence delta."""
        cands = candidates or list(KNOWN_INTERVENTIONS)
        scored: List[tuple] = []
        for c in cands:
            s = self.summary(user_id, c)
            if s.n >= 1 and s.avg_valence_delta is not None:
                scored.append((s.avg_valence_delta, c, s.n))
        if not scored:
            return None
        scored.sort(key=lambda x: (x[0], x[2]), reverse=True)
        return scored[0][1]
