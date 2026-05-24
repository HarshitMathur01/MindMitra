"""GET /me/snapshot — landing-page ambience signals.

The SanctuaryHome SPA calls this on every page load to drive its ambient
personalization engine (mood-mirroring, crisis quieting, door reordering,
whisper-wall theme matching). It MUST be Redis-cached server-side so a
hot cache never reads Supabase or Qdrant — the landing page TTI budget
cannot absorb DB latency on every refresh.

Field sources are documented in the route docstring. Themes are inputs to
ranking only; the response never carries user-facing strings.

Auth: Bearer JWT, decoded with the same `decode_supabase_jwt` used by
/chat. SKIP_AUTH falls back to DEV_USER_ID in non-production for parity
with the rest of the v3 surface.
"""
from __future__ import annotations

import asyncio
import json
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..core.auth import AuthError, decode_supabase_jwt
from ..core.connections import get_redis, get_supabase
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..services import profile_service

logger = get_logger(__name__, layer="delivery")

router = APIRouter()

SNAPSHOT_CACHE_TTL_S = 60
SNAPSHOT_AFFECT_EMA_WINDOW = 10
SNAPSHOT_LOOKBACK_DAYS = 28


class AffectEma(BaseModel):
    valence: float
    arousal: float


class LanguageBaseline(BaseModel):
    # `register` shadows BaseModel.register in pydantic v2; alias keeps the
    # JSON key the frontend expects while using a safe attribute name.
    model_config = ConfigDict(protected_namespaces=(), populate_by_name=True)
    code_mix: float
    register_: str = Field(..., alias="register")


class SnapshotResponse(BaseModel):
    user_id: str
    computed_at: str
    affect_ema: Optional[AffectEma] = None
    recent_crisis_flag: bool = False
    crisis_flag_set_at: Optional[str] = None
    longitudinal_risk_flag: bool = False
    last_slope: Optional[float] = None
    dominant_themes: List[str] = []
    comfort_topics: List[str] = []
    dominant_mode: Optional[str] = None
    cultural_frame_id: Optional[str] = None
    language_baseline: Optional[LanguageBaseline] = None
    session_count_28d: int = 0
    distinct_days_28d: int = 0


async def _resolve_user_id(authorization: Optional[str]) -> str:
    e = env()
    if e.skip_auth_effective:
        logger.warning(
            "[auth] /me/snapshot SKIP_AUTH active — using DEV_USER_ID=%.8s",
            e.dev_user_id,
        )
        return e.dev_user_id
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authorization header required")
    try:
        auth_uuid = decode_supabase_jwt(token)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    if auth_uuid == e.dev_user_id and e.skip_auth_effective:
        return auth_uuid
    return await profile_service.ensure_user_row(auth_uuid)


def _cache_key(user_id: str) -> str:
    return f"snapshot:{user_id}"


async def _read_cache(user_id: str) -> Optional[Dict[str, Any]]:
    r = get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(_cache_key(user_id))
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "snapshot cache read failed",
            extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
        )
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


async def _write_cache(user_id: str, payload: Dict[str, Any]) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.setex(_cache_key(user_id), SNAPSHOT_CACHE_TTL_S, json.dumps(payload, default=str))
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "snapshot cache write failed",
            extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
        )


def _affect_ema(series: List[Dict[str, Any]]) -> Optional[Dict[str, float]]:
    """Exponentially-weighted mean of the last N affect snapshots.

    Most recent observation gets the heaviest weight (alpha=0.5).
    """
    if not series:
        return None
    window = [s for s in series[-SNAPSHOT_AFFECT_EMA_WINDOW:] if isinstance(s, dict)]
    if not window:
        return None
    alpha = 0.5
    valence_ema: Optional[float] = None
    arousal_ema: Optional[float] = None
    for entry in window:
        try:
            v = float(entry.get("valence", 0.0) or 0.0)
            a = float(entry.get("arousal", 0.0) or 0.0)
        except (TypeError, ValueError):
            continue
        if valence_ema is None:
            valence_ema = v
            arousal_ema = a
        else:
            valence_ema = alpha * v + (1 - alpha) * valence_ema
            arousal_ema = alpha * a + (1 - alpha) * (arousal_ema or 0.0)
    if valence_ema is None:
        return None
    return {"valence": round(valence_ema, 3), "arousal": round(arousal_ema or 0.0, 3)}


def _dominant_themes(recurring: Any, limit: int = 5) -> List[str]:
    """Pick the top recurring themes by frequency.

    `recurring_themes` is authored as `{theme: count}` in
    `user_semantic_profiles`. Defensive when it arrives as a list or null.
    """
    if isinstance(recurring, dict):
        items = [
            (str(k), float(v) if isinstance(v, (int, float)) else 0.0)
            for k, v in recurring.items()
            if k
        ]
        items.sort(key=lambda kv: kv[1], reverse=True)
        return [k for k, _ in items[:limit]]
    if isinstance(recurring, list):
        return [str(x) for x in recurring[:limit] if x]
    return []


def _comfort_topics(value: Any, limit: int = 5) -> List[str]:
    if isinstance(value, list):
        return [str(x) for x in value[:limit] if x]
    return []


