"""
Within-session emotional valence arc (VADER + Hinglish markers).

Cross-session LLM emotional trend remains in ``memory_reflection.get_emotional_trend``;
this module is for deterministic arc signals from recent user turns.
"""
from __future__ import annotations

import logging
from statistics import mean
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

    _VADER_ANALYZER = SentimentIntensityAnalyzer()
    _VADER_IMPORT_OK = True
except Exception as _vader_exc:  # pragma: no cover - exercised when package missing
    _VADER_ANALYZER = None
    _VADER_IMPORT_OK = False
    logger.debug("vaderSentiment unavailable: %s", _vader_exc)

VADER_AVAILABLE = _VADER_IMPORT_OK


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


class EmotionalArcReader:
    """Score user text valence and summarize short-window emotional arc."""

    VADER_AVAILABLE: bool = _VADER_IMPORT_OK

    HINGLISH_NEGATIVE_MARKERS = [
        "nahi",
        "nahi hun",
        "thak gaya",
        "thak gayi",
        "kya farak",
        "farak nahi",
        "akela",
        "akeli",
        "darta",
        "darti",
        "dard",
        "bechaini",
        "pareshan",
        "mushkil",
        "takleef",
        "rona",
        "ro raha",
        "ro rahi",
        "bura lag",
        "samajh nahi",
        "koi nahi sunta",
        "koi nahi",
        "bahut bura",
    ]

    HINGLISH_POSITIVE_MARKERS = [
        "theek hun",
        "acha lag",
        "khush",
        "shukriya",
        "better feel",
        "thoda better",
        "mazaa",
        "mast",
        "sahi hai",
        "bilkul",
        "accha",
    ]

    def score_text(self, text: str) -> float:
        """Valence in [-1, 1]: VADER compound + bounded Hinglish marker adjustment."""
        if self.VADER_AVAILABLE and _VADER_ANALYZER is not None:
            base_score = float(_VADER_ANALYZER.polarity_scores(text or "")["compound"])
        else:
            base_score = 0.0

        lowered = (text or "").lower()
        neg_hits = sum(1 for m in self.HINGLISH_NEGATIVE_MARKERS if m in lowered)
        pos_hits = sum(1 for m in self.HINGLISH_POSITIVE_MARKERS if m in lowered)
        hinglish_delta = (pos_hits * 0.15) - (neg_hits * 0.15)
        hinglish_delta = _clamp(hinglish_delta, -0.45, 0.45)

        final_score = _clamp(base_score + hinglish_delta, -1.0, 1.0)
        return round(final_score, 3)

    def compute_arc(self, recent_messages: List[dict], window: int = 8) -> Dict[str, Any]:
        """
        Build arc stats from the last ``window`` user messages (role == \"user\").

        Returns a dict (ArcResult) with current_valence, arc_direction, arc_delta,
        session_low, session_high, turn_count.
        """
        user_msgs = [m for m in (recent_messages or []) if (m or {}).get("role") == "user"]
        take = min(window, len(user_msgs))
        user_msgs_windowed = user_msgs[-take:] if take else []

        scores = [self.score_text(str(m.get("content") or "")) for m in user_msgs_windowed]

        if not scores:
            return {
                "current_valence": 0.0,
                "arc_direction": "stable",
                "arc_delta": 0.0,
                "session_low": 0.0,
                "session_high": 0.0,
                "turn_count": 0,
            }

        current_valence = scores[-1]
        session_low = min(scores)
        session_high = max(scores)
        turn_count = len(scores)

        arc_direction = "stable"
        arc_delta = 0.0

        if len(scores) >= 3:
            recent_avg = mean(scores[-3:])
            if len(scores) > 3:
                earlier_avg = mean(scores[:-3])
            else:
                earlier_avg = scores[0]
            delta = recent_avg - earlier_avg
            arc_delta = round(scores[-1] - scores[max(0, len(scores) - 4)], 3)

            if abs(delta) < 0.1:
                arc_direction = "stable"
            elif delta > 0:
                arc_direction = "rising"
            else:
                arc_direction = "falling"

            if (
                (session_high - session_low) > 0.6
                and session_low < -0.2
                and session_high > 0.2
            ):
                arc_direction = "volatile"

        return {
            "current_valence": current_valence,
            "arc_direction": arc_direction,
            "arc_delta": arc_delta,
            "session_low": session_low,
            "session_high": session_high,
            "turn_count": turn_count,
        }

    @staticmethod
    def get_arc_for_session(
        session_id: str,
        user_id: str,
        supabase_client: Any,
    ) -> Dict[str, Any]:
        """
        Load the last 10 rows for the session and compute the arc.

        MindMitra persists chat rows in ``chat_messages`` (role, content, created_at).
        """
        reader = EmotionalArcReader()
        if not supabase_client or not session_id or not user_id:
            return reader.compute_arc([], window=8)

        try:
            resp = (
                supabase_client.table("chat_messages")
                .select("role, content")
                .eq("session_id", session_id)
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            rows = list(resp.data or [])
            rows.reverse()
            return reader.compute_arc(rows, window=8)
        except Exception as exc:
            logger.debug("get_arc_for_session failed: %s", exc)
            return reader.compute_arc([], window=8)
