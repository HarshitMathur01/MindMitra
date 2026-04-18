from __future__ import annotations

import logging
import math
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .memory_crud import MemoryCRUD

logger = logging.getLogger(__name__)

LAMBDA_MAP = {
    # Unified architecture (MEMOIR) taxonomy
    "identity": 0.001,
    "preference": 0.002,
    "behavioral": 0.005,
    "emotional": 0.004,
    "contextual": 0.008,
    # Legacy / transitional aliases (avoid breaking existing rows during migration)
    "episodic": 0.008,
    "semantic": 0.002,
    "affective": 0.004,
    "procedural": 0.003,
    "relational": 0.001,
    "reflection": 0.002,
    "crisis": 0.004,
}


def _parse_ts(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    s = str(val).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


class DecayEngine:
    @staticmethod
    def compute_decay_score(memory: Dict[str, Any]) -> float:
        now = datetime.now(timezone.utc)
        created = _parse_ts(memory.get("created_at")) or _parse_ts(memory.get("last_accessed_at")) or now
        accessed = _parse_ts(memory.get("last_accessed_at")) or created

        days_since_accessed = max(0, (now - accessed).days)

        t = (memory.get("pipeline_memory_type") or memory.get("memory_type") or "semantic")
        if isinstance(t, str):
            t = t.lower()
        lam = LAMBDA_MAP.get(t, 0.002)

        recency_weight = math.exp(-lam * days_since_accessed)
        access_count = int(memory.get("access_count", 1) or 1)
        reinforcement_weight = min(access_count / 8.0, 1.0)

        conf = memory.get("confidence")
        if conf is None:
            imp = float(memory.get("importance_score", 5) or 5)
            conf = max(0.0, min(1.0, imp / 10.0))
        else:
            conf = float(conf)

        decay_score = conf * recency_weight * reinforcement_weight
        return round(max(0.0, min(1.0, decay_score)), 4)

    @staticmethod
    def run_decay_pass(user_id: str, crud: MemoryCRUD) -> Dict[str, int]:
        processed = archived = soft_deleted = updated = 0
        rows = crud.get_user_memories(user_id, types=None, active_only=True, limit=500)
        for row in rows:
            processed += 1
            mem_id = str(row.get("mem0_id") or "")
            if not mem_id:
                continue

            # PDF: crisis memories are never auto-archived by decay.
            cat = str(row.get("memory_category") or row.get("category") or "").lower()
            mtype = str(row.get("memory_type") or row.get("pipeline_memory_type") or "").lower()
            tags = row.get("tags") or []
            if isinstance(tags, str):
                tags = [tags]
            if cat == "crisis" or mtype == "crisis" or any(str(t).lower() == "crisis" for t in (tags or []) if t):
                continue

            score = DecayEngine.compute_decay_score(row)
            if score < 0.05:
                crud.soft_delete(mem_id, "decay_soft_delete")
                soft_deleted += 1
            elif score < 0.10:
                crud.archive(mem_id, reason="decay_archive_threshold")
                archived += 1
            else:
                crud.update_decay_score(mem_id, score)
                updated += 1
        return {"processed": processed, "archived": archived, "soft_deleted": soft_deleted, "updated": updated}

    @staticmethod
    def run_global_decay_pass(crud: MemoryCRUD, supabase_client: Any) -> Dict[str, Any]:
        if not supabase_client:
            return {"users": 0, "processed": 0, "archived": 0, "updated": 0}
        try:
            resp = (
                supabase_client.table("memory_metadata")
                .select("user_id")
                .eq("is_active", True)
                .limit(5000)
                .execute()
            )
            uids = {str(r.get("user_id")) for r in (resp.data or []) if r.get("user_id")}
        except Exception as exc:
            logger.warning("[DecayEngine] global user listing failed: %s", exc)
            return {"users": 0, "processed": 0, "archived": 0, "updated": 0}

        tot_p = tot_a = tot_u = 0
        for uid in uids:
            s = DecayEngine.run_decay_pass(uid, crud)
            tot_p += s["processed"]
            tot_a += s["archived"]
            tot_u += s["updated"]
        return {"users": len(uids), "processed": tot_p, "archived": tot_a, "updated": tot_u}

    @staticmethod
    def schedule_nightly_decay(crud: MemoryCRUD, supabase_client: Any) -> None:
        def _seconds_until_midnight_utc() -> float:
            now = datetime.now(timezone.utc)
            nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            return max(1.0, (nxt - now).total_seconds())

        def _loop() -> None:
            time.sleep(_seconds_until_midnight_utc())
            while True:
                try:
                    summary = DecayEngine.run_global_decay_pass(crud, supabase_client)
                    logger.info("[DecayEngine] nightly decay pass complete: %s", summary)
                except Exception as exc:
                    logger.error("[DecayEngine] nightly decay failed: %s", exc, exc_info=True)
                time.sleep(86400.0)

        threading.Thread(target=_loop, daemon=True, name="memory-decay-nightly").start()
