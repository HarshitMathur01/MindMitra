"""
Onboarding API routes.

POST /onboarding/mirror-response
    Receives the user's free-text answer from Act 2.
    1. Client-side crisis keywords screened first.
    2. If safe, calls Groq to generate a ≤45-word empathy mirror.
    Returns: { response_text, crisis_assessment }

POST /onboarding/crisis-check
    LLM-based crisis assessment for ambiguous medium-score cases.
    Returns: { level, reasoning, recommended_action }

SECURITY (added by audit fix):
    - Both routes now require a valid Supabase JWT (same gate as /chat).
    - Per-user + per-IP token-bucket rate limits guard against cost abuse and
      prompt-stress attacks.
    - Body fields capped at safe lengths to prevent DoS via huge payloads.
"""

import logging
import os
import re
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from groq import Groq
from pydantic import BaseModel, Field

from ..core.auth import validate_user_token
from ..core.config import config
from ..core.rate_limit import RateLimiter
from ..services.supabase_service import supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# ── Rate limiters (in-process, swap for Redis in multi-replica deploy) ─────
# Generous enough for genuine onboarding flows (a handful of mirror calls per
# session) but strict enough to make cost-abuse / prompt-stress unattractive.
_MIRROR_LIMIT_PER_USER = int(os.getenv("ONBOARDING_MIRROR_RATE_PER_USER", "20"))
_MIRROR_LIMIT_PER_IP = int(os.getenv("ONBOARDING_MIRROR_RATE_PER_IP", "60"))
_CRISIS_LIMIT_PER_USER = int(os.getenv("ONBOARDING_CRISIS_RATE_PER_USER", "10"))
_CRISIS_LIMIT_PER_IP = int(os.getenv("ONBOARDING_CRISIS_RATE_PER_IP", "30"))
_RATE_WINDOW_S = float(os.getenv("ONBOARDING_RATE_WINDOW_S", "60"))

_mirror_limiter_user = RateLimiter(_MIRROR_LIMIT_PER_USER, _RATE_WINDOW_S)
_mirror_limiter_ip = RateLimiter(_MIRROR_LIMIT_PER_IP, _RATE_WINDOW_S)
_crisis_limiter_user = RateLimiter(_CRISIS_LIMIT_PER_USER, _RATE_WINDOW_S)
_crisis_limiter_ip = RateLimiter(_CRISIS_LIMIT_PER_IP, _RATE_WINDOW_S)


