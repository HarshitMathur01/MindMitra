"""Profile service — Supabase reads/writes for the v3 schema.

Pure data accessors. Everything is wrapped in ``asyncio.to_thread`` because
the supabase-py client is sync. Failures degrade silently to empty defaults
so the session-start gather can never crash a chat connection.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..core.connections import get_redis, get_supabase

logger = logging.getLogger(__name__)
_USER_ROW_CACHE: Dict[str, str] = {}
_USER_ROW_TIMEOUT_S = 3.0


DEFAULT_STYLE_VECTOR: Dict[str, float] = {
    "formality": 0.4,
    "code_mix": 0.5,
    "sentence_length": 0.5,
    "warmth": 0.7,
    "emoji_use": 0.2,
    "directness": 0.5,
    "humour_tolerance": 0.4,
    "pace": 0.5,
}


# ── reads ────────────────────────────────────────────────────────────────
async def load_semantic_profile(user_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    if sb is None:
        return _empty_semantic(user_id)

    def _read() -> Dict[str, Any]:
        try:
            res = sb.table("user_semantic_profiles").select("*").eq("user_id", user_id).limit(1).execute()
            rows = res.data or []
            return rows[0] if rows else _empty_semantic(user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] semantic load failed: %s", exc)
            return _empty_semantic(user_id)

    return await asyncio.to_thread(_read)


async def load_procedural_profile(user_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    if sb is None:
        cached = await _load_cached_procedural(user_id)
        if cached:
            logger.warning("[v3 profile] Supabase unavailable; using Redis-cached procedural_profile")
            return cached
        logger.warning("[v3 profile] Supabase unavailable; using empty procedural_profile defaults")
        return _empty_procedural(user_id)

    def _read() -> Dict[str, Any]:
        try:
            res = sb.table("user_procedural_profiles").select("*").eq("user_id", user_id).limit(1).execute()
            rows = res.data or []
            return rows[0] if rows else _empty_procedural(user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] procedural load failed: %s", exc)
            return _empty_procedural(user_id)

    profile = await asyncio.to_thread(_read)
    await _cache_procedural(user_id, profile)
    return profile


async def load_longitudinal(user_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    if sb is None:
        return {"user_id": user_id, "longitudinal_risk_flag": False, "affect_series": [], "phq2_scores": []}

    def _read() -> Dict[str, Any]:
        try:
            res = (
                sb.table("user_longitudinal_trajectory")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            rows = res.data or []
            return rows[0] if rows else {
                "user_id": user_id,
                "longitudinal_risk_flag": False,
                "affect_series": [],
                "phq2_scores": [],
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] longitudinal load failed: %s", exc)
            return {"user_id": user_id, "longitudinal_risk_flag": False, "affect_series": [], "phq2_scores": []}

    return await asyncio.to_thread(_read)


# ── writes (session-end Task A) ──────────────────────────────────────────
async def write_session_record(record: Dict[str, Any]) -> bool:
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            sb.table("sessions").upsert(record, on_conflict="id").execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] write_session_record failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


# ── writes (session-end Task D — procedural EMA) ─────────────────────────
async def upsert_procedural(user_id: str, updates: Dict[str, Any]) -> bool:
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            payload = {"user_id": user_id, **updates, "updated_at": _now_iso()}
            sb.table("user_procedural_profiles").upsert(payload, on_conflict="user_id").execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] upsert_procedural failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


# ── writes (session-end Task E — longitudinal) ───────────────────────────
async def upsert_longitudinal(user_id: str, updates: Dict[str, Any]) -> bool:
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            payload = {"user_id": user_id, **updates, "last_computed_at": _now_iso()}
            sb.table("user_longitudinal_trajectory").upsert(payload, on_conflict="user_id").execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] upsert_longitudinal failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


# ── writes (session-end Task C — semantic facts) ─────────────────────────
async def upsert_semantic(user_id: str, updates: Dict[str, Any]) -> bool:
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            payload = {"user_id": user_id, **updates, "updated_at": _now_iso()}
            sb.table("user_semantic_profiles").upsert(payload, on_conflict="user_id").execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] upsert_semantic failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


# ── audit log writer ─────────────────────────────────────────────────────
async def write_audit_log(event: Dict[str, Any]) -> bool:
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            sb.table("audit_logs").insert(event).execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] write_audit_log failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


# ── activity feedback writer ─────────────────────────────────────────────
async def write_activity_feedback(event: Dict[str, Any]) -> bool:
    """Persist a single user accept/dismiss/complete for an activity suggestion.

    The row is later rolled into ``user_procedural_profiles.activity_affinity``
    by the session-end worker. Best-effort: failures are logged but never
    surfaced to the user.
    """
    sb = get_supabase()
    if sb is None:
        return False

    def _write() -> bool:
        try:
            sb.table("activity_feedback").insert(event).execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] write_activity_feedback failed: %s", exc)
            return False

    return await asyncio.to_thread(_write)


async def fetch_recent_activity_feedback(user_id: str, since_iso: str) -> List[Dict[str, Any]]:
    """Pull all feedback rows for one user since a timestamp (session-end EMA)."""
    sb = get_supabase()
    if sb is None:
        return []

    def _read() -> List[Dict[str, Any]]:
        try:
            res = (
                sb.table("activity_feedback")
                .select("activity_id, action, created_at")
                .eq("user_id", user_id)
                .gte("created_at", since_iso)
                .execute()
            )
            return list(res.data or [])
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] fetch_recent_activity_feedback failed: %s", exc)
            return []

    return await asyncio.to_thread(_read)


async def write_failed_summary(user_id: str, session_id: str, transcript: str) -> bool:
    return await _write_failed_payload("failed_summaries", user_id, session_id, transcript)


async def write_failed_extraction(user_id: str, session_id: str, transcript: str) -> bool:
    return await _write_failed_payload("failed_extractions", user_id, session_id, transcript)


async def _write_failed_payload(table: str, user_id: str, session_id: str, transcript: str) -> bool:
    sb = get_supabase()
    if sb is None:
        logger.error("[v3 profile] %s unavailable — transcript not persisted", table)
        return False

    def _write() -> bool:
        try:
            sb.table(table).insert(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "transcript": transcript,
                    "status": "pending",
                }
            ).execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("[v3 profile] %s write failed: %s", table, exc)
            return False

    return await asyncio.to_thread(_write)


async def fetch_active_crisis_template(language_variant: str) -> Optional[str]:
    sb = get_supabase()
    if sb is None:
        return None

    def _read() -> Optional[str]:
        try:
            res = (
                sb.table("crisis_templates")
                .select("content")
                .eq("language_variant", language_variant)
                .eq("active", True)
                .order("version", desc=True)
                .limit(1)
                .execute()
            )
            rows = res.data or []
            if not rows:
                return None
            return rows[0].get("content")
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] crisis_template fetch failed (%s): %s", language_variant, exc)
            return None

    return await asyncio.to_thread(_read)


async def fetch_static_fallback(
    mode: str, language_variant: str, template_index: int
) -> Optional[str]:
    sb = get_supabase()
    if sb is None:
        return None

    def _read() -> Optional[str]:
        try:
            res = (
                sb.table("static_fallback_templates")
                .select("content")
                .eq("mode", mode)
                .eq("language_variant", language_variant)
                .eq("template_index", template_index)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            rows = res.data or []
            return rows[0]["content"] if rows else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 profile] static_fallback fetch failed: %s", exc)
            return None

    return await asyncio.to_thread(_read)


async def ensure_user_row(auth_id: str) -> str:
    """Ensure a row exists in ``public.users`` for the given auth UUID.

    Returns the v3 ``users.id`` (which we use as ``user_id`` everywhere
    downstream). Used by onboarding and HTTP chat auth resolution.
    """
    def _ensure() -> str:
        sb = get_supabase()
        if sb is None:
            return auth_id  # fallback: treat auth UUID as user_id
        try:
            existing = (
                sb.table("users").select("id").eq("auth_id", auth_id).limit(1).execute()
            )
            if existing.data:
                internal_id = existing.data[0]["id"]
                logger.debug("[v3 profile] ensure_user_row found existing user_id=%.8s", internal_id)
                return internal_id
            new_id = str(uuid.uuid4())
            sb.table("users").insert({"id": new_id, "auth_id": auth_id}).execute()
            logger.info("[v3 profile] ensure_user_row created new user row: user_id=%.8s auth_id=%.8s", new_id, auth_id)
            return new_id
        except Exception as exc:  # noqa: BLE001
            err_str = str(exc)
            if "23503" in err_str or "auth_id_fkey" in err_str.lower():
                logger.warning(
                    "[v3 profile] ensure_user_row FK violation for auth_id=%.8s "
                    "(user not in auth.users — probably DEV_USER_ID or new account). "
                    "Using auth_id directly as user_id.",
                    auth_id,
                )
            else:
                logger.warning("[v3 profile] ensure_user_row failed: %s — using auth_id as fallback", exc)
            return auth_id

    cached = _USER_ROW_CACHE.get(auth_id)
    if cached:
        return cached

    try:
        user_id = await asyncio.wait_for(
            asyncio.to_thread(_ensure),
            timeout=_USER_ROW_TIMEOUT_S,
        )
        _USER_ROW_CACHE[auth_id] = user_id
        return user_id
    except TimeoutError:
        logger.warning(
            "[v3 profile] ensure_user_row timed out after %.1fs for auth_id=%.8s; using auth_id fallback",
            _USER_ROW_TIMEOUT_S,
            auth_id,
        )
        return auth_id


# ── internal helpers ─────────────────────────────────────────────────────
def _empty_semantic(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "display_name": None,
        "occupation_detail": None,
        "city": None,
        "recurring_themes": {},
        "relationship_map": [],
        "comfort_topics": [],
        "discomfort_topics": [],
        "language_baseline": {"code_mix_mean": 0.5, "formality_mean": 0.4},
        "cultural_frame_id": "metro_social",
        "total_sessions": 0,
        "first_session_at": None,
    }


def _empty_procedural(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "style_vector": dict(DEFAULT_STYLE_VECTOR),
        "deflection_topics": [],
        "engagement_topics": [],
        "response_length_pref": 0.5,
        "dependency_risk_counter": 0,
        "social_mentions_count": 0,
        "sessions_this_week": 0,
        "last_session_date": None,
        "consecutive_high_urgency_sessions": 0,
        "preferred_time_slots": [],
    }


async def _load_cached_procedural(user_id: str) -> Optional[Dict[str, Any]]:
    r = get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(f"procedural:{user_id}")
        return json.loads(raw) if raw else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 profile] procedural Redis cache read failed: %s", exc)
        return None


async def _cache_procedural(user_id: str, profile: Dict[str, Any]) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.setex(f"procedural:{user_id}", 86400, json.dumps(profile, default=str))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 profile] procedural Redis cache write failed: %s", exc)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def fetch_most_recent_episodic(user_id: str) -> Optional[Dict[str, Any]]:
    """Pull the most recent ``episodic_memories`` payload for this user.

    Used at session start to populate ``previous_session_peak_urgency`` so
    the orchestrator can decide on ``recovery_check`` mode without waiting
    on the live retrieval call.
    """
    from ..core.connections import get_qdrant
    from ..core.env import env

    client = get_qdrant()
    if client is None:
        return None

    try:
        from qdrant_client.http import models as qmodels

        result = await client.scroll(
            collection_name=env().qdrant_episodic_collection,
            scroll_filter=qmodels.Filter(
                must=[qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id))]
            ),
            limit=20,
            with_payload=True,
            with_vectors=False,
        )
        points, _ = result
        if not points:
            return None
        # Sort by session_date payload desc.
        points.sort(
            key=lambda p: (p.payload or {}).get("session_date", ""),
            reverse=True,
        )
        return points[0].payload or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 profile] fetch_most_recent_episodic failed: %s", exc)
        return None
