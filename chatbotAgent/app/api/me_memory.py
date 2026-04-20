"""
Memory Mirror API — the user-facing surface for "what does Mitra remember
about me?", with full mutation controls (edit, archive, delete, pause writes).

Endpoints:
    GET    /me/memory                       — full snapshot (identity + episodes + affect)
    PATCH  /me/memory/episodes/{id}         — edit summary or unarchive
    DELETE /me/memory/episodes/{id}         — soft archive (default) or hard delete (?hard=1)
    GET    /me/memory/preferences           — current procedural preferences
    PUT    /me/memory/preferences           — partial update of preferences
    POST   /me/memory/pause                 — start incognito mode (no memory writes)
    POST   /me/memory/resume                — end incognito mode immediately

Design notes:
    * All mutations are scoped to `auth.uid()` via Supabase RLS, so the route
      handlers only need to verify the token and pass the resolved user_id.
    * Soft archive is the default for "delete" — preserves audit trail and
      allows restore from the UI. ?hard=1 actually removes the row + Qdrant point.
    * Pause writes is a forward-dated timestamp; the importance gate checks
      `prefs.is_incognito_now()` before persisting episodic memories.
    * Always degrades gracefully — if the v2 stack isn't reachable, returns
      structured warnings rather than 5xx-ing.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Header, HTTPException, Query

from ..core.auth import validate_user_token
from ..services.supabase_service import supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


async def _resolve_user_id_async(authorization: str) -> str:
    try:
        return await validate_user_token(authorization, supabase_client)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[memory-mirror] auth error: %s", exc)
        raise HTTPException(status_code=401, detail="invalid token") from exc


@router.get("/me/memory")
async def get_user_memory(
    authorization: str = Header(None),
    limit: int = Query(20, ge=1, le=100),
    include_archived: bool = Query(False),
):
    """Return Identity Card + recent episodes + affect trend + preferences."""
    user_id = await _resolve_user_id_async(authorization)

    out: Dict[str, Any] = {
        "user_id": user_id,
        "identity_card": None,
        "recent_memories": [],
        "affect_trend": None,
        "preferences": None,
        "incognito": {"active": False, "until": None},
        "stack_version": "mitra_v2",
        "warnings": [],
    }

    if supabase_client is None:
        out["warnings"].append("supabase_client unavailable; memory stack offline")
        return out

    # ── Identity Card ───────────────────────────────────────────────────────
    try:
        from ..memory.identity_card import IdentityCardService
        card = IdentityCardService(supabase_client).load(user_id)
        if card is not None and not card.is_empty():
            out["identity_card"] = card.to_dict()
    except Exception as exc:
        out["warnings"].append(f"identity_card_load_failed:{exc.__class__.__name__}")

    # ── Recent episodes (importance-ranked) ────────────────────────────────
    try:
        from ..memory.repositories import EpisodicRepo
        rows = EpisodicRepo(supabase_client).by_user(user_id, limit=limit)
        out["recent_memories"] = [
            {
                "id": r.get("id"),
                "summary": r.get("summary"),
                "themes": r.get("themes") or [],
                "affect_label": r.get("affect_label"),
                "importance": float(r.get("importance") or 0.5),
                "strength": float(r.get("strength") or 1.0),
                "created_at": r.get("created_at"),
                "archived": bool(r.get("archived_at")),
            }
            for r in rows
            if include_archived or not r.get("archived_at")
        ]
    except Exception as exc:
        out["warnings"].append(f"episodes_load_failed:{exc.__class__.__name__}")

    # ── Affect trend (last 14 days, lexical channel) ───────────────────────
    try:
        from ..memory.affective import AffectiveService
        svc = AffectiveService(supabase_client)
        pattern = svc.recent_pattern(user_id)
        if pattern is not None:
            out["affect_trend"] = {
                "label": getattr(pattern, "label", None),
                "confidence": float(getattr(pattern, "confidence", 0.0) or 0.0),
                "supporting_channels": list(getattr(pattern, "supporting_channels", []) or []),
                "detail": getattr(pattern, "detail", None),
                "sample_size": int(getattr(pattern, "sample_size", 0) or 0),
            }
    except Exception as exc:
        out["warnings"].append(f"affect_trend_failed:{exc.__class__.__name__}")

    # ── Preferences + incognito state ──────────────────────────────────────
    try:
        from ..memory.preferences import PreferencesService
        prefs = PreferencesService(supabase_client).load(user_id)
        out["preferences"] = prefs.to_dict()
        out["incognito"] = {
            "active": prefs.is_incognito_now(),
            "until": prefs.incognito_until,
        }
    except Exception as exc:
        out["warnings"].append(f"preferences_load_failed:{exc.__class__.__name__}")

    return out


# ── Mutations ──────────────────────────────────────────────────────────────

@router.patch("/me/memory/episodes/{mem_id}")
async def patch_episode(
    mem_id: str,
    payload: Dict[str, Any] = Body(...),
    authorization: str = Header(None),
):
    """Edit a single episodic memory.

    Body may include any of:
        summary       (string)  — overwrite the user-visible summary
        archived      (bool)    — true to archive (soft-delete), false to restore
    """
    user_id = await _resolve_user_id_async(authorization)
    if supabase_client is None:
        raise HTTPException(status_code=503, detail="memory stack offline")

    from ..memory.repositories import EpisodicRepo
    repo = EpisodicRepo(supabase_client)

    existing = repo.get_by_id(user_id, mem_id)
    if not existing:
        raise HTTPException(status_code=404, detail="memory not found")

    updated: Optional[Dict[str, Any]] = None
    if "summary" in payload:
        new_summary = (payload.get("summary") or "").strip()
        if not new_summary:
            raise HTTPException(status_code=400, detail="summary cannot be empty")
        updated = repo.update_summary(user_id, mem_id, new_summary)

    if "archived" in payload:
        if payload.get("archived"):
            updated = repo.archive(user_id, mem_id)
        else:
            updated = repo.unarchive(user_id, mem_id)

    if updated is None:
        raise HTTPException(status_code=400, detail="no supported fields in patch")
    return {"ok": True, "memory": updated}


@router.delete("/me/memory/episodes/{mem_id}")
async def delete_episode(
    mem_id: str,
    hard: bool = Query(False, description="If true, hard-delete (Postgres + Qdrant)"),
    authorization: str = Header(None),
):
    """Soft-archive (default) or hard-delete a memory.

    Hard delete also purges the corresponding Qdrant point so the memory
    cannot resurface via vector search. Soft archive keeps the row but flips
    `archived_at`, which the retriever filters out.
    """
    user_id = await _resolve_user_id_async(authorization)
    if supabase_client is None:
        raise HTTPException(status_code=503, detail="memory stack offline")

    from ..memory.repositories import EpisodicRepo
    repo = EpisodicRepo(supabase_client)

    if not hard:
        updated = repo.archive(user_id, mem_id)
        if not updated:
            raise HTTPException(status_code=404, detail="memory not found")
        return {"ok": True, "mode": "archived", "memory": updated}

    qid = repo.delete(user_id, mem_id)
    if qid is None:
        raise HTTPException(status_code=404, detail="memory not found")

    # Best-effort Qdrant purge — non-fatal if the client is unavailable.
    try:
        from ..memory.qdrant_v2 import COLLECTION_EPISODIC, get_qdrant
        client = get_qdrant()
        if client and qid:
            client.delete_points(COLLECTION_EPISODIC, [qid])
    except Exception as exc:
        logger.warning("[memory-mirror] qdrant purge failed for %s: %s", qid, exc)
        return {"ok": True, "mode": "deleted_postgres_only",
                "warning": f"qdrant_purge_failed:{exc.__class__.__name__}"}

    return {"ok": True, "mode": "deleted"}


@router.get("/me/memory/preferences")
async def get_preferences(authorization: str = Header(None)):
    user_id = await _resolve_user_id_async(authorization)
    if supabase_client is None:
        raise HTTPException(status_code=503, detail="memory stack offline")
    from ..memory.preferences import PreferencesService
    prefs = PreferencesService(supabase_client).load(user_id)
    return {"ok": True, "preferences": prefs.to_dict()}


@router.put("/me/memory/preferences")
async def put_preferences(
    payload: Dict[str, Any] = Body(...),
    authorization: str = Header(None),
):
    user_id = await _resolve_user_id_async(authorization)
    if supabase_client is None:
        raise HTTPException(status_code=503, detail="memory stack offline")
    from ..memory.preferences import PreferencesService
    prefs = PreferencesService(supabase_client).upsert_partial(user_id, payload or {})
    return {"ok": True, "preferences": prefs.to_dict()}


@router.post("/me/memory/pause")
async def pause_memory(
    payload: Dict[str, Any] = Body(default={}),
    authorization: str = Header(None),
):
    """Suspend episodic memory writes for the next N hours (default 24).

    Body: { "hours": int (1..168) }
    """
    user_id = await _resolve_user_id_async(authorization)
    if supabase_client is None:
        raise HTTPException(status_code=503, detail="memory stack offline")

    hours = int((payload or {}).get("hours") or 24)
    hours = max(1, min(168, hours))
    until = datetime.now(timezone.utc) + timedelta(hours=hours)

    from ..memory.preferences import PreferencesService
    prefs = PreferencesService(supabase_client).upsert_partial(
        user_id, {"incognito_until": until.isoformat()},
    )
    return {
        "ok": True,
        "incognito": {"active": True, "until": prefs.incognito_until},
        "preferences": prefs.to_dict(),
    }


@router.post("/me/memory/resume")
async def resume_memory(authorization: str = Header(None)):
    """Resume episodic memory writes immediately."""
    user_id = await _resolve_user_id_async(authorization)
    if supabase_client is None:
        raise HTTPException(status_code=503, detail="memory stack offline")

    from ..memory.preferences import PreferencesService
    prefs = PreferencesService(supabase_client).upsert_partial(
        user_id, {"incognito_until": None},
    )
    return {
        "ok": True,
        "incognito": {"active": False, "until": None},
        "preferences": prefs.to_dict(),
    }
