"""Onboarding endpoint.

3-turn conversational onboarding (NOT a form). The agent's lines are
pre-scripted; Groq does a single classification pass on Turns 2 and 3 to
extract:
  * occupation + occupation_detail → cultural_frame_id
  * baseline valence/arousal → seeds longitudinal trajectory
  * language baseline (code-mix ratio + register) → seeds semantic profile

Route::

  POST /onboarding
      body: {"turn": 1|2|3, "session_state": {...}, "user_message": str?}

The frontend drives the turn counter. The backend never gates on which turn
it sees so the user can resume mid-onboarding.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from ..core.connections import get_groq, guarded_call
from ..core.env import env
from ..pipeline.ingestion import ingest_input
from ..services import profile_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["onboarding"])


# ── prompts (pre-scripted, NOT LLM-generated) ────────────────────────────
TURN_1 = "Hey! Glad you're here. What's your name, if you'd like to share?"
TURN_2_TEMPLATE = (
    "Nice to meet you{name_suffix}. What do you do these days — student, "
    "working, something else?"
)
TURN_3 = "And how's life treating you these days? No pressure to be specific."
DONE_MESSAGE = "Got it. I'm here whenever you want to talk — about anything."

CLASSIFY_SCHEMA = (
    "Classify this short Indian young-adult self-description. Strict JSON only:\n"
    "{\n"
    '  "occupation": "student"|"working"|"other",\n'
    '  "occupation_detail": string,\n'
    '  "city": string|null,\n'
    '  "cultural_frame_id": "iit_pressure"|"working_professional"|"first_gen_aspirant"|"metro_social"|"small_town_adult"\n'
    "}\n"
    "Use 'iit_pressure' for IIT/NIT/BITS/AIIMS-tier students. 'working_professional' for any 22-30 working adult. "
    "'first_gen_aspirant' for first-generation college / small-city → metro transitions. 'metro_social' for metro 22-28 not above. 'small_town_adult' for 18-25 in tier 2/3 city."
)

AFFECT_SCHEMA = (
    "Estimate baseline affect from this short answer. Strict JSON only:\n"
    "{\n"
    '  "baseline_valence": float[-1..1],\n'
    '  "baseline_arousal": float[0..1],\n'
    '  "code_mix_ratio": float[0..1]\n'
    "}\n"
    "Negative valence = stress/sadness, positive = ok/good. Arousal = how charged the message feels (0=flat, 1=intense)."
)


# ── request/response models ──────────────────────────────────────────────
class OnboardingRequest(BaseModel):
    # Turn 1 → agent asks for name (no user_message expected).
    # Turn 2 → user answered name; agent asks about occupation.
    # Turn 3 → user answered occupation; agent asks the open-ended affect Q.
    # Turn 4 → user answered the affect Q; backend finalises + persists.
    turn: int = Field(..., ge=1, le=4)
    user_message: Optional[str] = None
    session_state: Dict[str, Any] = Field(default_factory=dict)


class OnboardingResponse(BaseModel):
    agent_message: str
    next_turn: Optional[int] = None
    onboarding_complete: bool = False
    session_state: Dict[str, Any]


# ── public route ─────────────────────────────────────────────────────────
@router.post("/onboarding", response_model=OnboardingResponse)
async def onboarding(
    body: OnboardingRequest,
    authorization: Optional[str] = Header(default=None),
) -> OnboardingResponse:
    e = env()
    if not e.enabled:
        raise HTTPException(status_code=503, detail="MHA disabled (set MHA_V3_ENABLED=1)")

    user_id = await _resolve_user_id(authorization)

    state: Dict[str, Any] = dict(body.session_state or {})

    if body.turn == 1:
        return OnboardingResponse(
            agent_message=TURN_1,
            next_turn=2,
            session_state=state,
        )

    if body.turn == 2:
        # Save name from previous answer (turn=1 user response)
        if body.user_message:
            ingested = ingest_input(
                body.user_message, user_id=user_id, session_id="onboarding", is_new_session=True
            )
            name = _extract_name(ingested.normalised_message)
            if name:
                state["display_name"] = name
        suffix = f", {state.get('display_name')}" if state.get("display_name") else ""
        return OnboardingResponse(
            agent_message=TURN_2_TEMPLATE.format(name_suffix=suffix),
            next_turn=3,
            session_state=state,
        )

    # Turn 3 → classify occupation + frame, then ask the final question
    if body.turn == 3:
        if body.user_message:
            classify = await _classify_occupation(body.user_message)
            if classify:
                state.update(classify)
        return OnboardingResponse(
            agent_message=TURN_3,
            next_turn=4,
            session_state=state,
        )

    # turn 4 → user answered the 3rd question; finalise + persist
    if body.user_message:
        affect = await _extract_affect(body.user_message)
        if affect:
            state.update(affect)

    await _persist_onboarding(user_id, state)

    return OnboardingResponse(
        agent_message=DONE_MESSAGE,
        next_turn=None,
        onboarding_complete=True,
        session_state=state,
    )


# ── helpers ──────────────────────────────────────────────────────────────
async def _resolve_user_id(authorization: Optional[str]) -> str:
    e = env()
    if not authorization:
        if e.skip_auth_effective:
            return e.dev_user_id
        raise HTTPException(status_code=401, detail="Authorization required")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    try:
        from ..core.auth import decode_supabase_jwt  # noqa: WPS433 (delayed import)

        auth_uuid = decode_supabase_jwt(authorization.removeprefix("Bearer "))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail=f"JWT invalid: {exc}")
    return await profile_service.ensure_user_row(auth_uuid)


def _extract_name(text: str) -> Optional[str]:
    # If the message is short and looks like a name, take it. Otherwise let
    # them stay anonymous.
    cleaned = text.strip().strip(".!?")
    if 1 <= len(cleaned.split()) <= 4 and len(cleaned) <= 40 and not any(c.isdigit() for c in cleaned):
        return cleaned.title()
    return None


async def _classify_occupation(message: str) -> Optional[Dict[str, Any]]:
    client = get_groq()
    if client is None:
        return None
    e = env()
    try:
        resp = await guarded_call(
            "groq",
            lambda: client.chat.completions.create(
                model=e.groq_signal_model,
                messages=[
                    {"role": "system", "content": CLASSIFY_SCHEMA},
                    {"role": "user", "content": message},
                ],
                temperature=0.0,
                max_tokens=200,
                response_format={"type": "json_object"},
            ),
            timeout_s=e.groq_timeout_s,
            retries=0,
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 onboarding] classify failed: %s", exc)
        return None


async def _extract_affect(message: str) -> Optional[Dict[str, Any]]:
    client = get_groq()
    if client is None:
        return None
    e = env()
    try:
        resp = await guarded_call(
            "groq",
            lambda: client.chat.completions.create(
                model=e.groq_signal_model,
                messages=[
                    {"role": "system", "content": AFFECT_SCHEMA},
                    {"role": "user", "content": message},
                ],
                temperature=0.0,
                max_tokens=120,
                response_format={"type": "json_object"},
            ),
            timeout_s=e.groq_timeout_s,
            retries=0,
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 onboarding] affect extract failed: %s", exc)
        return None


async def _persist_onboarding(user_id: str, state: Dict[str, Any]) -> None:
    semantic_updates: Dict[str, Any] = {}
    if state.get("display_name"):
        semantic_updates["display_name"] = state["display_name"]
    if state.get("occupation_detail"):
        semantic_updates["occupation_detail"] = state["occupation_detail"]
    if state.get("city"):
        semantic_updates["city"] = state["city"]
    if state.get("cultural_frame_id"):
        semantic_updates["cultural_frame_id"] = state["cultural_frame_id"]
    if "code_mix_ratio" in state:
        semantic_updates["language_baseline"] = {
            "code_mix_mean": float(state["code_mix_ratio"]),
            "formality_mean": 0.4,
        }
    if semantic_updates:
        await profile_service.upsert_semantic(user_id, semantic_updates)

    if "baseline_valence" in state and "baseline_arousal" in state:
        await profile_service.upsert_longitudinal(
            user_id,
            {
                "affect_series": [
                    {
                        "date": _today(),
                        "valence_mean": float(state["baseline_valence"]),
                        "arousal_mean": float(state["baseline_arousal"]),
                        "peak_urgency": 0,
                    }
                ],
                "longitudinal_risk_flag": False,
            },
        )

    # Mark onboarding complete on the users row
    from ..core.connections import get_supabase
    import asyncio

    sb = get_supabase()
    if sb is None:
        return

    def _flip() -> None:
        try:
            sb.table("users").update({"onboarding_complete": True}).eq("id", user_id).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 onboarding] flip onboarding_complete failed: %s", exc)

    await asyncio.to_thread(_flip)


def _today() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).date().isoformat()
