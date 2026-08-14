"""
Therapist Bridge API — profile preview, referral creation, clinician magic-link read.
"""

from __future__ import annotations

import asyncio
import copy
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException

from ..core.auth import validate_user_token
from ..core.env import env
from ..services import profile_service
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

# Directory stub. There is no `therapists` table — these are fixtures shaped to
# the frontend `Therapist` type. `approach` and `qualities` exist because the
# client-side `matchTherapists()` scores against them; `photo` is deliberately
# absent, the frontend maps `id` onto a bundled asset.
#
# TODO(localisation): dollar pricing and Danish/Spanish-speaking clinicians are
# wrong for an audience of Indian college students. Replace with RCI-registered
# therapists and rupee fees before this reaches a real user.
MOCK_THERAPISTS = [
    {
        "id": "maren",
        "name": "Maren Ellis",
        "credentials": "LCSW · 12 years",
        "specialties": ["Anxiety", "Burnout", "Sleep"],
        "approach": ["CBT", "ACT"],
        "qualities": ["Structured", "Warm"],
        "languages": ["English", "Danish"],
        "price": 120,
        "formats": ["virtual", "in-person"],
        "nextAvailable": "Thursday, 4:30pm",
        "note": "Works mostly with people carrying long stretches of overwork.",
    },
    {
        "id": "tomas",
        "name": "Tomás Rivera",
        "credentials": "PsyD · 21 years",
        "specialties": ["Grief", "Relationships", "Identity"],
        "approach": ["Psychodynamic", "Existential"],
        "qualities": ["Reflective", "Warm"],
        "languages": ["English", "Spanish"],
        "price": 155,
        "formats": ["in-person", "virtual"],
        "nextAvailable": "Monday, 11:00am",
        "note": "Slow, unhurried sessions that follow where the conversation goes.",
    },
    {
        "id": "ada",
        "name": "Ada Okonkwo",
        "credentials": "LPC · 8 years",
        "specialties": ["Anxiety", "Depression", "Identity", "Burnout"],
        "approach": ["CBT", "Mindfulness"],
        "qualities": ["Direct", "Structured"],
        "languages": ["English"],
        "price": 95,
        "formats": ["virtual"],
        "nextAvailable": "Tomorrow, 9:15am",
        "note": "Practical between-session tools, clear structure, gentle pace.",
    },
    {
        "id": "ravi",
        "name": "Ravi Menon",
        "credentials": "LMFT · 10 years",
        "specialties": ["Relationships", "Trauma", "Anxiety"],
        "approach": ["EMDR", "Somatic"],
        "qualities": ["Trauma-informed", "Warm"],
        "languages": ["English", "Hindi", "Malayalam"],
        "price": 135,
        "formats": ["virtual", "in-person"],
        "nextAvailable": "Friday, 6:00pm",
        "note": "Body-aware work for people who feel stuck in the same loop.",
    },
    {
        "id": "helen",
        "name": "Helen Marsh",
        "credentials": "PhD · 27 years",
        "specialties": ["Depression", "Grief", "Sleep", "Purpose"],
        "approach": ["Psychodynamic", "ACT"],
        "qualities": ["Reflective", "Direct"],
        "languages": ["English", "French"],
        "price": 175,
        "formats": ["in-person", "virtual"],
        "nextAvailable": "Wednesday, 2:00pm",
        "note": "Long-view work on meaning, loss and what comes next.",
    },
]


def apply_consent_to_emotional_profile(
    emotional: Dict[str, Any], consent: Optional[ConsentStatePayload]
) -> Dict[str, Any]:
    """Strip every section the user has not explicitly allowed.

    A missing consent block denies everything. It used to return the profile
    unfiltered, which made the whole feature opt-out on a DPDP path — a client
    that simply forgot the field shared the lot.

    Crisis rows have their own key. They used to ride ``share_patterns``, so
    turning on "share my mood trends" silently also shared crisis history.
    """
    effective = consent if consent is not None else ConsentStatePayload.deny_all()
    o = copy.deepcopy(emotional)

    if not effective.share_assessments:
        o["assessments"] = []
    if not effective.share_patterns:
        o["moodTrends"] = []
        o["patterns"] = []
        o["topics"] = []
    if not effective.share_crisis_flags:
        o["crisisEvents"] = []
    if not effective.share_summaries:
        # Narrative bullets are merged into patterns by Layer C and are the only
        # place summary-derived prose reaches the clinician.
        o["patterns"] = [
            p for p in (o.get("patterns") or []) if not _is_narrative_pattern(p)
        ]
    return o


_NARRATIVE_TITLES = {"Theme", "Strength", "Coping", "Intake Suggestion"}


def _is_narrative_pattern(pattern: Dict[str, Any]) -> bool:
    """Layer C bullets are appended as patterns titled after their category."""
    return str(pattern.get("title", "")) in _NARRATIVE_TITLES


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
    """Run a synchronous call off the loop with a deadline.

    Caveat that matters for writes: the timeout abandons the *await*, it cannot
    cancel the thread. A timed-out insert may still land. Anything that mutates
    state must therefore be idempotent or transactional — see ``_insert_referral``.
    """
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn), timeout=env().therapist_bridge_blocking_timeout_s)
    except asyncio.TimeoutError as exc:
        logger.warning("[THERAPIST-BRIDGE] %s timed out", label)
        raise HTTPException(status_code=504, detail=f"{label} timed out") from exc


