import json
import logging
import math
import os
import threading
import time
from tenacity import retry, stop_after_attempt, wait_random_exponential, before_sleep_log
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai

from ..controllers.llm_controller import LLMController
from ..services.supabase_service import supabase_client

logger = logging.getLogger(__name__)

class MemoryStore:
    def __init__(self) -> None:
        # Return immediately with safe defaults so the module-level singleton
        # (bottom of this file) resolves in microseconds.  The sentence-
        # transformers model load (~90 MB), Qdrant connection, Gemini init,
        # and GLM init are all offloaded to a daemon thread — uvicorn can
        # bind port 8000 and serve requests while memory warms up in the
        # background (~5-30 s on a cold cache, <1 s if already cached).
        self._mem0 = None       # type: ignore[assignment]
        self._ready = False
        self._gemini_model = None
        self._glm = None
        self._groq_client = None   # for importance scoring
        self._init_lock = threading.Lock()

        # Emotional trend cache: user_id → (trend_text, timestamp)
        # Avoids redundant Groq LLM calls within the same session (~1 hour)
        self._emotional_trend_cache: Dict[str, Tuple[str, float]] = {}
        self._EMOTIONAL_TREND_CACHE_TTL_S: float = 3600.0  # 1 hour

        logger.debug("[MEMORY] Spawning background init thread (mem0-init)")
        threading.Thread(target=self._deferred_init, daemon=True, name="mem0-init").start()

    # ── deferred (background) initialisation ─────────────────────────────

    def _init_mem0_with_retry(self, config):
        """
        Initialize mem0 with exponential backoff retry.
        Handles cases where Qdrant is still starting (common in Railway deployments).
        """
        from mem0 import Memory
        return Memory.from_config(config)

    def _deferred_init(self) -> None:
        """
        Runs in a daemon thread.  Loads the local HuggingFace embedding model,
        connects to Qdrant via mem0, and initialises Gemini + GLM.
        Sets self._ready = True only when mem0 is fully operational.
        """
        with self._init_lock:
            # ── mem0 + Qdrant (Groq LLM + local HuggingFace embedder) ──────
            try:
                from mem0 import Memory  # lazy — fails gracefully if not installed

                qdrant_host = os.getenv("QDRANT_HOST", "localhost")
                qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))
                collection = os.getenv("QDRANT_COLLECTION", "companion_memories")
                groq_key = os.getenv("GROQ_API_KEY", "")

                if not groq_key:
                    logger.warning("⚠️ [MEMORY] GROQ_API_KEY not set — mem0 disabled")
                else:
                    mem0_config = {
                        "version": "v1.1",
                        "llm": {
                            # Groq: fast + zero-cost for fact extraction
                            "provider": "groq",
                            "config": {
                                "model": "llama-3.3-70b-versatile",
                                "temperature": 0.1,
                                "max_tokens": 2000,
                            },
                        },
                        "embedder": {
                            # Local sentence-transformers model — no API, 384-dim.
                            # Loaded here in the background thread so startup is
                            # never blocked by the ~90 MB model download/load.
                            "provider": "huggingface",
                            "config": {
                                "model": "sentence-transformers/all-MiniLM-L6-v2",
                                "embedding_dims": 384,
                            },
                        },
                        "vector_store": {
                            "provider": "qdrant",
                            "config": {
                                "host": qdrant_host,
                                "port": qdrant_port,
                                "collection_name": collection,
                                # Must be set explicitly — mem0 only auto-propagates
                                # embedding_dims → embedding_model_dims when graph_store
                                # is in config AND vector_store is absent. Since we
                                # always provide vector_store, we set it manually.
                                "embedding_model_dims": 384,
                            },
                        },
                    }

                    logger.debug(
                        f"[MEMORY] Calling Memory.from_config() — loading "
                        f"all-MiniLM-L6-v2 + connecting Qdrant @ {qdrant_host}:{qdrant_port}"
                    )
                    self._mem0 = self._init_mem0_with_retry(mem0_config)
                    self._ready = True
                    logger.info(
                        f"✅ [MEMORY] MemoryManager ready — Qdrant @ {qdrant_host}:{qdrant_port}, "
                        f"collection={collection}"
                    )

            except Exception as exc:
                logger.error(f"⚠️ [MEMORY] mem0 init failed (memory disabled): {exc}", exc_info=True)
                self._mem0 = None
                self._ready = False

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

            logger.debug("[MEMORY] Background init thread finished (mem0-init)")

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

        This calls mem0.add() which uses Groq to extract facts from the
        conversation, deduplicates against existing memories, and upserts
        to Qdrant.  Should ALWAYS be called from a background thread.

        After extraction, LLM-based importance scoring is applied to each
        new memory and metadata is persisted to Supabase.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            user_id:  Supabase user UUID.
            session_id: Current chat session ID (stored as metadata).
            metadata: Optional extra metadata dict (may contain "category", "source").

        Returns:
            {"results": [...]} on success, {"results": [], "error": "..."} on failure.
        """
        if not self._ready or not self._mem0:
            return {"results": [], "error": "mem0 not initialised"}

        try:
            _t = time.monotonic()

            # Build metadata payload
            meta = metadata.copy() if metadata else {}
            if session_id:
                meta["session_id"] = session_id
            meta.setdefault("source", "conversation")

            result = self._mem0.add(
                messages=messages,
                user_id=user_id,
                metadata=meta,
            )

            elapsed = (time.monotonic() - _t) * 1000
            count = len(result.get("results", []))
            logger.info(f"✅ [MEMORY] add_memories: {count} memories in {elapsed:.0f}ms")

            # Fire-and-forget: importance scoring + metadata save to Supabase
            if count > 0:
                # Determine memory_type from metadata
                category = meta.get("category", "general")
                memory_type = "semantic"  # default
                if category == "procedural":
                    memory_type = "procedural"
                elif category == "crisis":
                    memory_type = "crisis"

                threading.Thread(
                    target=self._score_and_save_metadata,
                    args=(user_id, result.get("results", []), session_id, memory_type),
                    daemon=True,
                ).start()

            return result

        except Exception as exc:
            logger.error(f"❌ [MEMORY] add_memories failed: {exc}")
            return {"results": [], "error": str(exc)}

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
                model="llama-3.3-70b-versatile",
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
        Return all stored memories for a user from mem0.

        Returns a list of memory dicts, or [] on failure.
        """
        if not self._ready or not self._mem0:
            return []

        try:
            result = self._mem0.get_all(user_id=user_id, limit=limit)
            return result.get("results", [])
        except Exception as exc:
            logger.error(f"❌ [MEMORY] get_all_memories failed: {exc}")
            return []

    # ── public: crisis importance override ────────────────────────────────


    def add_crisis_memory(self, user_id: str, message: str, session_id: Optional[str] = None) -> None:
        """
        Store a high-importance crisis memory.  Called from crisis fast-path.
        Runs in background — fire and forget.
        """
        if not self._ready or not self._mem0:
            return

        try:
            meta = {
                "importance": "critical",
                "category": "crisis",
                "source": "crisis_fast_path",
            }
            if session_id:
                meta["session_id"] = session_id

            self._mem0.add(
                messages=[{"role": "user", "content": message}],
                user_id=user_id,
                metadata=meta,
            )
            logger.info("✅ [MEMORY] Crisis memory saved")
        except Exception as exc:
            logger.error(f"❌ [MEMORY] add_crisis_memory failed: {exc}")

    # ── public: procedural memory synthesis ───────────────────────────────


    def _count_user_memories(self, user_id: str) -> int:
        """Count total memories for a user in mem0."""
        if not self._ready or not self._mem0:
            return 0
        try:
            result = self._mem0.get_all(user_id=user_id, limit=1000)
            return len(result.get("results", []))
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
        """True if mem0 is initialised and Qdrant is reachable."""
        return self._ready


