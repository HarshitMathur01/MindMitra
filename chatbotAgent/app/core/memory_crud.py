from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from qdrant_client.models import PointStruct

from .embedder import get_embedding_service
from .memory_pipeline_types import MemoryCandidate

logger = logging.getLogger(__name__)


def _score_to_label(score: int) -> str:
    s = int(score)
    if s >= 9:
        return "critical"
    if s >= 7:
        return "high"
    if s >= 5:
        return "medium"
    if s >= 3:
        return "low"
    return "trivial"


def _map_structured_type_to_db(memory_type: str) -> str:
    """
    Map pipeline memory types to the legacy `memory_type` column constraint.

    IMPORTANT: `memory_metadata.memory_type` is constrained (see migration
    `20260602000000_memory_scoring_upgrade.sql`) to:
      semantic | procedural | reflection | crisis

    Unified taxonomy (identity/preference/behavioral/emotional/contextual) is stored
    in `pipeline_memory_type` instead.
    """
    t = (memory_type or "").lower()
    if t in ("procedural", "reflection", "crisis"):
        return t
    return "semantic"


class MemoryCRUD:
    """
    Data access for structured memories (Qdrant + Supabase).
    Uses existing clients only — no new connection pools.
    """

    def __init__(self, qdrant_client: Any, supabase_client: Any) -> None:
        self._qc = qdrant_client
        self._sb = supabase_client
        self._collection = os.getenv("QDRANT_COLLECTION", "companion_memories")

    def insert(self, candidate: MemoryCandidate, user_id: str, session_id: str) -> str:
        memory_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        vec = get_embedding_service().embed(candidate.content, is_query=False)

        payload: Dict[str, Any] = {
            "data": candidate.content,
            "user_id": user_id,
            "session_id": session_id,
            "hash": hashlib.md5(candidate.content.encode()).hexdigest(),
            "created_at": now,
            "memory_kind": "structured",
            # Unified taxonomy name used by MEMOIR for scoring/decay.
            "type": (candidate.type or "").lower(),
            "verbatim_anchor": candidate.verbatim_anchor,
            "confidence": float(candidate.confidence),
            "emotional_valence": float(candidate.emotional_valence),
            "emotional_intensity": float(candidate.emotional_intensity),
            "tags": candidate.tags,
            "is_sensitive": candidate.is_sensitive,
            "language": candidate.language,
            "is_resolved": bool(candidate.is_resolved),
            "memory_category": (candidate.category or "").strip() or None,
            "source": "structured_pipeline",
            "access_count": 1,
            "last_accessed_at": now,
            "is_active": True,
            "decay_score": 1.0,
        }

        self._qc.upsert(
            collection_name=self._collection,
            points=[PointStruct(id=memory_id, vector=vec, payload=payload)],
        )

        if self._sb:
            imp = max(1, min(10, int(round(float(candidate.confidence) * 10))))
            if candidate.is_sensitive and candidate.emotional_intensity > 0.8:
                imp = max(imp, 9)
            mem_type = _map_structured_type_to_db(candidate.category or candidate.type or "semantic")
            row = {
                "user_id": user_id,
                "mem0_id": memory_id,
                "category": "general",
                "importance": _score_to_label(imp),
                "importance_score": imp,
                "memory_type": mem_type,
                "last_accessed_at": now,
                "source": "structured_pipeline",
                "session_id": session_id,
                "is_active": True,
                "is_resolved": bool(candidate.is_resolved),
                "memory_category": (candidate.category or "").strip() or None,
                "decay_score": 1.0,
                "access_count": 1,
                "confidence": float(candidate.confidence),
                "verbatim_anchor": candidate.verbatim_anchor,
                "pipeline_memory_type": candidate.type,
                "created_at": now,
                "tags": list(candidate.tags or []),
                "memory_content": candidate.content,
            }
            self._sb.table("memory_metadata").insert(row).execute()

        return memory_id

    def reinforce(self, memory_id: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        got = self._qc.retrieve(collection_name=self._collection, ids=[memory_id], with_payload=True)
        if not got:
            logger.warning("[MemoryCRUD] reinforce: point not found %s", memory_id)
            return
        pl = dict(got[0].payload or {})
        pl["access_count"] = int(pl.get("access_count", 1) or 1) + 1
        pl["last_accessed_at"] = now
        self._qc.set_payload(collection_name=self._collection, payload=pl, points=[memory_id])

        if self._sb:
            resp = (
                self._sb.table("memory_metadata")
                .select("access_count")
                .eq("mem0_id", memory_id)
                .limit(1)
                .execute()
            )
            cur = 1
            if resp.data:
                cur = int(resp.data[0].get("access_count", 1) or 1)
            self._sb.table("memory_metadata").update(
                {"access_count": cur + 1, "last_accessed_at": now}
            ).eq("mem0_id", memory_id).execute()

    def soft_delete(self, memory_id: str, reason: str) -> None:
        got = self._qc.retrieve(collection_name=self._collection, ids=[memory_id], with_payload=True)
        if not got:
            return
        pl = dict(got[0].payload or {})
        pl["is_active"] = False
        self._qc.set_payload(collection_name=self._collection, payload=pl, points=[memory_id])

        if self._sb:
            resp = (
                self._sb.table("memory_metadata")
                .select("notes")
                .eq("mem0_id", memory_id)
                .limit(1)
                .execute()
            )
            prev = ""
            if resp.data:
                prev = (resp.data[0].get("notes") or "").strip()
            note_line = f"[soft_delete {datetime.now(timezone.utc).isoformat()}] {reason}"
            notes = f"{prev}\n{note_line}".strip() if prev else note_line
            self._sb.table("memory_metadata").update(
                {"is_active": False, "notes": notes[:8000]}
            ).eq("mem0_id", memory_id).execute()

    def archive(self, memory_id: str, *, reason: str) -> None:
        """
        PDF: archive is a soft inactive state (still recoverable), distinct from soft_delete.
        We implement both as is_active=false but with a distinct notes reason for auditability.
        """
        got = self._qc.retrieve(collection_name=self._collection, ids=[memory_id], with_payload=True)
        if not got:
            return
        pl = dict(got[0].payload or {})
        pl["is_active"] = False
        self._qc.set_payload(collection_name=self._collection, payload=pl, points=[memory_id])

        if self._sb:
            try:
                resp = (
                    self._sb.table("memory_metadata")
                    .select("notes")
                    .eq("mem0_id", memory_id)
                    .limit(1)
                    .execute()
                )
                prev = ""
                if resp.data:
                    prev = (resp.data[0].get("notes") or "").strip()
                note_line = f"[archive {datetime.now(timezone.utc).isoformat()}] {reason}"
                notes = f"{prev}\n{note_line}".strip() if prev else note_line
                self._sb.table("memory_metadata").update(
                    {"is_active": False, "notes": notes[:8000]}
                ).eq("mem0_id", memory_id).execute()
            except Exception as exc:
                logger.debug("[MemoryCRUD] archive failed: %s", exc)

    def supersede(
        self,
        old_memory_id: str,
        new_candidate: MemoryCandidate,
        user_id: str,
        session_id: str,
    ) -> str:
        new_id = self.insert(new_candidate, user_id, session_id)

        got_old = self._qc.retrieve(collection_name=self._collection, ids=[old_memory_id], with_payload=True)
        if got_old:
            pl_old = dict(got_old[0].payload or {})
            pl_old["is_active"] = False
            pl_old["supersedes_id_inverse"] = new_id
            self._qc.set_payload(collection_name=self._collection, payload=pl_old, points=[old_memory_id])

        got_new = self._qc.retrieve(collection_name=self._collection, ids=[new_id], with_payload=True)
        if got_new:
            pl_new = dict(got_new[0].payload or {})
            pl_new["supersedes_id"] = old_memory_id
            self._qc.set_payload(collection_name=self._collection, payload=pl_new, points=[new_id])

        if self._sb:
            self._sb.table("memory_metadata").update(
                {"is_active": False, "supersedes_id_inverse": new_id}
            ).eq("mem0_id", old_memory_id).eq("user_id", user_id).execute()
            self._sb.table("memory_metadata").update(
                {"supersedes_id": old_memory_id}
            ).eq("mem0_id", new_id).eq("user_id", user_id).execute()

        return new_id

    def update_decay_score(self, memory_id: str, score: float) -> None:
        got = self._qc.retrieve(collection_name=self._collection, ids=[memory_id], with_payload=True)
        if not got:
            return
        pl = dict(got[0].payload or {})
        pl["decay_score"] = float(score)
        self._qc.set_payload(collection_name=self._collection, payload=pl, points=[memory_id])
        if self._sb:
            self._sb.table("memory_metadata").update({"decay_score": float(score)}).eq(
                "mem0_id", memory_id
            ).execute()

    def get_user_memories(
        self,
        user_id: str,
        types: Optional[List[str]] = None,
        active_only: bool = True,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        if not self._sb:
            return []
        q = self._sb.table("memory_metadata").select("*").eq("user_id", user_id)
        if active_only:
            q = q.eq("is_active", True)
        q = q.order("last_accessed_at", desc=True).limit(min(limit * 2, 200))
        resp = q.execute()
        rows = list(resp.data or [])
        if types:
            tl = {t.lower() for t in types}
            rows = [
                r
                for r in rows
                if (r.get("pipeline_memory_type") or "").lower() in tl
                or (r.get("memory_type") or "").lower() in tl
            ]
        return rows[:limit]

    def _user_id_for_memory_id(self, memory_id: str) -> Optional[str]:
        if not self._sb:
            return None
        try:
            resp = (
                self._sb.table("memory_metadata")
                .select("user_id")
                .eq("mem0_id", memory_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                return str(resp.data[0].get("user_id"))
        except Exception as exc:
            logger.debug("[MemoryCRUD] user lookup failed: %s", exc)
        return None

    def log_contradiction(self, memory_id_a: str, memory_id_b: str) -> None:
        if not self._sb:
            return
        now = datetime.now(timezone.utc).isoformat()
        uid = self._user_id_for_memory_id(memory_id_a) or self._user_id_for_memory_id(memory_id_b)
        row: Dict[str, Any] = {
            "memory_id_a": memory_id_a,
            "memory_id_b": memory_id_b,
            "detected_at": now,
            "status": "pending",
            "reason": "pair_log",
        }
        if uid:
            row["user_id"] = uid
        try:
            self._sb.table("memory_contradictions").insert(row).execute()
        except Exception as exc:
            logger.warning("[MemoryCRUD] log_contradiction failed: %s", exc)

    def ensure_session_registry_row(self, session_id: str, user_id: str) -> None:
        """Insert session_registry row with message_count=0 if missing (session start)."""
        if not self._sb or not session_id:
            return
        try:
            resp = (
                self._sb.table("session_registry")
                .select("session_id")
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                return
            self._sb.table("session_registry").insert(
                {
                    "session_id": session_id,
                    "user_id": user_id,
                    "message_count": 0,
                }
            ).execute()
        except Exception as exc:
            logger.warning("[MemoryCRUD] ensure_session_registry_row failed: %s", exc)

    def increment_session_registry_message_count(
        self, session_id: str, user_id: Optional[str] = None
    ) -> None:
        """Increment message_count for session_registry (ensures row when user_id given)."""
        if not self._sb or not session_id:
            return
        try:
            if user_id:
                self.ensure_session_registry_row(session_id, user_id)
            resp = (
                self._sb.table("session_registry")
                .select("message_count")
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            if not resp.data:
                return
            n = int(resp.data[0].get("message_count", 0) or 0) + 1
            self._sb.table("session_registry").update({"message_count": n}).eq(
                "session_id", session_id
            ).execute()
        except Exception as exc:
            logger.warning("[MemoryCRUD] increment_session_registry_message_count failed: %s", exc)

    def write_session_registry(self, session_id: str, user_id: str) -> None:
        if not self._sb or not session_id:
            return
        try:
            resp = (
                self._sb.table("session_registry")
                .select("message_count")
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                n = int(resp.data[0].get("message_count", 0) or 0) + 1
                self._sb.table("session_registry").update({"message_count": n}).eq(
                    "session_id", session_id
                ).execute()
            else:
                self._sb.table("session_registry").insert(
                    {
                        "session_id": session_id,
                        "user_id": user_id,
                        "message_count": 1,
                    }
                ).execute()
        except Exception as exc:
            logger.warning("[MemoryCRUD] write_session_registry failed: %s", exc)

    def update_session_end(self, session_id: str, summary_written: bool = False) -> None:
        if not self._sb or not session_id:
            return
        now = datetime.now(timezone.utc).isoformat()
        try:
            self._sb.table("session_registry").update(
                {"ended_at": now, "summary_written": summary_written}
            ).eq("session_id", session_id).execute()
        except Exception as exc:
            logger.warning("[MemoryCRUD] update_session_end failed: %s", exc)

    def fetch_suppressed_memory_ids(self, user_id: str) -> List[str]:
        if not self._sb or not user_id:
            return []
        try:
            resp = (
                self._sb.table("memory_suppression")
                .select("mem0_id")
                .eq("user_id", user_id)
                .execute()
            )
            return [str(r.get("mem0_id")) for r in (resp.data or []) if r.get("mem0_id")]
        except Exception as exc:
            logger.debug("[MemoryCRUD] fetch_suppressed_memory_ids failed: %s", exc)
            return []

    def log_audit(
        self,
        user_id: str,
        action: str,
        *,
        memory_id: Optional[str] = None,
        detail: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self._sb or not user_id:
            return
        row: Dict[str, Any] = {
            "user_id": user_id,
            "action": action,
            "detail": detail or {},
        }
        if memory_id:
            row["memory_id"] = memory_id
        try:
            self._sb.table("memory_audit_log").insert(row).execute()
        except Exception as exc:
            logger.debug("[MemoryCRUD] log_audit failed: %s", exc)

    def insert_restricted(
        self,
        user_id: str,
        verbatim_text: str,
        *,
        session_id: Optional[str] = None,
        structured_type: str = "crisis",
        source: str = "crisis_fast_path",
    ) -> None:
        if not self._sb or not user_id or not (verbatim_text or "").strip():
            return
        row: Dict[str, Any] = {
            "user_id": user_id,
            "verbatim_text": (verbatim_text or "").strip()[:8000],
            "structured_type": structured_type,
            "source": source,
        }
        if session_id:
            row["session_id"] = session_id
        try:
            self._sb.table("memory_restricted").insert(row).execute()
        except Exception as exc:
            logger.debug("[MemoryCRUD] insert_restricted failed: %s", exc)

    def merge_user_profile_patch(self, user_id: str, patch: Dict[str, Any]) -> None:
        """Shallow-merge keys into user_memory_profile.profile JSON."""
        if not self._sb or not user_id or not patch:
            return
        now = datetime.now(timezone.utc).isoformat()
        try:
            resp = (
                self._sb.table("user_memory_profile")
                .select("profile")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            prof: Dict[str, Any] = {}
            if resp.data:
                p = resp.data[0].get("profile") or {}
                if isinstance(p, str):
                    try:
                        prof = dict(json.loads(p))
                    except Exception:
                        prof = {}
                elif isinstance(p, dict):
                    prof = dict(p)
            prof.update(patch)
            self._sb.table("user_memory_profile").upsert(
                {"user_id": user_id, "profile": prof, "updated_at": now},
                on_conflict="user_id",
            ).execute()
        except Exception as exc:
            logger.warning("[MemoryCRUD] merge_user_profile_patch failed: %s", exc)
