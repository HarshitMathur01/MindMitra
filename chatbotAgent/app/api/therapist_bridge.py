"""
Therapist Bridge API — profile preview, referral creation, clinician magic-link read.
"""

from __future__ import annotations

import asyncio
import copy
import logging
import secrets
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException

from ..core.auth import validate_user_token
from ..core.env import env
from ..models.therapist_bridge_models import (
    ClinicianBriefResponse,
    ConsentStatePayload,
    ProfileLayers,
    ProfilePreviewRequest,
    ProfilePreviewResponse,
    ReferralRequest,
    ReferralResponse,
)
from ..services.supabase_service import supabase_client
from ..services.therapist_profile_builder import build_profile_bundle, DISCLAIMER
from ..services.therapist_profile_synthesis import (
    merge_narrative_into_patterns,
    synthesize_narrative_bundle,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/therapist-bridge", tags=["therapist-bridge"])

MOCK_THERAPISTS = [
    {
        "id": "1",
        "name": "Dr. Priya Sharma",
        "title": "Clinical Psychologist",
        "avatar": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&q=80",
        "rciNumber": "A12345",
        "rating": 4.9,
        "reviewCount": 127,
        "experience": "8 years",
        "languages": ["Hindi", "English"],
        "specializations": ["Anxiety", "Academic Stress", "Family Issues"],
        "testimonial": "Warm, non-judgmental approach",
        "nextAvailable": "Contact clinic",
        "sessionFee": 1200,
        "availability": ["Evenings", "Weekends"],
        "location": ["Online", "Lucknow"],
    },
    {
        "id": "2",
        "name": "Dr. Rajesh Kumar",
        "title": "Clinical Psychologist",
        "avatar": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&q=80",
        "rciNumber": "A23456",
        "rating": 4.8,
        "reviewCount": 94,
        "experience": "12 years",
        "languages": ["Hindi", "English"],
        "specializations": ["Low mood", "Career stress", "Relationships"],
        "testimonial": "Structured and compassionate",
        "nextAvailable": "Contact clinic",
        "sessionFee": 1500,
        "availability": ["Weekdays"],
        "location": ["Online", "Delhi"],
    },
]


def apply_consent_to_emotional_profile(
    emotional: Dict[str, Any], consent: Optional[ConsentStatePayload]
) -> Dict[str, Any]:
    if consent is None:
        return emotional
    o = copy.deepcopy(emotional)
    if not consent.share_assessments:
        o["assessments"] = []
    if consent.share_full_profile or consent.share_patterns:
        pass
    else:
        o["moodTrends"] = []
        o["patterns"] = []
        o["topics"] = []
        o["crisisEvents"] = []
    return o


def _run_synthesis(
    facts: Dict[str, Any],
    metrics: Dict[str, Any],
    emotional: Dict[str, Any],
) -> tuple[Dict[str, Any], str, str]:
    narrative, model_id, ph = synthesize_narrative_bundle(facts, metrics, emotional)
    if narrative.get("bullets"):
        emotional = merge_narrative_into_patterns(emotional, narrative)
    return emotional, model_id, ph


async def _run_blocking(label: str, fn):
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn), timeout=env().therapist_bridge_blocking_timeout_s)
    except asyncio.TimeoutError as exc:
        logger.warning("[THERAPIST-BRIDGE] %s timed out", label)
        raise HTTPException(status_code=504, detail=f"{label} timed out") from exc


@router.get("/therapists")
async def list_therapists():
    return MOCK_THERAPISTS


