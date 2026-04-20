"""
RelationshipState advancer — implements the Stage progression in §6.

Stage transitions (advance-only; manual ops command for downgrades):
    stranger      → acquaintance : ≥3 sessions OR ≥30 cumulative minutes
    acquaintance  → familiar     : ≥2 weeks elapsed AND topic_breadth ≥ 5
                                   AND no unresolved-rupture flag
    familiar      → trusted      : ≥6 weeks AND ≥1 successful repair
                                   AND ≥1 depth indicator
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from threading import RLock
from typing import Any, Dict, Optional

from ..core.prompts.stance import Stage
from .repositories import RelationshipStateRepo, SupabaseLike

logger = logging.getLogger(__name__)


@dataclass
class RelationshipState:
    user_id: str
    stage: Stage
    session_count: int = 0
    total_minutes: int = 0
    topic_breadth: int = 0
    successful_repairs: int = 0
    user_initiated_disclosures: int = 0   # how often THEY opened up first
    unresolved_ruptures: int = 0          # blocks promotion until repaired
    last_promoted_at: Optional[str] = None
    last_disclosure_at: Optional[str] = None


class RelationshipStateService:
    """
    Hybrid counter pattern (ported from legacy `get_hybrid_message_count`):
      - DB count is the source of truth across sessions/processes;
      - in-memory delta wins for the current session, so a promotion mid-session
        is reflected on the very next turn.
    """

    def __init__(self, client: SupabaseLike):
        self.repo = RelationshipStateRepo(client)
        self._lock = RLock()
        self._memory: Dict[str, RelationshipState] = {}

    # ── Read ───────────────────────────────────────────────────────────────

    def get(self, user_id: str) -> RelationshipState:
        with self._lock:
            cached = self._memory.get(user_id)
            if cached:
                return cached
            row = self.repo.get(user_id)
            st = _row_to_state(row) if row else RelationshipState(user_id=user_id, stage=Stage.STRANGER)
            self._memory[user_id] = st
            return st

    def current_stage(self, user_id: str) -> Stage:
        return self.get(user_id).stage

    # ── Write helpers ──────────────────────────────────────────────────────

    def record_session_end(self, user_id: str, *, duration_minutes: int,
                           new_topics: int = 0,
                           successful_repair: bool = False,
                           user_initiated_disclosure: bool = False,
                           rupture_detected: bool = False) -> RelationshipState:
        """Update state at end of a session. The Stage Engine will only promote
        when ALL gates are satisfied (sessions AND engagement AND user-initiated
        disclosure AND no unresolved ruptures)."""
        st = self.get(user_id)
        st.session_count += 1
        st.total_minutes += int(max(0, duration_minutes))
        st.topic_breadth += int(max(0, new_topics))
        if successful_repair:
            st.successful_repairs += 1
            st.unresolved_ruptures = max(0, st.unresolved_ruptures - 1)
        if user_initiated_disclosure:
            st.user_initiated_disclosures += 1
            st.last_disclosure_at = datetime.now(timezone.utc).isoformat()
        if rupture_detected:
            st.unresolved_ruptures += 1
        promoted = self._maybe_promote(st)
        self._persist(st)
        if promoted:
            logger.info("relationship_state: %s promoted → %s", user_id, st.stage.value)
        return st

    def record_turn(self, user_id: str, *,
                    user_initiated_disclosure: bool = False,
                    rupture_detected: bool = False) -> RelationshipState:
        """Lightweight per-turn update (no promotion check; saves write traffic).
        Promotion is only evaluated on `record_session_end`."""
        st = self.get(user_id)
        if user_initiated_disclosure:
            st.user_initiated_disclosures += 1
            st.last_disclosure_at = datetime.now(timezone.utc).isoformat()
        if rupture_detected:
            st.unresolved_ruptures += 1
        return st

    def force_set_stage(self, user_id: str, stage: Stage) -> RelationshipState:
        """Manual override (ops only)."""
        st = self.get(user_id)
        st.stage = stage
        self._persist(st)
        return st

    # ── Internal ───────────────────────────────────────────────────────────

    def _maybe_promote(self, st: RelationshipState) -> bool:
        """Returns True if stage advanced. Advance-only; never regresses.

        Each gate is **AND**-composed (sessions ∧ engagement ∧ user-initiated
        disclosure ∧ no-unresolved-rupture). This is the structural safeguard
        against the 'parasocial bait & switch' anti-pattern where the bot
        accelerates intimacy on its own clock.
        """
        target = st.stage

        # Stranger → Acquaintance: at least a few real sessions of meaningful
        # length AND the user has volunteered something about themselves.
        if (st.stage == Stage.STRANGER
                and st.session_count >= 3
                and st.total_minutes >= 30
                and st.user_initiated_disclosures >= 1
                and st.unresolved_ruptures == 0):
            target = Stage.ACQUAINTANCE

        # Acquaintance → Familiar: meaningful elapsed time, multi-topic depth,
        # multiple user-initiated disclosures, no unresolved ruptures.
        elif (st.stage == Stage.ACQUAINTANCE
              and self._weeks_since_promotion(st) >= 2
              and st.topic_breadth >= 5
              and st.user_initiated_disclosures >= 3
              and st.unresolved_ruptures == 0):
            target = Stage.FAMILIAR

        # Familiar → Trusted: longer span, repair history, depth indicator.
        elif (st.stage == Stage.FAMILIAR
              and self._weeks_since_promotion(st) >= 6
              and st.successful_repairs >= 1
              and st.topic_breadth >= 8
              and st.user_initiated_disclosures >= 6
              and st.unresolved_ruptures == 0):
            target = Stage.TRUSTED

        if target != st.stage:
            st.stage = target
            st.last_promoted_at = datetime.now(timezone.utc).isoformat()
            return True
        return False

    def _weeks_since_promotion(self, st: RelationshipState) -> float:
        if not st.last_promoted_at:
            return 999.0  # treat "never promoted" as "long ago" → eligible
        try:
            ts = datetime.fromisoformat(st.last_promoted_at.replace("Z", "+00:00"))
        except ValueError:
            return 0.0
        delta = datetime.now(timezone.utc) - ts
        return delta.total_seconds() / (7 * 24 * 3600)

    def _persist(self, st: RelationshipState) -> None:
        self.repo.upsert({
            "user_id": st.user_id,
            "stage": st.stage.value,
            "session_count": st.session_count,
            "total_minutes": st.total_minutes,
            "topic_breadth": st.topic_breadth,
            "successful_repairs": st.successful_repairs,
            "user_initiated_disclosures": st.user_initiated_disclosures,
            "unresolved_ruptures": st.unresolved_ruptures,
            "last_promoted_at": st.last_promoted_at,
            "last_disclosure_at": st.last_disclosure_at,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })


def _row_to_state(row: Dict[str, Any]) -> RelationshipState:
    return RelationshipState(
        user_id=row["user_id"],
        stage=Stage(row.get("stage") or "stranger"),
        session_count=int(row.get("session_count") or 0),
        total_minutes=int(row.get("total_minutes") or 0),
        topic_breadth=int(row.get("topic_breadth") or 0),
        successful_repairs=int(row.get("successful_repairs") or 0),
        user_initiated_disclosures=int(row.get("user_initiated_disclosures") or 0),
        unresolved_ruptures=int(row.get("unresolved_ruptures") or 0),
        last_promoted_at=row.get("last_promoted_at"),
        last_disclosure_at=row.get("last_disclosure_at"),
    )
