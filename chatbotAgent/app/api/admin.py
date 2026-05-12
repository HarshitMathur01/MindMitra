"""Admin endpoints for the v3 stack.

These routes are protected by a *shared admin key* — the simplest model that
still keeps approval distinct from the main user JWT. In production this is
swapped for a Supabase ``admin`` claim check, but the application-level
"two distinct approver IDs" rule still lives here.

POST /admin/crisis-templates
  body: {"language_variant": str, "content": str}
  → inserts a row with active=false, returns id

POST /admin/crisis-templates/{id}/approve
  body: {"approver_id": str}
  → first call sets approval_1; second (different) call sets approval_2,
    flips active=true, and demotes any other active row for that variant.

Approver IDs must be distinct UUIDs (the application enforces this; the
DB does not).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from ..core.connections import get_supabase
from ..core.env import env

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin_key(x_admin_key: Optional[str]) -> None:
    expected = env().v3_admin_key
    if not expected:
        raise HTTPException(status_code=503, detail="V3_ADMIN_KEY not configured")
    if x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key")


class CrisisTemplateCreate(BaseModel):
    language_variant: str = Field(..., min_length=2)
    content: str = Field(..., min_length=20)


class CrisisTemplateApprove(BaseModel):
    approver_id: str = Field(..., min_length=4)


@router.post("/crisis-templates")
async def create_crisis_template(
    body: CrisisTemplateCreate,
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
):
    _require_admin_key(x_admin_key)
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase unavailable")

    def _insert_template():
        resp = (
            sb.table("crisis_templates")
            .insert(
                {
                    "language_variant": body.language_variant,
                    "content": body.content,
                    "pending_content": body.content,
                    "active": False,
                }
            )
            .execute()
        )
        return {"id": (resp.data or [{}])[0].get("id")}

    try:
        return await asyncio.to_thread(_insert_template)
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 admin] insert crisis template failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create crisis template") from exc


@router.post("/crisis-templates/{template_id}/approve")
async def approve_crisis_template(
    template_id: str,
    body: CrisisTemplateApprove,
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
):
    _require_admin_key(x_admin_key)
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase unavailable")

    def _load_template():
        row = (
            sb.table("crisis_templates")
            .select("*")
            .eq("id", template_id)
            .limit(1)
            .execute()
        )
        return row

    try:
        row = await asyncio.to_thread(_load_template)
        if not row.data:
            raise HTTPException(status_code=404, detail="Template not found")
        record = row.data[0]
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 admin] load crisis template failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load crisis template") from exc

    now = datetime.now(timezone.utc).isoformat()
    approver = body.approver_id.strip()

    updates: dict = {}
    if not record.get("approval_1_by"):
        updates["approval_1_by"] = approver
        updates["approval_1_at"] = now
        message = "first_approval_recorded"
    elif record["approval_1_by"] == approver:
        raise HTTPException(status_code=409, detail="Second approver must be distinct")
    elif not record.get("approval_2_by"):
        updates["approval_2_by"] = approver
        updates["approval_2_at"] = now
        updates["active"] = True
        updates["content"] = record.get("pending_content") or record.get("content")
        updates["updated_at"] = now
        message = "activated"
    else:
        raise HTTPException(status_code=409, detail="Already approved")

    def _apply_updates() -> None:
        sb.table("crisis_templates").update(updates).eq("id", template_id).execute()
        # When activating, demote sibling actives for the same variant
        if updates.get("active"):
            sb.table("crisis_templates").update({"active": False}).eq(
                "language_variant", record["language_variant"]
            ).neq("id", template_id).execute()

    try:
        await asyncio.to_thread(_apply_updates)
    except Exception as exc:  # noqa: BLE001
        logger.error("[v3 admin] approve crisis template failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to approve crisis template") from exc

    return {"id": template_id, "status": message, "active": bool(updates.get("active"))}
