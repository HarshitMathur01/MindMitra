import hashlib
import json
import logging
import math
import os
import threading
import time
import uuid
from copy import deepcopy
from tenacity import retry, stop_after_attempt, wait_random_exponential, before_sleep_log
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai

from ..controllers.llm_controller import LLMController
from ..core.config import config
from ..services.supabase_service import supabase_client
from ..core.logging import log_timing
from ..core.language_detector import LanguageDetector
from ..utils.constants import EMBEDDING_DIMS, EMBEDDING_MODEL

logger = logging.getLogger(__name__)

class MemoryStore:
    def __init__(self) -> None:
        # Return immediately with safe defaults so the module-level singleton
        # (bottom of this file) resolves in microseconds.  The BGE-M3 model load
        # (~570 MB), Qdrant connection, Gemini init,
        # and GLM init are all offloaded to a daemon thread — uvicorn can
        # bind port 8000 and serve requests while memory warms up in the
        # background (~5-30 s on a cold cache, <1 s if already cached).
        self._qdrant_client = None
        self._collection: str = os.getenv("QDRANT_COLLECTION", "companion_memories")
        self._ready = False
        self._gemini_model = None
        self._glm = None
        self._groq_client = None   # for importance scoring
        self._anthropic_client = None  # for structured extraction (PDF: claude-haiku-4-5)
        self._init_lock = threading.Lock()
        self._memory_crud: Optional[Any] = None  # MemoryCRUD — set after Qdrant init

        # Emotional trend cache: user_id → (trend_text, timestamp)
        # Avoids redundant Groq LLM calls within the same session (~1 hour)
        self._emotional_trend_cache: Dict[str, Tuple[str, float]] = {}
        self._EMOTIONAL_TREND_CACHE_TTL_S: float = 3600.0  # 1 hour

        # Avoid starting heavyweight background init during pytest collection/execution.
        # The init thread loads large embedding models and opens network connections.
        if os.getenv("PYTEST_CURRENT_TEST"):
            logger.debug("[MEMORY] Pytest detected — skipping background init thread")
        else:
            logger.debug("[MEMORY] Spawning background init thread (memory-init)")
            threading.Thread(target=self._deferred_init, daemon=True, name="memory-init").start()

    # ── deferred (background) initialisation ─────────────────────────────

    def _init_qdrant_with_retry(self) -> Any:
        """Initialize Qdrant client with exponential backoff retry."""
        from qdrant_client import QdrantClient

        host = os.getenv("QDRANT_HOST", "localhost")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        url = (os.getenv("QDRANT_URL") or "").strip()
        api_key = (os.getenv("QDRANT_API_KEY") or "").strip() or None
        collection = os.getenv("QDRANT_COLLECTION", "companion_memories")
        self._collection = collection

        if url:
            qc = QdrantClient(url=url, api_key=api_key, timeout=5.0)
        else:
            qc = QdrantClient(host=host, port=port, api_key=api_key, timeout=5.0)
        # lightweight connectivity check
        qc.get_collections()
        return qc

    def _deferred_init(self) -> None:
        """
        Runs in a daemon thread.  Loads the local HuggingFace embedding model,
        connects to Qdrant, and initialises Gemini + GLM.
        Sets self._ready = True only when Qdrant + CRUD are operational.
        """
        with self._init_lock:
            # ── Qdrant + embedder + CRUD ─────────────────────────────────
            try:
                from ..core.embedder import get_embedding_service
                from ..core.memory_crud import MemoryCRUD

                get_embedding_service().ensure_loaded()
                self._qdrant_client = self._init_qdrant_with_retry()
                self._memory_crud = MemoryCRUD(self._qdrant_client, supabase_client)
                self._ready = True
                logger.info(
                    "✅ [MEMORY] Qdrant ready | collection=%s model=%s dims=%s",
                    self._collection,
                    EMBEDDING_MODEL,
                    EMBEDDING_DIMS,
                )

            except Exception as exc:
                logger.error("⚠️ [MEMORY] Qdrant init failed (memory disabled): %s", exc, exc_info=True)
                self._qdrant_client = None
                self._ready = False
                self._memory_crud = None

            # ── Gemini (session summaries) ─────────────────────────────────
            try:
                google_key = os.getenv("GOOGLE_API_KEY", "")
                if google_key:
                    genai.configure(api_key=google_key)
                    self._gemini_model = genai.GenerativeModel("gemini-2.5-flash-lite")
                    logger.info("✅ [MEMORY] Gemini ready for session summaries")
                else:
                    logger.debug("[MEMORY] GOOGLE_API_KEY not set — Gemini summaries disabled")
            except Exception as exc:
                logger.warning(f"⚠️ [MEMORY] Gemini init failed (summaries disabled): {exc}")

            # ── GLM (procedural memory synthesis) ─────────────────────────
            try:
                self._glm = LLMController()
                logger.info("✅ [MEMORY] GLM controller ready for procedural synthesis")
            except Exception as exc:
                logger.warning(f"⚠️ [MEMORY] GLM init failed (procedural synthesis disabled): {exc}")

            # ── Groq client (importance scoring + reflections) ────────────
            try:
                groq_key = os.getenv("GROQ_API_KEY", "")
                if groq_key:
                    from groq import Groq
                    self._groq_client = Groq(api_key=groq_key)
                    logger.info("✅ [MEMORY] Groq client ready for importance scoring")
                else:
                    logger.debug("[MEMORY] GROQ_API_KEY not set — importance scoring will use defaults")
            except Exception as exc:
                logger.warning(f"⚠️ [MEMORY] Groq client init failed (importance scoring disabled): {exc}")

            # ── Anthropic client (structured extraction) ──────────────────
            try:
                anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
                if anthropic_key:
                    from anthropic import Anthropic

                    self._anthropic_client = Anthropic(api_key=anthropic_key)
                    logger.info("✅ [MEMORY] Anthropic client ready for structured extraction")
                else:
                    logger.debug("[MEMORY] ANTHROPIC_API_KEY not set — structured extraction may be disabled")
            except Exception as exc:
                logger.warning(f"⚠️ [MEMORY] Anthropic init failed (structured extraction disabled): {exc}")

            logger.debug("[MEMORY] Background init thread finished (memory-init)")

    # ── public: add memories ──────────────────────────────────────────────


    def add_memories(
        self,
        messages: List[Dict[str, str]],
        user_id: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Extract and store memories from conversation messages.

        Legacy mem0.add path has been removed. Use add_structured instead.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            user_id:  Supabase user UUID.
            session_id: Current chat session ID (stored as metadata).
            metadata: Optional extra metadata dict (may contain "category", "source").

        Returns:
            {"results": [...]} on success, {"results": [], "error": "..."} on failure.
        """
        return {"results": [], "skipped": True, "error": "legacy_mem0_add_removed"}

    # ── structured pipeline (Patch 3 — not wired to orchestrator yet) ────

    def _fetch_recent_memories_for_structured(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Recent Qdrant payloads for this user (recency sort, best-effort)."""
        if not self._qdrant_client:
            return []
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            client = self._qdrant_client
            coll = self._collection
            fl = Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))])
            res, _ = client.scroll(
                collection_name=coll,
                scroll_filter=fl,
                limit=80,
                with_payload=True,
                with_vectors=False,
            )
            pts = sorted(
                res,
                key=lambda p: (p.payload or {}).get("created_at") or "",
                reverse=True,
            )[:limit]
            out: List[Dict[str, Any]] = []
            for p in pts:
                pl = dict(p.payload or {})
                out.append({"id": str(p.id), "data": pl.get("data", ""), "payload": pl})
            return out
        except Exception as exc:
            logger.warning("[MEMORY-STRUCT] fetch recent memories failed: %s", exc)
            return []

    def _structured_similarity_search(self, vector: List[float], user_id: str, k: int) -> List[Any]:
        if not self._qdrant_client:
            return []
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            fl = Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))])
            resp = self._qdrant_client.query_points(
                collection_name=self._collection,
                query=vector,
                query_filter=fl,
                limit=k,
                with_payload=True,
                with_vectors=False,
            )
            return list(getattr(resp, "points", []) or [])
        except Exception as exc:
            logger.warning("[MEMORY-STRUCT] similarity search failed: %s", exc)
            return []

    @staticmethod
    def _map_structured_type_to_db(memory_type: str) -> str:
        t = (memory_type or "").lower()
        if t in ("identity", "preference", "behavioral", "emotional", "contextual"):
            return t
        if t in ("procedural", "semantic", "episodic", "affective", "relational", "reflection", "crisis"):
            return t
        return "contextual"

    def add_structured(
        self,
        messages: List[Dict[str, str]],
        user_id: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Structured extraction → quality gate → Qdrant + Supabase.
        Canonical write path (mem0 removed).
        """
        empty = {"extracted": 0, "approved": 0, "rejected": 0, "contradictions": 0}
        if not self._ready or not self._qdrant_client:
            return {**empty, "error": "qdrant not initialised"}
        if not self._anthropic_client and not self._groq_client:
            return {**empty, "error": "no extraction client initialised"}
        if not self._memory_crud:
            return {**empty, "error": "memory crud not initialised"}

        from ..core.embedder import get_embedding_service
        from ..core.memory_extraction_providers import build_memory_extraction_provider
        from ..core.memory_pipeline_types import MemoryCandidate
        from ..core.quality_gate import QualityGate
        from ..core.signal_classifier import SignalClassifier

        import time as _time
        _t0 = _time.monotonic()
        logger.info(
            "💾 [MEMORY-WRITE] add_structured start | user=%s session=%s msgs=%d",
            str(user_id)[:12], str(session_id)[:8], len(messages),
        )

        sig = SignalClassifier().classify(messages, user_id)
        if not sig.is_memory_worthy:
            logger.info(
                "📭 [MEMORY-WRITE] Skipped — not memory-worthy | user=%s session=%s",
                str(user_id)[:12], str(session_id)[:8],
            )
            return empty

        extractor = build_memory_extraction_provider(
            groq_client=self._groq_client,
            anthropic_client=self._anthropic_client,
        )
        candidates = extractor.extract(messages, sig, user_id, session_id)
        extracted = len(candidates)
        logger.info(
            "🔍 [MEMORY-WRITE] Extraction complete | user=%s candidates=%d latency_ms=%.0f",
            str(user_id)[:12], extracted, (_time.monotonic() - _t0) * 1000,
        )

        existing = self._fetch_recent_memories_for_structured(user_id, 20)

        qg = QualityGate(
            embed_document=lambda t: get_embedding_service().embed(t, is_query=False),
            search_similar=self._structured_similarity_search,
        )
        qgr = qg.filter(candidates, user_id, existing)

        pending_pair_logs: List[Tuple[MemoryCandidate, str]] = []
        for cand, reason in qgr.contradictions:
            if reason.startswith("contradicts:"):
                parts = reason.split(":", 2)
                ex_id = parts[1] if len(parts) > 1 else None
                if ex_id:
                    pending_pair_logs.append((cand, ex_id))

        reinforced = 0
        for _cand, point_id in qgr.reinforce:
            try:
                self._memory_crud.reinforce(point_id)
                reinforced += 1
            except Exception as exc:
                logger.warning("[MEMORY-WRITE] reinforce failed id=%s: %s", point_id, exc)

        inserted = 0
        inserted_map: Dict[Tuple[str, str], str] = {}
        for cand in qgr.approved:
            try:
                nid = self._memory_crud.insert(cand, user_id, session_id)
                inserted += 1
                inserted_map[(cand.content, cand.verbatim_anchor)] = nid
                try:
                    self._memory_crud.log_audit(
                        user_id,
                        "memory_insert",
                        memory_id=nid,
                        detail={"type": cand.type, "session_id": session_id},
                    )
                except Exception:
                    pass
            except Exception as exc:
                logger.error("[MEMORY-WRITE] insert failed: %s", exc, exc_info=True)

        for cand, old_id in pending_pair_logs:
            key = (cand.content, cand.verbatim_anchor)
            if key in inserted_map:
                self._memory_crud.log_contradiction(old_id, inserted_map[key])

        def _has_pair_contradiction() -> bool:
            for _c, r in qgr.contradictions:
                if r == "possible_duplicate":
                    continue
                if isinstance(r, str) and r.startswith("contradicts:"):
                    return True
            return False

        try:
            if _has_pair_contradiction():
                self._memory_crud.merge_user_profile_patch(
                    user_id, {"memory_clarification_pending": True}
                )
            else:
                self._memory_crud.merge_user_profile_patch(
                    user_id, {"memory_clarification_pending": False}
                )
        except Exception as exc:
            logger.debug("[MEMORY-WRITE] profile contradiction flag merge failed: %s", exc)

        _total_ms = (_time.monotonic() - _t0) * 1000
        result = {
            "extracted": extracted,
            "approved": inserted + reinforced,
            "rejected": len(qgr.rejected),
            "contradictions": len(qgr.contradictions),
        }
        logger.info(
            "✅ [MEMORY-WRITE] add_structured complete | user=%s extracted=%d approved=%d "
            "rejected=%d contradictions=%d reinforced=%d total_ms=%.0f",
            str(user_id)[:12], extracted, result["approved"],
            result["rejected"], result["contradictions"], reinforced, _total_ms,
        )
        return result

    # ── public: retrieve memories ─────────────────────────────────────────


    def _score_importance_batch(self, memory_texts: List[str]) -> List[int]:
        """
        Score a batch of memory texts for importance (1–10) using Groq.

        Returns a list of integer scores in the same order as input.
        Falls back to default score of 5 on failure.
        """
        if not self._groq_client or not memory_texts:
            return [5] * len(memory_texts)

        try:
            numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(memory_texts))
            prompt = (
                "Rate the personal importance of each memory on a 1-10 scale "
                "for a companion AI that wants to deeply understand this person.\n\n"
                "Scale:\n"
                "1-2 = trivial daily details (e.g., 'user said hi')\n"
                "3-4 = minor preferences or routine facts\n"
                "5-6 = notable preferences, habits, or social context\n"
                "7-8 = significant life events, emotional struggles, or relationships\n"
                "9-10 = crisis, trauma, core identity, or deeply personal revelations\n\n"
                f"Memories:\n{numbered}\n\n"
                "Return ONLY a JSON array of integers, e.g. [5, 7, 3]. "
                "No other text."
            )

            response = self._groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",  # 1-10 integer scoring — 8b is sufficient, 88% cheaper
                messages=[
                    {"role": "system", "content": "You are a memory importance scorer. Return only a JSON array of integers."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=200,
            )

            raw = response.choices[0].message.content.strip()
            # Strip markdown code blocks if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            scores = json.loads(raw)

            if isinstance(scores, list) and len(scores) == len(memory_texts):
                # Clamp to 1-10
                return [max(1, min(10, int(s))) for s in scores]
            else:
                logger.warning(f"⚠️ [MEMORY] Importance scoring returned unexpected format: {raw}")
                return [5] * len(memory_texts)

        except Exception as exc:
            logger.warning(f"⚠️ [MEMORY] Importance scoring failed (using defaults): {exc}")
            return [5] * len(memory_texts)

    # ── metadata save with importance scoring ────────────────────────────


    def _score_and_save_metadata(
        self,
        user_id: str,
        results: List[Dict[str, Any]],
        session_id: Optional[str] = None,
        memory_type: str = "semantic",
    ) -> None:
        """
        Score importance for new memories via Groq, then save metadata
        to Supabase. Called from a background thread after add_memories.
        """
        if not supabase_client:
            return

        try:
            # Collect new ADD events
            new_memories = []
            for r in results:
                if r.get("id") and r.get("event") == "ADD":
                    new_memories.append(r)

            if not new_memories:
                return
            
            logger.info(f"🎯 [MEMORY-SCORING] Quantifying {len(new_memories)} new fact(s) for User {user_id[-6:]} via Groq")
            _t = time.monotonic()

            # Score importance for all new memories in one batch
            texts = [m.get("memory", "") for m in new_memories]
            scores = self._score_importance_batch(texts)

            # Override scores for special types
            if memory_type == "crisis":
                scores = [10] * len(scores)
            elif memory_type == "procedural":
                scores = [max(8, s) for s in scores]  # procedural ≥ 8

            # Insert metadata records
            now = datetime.now(timezone.utc).isoformat()
            records = []
            for mem, score in zip(new_memories, scores):
                records.append({
                    "user_id": user_id,
                    "mem0_id": mem["id"],
                    "category": "general" if memory_type == "semantic" else memory_type,
                    "importance": self._score_to_label(score),
                    "importance_score": score,
                    "memory_type": memory_type,
                    "last_accessed_at": now,
                    "source": "conversation",
                })

            if records:
                supabase_client.table("memory_metadata").insert(records).execute()
                logger.info(
                    f"✅ [MEMORY] Saved {len(records)} metadata records with importance "
                    f"scores: {scores}"
                )

            # Upsert user_memory_stats
            supabase_client.table("user_memory_stats").upsert(
                {
                    "user_id": user_id,
                    "total_memories": self._count_user_memories(user_id),
                    "last_extraction": now,
                    "session_count": self._count_user_sessions(user_id),
                    "updated_at": now,
                },
                on_conflict="user_id",
            ).execute()

        except Exception as exc:
            logger.error(f"❌ [MEMORY] _score_and_save_metadata failed: {exc}")

    @staticmethod
    def _score_to_label(score: int) -> str:
        """Map numeric importance_score (1–10) to a coarse label for Supabase."""
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

    def get_user_memory_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Return lightweight memory stats for a user.

        Returns {"total_memories": int, "last_extraction": str|None, "session_count": int}.
        """
        if not supabase_client:
            return {"total_memories": 0, "last_extraction": None, "session_count": 0}

        try:
            resp = (
                supabase_client.table("user_memory_stats")
                .select("total_memories, last_extraction, session_count")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

            if resp.data:
                row = resp.data[0]
                return {
                    "total_memories": row.get("total_memories", 0),
                    "last_extraction": row.get("last_extraction"),
                    "session_count": row.get("session_count", 0),
                }

            return {"total_memories": 0, "last_extraction": None, "session_count": 0}

        except Exception as exc:
            logger.error(f"❌ [MEMORY] get_user_memory_stats failed: {exc}")
            return {"total_memories": 0, "last_extraction": None, "session_count": 0}

    # ── public: get all memories ──────────────────────────────────────────


    def get_all_memories(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Return stored memories for a user (debug helper).

        Returns a list of memory dicts, or [] on failure.
        """
        if not self._ready or not self._qdrant_client:
            return []
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            fl = Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))])
            pts, _ = self._qdrant_client.scroll(
                collection_name=self._collection,
                scroll_filter=fl,
                limit=max(1, min(int(limit), 200)),
                with_payload=True,
                with_vectors=False,
            )
            out: List[Dict[str, Any]] = []
            for p in pts or []:
                out.append({"id": str(p.id), "memory": (p.payload or {}).get("data", ""), "payload": dict(p.payload or {})})
            return out
        except Exception as exc:
            logger.error("❌ [MEMORY] get_all_memories failed: %s", exc)
            return []

    # ── public: crisis importance override ────────────────────────────────


    def add_crisis_memory(self, user_id: str, message: str, session_id: Optional[str] = None) -> None:
        """
        Store a high-importance crisis memory.  Called from crisis fast-path.
        Runs in background — fire and forget.
        """
        if not self._ready:
            return

        if self._memory_crud:
            try:
                self._memory_crud.insert_restricted(
                    user_id,
                    message or "",
                    session_id=session_id,
                    structured_type="crisis",
                    source="D-crisis-warm",
                )
            except Exception as exc:
                logger.debug("[MEMORY] insert_restricted failed: %s", exc)

        if self._memory_crud and (message or "").strip():
            try:
                from ..core.memory_pipeline_types import MemoryCandidate

                det = LanguageDetector()
                anchor = (message or "").strip()[:200]
                cand = MemoryCandidate(
                    type="emotional",
                    content=(message or "").strip()[:4000],
                    verbatim_anchor=anchor,
                    confidence=1.0,
                    emotional_valence=-0.6,
                    emotional_intensity=0.95,
                    tags=["crisis"],
                    is_sensitive=True,
                    language=det.detect(message),
                    is_resolved=False,
                    category="crisis",
                )
                mid = self._memory_crud.insert(
                    cand,
                    user_id,
                    session_id or "crisis",
                )
                self._memory_crud.log_audit(
                    user_id,
                    "crisis_memory_structured",
                    memory_id=mid,
                    detail={"session_id": session_id},
                )
                logger.info("✅ [MEMORY] Crisis memory saved (structured)")
            except Exception as exc:
                logger.error("❌ [MEMORY] add_crisis_memory structured failed: %s", exc)
                try:
                    if supabase_client:
                        supabase_client.table("crisis_dead_letter").insert(
                            {
                                "user_id": user_id,
                                "session_id": session_id,
                                "component": "memory_store",
                                "action": "insert_crisis_memory_structured",
                                "error": str(exc),
                                "detail": {"source": "D-crisis-warm"},
                            }
                        ).execute()
                except Exception:
                    pass

    # ── public: procedural memory synthesis ───────────────────────────────


    def _count_user_memories(self, user_id: str) -> int:
        """Count total memories for a user (Supabase mirror)."""
        if not supabase_client:
            return 0
        try:
            resp = (
                supabase_client.table("memory_metadata")
                .select("mem0_id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            return int(resp.count or 0)
        except Exception:
            return 0


    def _count_user_sessions(self, user_id: str) -> int:
        """Count distinct sessions in session_summaries for a user."""
        if not supabase_client:
            return 0
        try:
            resp = (
                supabase_client.table("session_summaries")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            return resp.count if hasattr(resp, "count") else 0
        except Exception:
            return 0


    @property
    def is_ready(self) -> bool:
        """True if Qdrant is initialised and reachable."""
        return self._ready

    @property
    def memory_crud(self) -> Optional[Any]:
        """Structured-memory CRUD (None until Qdrant init succeeds)."""
        return self._memory_crud


