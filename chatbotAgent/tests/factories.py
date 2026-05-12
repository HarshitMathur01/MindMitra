"""Small factories for backend tests.

These helpers keep tests focused on behavior instead of repeating the same
Pydantic/session construction details across every pipeline layer.
"""
from __future__ import annotations

from typing import Any

from app.core.session import SessionObject
from app.models.signals import (
    AffectVector,
    MemoryResult,
    OrchestratorOutput,
    PassiveSignals,
    PromptBundle,
    SafetyFlags,
    SafetyResult,
    Signals,
    ToneParams,
)
from app.pipeline.ingestion import ingest_input


def make_session(**overrides: Any) -> SessionObject:
    defaults: dict[str, Any] = {
        "session_id": "session-test",
        "user_id": "user-test",
        "turn_count": 2,
        "current_mode": "companion",
        "is_new_session": False,
        "cultural_frame_id": "metro_social",
    }
    defaults.update(overrides)
    session = SessionObject(**defaults)
    session.semantic_profile = {
        "display_name": "Aarav",
        "occupation_detail": "an engineering student",
        "cultural_frame_id": "metro_social",
        "total_sessions": 4,
        "language_baseline": {"code_mix_mean": 0.5},
        "recurring_themes": {"exam": 0.9, "family": 0.4},
        "relationship_map": [{"name": "Priya", "relation": "friend"}],
    }
    session.procedural_profile = {
        "style_vector": {
            "warmth": 0.7,
            "formality": 0.4,
            "code_mix": 0.5,
            "sentence_length": 0.5,
            "emoji_use": 0.2,
            "directness": 0.5,
            "humour_tolerance": 0.4,
            "pace": 0.5,
        },
        "dependency_risk_counter": 0,
        "social_mentions_count": 0,
        "sessions_this_week": 2,
        "consecutive_high_urgency_sessions": 0,
    }
    session.total_sessions_at_start = 4
    return session


def make_ingested(text: str = "I feel overwhelmed today", **overrides: Any):
    kwargs = {
        "user_id": overrides.pop("user_id", "user-test"),
        "session_id": overrides.pop("session_id", "session-test"),
        "is_new_session": overrides.pop("is_new_session", False),
        "device_locale": overrides.pop("device_locale", None),
    }
    ingested = ingest_input(text, **kwargs)
    if overrides:
        return ingested.model_copy(update=overrides)
    return ingested


def make_signals(urgency: int = 0, *, sarcasm: bool = False, code_mix: float = 0.5) -> Signals:
    return Signals(
        affect_vector=AffectVector(valence=-0.2 * urgency, arousal=0.3 + 0.2 * urgency, dominance=0.5),
        urgency_score=urgency,
        language_register="casual",
        code_mix_ratio=code_mix,
        sarcasm_detected=sarcasm,
        implicit_distress_signals=[],
        topic_keywords=["work"],
        passive_signals=PassiveSignals(),
    )


def make_orchestrator(
    *,
    mode: str = "companion",
    memory_gate: bool = False,
    dependency: bool = False,
    max_tokens: int = 120,
    temperature: float = 0.7,
) -> OrchestratorOutput:
    return OrchestratorOutput(
        selected_mode=mode,
        previous_mode="companion",
        mode_change_reason="test",
        memory_gate=memory_gate,
        memory_gate_strength="full",
        tone_params=ToneParams(),
        cultural_frame_id="metro_social",
        max_response_tokens=max_tokens,
        dependency_flag=dependency,
        affect_for_retrieval={"valence": -0.2, "arousal": 0.6},
        topic_keywords_for_retrieval=["exam", "Priya"],
        temperature=temperature,
    )


def make_memory_result(**overrides: Any) -> MemoryResult:
    defaults = {"memory_retrieved": False}
    defaults.update(overrides)
    return MemoryResult(**defaults)


def make_prompt() -> PromptBundle:
    return PromptBundle(
        full_prompt="system\nuser",
        system_text="You are MindMitra.",
        user_text="Hello",
        prompt_token_count=10,
        prompt_version_hash="testhash",
        blocks_used={},
    )


def make_safety_result(text: str, *, source: str = "llm_primary") -> SafetyResult:
    return SafetyResult(
        approved=source == "llm_primary",
        approved_response=text,
        response_source=source,
        safety_flags=SafetyFlags(),
        retries_used=0,
        conformance_score=1.0,
    )