def _language_baseline(value: Any) -> Optional[Dict[str, Any]]:
    """Reshape the semantic profile's language_baseline into the snapshot shape."""
    if not isinstance(value, dict):
        return None
    try:
        code_mix = float(value.get("code_mix_mean", value.get("code_mix", 0.5)) or 0.5)
    except (TypeError, ValueError):
        code_mix = 0.5
    register = value.get("register")
    if register is None:
        formality = value.get("formality_mean", 0.4)
        try:
            register = "formal" if float(formality) >= 0.6 else "casual"
        except (TypeError, ValueError):
            register = "casual"
    return {"code_mix": round(code_mix, 3), "register": str(register)}


def _sessions_aggregate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Histogram modes and count distinct UTC days within the 28d window."""
    mode_counter: Counter[str] = Counter()
    days: set[str] = set()
    for row in rows:
        seq = row.get("mode_sequence")
        if isinstance(seq, str):
            try:
                seq = json.loads(seq)
            except (TypeError, ValueError):
                seq = []
        if isinstance(seq, list):
            for mode in seq:
                if isinstance(mode, str) and mode:
                    mode_counter[mode] += 1
        started = row.get("started_at")
        if started:
            try:
                if isinstance(started, datetime):
                    dt = started if started.tzinfo else started.replace(tzinfo=timezone.utc)
                else:
                    dt = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                days.add(dt.astimezone(timezone.utc).date().isoformat())
            except (TypeError, ValueError):
                continue
    dominant_mode: Optional[str] = None
    if mode_counter:
        dominant_mode = mode_counter.most_common(1)[0][0]
    return {
        "dominant_mode": dominant_mode,
        "session_count_28d": len(rows),
        "distinct_days_28d": len(days),
    }


async def _load_sessions(user_id: str) -> List[Dict[str, Any]]:
    sb = get_supabase()
    if sb is None:
        return []
    since_iso = (datetime.now(timezone.utc) - timedelta(days=SNAPSHOT_LOOKBACK_DAYS)).isoformat()

    def _read() -> List[Dict[str, Any]]:
        try:
            res = (
                sb.table("sessions")
                .select("started_at,mode_sequence")
                .eq("user_id", user_id)
                .gte("started_at", since_iso)
                .execute()
            )
            return list(res.data or [])
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "snapshot sessions load failed",
                extra=log_context(user_id=user_id, exception_type=type(exc).__name__),
            )
            return []

    return await asyncio.to_thread(_read)


async def _build_snapshot(user_id: str) -> Dict[str, Any]:
    semantic, longitudinal, sessions = await asyncio.gather(
        profile_service.load_semantic_profile(user_id),
        profile_service.load_longitudinal(user_id),
        _load_sessions(user_id),
    )
    semantic = semantic or {}
    longitudinal = longitudinal or {}

    affect = _affect_ema(longitudinal.get("affect_series") or [])
    sessions_agg = _sessions_aggregate(sessions)

    crisis_set_at = longitudinal.get("crisis_flag_set_at")
    if isinstance(crisis_set_at, datetime):
        crisis_set_at = crisis_set_at.isoformat()
    elif crisis_set_at is not None:
        crisis_set_at = str(crisis_set_at)

    last_slope_raw = longitudinal.get("last_slope")
    try:
        last_slope = float(last_slope_raw) if last_slope_raw is not None else None
    except (TypeError, ValueError):
        last_slope = None

    return {
        "user_id": user_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "affect_ema": affect,
        "recent_crisis_flag": bool(longitudinal.get("recent_crisis_flag", False)),
        "crisis_flag_set_at": crisis_set_at,
        "longitudinal_risk_flag": bool(longitudinal.get("longitudinal_risk_flag", False)),
        "last_slope": last_slope,
        "dominant_themes": _dominant_themes(semantic.get("recurring_themes")),
        "comfort_topics": _comfort_topics(semantic.get("comfort_topics")),
        "dominant_mode": sessions_agg["dominant_mode"],
        "cultural_frame_id": semantic.get("cultural_frame_id"),
        "language_baseline": _language_baseline(semantic.get("language_baseline")),
        "session_count_28d": sessions_agg["session_count_28d"],
        "distinct_days_28d": sessions_agg["distinct_days_28d"],
    }


@router.get("/me/snapshot", response_model=SnapshotResponse)
async def me_snapshot(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> SnapshotResponse:
    """Return cached ambience signals for the SanctuaryHome landing page.

    Cache: `snapshot:{user_id}` Redis key, 60s TTL. Matches react-query's
    staleTime on the client so a refresh inside the window is a 1-call,
    cache-hit, no-DB round-trip.
    """
    e = env()
    if not e.enabled:
        raise HTTPException(status_code=503, detail="MHA disabled (set MHA_V3_ENABLED=1)")

    user_id = await _resolve_user_id(authorization)
    started = time.perf_counter()

    cached = await _read_cache(user_id)
    if cached:
        logger.info(
            "snapshot served from cache",
            extra=log_context(
                user_id=user_id,
                source="redis",
                latency_ms=(time.perf_counter() - started) * 1000,
                outcome="cache_hit",
            ),
        )
        return SnapshotResponse(**cached)

    payload = await _build_snapshot(user_id)
    await _write_cache(user_id, payload)
    logger.info(
        "snapshot computed",
        extra=log_context(
            user_id=user_id,
            source="supabase",
            crisis=payload["recent_crisis_flag"],
            risk=payload["longitudinal_risk_flag"],
            session_count=payload["session_count_28d"],
            latency_ms=(time.perf_counter() - started) * 1000,
            outcome="computed",
        ),
    )
    return SnapshotResponse(**payload)
