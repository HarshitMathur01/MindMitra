"""Pydantic models for every field that crosses a layer boundary in v3.

These types are the *contract* between layers. The audit invariant
(``every produced field has at least one declared consumer``) is enforced in
code review by grepping for each field name; keeping them centralised here
makes that grep trivial.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Layer 1: Input ingestion outputs ──────────────────────────────────────
class IngestedInput(BaseModel):
    """Output of :mod:`app.pipeline.ingestion` (Layer 1)."""

    normalised_message: str
    language_hint: Literal["en", "hi", "hinglish", "other_indic"]
    session_id: str
    user_id: str
    pii_detected: bool
    server_timestamp: datetime
    is_new_session: bool
    trace_id: str
    device_locale: Optional[str] = None
    pii_categories: List[str] = Field(default_factory=list)


# ── Layer 2: Signal extraction outputs ────────────────────────────────────
class AffectVector(BaseModel):
    valence: float = Field(ge=-1.0, le=1.0)
    arousal: float = Field(ge=0.0, le=1.0)
    dominance: float = Field(ge=0.0, le=1.0)


class GroqSignalRaw(BaseModel):
    """Raw structured-JSON envelope returned by Groq."""

    model_config = ConfigDict(extra="forbid")

    affect_vector: AffectVector
    urgency_score: int = Field(ge=0, le=3)
    language_register: Literal["formal", "semi_formal", "casual", "slang"]
    code_mix_ratio: float = Field(ge=0.0, le=1.0)
    sarcasm_detected: bool = False
    implicit_distress_signals: List[str] = Field(default_factory=list)
    topic_keywords: List[str] = Field(default_factory=list)

    @field_validator("topic_keywords")
    @classmethod
    def _clamp_keywords(cls, v: List[str]) -> List[str]:
        return [k.strip() for k in v if isinstance(k, str) and k.strip()][:6]


class PassiveSignals(BaseModel):
    farewell_detected: bool = False
    hopelessness_count: int = 0
    sudden_shutdown: bool = False
    topic_drop: bool = False


class Signals(BaseModel):
    """Layer 2 output — Groq result fused with passive monitor adjustments."""

    affect_vector: AffectVector
    urgency_score: int = Field(ge=0, le=3)
    language_register: Literal["formal", "semi_formal", "casual", "slang"]
    code_mix_ratio: float
    sarcasm_detected: bool
    implicit_distress_signals: List[str]
    topic_keywords: List[str]
    passive_signals: PassiveSignals
    fallback_used: bool = False
    extraction_latency_ms: Optional[float] = None


# ── Layer 2B: Crisis ──────────────────────────────────────────────────────
class CrisisResponse(BaseModel):
    content: str
    crisis_numbers: List[str] = Field(default_factory=lambda: ["iCall: 9152987821", "Vandrevala: 1860-2662-345"])
    bypassed_llm: bool = True
    language_variant: str = "en"
    source: Literal["supabase", "hardcoded"] = "supabase"


# ── Layer 3: Orchestrator outputs ─────────────────────────────────────────
Mode = Literal["companion", "active_listener", "recovery_check", "referral_bridge", "psychoeducation", "skill_coach"]
MemoryGateStrength = Literal["full", "light"]


class ToneParams(BaseModel):
    formality: float = Field(ge=0.0, le=1.0, default=0.4)
    code_mix: float = Field(ge=0.0, le=1.0, default=0.5)
    sentence_length: float = Field(ge=0.0, le=1.0, default=0.5)
    warmth: float = Field(ge=0.45, le=1.0, default=0.7)
    emoji_use: float = Field(ge=0.0, le=1.0, default=0.2)
    directness: float = Field(ge=0.0, le=1.0, default=0.5)
    humour_tolerance: float = Field(ge=0.0, le=1.0, default=0.4)
    pace: float = Field(ge=0.0, le=1.0, default=0.5)


class OrchestratorOutput(BaseModel):
    selected_mode: Mode
    previous_mode: Mode
    mode_change_reason: str
    memory_gate: bool
    memory_gate_strength: MemoryGateStrength = "full"
    tone_params: ToneParams
    cultural_frame_id: str
    frame_uncertainty: bool = False
    max_response_tokens: int
    dependency_flag: bool = False
    affect_for_retrieval: Dict[str, float]
    topic_keywords_for_retrieval: List[str]
    temperature: float


# ── Layer 4: Memory retrieval outputs ─────────────────────────────────────
class EpisodicMemory(BaseModel):
    summary_text: str
    relative_date: str
    ending_affect: Dict[str, float]
    named_entities: List[str] = Field(default_factory=list)
    techniques_used: List[str] = Field(default_factory=list)
    harmonic_score: float = 0.0


class RetrievalScores(BaseModel):
    episodic_count: int = 0
    top_score: float = 0.0
    affect_similarity: float = 0.0


class MemoryResult(BaseModel):
    episodic_memories: List[EpisodicMemory] = Field(default_factory=list)
    semantic_facts_injection: str = ""
    retrieval_scores: RetrievalScores = Field(default_factory=RetrievalScores)
    memory_retrieved: bool = False


# ── Layer 5: Prompt builder output ────────────────────────────────────────
class PromptBundle(BaseModel):
    full_prompt: str
    system_text: str
    user_text: str
    prompt_token_count: int
    prompt_version_hash: str
    blocks_used: Dict[str, int]


# ── Layer 6: LLM core output ──────────────────────────────────────────────
class LLMResult(BaseModel):
    raw_response: str
    tokens_used: Dict[str, int]
    finish_reason: Literal["stop", "length", "content_filter", "error"]
    llm_used: str
    latency_ms: float
    fallback_chain: List[str] = Field(default_factory=list)


# ── Layer 7: Safety gate output ───────────────────────────────────────────
ResponseSource = Literal["llm_primary", "llm_retry", "static_fallback", "crisis_template", "hardcoded_crisis"]


class SafetyFlags(BaseModel):
    harm: Optional[bool] = False
    harm_category: Optional[str] = None
    sycophancy: Optional[bool] = False
    sycophancy_type: Optional[str] = None
    hallucination: Optional[bool] = False


class SafetyResult(BaseModel):
    approved: bool
    approved_response: str
    safety_flags: SafetyFlags
    safety_check_result: Dict[str, Any] = Field(default_factory=dict)
    conformance_score: float = 1.0
    retries_used: int = 0
    response_source: ResponseSource


# ── Audit log entry ──────────────────────────────────────────────────────
class AuditEvent(BaseModel):
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    event_type: str
    urgency_score: Optional[int] = None
    mode: Optional[str] = None
    memory_used: Optional[bool] = None
    tokens_used: Optional[int] = None
    llm_used: Optional[str] = None
    safety_flags: Optional[Dict[str, Any]] = None
    extra: Optional[Dict[str, Any]] = None


# ── Layer 8: TurnResult — final per-turn shape ───────────────────────────
class TurnResult(BaseModel):
    response: str
    source: ResponseSource
    urgency: int
    mode: str
    ingested: Optional[IngestedInput] = None
    signals: Optional[Signals] = None
    orchestrator: Optional[OrchestratorOutput] = None
    memory: Optional[MemoryResult] = None
    llm: Optional[LLMResult] = None
    safety: Optional[SafetyResult] = None
    prompt: Optional[PromptBundle] = None
    timings_ms: Dict[str, float] = Field(default_factory=dict)
    trace_id: Optional[str] = None
