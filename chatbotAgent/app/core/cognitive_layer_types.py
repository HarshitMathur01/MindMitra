"""Lightweight cognitive-layer output for future pipeline ctx merging (dataclass only)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class CognitivLayerOutput:
    # Intent
    intent: str = "venting"  # "venting"|"advice"|"casual"|"reflect"|"update"|"crisis"|"emotional"

    # Emotional state
    primary_emotion: str = "neutral"
    emotional_valence: float = 0.0  # -1.0 to 1.0
    emotional_intensity: float = 0.5  # 0.0 to 1.0
    arc_trajectory: str = "stable"  # "rising"|"falling"|"stable"|"volatile"
    risk_level: str = "low"  # "low"|"moderate"|"elevated"|"crisis"

    # Within-session arc numerics (from EmotionalArcReader; mirrored for response prompt)
    arc_current_valence: float = 0.0
    arc_session_low: float = 0.0
    arc_delta: float = 0.0

    # Intervention
    intervention_sequence: List[str] = field(
        default_factory=lambda: ["validate"]
    )
    # ordered list, 1-3 items from: validate, reflect, ground, reframe, affirm, explore, practical_support

    # Response style
    response_length: str = "medium"  # "short"|"medium"|"long"
    question_allowed: bool = True
    memory_reference_allowed: bool = True
    language_mirror: str = "en"  # "en"|"hi"|"hinglish"
    mi_move: str = "reflection"  # "open_question"|"affirmation"|"reflection"|"summary"|"no_move"

    # Cultural context
    cultural_context: str = ""

    # Metadata
    confidence: float = 0.8
    fallback_used: bool = False  # True if LLM call failed and defaults were used

    def to_ctx_dict(self) -> dict:
        """
        Returns the canonical 14 `cl_*` keys used by COMPASS (per unified architecture spec).

        Note: arc numerics (current_valence, session_low) and confidence are intentionally not
        exposed as `cl_*` keys. They may be logged/eval-traced separately.
        """
        return {
            "cl_intent": self.intent,
            "cl_primary_emotion": self.primary_emotion,
            "cl_emotional_valence": self.emotional_valence,
            "cl_emotional_intensity": self.emotional_intensity,
            "cl_arc_trajectory": self.arc_trajectory,
            "cl_arc_delta": self.arc_delta,
            "cl_risk_level": self.risk_level,
            "cl_intervention_sequence": self.intervention_sequence,
            "cl_response_length": self.response_length,
            "cl_question_allowed": self.question_allowed,
            "cl_language_mirror": self.language_mirror,
            "cl_mi_move": self.mi_move,
            "cl_cultural_context": self.cultural_context,
            "cl_fallback_used": self.fallback_used,
        }
