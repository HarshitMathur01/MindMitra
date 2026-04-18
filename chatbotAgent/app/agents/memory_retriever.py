import json
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..services.supabase_service import supabase_client
from ..core.logging import log_timing
from ..core.logging import log_event
from ..core.embedder import get_embedding_service
from ..core.memoir_scorer import MEMOIRScorer, select_top_diverse
from ..core.memory_suppressor import MemorySuppressor
from ..core.retrieval_spec import RetrievalSpec
from ..core.redis_working_memory import get_user_has_memories, set_user_has_memories


logger = logging.getLogger(__name__)

MEMOIR_TOP_K = 7
MEMOIR_MAX_PER_TYPE = 3
MEMOIR_HARD_FLOOR = 0.25


def _memoir_debug() -> bool:
    return os.getenv("MM_MEMOIR_DEBUG", "").lower() in ("1", "true", "yes")


def _memory_trace_enabled() -> bool:
    return os.getenv("MM_MEMORY_TRACE", "").lower() in ("1", "true", "yes")


def _map_router_intent_to_memoir(router_intent: str) -> str:
    """Map pipeline intent labels → MEMOIR scorer intent."""
    k = (router_intent or "emotional").lower()
    m = {
        "emotional": "venting",
        "therapeutic": "advice_seeking",
        "casual": "casual",
        "crisis": "crisis",
        "advice": "advice_seeking",
        "reflect": "reflection",
        "venting": "venting",
        "update": "venting",
    }
    if k in m:
        return m[k]
    if k in ("advice_seeking", "reflection", "venting", "casual", "crisis"):
        return k
    return "venting"


def _extract_named_entities(text: str) -> List[str]:
    if not text:
        return []
    found: List[str] = []
    for pat in (
        r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b",
        r"'([^']{2,40})'",
        r'"([^"]{2,40})"',
    ):
        for m in re.findall(pat, text):
            if isinstance(m, tuple):
                m = m[0] if m else ""
            s = str(m).strip()
            if len(s) >= 2 and s not in found:
                found.append(s)
    return found[:12]