def _client_ip(request: Request) -> str:
    """Best-effort client IP — honours XFF behind a trusted proxy."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        # First entry is the original client per RFC 7239 conventions.
        return xff.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_limits(
    user_limiter: RateLimiter,
    ip_limiter: RateLimiter,
    user_id: str,
    ip: str,
    label: str,
) -> None:
    """Reject with 429 if either bucket is exhausted."""
    if not user_limiter.try_acquire(user_id):
        logger.warning("⚠️ [ONBOARDING/%s] user rate-limit hit user=%s", label, user_id[:8])
        raise HTTPException(status_code=429, detail="Too many requests")
    if not ip_limiter.try_acquire(ip):
        logger.warning("⚠️ [ONBOARDING/%s] ip rate-limit hit ip=%s", label, ip)
        raise HTTPException(status_code=429, detail="Too many requests")

# ── Groq client (shared, lazy-initialised) ─────────────────────────────────

_groq_client: Optional[Groq] = None


def _get_groq() -> Optional[Groq]:
    global _groq_client
    if _groq_client is None:
        key = config.get_api_key("groq") or os.getenv("GROQ_API_KEY", "")
        if not key:
            logger.warning("⚠️ [ONBOARDING] GROQ_API_KEY not set — LLM unavailable")
            return None
        _groq_client = Groq(api_key=key)
    return _groq_client


_MODEL = "llama-3.3-70b-versatile"

# ── Client-side keyword crisis screen (mirrors crisisDetection.ts) ─────────
# Only categories needed here; full list lives in the TypeScript client.

_CRISIS_CRITICAL = [
    re.compile(r"\bkill\s+myself\b", re.I),
    re.compile(r"\bsuicid", re.I),
    re.compile(r"\bend\s+my\s+life\b", re.I),
    re.compile(r"\bwant\s+to\s+die\b", re.I),
    re.compile(r"\bno\s+reason\s+to\s+live\b", re.I),
    re.compile(r"मरना\s*चाहत"),
    re.compile(r"आत्महत्या"),
    re.compile(r"जान\s*दे\s*दूं"),
    re.compile(r"\batmahatya\b", re.I),
    re.compile(r"\bmarna\s+chah", re.I),
]

_CRISIS_HIGH = [
    re.compile(r"\bhurt\s+myself\b", re.I),
    re.compile(r"\bself[\s-]?harm", re.I),
    re.compile(r"\bcut\s+myself\b", re.I),
    re.compile(r"\bhopeless\b", re.I),
    re.compile(r"\bworthless\b", re.I),
    re.compile(r"खुद\s*को\s*(नुकसान|चोट)"),
    re.compile(r"\bkhud\s+ko\s+(hurt|nuksan|chot)\b", re.I),
]


def _screen_crisis(text: str) -> str:
    """Returns 'critical', 'high', or 'none'."""
    for pattern in _CRISIS_CRITICAL:
        if pattern.search(text):
            return "critical"
    for pattern in _CRISIS_HIGH:
        if pattern.search(text):
            return "high"
    return "none"


# ── Pydantic models ────────────────────────────────────────────────────────


class MirrorRequest(BaseModel):
    # Cap inputs to prevent base-DoS / token-burn via huge bodies.
    user_answer: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="en", max_length=8)   # "en" | "hi"


class MirrorResponse(BaseModel):
    response_text: str
    crisis_assessment: dict


class CrisisCheckRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="en", max_length=8)
    client_level: str = Field(default="medium", max_length=16)


class CrisisCheckResponse(BaseModel):
    level: str
    reasoning: str
    recommended_action: str


# ── Routes ─────────────────────────────────────────────────────────────────


@router.post("/mirror-response", response_model=MirrorResponse)
async def mirror_response(
    body: MirrorRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """
    Generate a warm, empathic mirror response (≤45 words) for the user's
    free-text answer in Act 2.  Crisis-screens the input first.

    Requires a valid Supabase JWT and is rate-limited per user + per IP.
    """
    user_id = await validate_user_token(authorization, supabase_client)
    _enforce_limits(
        _mirror_limiter_user, _mirror_limiter_ip,
        user_id, _client_ip(request), "mirror",
    )

    text = body.user_answer.strip()
    lang = body.language.lower()

    # ── Crisis screen ──────────────────────────────────────────────────
    crisis_level = _screen_crisis(text)
    crisis_assessment = {
        "level": crisis_level,
        "matched": crisis_level != "none",
    }

    # If critical / high — return safe fallback, skip LLM generation
    if crisis_level in ("critical", "high"):
        fallback = (
            "मैं तुम्हारी बात सुन रही हूं। कृपया नीचे दिए गए नंबरों पर संपर्क करो।"
            if lang == "hi"
            else "I hear you. Please reach out to a crisis line — you don't have to face this alone."
        )
        return MirrorResponse(response_text=fallback, crisis_assessment=crisis_assessment)

    # ── LLM mirror generation ──────────────────────────────────────────
    client = _get_groq()
    if not client:
        # Graceful fallback when Groq unavailable
        excerpt = text[:40] + ("…" if len(text) > 40 else "")
        fallback = (
            f'मैं सुन रही हूं। "{excerpt}" — यह बहुत कुछ है। साझा करने के लिए शुक्रिया।'
            if lang == "hi"
            else f'I hear you. "{excerpt}" — that sounds like a lot to carry. Thank you for sharing.'
        )
        return MirrorResponse(response_text=fallback, crisis_assessment=crisis_assessment)

    if lang == "hi":
        system_prompt = (
            "तुम MindMitra हो — एक भावनात्मक AI साथी जो भारतीय छात्रों की मदद करता है। "
            "उपयोगकर्ता ने अभी अपनी परेशानी शेयर की है। "
            "एक warm, empathic mirror response लिखो: उनकी भावना को reflect करो, "
            "emotion को name दो, normalize करो। "
            "45 words से कम में Hindi में जवाब दो। "
            "कोई सवाल मत पूछो। कोई advice मत दो।"
        )
    else:
        system_prompt = (
            "You are MindMitra, a warm AI companion for Indian students. "
            "The user just shared what's weighing on them. "
            "Write a brief empathic mirror response: reflect their feeling, "
            "name the emotion, normalise it. "
            "Stay under 45 words. English only. No questions. No advice."
        )

    try:
        resp = client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": text[:800]},
            ],
            temperature=0.7,
            max_tokens=120,
        )
        response_text = resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.error(f"❌ [ONBOARDING/mirror] Groq call failed: {exc}")
        excerpt = text[:40] + ("…" if len(text) > 40 else "")
        response_text = (
            f'मैं सुन रही हूं। "{excerpt}" — यह बहुत कुछ है।'
            if lang == "hi"
            else f'I hear you. "{excerpt}" — that sounds like a lot to carry.'
        )

    return MirrorResponse(response_text=response_text, crisis_assessment=crisis_assessment)


@router.post("/crisis-check", response_model=CrisisCheckResponse)
async def crisis_check(
    body: CrisisCheckRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """
    LLM-based nuanced crisis assessment for ambiguous medium client-side scores.
    Returns level, reasoning, and a recommended action.

    Requires a valid Supabase JWT and is rate-limited per user + per IP.
    """
    user_id = await validate_user_token(authorization, supabase_client)
    _enforce_limits(
        _crisis_limiter_user, _crisis_limiter_ip,
        user_id, _client_ip(request), "crisis-check",
    )

    text       = body.text.strip()
    lang       = body.language.lower()
    client_lvl = body.client_level

    client = _get_groq()
    if not client:
        # Fallback: trust client-side assessment
        return CrisisCheckResponse(
            level=client_lvl,
            reasoning="LLM unavailable — using client-side assessment.",
            recommended_action=(
                "Please consider reaching out to a mental health professional."
                if client_lvl != "none"
                else "Continue as normal."
            ),
        )

    system_prompt = (
        "You are a mental health crisis triage assistant. "
        "Evaluate the following user message for crisis risk. "
        "Respond ONLY with JSON — no markdown, no extra text:\n"
        '{ "level": "critical|high|medium|none", '
        '"reasoning": "<one sentence>", '
        '"recommended_action": "<one sentence>" }'
    )

    user_prompt = (
        f"Client-side assessment: {client_lvl}\n"
        f"Language: {lang}\n"
        f"User message: \"{text[:600]}\""
    )

    try:
        resp = client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=150,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown fences if present
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
        import json
        parsed = json.loads(raw)
        return CrisisCheckResponse(
            level=parsed.get("level", client_lvl),
            reasoning=parsed.get("reasoning", ""),
            recommended_action=parsed.get("recommended_action", ""),
        )
    except Exception as exc:
        logger.error(f"❌ [ONBOARDING/crisis-check] Groq call failed: {exc}")
        return CrisisCheckResponse(
            level=client_lvl,
            reasoning="Assessment failed — defaulting to client-side score.",
            recommended_action="Please consider speaking with a mental health professional.",
        )
