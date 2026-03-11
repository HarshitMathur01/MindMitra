"""
MemoryManager — mem0 + Qdrant powered memory layer for MindMitra.

Replaces the legacy Gemini-based memory_architecture.py with a vector-first
approach:  mem0 handles fact extraction + deduplication + vector storage,
while Supabase stores session summaries and lightweight metadata.

All public methods are **sync** and designed to be called from background
threads — they must NEVER block the FastAPI request/response path.

Every method is wrapped in try/except so a memory failure cannot crash the
chat pipeline.
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import google.generativeai as genai

from ..controllers.glm_controller import GLMController
from ..services.supabase_service import supabase_client

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
# MemoryManager
# ════════════════════════════════════════════════════════════════════════════

class MemoryManager:
    """
    Singleton (module-level instance at bottom of file) providing:
      • add_memories      — background extraction from conversation turns
      • retrieve_memories — fetch relevant context for the current message
      • save_session_summary — end-of-session summarisation (Gemini)
      • load_session_summary — hydrate session context on reconnect
      • get_user_memory_stats — lightweight stats for admin/debug
    """

    # ── initialisation ────────────────────────────────────────────────────

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
        self._init_lock = threading.Lock()

        logger.debug("[MEMORY] Spawning background init thread (mem0-init)")
        threading.Thread(target=self._deferred_init, daemon=True, name="mem0-init").start()

    # ── deferred (background) initialisation ─────────────────────────────

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
                    self._mem0 = Memory.from_config(mem0_config)
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
                self._glm = GLMController()
                logger.info("✅ [MEMORY] GLM controller ready for procedural synthesis")
            except Exception as exc:
                logger.warning(f"⚠️ [MEMORY] GLM init failed (procedural synthesis disabled): {exc}")

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

        This calls mem0.add() which uses OpenAI to extract facts from the
        conversation, deduplicates against existing memories, and upserts
        to Qdrant.  Should ALWAYS be called from a background thread.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            user_id:  Supabase user UUID.
            session_id: Current chat session ID (stored as metadata).
            metadata: Optional extra metadata dict.

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
            meta["source"] = "conversation"

            result = self._mem0.add(
                messages=messages,
                user_id=user_id,
                metadata=meta,
            )

            elapsed = (time.monotonic() - _t) * 1000
            count = len(result.get("results", []))
            logger.info(f"✅ [MEMORY] add_memories: {count} memories in {elapsed:.0f}ms")

            # Fire-and-forget: update stats + save metadata to Supabase
            if count > 0:
                threading.Thread(
                    target=self._save_memory_metadata,
                    args=(user_id, result.get("results", []), session_id),
                    daemon=True,
                ).start()

            return result

        except Exception as exc:
            logger.error(f"❌ [MEMORY] add_memories failed: {exc}")
            return {"results": [], "error": str(exc)}

    # ── public: retrieve memories ─────────────────────────────────────────

    def retrieve_memories(
        self,
        query: str,
        user_id: str,
        intent: str = "emotional",
        limit: int = 5,
        threshold: float = 0.3,
    ) -> str:
        """
        Search mem0 for memories relevant to the current user message.

        Returns a formatted string ready to be injected into the system prompt
        as {memory_context}.  Returns "" on failure or when nothing is found.

        Args:
            query:     The user's current message text.
            user_id:   Supabase user UUID.
            intent:    Router intent (casual/emotional/therapeutic/crisis).
            limit:     Max results to return.
            threshold: Minimum similarity score.

        Returns:
            A formatted context string, or "".
        """
        if not self._ready or not self._mem0:
            return ""

        try:
            _t = time.monotonic()

            # Adjust retrieval depth based on intent
            if intent == "casual":
                limit = 2
            elif intent == "crisis":
                limit = 3
            elif intent == "therapeutic":
                limit = 7

            results = self._mem0.search(
                query=query,
                user_id=user_id,
                limit=limit,
            )

            memories = results.get("results", [])

            # Filter by threshold
            memories = [m for m in memories if m.get("score", 0) >= threshold]

            elapsed = (time.monotonic() - _t) * 1000
            logger.info(
                f"✅ [MEMORY] retrieve_memories: {len(memories)} results "
                f"(intent={intent}, threshold={threshold}) in {elapsed:.0f}ms"
            )

            if not memories:
                return ""

            return self._format_memory_context(memories)

        except Exception as exc:
            logger.error(f"❌ [MEMORY] retrieve_memories failed: {exc}")
            return ""

    # ── public: session summaries ─────────────────────────────────────────

    def save_session_summary(
        self,
        user_id: str,
        session_id: str,
        messages: List[Dict[str, str]],
    ) -> bool:
        """
        Generate a session summary via Gemini and save to Supabase.

        Should be called at end-of-session (or periodically).  Runs in a
        background thread — never blocks the response path.

        Returns True on success, False on failure.
        """
        if not self._gemini_model:
            logger.warning("⚠️ [MEMORY] Gemini unavailable — skipping session summary")
            return False

        try:
            _t = time.monotonic()

            # Format conversation for Gemini
            conv_text = "\n".join(
                f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
                for m in messages[-30:]  # last 30 messages max
            )

            prompt = (
                "Summarise this therapy conversation in 3-5 sentences. "
                "Focus on: key themes discussed, emotional progression, "
                "coping strategies mentioned, and any action items.\n\n"
                "Also extract:\n"
                '- themes: a JSON array of 3-5 key theme strings\n'
                '- emotional_arc: a JSON array of emotion labels in chronological order\n\n'
                "Return ONLY valid JSON:\n"
                "{\n"
                '  "summary": "<3-5 sentence summary>",\n'
                '  "themes": ["theme1", "theme2", ...],\n'
                '  "emotional_arc": ["emotion1", "emotion2", ...]\n'
                "}\n\n"
                f"Conversation:\n{conv_text}"
            )

            response = self._gemini_model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=500,
                ),
            )

            raw = response.text.strip()
            # Strip markdown code blocks if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            parsed = json.loads(raw)
            summary_text = parsed.get("summary", raw)
            themes = parsed.get("themes", [])
            emotional_arc = parsed.get("emotional_arc", [])

            # Upsert to Supabase
            if supabase_client:
                supabase_client.table("session_summaries").upsert(
                    {
                        "user_id": user_id,
                        "session_id": session_id,
                        "summary_text": summary_text,
                        "themes": json.dumps(themes),
                        "emotional_arc": json.dumps(emotional_arc),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    on_conflict="session_id",
                ).execute()

            elapsed = (time.monotonic() - _t) * 1000
            logger.info(f"✅ [MEMORY] Session summary saved in {elapsed:.0f}ms")
            return True

        except Exception as exc:
            logger.error(f"❌ [MEMORY] save_session_summary failed: {exc}")
            return False

    def load_session_summary(self, session_id: str) -> Dict[str, Any]:
        """
        Load the most recent session summary from Supabase.

        Returns {"summary": "...", "themes": [...], "emotional_arc": [...]}
        or an empty dict on failure.
        """
        if not supabase_client or not session_id:
            return {}

        try:
            resp = (
                supabase_client.table("session_summaries")
                .select("summary_text, themes, emotional_arc")
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )

            if not resp.data:
                return {}

            row = resp.data[0]
            themes = row.get("themes", "[]")
            emotional_arc = row.get("emotional_arc", "[]")

            # Parse JSON strings if stored as text
            if isinstance(themes, str):
                try:
                    themes = json.loads(themes)
                except (json.JSONDecodeError, TypeError):
                    themes = []
            if isinstance(emotional_arc, str):
                try:
                    emotional_arc = json.loads(emotional_arc)
                except (json.JSONDecodeError, TypeError):
                    emotional_arc = []

            return {
                "summary": row.get("summary_text", ""),
                "themes": themes,
                "emotional_arc": emotional_arc,
            }

        except Exception as exc:
            logger.error(f"❌ [MEMORY] load_session_summary failed: {exc}")
            return {}

    # ── public: stats ─────────────────────────────────────────────────────

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

    def synthesize_procedural_memory(
        self,
        user_id: str,
        topic: str,
        messages: List[Dict[str, str]],
    ) -> Optional[str]:
        """
        Use GLM to synthesize a procedural memory from conversation about
        coping strategies, techniques, or action plans.

        Returns the procedural memory text, or None on failure.
        """
        if not self._glm:
            return None

        try:
            conv_text = "\n".join(
                f"{m.get('role', 'user').capitalize()}: {m.get('content', '')[:200]}"
                for m in messages[-10:]
            )

            prompt = (
                "Extract a concise procedural memory from this therapy conversation. "
                "Focus on coping strategies, techniques, or action plans discussed. "
                f"Topic: {topic}\n\n"
                f"Conversation:\n{conv_text}\n\n"
                "Return ONLY the procedural memory as a single paragraph (2-3 sentences). "
                "Start with an action verb."
            )

            resp = self._glm.invoke([
                {"role": "system", "content": "You are a memory extraction assistant."},
                {"role": "user", "content": prompt},
            ])

            if resp and resp.content:
                procedural_text = resp.content.strip()

                # Store as a procedural-type memory in mem0
                if self._ready and self._mem0:
                    self._mem0.add(
                        messages=[{"role": "assistant", "content": procedural_text}],
                        user_id=user_id,
                        metadata={
                            "category": "procedural",
                            "topic": topic,
                            "source": "glm_synthesis",
                            "importance": "high",
                        },
                    )

                logger.info(f"✅ [MEMORY] Procedural memory synthesized: {procedural_text[:80]}...")
                return procedural_text

        except Exception as exc:
            logger.error(f"❌ [MEMORY] synthesize_procedural_memory failed: {exc}")

        return None

    # ── internal helpers ──────────────────────────────────────────────────

    def _format_memory_context(self, memories: List[Dict[str, Any]]) -> str:
        """
        Format retrieved memories into a context block for the system prompt.

        Produces a human-readable block like:
            RELEVANT MEMORIES ABOUT THIS USER:
            • Feels anxious about college entrance exams (relevance: 0.87)
            • Practices deep breathing when stressed (relevance: 0.74)
        """
        if not memories:
            return ""

        lines = ["RELEVANT MEMORIES ABOUT THIS USER:"]
        for m in memories:
            text = m.get("memory", "")
            score = m.get("score", 0)
            if text:
                lines.append(f"• {text} (relevance: {score:.2f})")

        return "\n".join(lines)

    def _save_memory_metadata(
        self,
        user_id: str,
        results: List[Dict[str, Any]],
        session_id: Optional[str] = None,
    ) -> None:
        """
        Save memory metadata to Supabase and update user_memory_stats.
        Called from a background thread after add_memories succeeds.
        """
        if not supabase_client:
            return

        try:
            # Insert individual memory metadata records
            records = []
            for r in results:
                mem_id = r.get("id", "")
                event = r.get("event", "")
                if mem_id and event == "ADD":
                    records.append({
                        "user_id": user_id,
                        "mem0_id": mem_id,
                        "category": "general",
                        "importance": "medium",
                        "source": "conversation",
                    })

            if records:
                supabase_client.table("memory_metadata").insert(records).execute()

            # Upsert user_memory_stats
            now = datetime.now(timezone.utc).isoformat()
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
            logger.error(f"❌ [MEMORY] _save_memory_metadata failed: {exc}")

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


# ════════════════════════════════════════════════════════════════════════════
# Module-level singleton
# ════════════════════════════════════════════════════════════════════════════
memory_manager = MemoryManager()