@router.post(
    "/profile-preview",
    response_model=ProfilePreviewResponse,
    response_model_by_alias=True,
)
async def profile_preview(
    body: ProfilePreviewRequest,
    authorization: str = Header(None),
):
    user_id = await validate_user_token(authorization, supabase_client)
    bundle = await _run_blocking("profile preview", lambda: build_profile_bundle(user_id))
    facts = bundle["facts"]
    metrics = bundle["metrics"]
    emotional = copy.deepcopy(bundle["emotionalProfile"])

    narrative_meta_model = "none"
    narrative_meta_hash = "n/a"
    if body.include_narrative:
        emotional, narrative_meta_model, narrative_meta_hash = await _run_blocking(
            "profile synthesis",
            lambda: _run_synthesis(facts, metrics, emotional),
        )

    filtered = apply_consent_to_emotional_profile(emotional, body.consent)

    layers = ProfileLayers(
        facts=facts,
        metrics=metrics,
        narrative={"model_id": narrative_meta_model, "prompt_hash": narrative_meta_hash},
    )
    return ProfilePreviewResponse(
        emotional_profile=filtered,
        layers=layers,
        disclaimer=DISCLAIMER,
        data_gaps=bundle["data_gaps"],
        schema_version="1",
    )


@router.post("/referral", response_model=ReferralResponse, response_model_by_alias=True)
async def create_referral(
    body: ReferralRequest,
    authorization: str = Header(None),
):
    user_id = await validate_user_token(authorization, supabase_client)
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    bundle = await _run_blocking("profile build", lambda: build_profile_bundle(user_id))
    facts = bundle["facts"]
    metrics = bundle["metrics"]
    emotional = copy.deepcopy(bundle["emotionalProfile"])
    emotional, narrative_model, prompt_hash = await _run_blocking(
        "profile synthesis",
        lambda: _run_synthesis(facts, metrics, emotional),
    )

    filtered = apply_consent_to_emotional_profile(emotional, body.consent)
    payload = {
        "schema_version": "1",
        "facts": facts,
        "metrics": metrics,
        "emotionalProfile": filtered,
        "disclaimer": DISCLAIMER,
        "data_gaps": bundle["data_gaps"],
    }

    snapshot_id = str(uuid.uuid4())
    referral_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)

    def _insert_referral() -> None:
        supabase_client.table("therapist_profile_snapshots").insert(
            {
                "id": snapshot_id,
                "user_id": user_id,
                "schema_version": "1",
                "consent_mask": body.consent.model_dump(by_alias=True),
                "payload": payload,
                "narrative_model_id": narrative_model,
                "narrative_prompt_hash": prompt_hash,
            }
        ).execute()

        supabase_client.table("therapist_referrals").insert(
            {
                "id": referral_id,
                "user_id": user_id,
                "therapist_external_id": body.therapist_id,
                "snapshot_id": snapshot_id,
                "consent": body.consent.model_dump(by_alias=True),
                "status": "created",
                "clinician_view_token": token,
            }
        ).execute()

    try:
        await _run_blocking("referral insert", _insert_referral)
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] referral insert failed: %s", exc)
        return ReferralResponse(id=referral_id, status="failed")

    return ReferralResponse(
        id=referral_id,
        status="created",
        snapshot_id=snapshot_id,
        clinician_view_token=token,
    )


@router.get(
    "/clinician-brief/{token}",
    response_model=ClinicianBriefResponse,
    response_model_by_alias=True,
)
async def clinician_brief(token: str):
    """Opaque token resolves snapshot (service role). Do not log token."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")
    def _load_brief():
        rref = (
            supabase_client.table("therapist_referrals")
            .select("snapshot_id, consent, created_at")
            .eq("clinician_view_token", token)
            .limit(1)
            .execute()
        )
        if not rref.data:
            raise HTTPException(status_code=404, detail="Not found")
        row = rref.data[0]
        sid = row["snapshot_id"]
        snap = (
            supabase_client.table("therapist_profile_snapshots")
            .select("payload, created_at")
            .eq("id", sid)
            .limit(1)
            .execute()
        )
        if not snap.data:
            raise HTTPException(status_code=404, detail="Snapshot missing")
        return rref.data[0], snap.data[0]

    try:
        row, snap_row = await _run_blocking("clinician brief load", _load_brief)
        payload = snap_row.get("payload") or {}
        return ClinicianBriefResponse(
            snapshot_id=row["snapshot_id"],
            created_at=str(snap_row.get("created_at", "")),
            emotional_profile=payload.get("emotionalProfile", {}),
            disclaimer=payload.get("disclaimer", DISCLAIMER),
            consent_scope=row.get("consent") or {},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] clinician brief failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load brief") from exc
