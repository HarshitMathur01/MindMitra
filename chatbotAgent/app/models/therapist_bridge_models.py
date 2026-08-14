"""Pydantic models for Therapist Bridge — clinician handoff API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ConsentStatePayload(BaseModel):
    """What the clinician is allowed to see.

    One key per real section of the snapshot payload — a toggle that governs
    nothing is worse than no toggle, because the UI implies a promise the
    backend does not keep. ``share_anonymously`` was exactly that and is gone.

    Defaults mirror the consent sheet: the two least-identifying categories are
    on, anything resembling the person's own words is off. ``share_crisis_flags``
    defaults on because a clinician receiving a referral needs to know a crisis
    pathway fired — but it stays a toggle, because the user is the one deciding.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    share_assessments: bool = Field(alias="shareAssessments", default=True)
    share_patterns: bool = Field(alias="sharePatterns", default=True)
    share_summaries: bool = Field(alias="shareSummaries", default=False)
    share_words: bool = Field(alias="shareWords", default=False)
    share_crisis_flags: bool = Field(alias="shareCrisisFlags", default=True)

    @classmethod
    def deny_all(cls) -> "ConsentStatePayload":
        """The fallback when a request carries no consent block at all."""
        return cls(
            share_assessments=False,
            share_patterns=False,
            share_summaries=False,
            share_words=False,
            share_crisis_flags=False,
        )


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

    #: PHQ-2 is what the v3 pipeline actually produces — inferred from
    #: conversation by ``memory/semantic_write._append_phq2``, not administered.
    #: The others remain in the union for imported or future self-report data.
    type: Literal["PHQ-2", "PHQ-9", "GAD-7", "WEMWBS"]
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
    #: When the clinician link stops resolving. Surface it next to the link —
    #: a magic link with no visible lifetime reads as permanent.
    expires_at: Optional[str] = Field(default=None, alias="expiresAt")


class ClinicianBriefResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    snapshot_id: str = Field(alias="snapshotId")
    created_at: str = Field(alias="createdAt")
    emotional_profile: Dict[str, Any] = Field(alias="emotionalProfile")
    disclaimer: str
    consent_scope: Dict[str, Any] = Field(alias="consentScope")