def _fetch_session_count(user_id: str) -> int:
    if not supabase_client:
        return 0
    try:
        resp = (
            supabase_client.table("user_memory_profile")
            .select("profile")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not resp.data:
            return 0
        p = resp.data[0].get("profile") or {}
        if isinstance(p, str):
            p = json.loads(p)
        return int((p or {}).get("session_count", 0) or 0)
    except Exception:
        return 0


def _batch_vectors(qclient: Any, collection: str, ids: List[str]) -> Dict[str, Tuple[Any, Dict[str, Any]]]:
    out: Dict[str, Tuple[Any, Dict[str, Any]]] = {}
    for i in range(0, len(ids), 64):
        chunk = [x for x in ids[i : i + 64] if x]
        if not chunk:
            continue
        try:
            pts = qclient.retrieve(
                collection_name=collection,
                ids=chunk,
                with_vectors=True,
                with_payload=True,
            )
        except Exception as exc:
            logger.debug("[MEMOIR] batch retrieve chunk failed: %s", exc)
            continue
        for p in pts or []:
            vid = str(p.id)
            vec = p.vector
            if isinstance(vec, dict):
                vec = next(iter(vec.values()), None)
            out[vid] = (vec, dict(p.payload or {}))
    return out


def _normalize_memory(
    mem_id: str,
    payload: Dict[str, Any],
    meta_row: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    row = dict(meta_row or {})
    pl = dict(payload or {})
    text = pl.get("data") or row.get("memory_content") or row.get("verbatim_anchor") or ""
    pmt = (
        row.get("pipeline_memory_type")
        or pl.get("type")
        or row.get("memory_type")
        or "contextual"
    )
    if isinstance(pmt, str):
        pmt = pmt.lower()
    tags = row.get("tags")
    if tags is None:
        tags = pl.get("tags") or []
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except json.JSONDecodeError:
            tags = []
    if not isinstance(tags, list):
        tags = []

    last_ts = pl.get("last_accessed_at") or row.get("last_accessed_at")
    return {
        "id": mem_id,
        "mem0_id": mem_id,
        "memory": text,
        "type": pmt,
        "memory_type": row.get("memory_type", "semantic"),
        "emotional_valence": float(pl.get("emotional_valence", 0.0) or 0.0),
        "emotional_intensity": float(pl.get("emotional_intensity", 0.0) or 0.0),
        "access_count": int(pl.get("access_count", row.get("access_count", 1)) or 1),
        "confidence": float(pl.get("confidence", row.get("confidence", 0.75) or 0.75)),
        "is_sensitive": bool(pl.get("is_sensitive", row.get("is_sensitive", False))),
        "is_active": pl.get("is_active", row.get("is_active", True)),
        "decay_score": float(pl.get("decay_score", row.get("decay_score", 1.0) or 1.0)),
        "is_resolved": bool(row.get("is_resolved", pl.get("is_resolved", False))),
        "tags": tags,
        "last_accessed": last_ts,
        "last_accessed_at": last_ts,
        "metadata": {k: v for k, v in pl.items() if k not in ("data",)},
    }


class MemoryRetriever:
    def __init__(self, store):
        self.store = store

    @property
    def _ready(self):
        return self.store._ready

    @property
    def _qc(self):
        return getattr(self.store, "_qdrant_client", None)

    @property
    def _collection(self) -> str:
        return str(getattr(self.store, "_collection", os.getenv("QDRANT_COLLECTION", "companion_memories")))

    def _has_any_memories(self, user_id: str) -> bool:
        # PDF: Stage 0 short-circuit uses Redis key user:{id}:has_memories (TTL 120s).
        cached = get_user_has_memories(user_id)
        if cached is not None:
            return bool(cached)

        try:
            resp = (
                supabase_client.table("memory_metadata")
                .select("mem0_id", count="exact")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            has_mem = (resp.count or 0) > 0
        except Exception as exc:
            logger.debug("[MEMORY] _has_any_memories check failed (%s) — failing open", exc)
            return True

        set_user_has_memories(user_id, bool(has_mem), ttl_seconds=120)

        return has_mem

    def invalidate_has_memories_cache(self, user_id: str) -> None:
        # Best-effort: just refresh next call. (Redis setter runs after count query.)
        return

    def _update_access_timestamps(self, mem0_ids: List[str]) -> None:
        if not supabase_client or not mem0_ids:
            return
        try:
            now = datetime.now(timezone.utc).isoformat()
            supabase_client.table("memory_metadata").update(
                {"last_accessed_at": now}
            ).in_("mem0_id", mem0_ids).execute()
        except Exception as exc:
            logger.error("[MEMORY] _update_access_timestamps failed: %s", exc)

    def _memoir_dense_search(self, query: str, user_id: str, limit: int) -> List[Tuple[str, Dict[str, Any], Any]]:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        client = self._qc
        coll = self._collection
        qvec = get_embedding_service().embed(query or "", is_query=True)
        fl = Filter(
            must=[
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                FieldCondition(key="is_active", match=MatchValue(value=True)),
            ]
        )
        try:
            if not client:
                return []
            resp = client.query_points(
                collection_name=coll,
                query=qvec,
                query_filter=fl,
                limit=limit,
                with_payload=True,
                with_vectors=True,
            )
        except Exception as exc:
            logger.warning("[MEMOIR] dense search failed: %s", exc)
            return []
        out: List[Tuple[str, Dict[str, Any], Any]] = []
        for p in getattr(resp, "points", []) or []:
            pl = dict(p.payload or {})
            if pl.get("is_active") is False:
                continue
            vec = p.vector
            if isinstance(vec, dict):
                vec = next(iter(vec.values()), None)
            out.append((str(p.id), pl, vec))
        return out

    def _memoir_keyword_rows(self, user_id: str, entities: List[str]) -> List[Dict[str, Any]]:
        if not supabase_client:
            return []
        rows: List[Dict[str, Any]] = []
        seen: set = set()

        # PDF keyword/structured thread:
        # - tags @> named_entities OR type='behavioral'
        try:
            behavioral = (
                supabase_client.table("memory_metadata")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .eq("memory_type", "behavioral")
                .limit(15)
                .execute()
            )
            for r in behavioral.data or []:
                mid = r.get("mem0_id")
                if mid and mid not in seen:
                    seen.add(mid)
                    rows.append(r)
        except Exception as exc:
            logger.debug("[MEMOIR] behavioral fetch failed: %s", exc)

        for ent in (entities or [])[:8]:
            if not ent:
                continue
            try:
                hit = (
                    supabase_client.table("memory_metadata")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("is_active", True)
                    .contains("tags", [ent])
                    .limit(5)
                    .execute()
                )
                for r in hit.data or []:
                    mid = r.get("mem0_id")
                    if mid and mid not in seen:
                        seen.add(mid)
                        rows.append(r)
            except Exception as exc:
                logger.debug("[MEMOIR] tags.contains failed for %r: %s — trying ilike", ent, exc)
                try:
                    pat = f"%{ent}%"
                    hit = (
                        supabase_client.table("memory_metadata")
                        .select("*")
                        .eq("user_id", user_id)
                        .eq("is_active", True)
                        .or_(f"memory_content.ilike.{pat},verbatim_anchor.ilike.{pat}")
                        .limit(5)
                        .execute()
                    )
                    for r in hit.data or []:
                        mid = r.get("mem0_id")
                        if mid and mid not in seen:
                            seen.add(mid)
                            rows.append(r)
                except Exception as exc2:
                    logger.debug("[MEMOIR] keyword ilike failed for %r: %s", ent, exc2)

        return rows[:15]

    def _memoir_recency_rows(self, user_id: str) -> List[Dict[str, Any]]:
        crud = getattr(self.store, "memory_crud", None)
        if crud:
            return crud.get_user_memories(user_id, types=None, active_only=True, limit=5)
        if not supabase_client:
            return []
        try:
            resp = (
                supabase_client.table("memory_metadata")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .order("last_accessed_at", desc=True)
                .limit(5)
                .execute()
            )
            return list(resp.data or [])
        except Exception as exc:
            logger.debug("[MEMOIR] recency fetch failed: %s", exc)
            return []

    # NOTE: PDF “ditto” retrieval pipeline does not include lexical RPC or session summaries
    # in the Stage 2 hot path. Those are handled in separate layers (e.g., session summaries)
    # and should not add synchronous latency here.

    @staticmethod
    def _intent_bucket(intent: str) -> str:
        k = (intent or "").lower()
        if k in ("casual",):
            return "casual"
        if k in ("crisis",):
            return "crisis"
        if k in ("advice_seeking", "advice", "therapeutic"):
            return "therapeutic"
        return "emotional"

    @staticmethod
    def _type_bucket(mem_type: str) -> str:
        t = (mem_type or "").lower()
        if t in ("identity", "preference", "contextual"):
            return "ipc"
        if t in ("behavioral",):
            return "behavioral"
        if t in ("emotional",):
            return "emotional"
        if t in ("reflection", "reflective"):
            return "reflective"
        return "ipc"

    @classmethod
    def _select_top7_intent_buckets(
        cls,
        scored: List[Tuple[float, Dict[str, Any]]],
        *,
        intent_bucket: str,
        top_n: int = 7,
        max_per_type: int = 3,
    ) -> List[Dict[str, Any]]:
        caps = {
            "casual": {"ipc": 3, "behavioral": 1, "emotional": 1, "reflective": 0},
            "emotional": {"ipc": 5, "behavioral": 2, "emotional": 2, "reflective": 1},
            "therapeutic": {"ipc": 7, "behavioral": 4, "emotional": 3, "reflective": 2},
            "crisis": {"ipc": 4, "behavioral": 3, "emotional": 4, "reflective": 1},
        }
        bucket_caps = caps.get(intent_bucket, caps["emotional"])

        by = sorted(scored, key=lambda x: x[0], reverse=True)
        chosen: List[Dict[str, Any]] = []
        chosen_ids: set = set()
        type_counts: Dict[str, int] = {}
        bucket_counts: Dict[str, int] = {"ipc": 0, "behavioral": 0, "emotional": 0, "reflective": 0}

        def _mid(mem: Dict[str, Any]) -> str:
            return str(mem.get("id") or mem.get("mem0_id") or id(mem))

        for sc, m in by:
            if len(chosen) >= top_n:
                break
            if sc < MEMOIR_HARD_FLOOR:
                break
            mid = _mid(m)
            if mid in chosen_ids:
                continue
            t = (m.get("type") or m.get("memory_type") or "contextual").lower()
            if type_counts.get(t, 0) >= max_per_type:
                continue
            b = cls._type_bucket(t)
            if bucket_counts.get(b, 0) >= int(bucket_caps.get(b, 0)):
                continue
            chosen.append(m)
            chosen_ids.add(mid)
            type_counts[t] = type_counts.get(t, 0) + 1
            bucket_counts[b] = bucket_counts.get(b, 0) + 1

        # Backfill to top_n if caps were too restrictive, still respecting per-type cap and hard floor.
        if len(chosen) < top_n:
            for sc, m in by:
                if len(chosen) >= top_n:
                    break
                if sc < MEMOIR_HARD_FLOOR:
                    break
                mid = _mid(m)
                if mid in chosen_ids:
                    continue
                t = (m.get("type") or m.get("memory_type") or "contextual").lower()
                if type_counts.get(t, 0) >= max_per_type:
                    continue
                chosen.append(m)
                chosen_ids.add(mid)
                type_counts[t] = type_counts.get(t, 0) + 1

        return chosen[:top_n]

    def _memoir_collect_top_memories(
        self,
        query: str,
        user_id: str,
        intent: str,
        limit: int,
        threshold: float,
        *,
        session_id: Optional[str],
        current_affect: Optional[Dict[str, float]],
        session_message_count: int = 0,
        arc_trajectory: str = "stable",
    ) -> List[Dict[str, Any]]:
        del limit, threshold
        if not self._ready or not self._qc:
            return []
        if not getattr(self.store, "memory_crud", None):
            return []

        skip_fast_path = os.getenv("MM_DISABLE_MEMORY_FAST_PATH", "").lower() in ("1", "true", "yes")
        has_rows = self._has_any_memories(user_id) if not skip_fast_path else True
        if not skip_fast_path and not has_rows:
            return []

        affect = current_affect or {"valence": 0.0, "intensity": 0.0}
        memoir_intent = _map_router_intent_to_memoir(intent)
        session_count = _fetch_session_count(user_id)
        entities = _extract_named_entities(query or "")
        suppressed_ids: frozenset = frozenset()
        try:
            crud = getattr(self.store, "memory_crud", None)
            if crud:
                suppressed_ids = frozenset(crud.fetch_suppressed_memory_ids(user_id))
        except Exception:
            suppressed_ids = frozenset()

        _spec = RetrievalSpec.build(
            query=query or "",
            user_id=user_id,
            router_intent=intent,
            session_count=session_count,
            current_affect=affect,
            cl_arc_trajectory=arc_trajectory,
            session_message_count=session_message_count,
            intent_mapper=_map_router_intent_to_memoir,
        )
        if _memoir_debug():
            logger.info("[MEMOIR] retrieval_spec=%s", _spec.to_debug_dict())

        ctx = {
            "intent": memoir_intent,
            "current_affect": affect,
            "session_count": session_count,
            "user_message": query or "",
            "suppressed_ids": suppressed_ids,
        }

        client = self._qc
        coll = self._collection

        try:
            with log_timing("MEMOIR Retrieval", query=query, intent=intent, user_id=user_id):
                # PDF Stage 2: exactly 3 parallel candidate retrieval threads.
                with ThreadPoolExecutor(max_workers=3) as ex:
                    fa = ex.submit(self._memoir_dense_search, query or "", user_id, 25)
                    fb = ex.submit(self._memoir_keyword_rows, user_id, entities)
                    fc = ex.submit(self._memoir_recency_rows, user_id)
                    dense = fa.result()
                    kw_rows = fb.result()
                    rec_rows = fc.result()

            merged: Dict[str, Tuple[Dict[str, Any], Optional[Dict[str, Any]], Any]] = {}
            for mid, pl, vec in dense:
                merged[mid] = (pl, None, vec)

            for row in kw_rows:
                mid = str(row.get("mem0_id") or "")
                if not mid:
                    continue
                pl, mr, v = merged.get(mid, ({}, None, None))
                merged[mid] = (pl or {}, row, v)

            for row in rec_rows:
                mid = str(row.get("mem0_id") or "")
                if not mid:
                    continue
                pl, mr, v = merged.get(mid, ({}, None, None))
                merged[mid] = (pl or {}, row if mr is None else mr, v)

            need_vectors = [mid for mid, (_, _, v) in merged.items() if v is None and not str(mid).startswith("summary:")]
            batch = _batch_vectors(client, coll, need_vectors)
            for mid in need_vectors:
                if mid not in merged:
                    continue
                pl, mr, _v = merged[mid]
                got = batch.get(mid)
                if got:
                    nv, npl = got
                    pl = {**npl, **pl}
                    merged[mid] = (pl, mr, nv)

            candidates: List[Dict[str, Any]] = []
            for mid, (pl, mr, vec) in merged.items():
                if mid in suppressed_ids:
                    continue
                uni = _normalize_memory(mid, pl, mr or {})
                uni["_memoir_vec"] = vec
                candidates.append(uni)

            if _memoir_debug():
                logger.info(
                    "[MEMOIR] stage2 merged=%s entities=%s session_count=%s memoir_intent=%s",
                    len(candidates),
                    entities,
                    session_count,
                    memoir_intent,
                )

            kept = MemorySuppressor.filter_candidates(candidates, ctx)
            log_event(
                logger,
                "memoir_candidates",
                user=str(user_id)[:12],
                intent=memoir_intent,
                session_count=session_count,
                dense=len(dense),
                keyword=len(kw_rows),
                recency=len(rec_rows),
                merged=len(candidates),
                kept=len(kept),
            )

            qemb = get_embedding_service().embed(query or "", is_query=True)
            scored: List[Tuple[float, Dict[str, Any]]] = []
            for m in kept:
                vec = m.pop("_memoir_vec", None)
                if vec is None:
                    vec = get_embedding_service().embed(m.get("memory") or "", is_query=False)
                sc = MEMOIRScorer.score(m, qemb, vec, affect, memoir_intent, session_count)
                if m.get("is_sensitive") and memoir_intent == "crisis":
                    sc = 1.0
                m["memoir_score"] = sc
                scored.append((sc, m))

            scored.sort(key=lambda x: x[0], reverse=True)
            # PDF hard floor: drop any memory below S<0.25 before injection.
            scored = [(sc, m) for (sc, m) in scored if sc >= MEMOIR_HARD_FLOOR]

            # PDF Stage 5: intent-aware bucket allocation + diversity caps.
            intent_bucket = self._intent_bucket(memoir_intent)
            top = self._select_top7_intent_buckets(
                scored,
                intent_bucket=intent_bucket,
                top_n=MEMOIR_TOP_K,
                max_per_type=MEMOIR_MAX_PER_TYPE,
            )
            if len(top) < MEMOIR_TOP_K:
                # Final safety net: fill from remaining scored with simple diversity.
                top = top + [
                    m for m in select_top_diverse(scored, top_n=MEMOIR_TOP_K, max_per_type=MEMOIR_MAX_PER_TYPE)
                    if (m.get("id") or m.get("mem0_id")) not in {x.get("id") or x.get("mem0_id") for x in top}
                ]
                top = top[:MEMOIR_TOP_K]

            # Safe transparency: log selected ids/types/scores only (no memory text).
            try:
                picked = [
                    {
                        "id": str(m.get("id") or m.get("mem0_id") or "")[:12],
                        "type": (m.get("type") or m.get("memory_type") or ""),
                        "score": m.get("memoir_score"),
                    }
                    for m in top
                ]
                log_event(
                    logger,
                    "memoir_selected_top7",
                    user=str(user_id)[:12],
                    intent=memoir_intent,
                    session_count=session_count,
                    selected=len(top),
                    picked=picked,
                )
            except Exception:
                pass

            if _memoir_debug():
                logger.info("[MEMOIR] top_ids=%s", [x.get("id") for x in top])

            crud = self.store.memory_crud
            for m in top:
                mid = m.get("id") or m.get("mem0_id")
                if mid:
                    try:
                        threading.Thread(
                            target=crud.reinforce,
                            args=(str(mid),),
                            daemon=True,
                        ).start()
                    except Exception as exc:
                        logger.debug("[MEMOIR] reinforce schedule failed: %s", exc)

            if top:
                logger.info("[MEMOIR] fetch_memory_records: selected=%s memories", len(top))
            return top

        except Exception as exc:
            logger.error("[MEMOIR] retrieve_memories failed: %s", exc, exc_info=True)
            return []

    def _memoir_top_to_compose_records(self, top: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for m in top:
            t = (m.get("type") or m.get("memory_type") or "semantic").lower()
            mid = str(m.get("id") or m.get("mem0_id") or "")
            out.append(
                {
                    "id": mid,
                    "mem0_id": mid,
                    "type": t,
                    "memory_type": m.get("memory_type", t),
                    "memory": m.get("memory", ""),
                    "is_sensitive": bool(m.get("is_sensitive", False)),
                    "emotional_valence": float(m.get("emotional_valence", 0) or 0),
                    "emotional_intensity": float(m.get("emotional_intensity", 0) or 0),
                }
            )
        return out

    def _memoir_fetch_memory_records(
        self,
        query: str,
        user_id: str,
        intent: str,
        limit: int,
        threshold: float,
        *,
        session_id: Optional[str],
        current_affect: Optional[Dict[str, float]],
        session_message_count: int = 0,
        arc_trajectory: str = "stable",
    ) -> List[Dict[str, Any]]:
        _t0 = time.monotonic()
        if not getattr(self.store, "memory_crud", None):
            logger.error(
                "❌ [MEMOIR-FETCH] memory_crud unavailable — MEMOIR retrieval requires store.memory_crud | user=%s",
                str(user_id)[:12],
            )
            return []
        top = self._memoir_collect_top_memories(
            query,
            user_id,
            intent,
            limit,
            threshold,
            session_id=session_id,
            current_affect=current_affect,
            session_message_count=session_message_count,
            arc_trajectory=arc_trajectory,
        )
        records = self._memoir_top_to_compose_records(top)
        _latency_ms = (time.monotonic() - _t0) * 1000
        logger.info(
            "[MEMORY-MEMOIR] Retrieval complete | user=%s intent=%s limit=%d threshold=%.2f records=%d latency_ms=%.0f",
            str(user_id)[:12], intent, limit, threshold, len(records), _latency_ms,
        )
        return records

    def fetch_memory_records(
        self,
        query: str,
        user_id: str,
        intent: str = "emotional",
        limit: int = 5,
        threshold: float = 0.3,
        *,
        session_id: Optional[str] = None,
        current_affect: Optional[Dict[str, float]] = None,
        session_message_count: int = 0,
        arc_trajectory: str = "stable",
    ) -> List[Dict[str, Any]]:
        """Structured memories for ContextComposer (MEMOIR only)."""
        return self._memoir_fetch_memory_records(
            query,
            user_id,
            intent,
            limit,
            threshold,
            session_id=session_id,
            current_affect=current_affect,
            session_message_count=session_message_count,
            arc_trajectory=arc_trajectory,
        )

    def retrieve_memories(
        self,
        query: str,
        user_id: str,
        intent: str = "emotional",
        limit: int = 5,
        threshold: float = 0.3,
        *,
        session_id: Optional[str] = None,
        current_affect: Optional[Dict[str, float]] = None,
        session_message_count: int = 0,
        arc_trajectory: str = "stable",
    ) -> str:
        """
        Standalone composed prompt block (default profile). Prefer memory_manager.retrieve_memories
        for production (uses Supabase user_memory_profile).
        """
        from ..core.context_composer import ContextComposer, pipeline_intent_to_compose_intent

        recs = self.fetch_memory_records(
            query,
            user_id,
            intent,
            limit,
            threshold,
            session_id=session_id,
            current_affect=current_affect,
            session_message_count=session_message_count,
            arc_trajectory=arc_trajectory,
        )
        default_prof = {
            "session_count": 0,
            "trust_tier": 1,
            "language_preference": "en",
            "narrative_paragraph": None,
        }
        return ContextComposer().compose(
            recs,
            default_prof,
            0,
            pipeline_intent_to_compose_intent(intent),
        )
