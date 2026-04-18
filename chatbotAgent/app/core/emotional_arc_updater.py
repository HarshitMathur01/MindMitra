"""
Post-turn emotional arc logging (non-blocking).

TODO: write structured rows to Supabase session_arc_log for evaluation / training.
"""
from __future__ import annotations

import logging
import threading
from typing import Any, Dict, Optional

from .emotional_arc import EmotionalArcReader


class EmotionalArcUpdater:
    """Compare user vs assistant valence hints; log for offline use."""

    def __init__(self) -> None:
        self._reader = EmotionalArcReader()

    def compute_response_sentiment(self, response_text: str) -> float:
        return self._reader.score_text(response_text or "")

    def update_async(
        self,
        user_message: str,
        response_text: str,
        ctx: Dict[str, Any],
        supabase_client: Optional[Any],
        logger_instance: logging.Logger,
    ) -> None:
        """Run logging in a daemon thread; never raises to caller."""
        del supabase_client  # reserved for future session_arc_log writes

        def _work() -> None:
            try:
                user_score = EmotionalArcReader().score_text(user_message or "")
                response_score = self.compute_response_sentiment(response_text)
                intent = ctx.get("cl_intent", "unknown")
                intervention_used = ctx.get("cl_intervention_sequence", [])
                arc_direction = ctx.get("cl_arc_trajectory", "stable")
                risk_level = ctx.get("cl_risk_level", "low")
                session_id = str(ctx.get("session_id") or "")

                logger_instance.info(
                    "[ARC-UPDATE] session=%s user_valence=%.2f response_valence=%.2f intent=%s arc=%s risk=%s interventions=%s",
                    session_id,
                    user_score,
                    response_score,
                    intent,
                    arc_direction,
                    risk_level,
                    intervention_used,
                )
                # TODO: write to Supabase session_arc_log table
            except Exception as exc:  # pragma: no cover - defensive
                logger_instance.exception("[ARC-UPDATE] thread failed: %s", exc)

        threading.Thread(target=_work, daemon=True, name="arc-update").start()