async def _audit(user_id: str, action: str, **detail: Any) -> None:
    """Append-only access log. Never blocks or fails the request."""
    try:
        await profile_service.write_audit_log(
            {
                "user_id": user_id,
                "action": action,
                "resource": "therapist_bridge",
                "detail": detail,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[THERAPIST-BRIDGE] audit write failed for %s: %s", action, exc)


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
    bundle = await build_profile_bundle(user_id)
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

    await _audit(
        user_id,
        "therapist_bridge.profile_preview",
        include_narrative=body.include_narrative,
        consent=body.consent.model_dump(by_alias=True) if body.consent else None,
        data_gap_count=len(bundle["data_gaps"]),
    )

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

    bundle = await build_profile_bundle(user_id)
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
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=env().therapist_bridge_token_ttl_days
    )
    consent_mask = body.consent.model_dump(by_alias=True)

    def _insert_referral() -> None:
        """Both rows in one transaction.

        Two bare inserts could leave a snapshot with no referral pointing at it —
        an orphaned copy of someone's clinical profile with no consent record
        attached. ``create_therapist_referral`` is the SQL function that writes
        both or neither; see the 20260814 migration.
        """
        supabase_client.rpc(
            "create_therapist_referral",
            {
                "p_snapshot_id": snapshot_id,
                "p_referral_id": referral_id,
                "p_user_id": user_id,
                "p_therapist_external_id": body.therapist_id,
                "p_consent": consent_mask,
                "p_payload": payload,
                "p_narrative_model_id": narrative_model,
                "p_narrative_prompt_hash": prompt_hash,
                "p_clinician_view_token": token,
                "p_expires_at": expires_at.isoformat(),
            },
        ).execute()

    try:
        await _run_blocking("referral insert", _insert_referral)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] referral insert failed: %s", exc)
        # Used to return 200 with status="failed", so a client that only checked
        # the HTTP code believed the referral existed.
        raise HTTPException(status_code=502, detail="Referral could not be recorded") from exc

    await _audit(
        user_id,
        "therapist_bridge.referral_created",
        referral_id=referral_id,
        snapshot_id=snapshot_id,
        therapist_external_id=body.therapist_id,
        consent=consent_mask,
        expires_at=expires_at.isoformat(),
    )

    return ReferralResponse(
        id=referral_id,
        status="created",
        snapshot_id=snapshot_id,
        clinician_view_token=token,
        expires_at=expires_at.isoformat(),
    )


@router.get(
    "/clinician-brief/{token}",
    response_model=ClinicianBriefResponse,
    response_model_by_alias=True,
)
async def clinician_brief(token: str):
    """Opaque token resolves a snapshot, service-role, unauthenticated by design.

    Never log the token. It lives in the URL path, so it will still reach the
    proxy's access log whatever we do here — expiry and a recorded first view are
    the actual mitigations, not the logging discipline.
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _load_brief():
        rref = (
            supabase_client.table("therapist_referrals")
            .select("id, user_id, snapshot_id, consent, status, created_at, expires_at, viewed_at")
            .eq("clinician_view_token", token)
            .limit(1)
            .execute()
        )
        if not rref.data:
            raise HTTPException(status_code=404, detail="Not found")
        row = rref.data[0]

        expires_at = row.get("expires_at")
        if expires_at:
            try:
                deadline = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > deadline:
                    # 404 not 410: an expired token and an unknown token should be
                    # indistinguishable to whoever is holding the link.
                    raise HTTPException(status_code=404, detail="Not found")
            except HTTPException:
                raise
            except (TypeError, ValueError):
                logger.warning("[THERAPIST-BRIDGE] unparseable expires_at on referral")

        snap = (
            supabase_client.table("therapist_profile_snapshots")
            .select("payload, created_at")
            .eq("id", row["snapshot_id"])
            .limit(1)
            .execute()
        )
        if not snap.data:
            raise HTTPException(status_code=404, detail="Snapshot missing")

        # First read flips the referral to 'delivered' and stamps the view. The
        # CHECK constraint has always allowed 'delivered'; nothing ever set it.
        if not row.get("viewed_at"):
            try:
                supabase_client.table("therapist_referrals").update(
                    {"status": "delivered", "viewed_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", row["id"]).execute()
            except Exception as exc:  # noqa: BLE001
                logger.warning("[THERAPIST-BRIDGE] could not stamp viewed_at: %s", exc)

        return row, snap.data[0]

    try:
        row, snap_row = await _run_blocking("clinician brief load", _load_brief)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] clinician brief failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load brief") from exc

    await _audit(
        row.get("user_id") or "",
        "therapist_bridge.clinician_brief_read",
        referral_id=row.get("id"),
        snapshot_id=row.get("snapshot_id"),
        first_view=not row.get("viewed_at"),
    )

    payload = snap_row.get("payload") or {}
    return ClinicianBriefResponse(
        snapshot_id=row["snapshot_id"],
        created_at=str(snap_row.get("created_at", "")),
        emotional_profile=payload.get("emotionalProfile", {}),
        disclaimer=payload.get("disclaimer", DISCLAIMER),
        consent_scope=row.get("consent") or {},
    )
