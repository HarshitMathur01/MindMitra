"""
Pipeline Context — canonical UserContext JSON envelope.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def create_empty_user_context(
    user_id: str = "anonymous",
    session_id: Optional[str] = None,
    user_message: str = "",
) -> Dict[str, Any]:
    """
    Canonical JSON envelope that every pipeline module reads from / writes to.
    Nothing leaves or enters the pipeline except through this structure.
    """
    return {
        # ── identity ──
        "user_id": user_id,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),

        # ── raw input ──
        "user_message": user_message,
        "voice_analysis": {},

        # ── session history ──
        "session_context": {
            "recent_messages": [],
            "conversation_summary": {},
            "session_memories": {
                "procedural": [],
                "semantic": [],
                "episodic": [],
            },
            "user_activities": [],
            "user_patterns": {},
        },

        # ── NLP analysis (legacy envelope; COMPASS uses cl_* on ctx) ──
        "nlp_analysis": {
            "emotions": {},
            "primary_emotion": "",
            "sentiment": {"score": 0.0, "label": "neutral"},
            "intensity": 0.0,
            "key_phrases": [],
            "language_detected": "en",
            "urgency_flag": False,
        },

        # ── cultural context ──
        "cultural_context": {
            "language_style": "casual",
            "hindi_english_ratio": 0.0,
            "code_switching_detected": False,
            "cultural_sensitivity_flags": [],
            "communication_pattern": "",
            "regional_context": "",
            "formality_level": "medium",
        },

        # ── psychological analysis ──
        "psychological_analysis": {
            "emotional_state": "",
            "stress_categories": [],
            "risk_assessment": "low",
            "coping_assessment": "",
            "intervention_priority": "supportive",
            "psychological_insights": [],
            "cultural_pressures": "",
        },

        # ── screening scales ──
        "screening_assessments": {
            "phq9": {"score": None, "severity": "", "responses": [], "last_updated": None},
            "gad7": {"score": None, "severity": "", "responses": [], "last_updated": None},
        },

        # ── technique selection ──
        "technique_selection": {
            "primary_technique": "",
            "therapeutic_approach": "",
            "activity_recommendations": [],
            "rationale": "",
        },

        # ── memory context (populated by MemoryManager) ──
        "memory_context": "",

        # ── final output ──
        "ai_response": "",
        "response_generated": False,
    }
