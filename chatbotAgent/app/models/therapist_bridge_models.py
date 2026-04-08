"""Pydantic models for Therapist Bridge — clinician handoff API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ConsentStatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    share_full_profile: bool = Field(alias="shareFullProfile", default=False)
    share_assessments: bool = Field(alias="shareAssessments", default=True)
    share_patterns: bool = Field(alias="sharePatterns", default=True)
    share_anonymously: bool = Field(alias="shareAnonymously", default=True)


class MoodPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    mood: int


class PatternItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    icon: str = "•"
    title: str
    description: str
    evidence_refs: List[str] = Field(default_factory=list)


class TopicItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str
    frequency: int
    sentiment: float


class AssessmentItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["PHQ-9", "GAD-7", "WEMWBS"]
    score: int
    severity: str
    date: str
    note: str = Field(
        default="Screening estimate only — not a diagnosis. Clinical interpretation required.",
    )


class CrisisEventItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    severity: str
    action_taken: str = Field(alias="actionTaken", default="Platform safety pathway activated.")
    source: str = ""


class NarrativeBullet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    category: Literal["theme", "strength", "coping", "intake_suggestion"] = "theme"
    evidence_refs: List[str] = Field(default_factory=list)


class EvidenceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    kind: Literal["activity", "session_summary", "screening", "crisis", "memory", "metric"]


class ProfileLayers(BaseModel):
    """Three-layer internal model for audit and regeneration."""

    model_config = ConfigDict(extra="forbid")

    facts: Dict[str, Any] = Field(default_factory=dict)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    narrative: Dict[str, Any] = Field(default_factory=dict)


class EmotionalProfilePayload(BaseModel):
    """UI-compatible emotional profile (camelCase aliases)."""

    model_config = ConfigDict(populate_by_name=True)

    mood_trends: List[MoodPoint] = Field(alias="moodTrends", default_factory=list)
    patterns: List[PatternItem] = Field(default_factory=list)
    topics: List[TopicItem] = Field(default_factory=list)
    assessments: List[AssessmentItem] = Field(default_factory=list)
    crisis_events: List[CrisisEventItem] = Field(alias="crisisEvents", default_factory=list)


class ProfilePreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    include_narrative: bool = Field(alias="includeNarrative", default=True)
    narrative_async: bool = Field(alias="narrativeAsync", default=False)
    """When set, emotionalProfile in the response is consent-filtered (same logic as referral)."""
    consent: Optional[ConsentStatePayload] = None


class ProfilePreviewResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    emotional_profile: Dict[str, Any] = Field(
        alias="emotionalProfile",
    )
    layers: ProfileLayers
    disclaimer: str
    data_gaps: List[str] = Field(default_factory=list, alias="dataGaps")
    schema_version: str = Field(default="1", alias="schemaVersion")


class ReferralRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    therapist_id: str = Field(alias="therapistId")
    consent: ConsentStatePayload


class ReferralResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    status: Literal["created", "failed"]
    snapshot_id: Optional[str] = Field(default=None, alias="snapshotId")
    clinician_view_token: Optional[str] = Field(
        default=None, alias="clinicianViewToken"
    )


class ClinicianBriefResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    snapshot_id: str = Field(alias="snapshotId")
    created_at: str = Field(alias="createdAt")
    emotional_profile: Dict[str, Any] = Field(alias="emotionalProfile")
    disclaimer: str
    consent_scope: Dict[str, Any] = Field(alias="consentScope")
