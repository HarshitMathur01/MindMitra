"""
MemoryManager — mem0 + Qdrant powered memory layer for MindMitra.

Implements a Generative-Agents-inspired memory system with:
  • Composite retrieval scoring (recency × importance × relevance)
  • LLM-based importance scoring at extraction time
  • Procedural memory synthesis + always-inject for therapeutic paths
  • Reflection/synthesis layer for deepening companion bond
  • Emotional continuity tracking across sessions
  • Structured memory injection (semantic / procedural / reflection sections)

All public methods are **sync** and designed to be called from background
threads — they must NEVER block the FastAPI request/response path.

Every method is wrapped in try/except so a memory failure cannot crash the
chat pipeline.
"""

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

from ..controllers.glm_controller import GLMController
from ..services.supabase_service import supabase_client
from ..utils.constants import (
    MEMORY_OVERFETCH_LIMIT,
    MEMORY_LIMIT_CASUAL,
    MEMORY_LIMIT_EMOTIONAL,
    MEMORY_LIMIT_THERAPEUTIC,
    MEMORY_LIMIT_CRISIS,
    RECENCY_DECAY_RATE,
    SCORE_WEIGHT_RECENCY,
    SCORE_WEIGHT_IMPORTANCE,
    SCORE_WEIGHT_RELEVANCE,
    MEMORY_RELEVANCE_THRESHOLD,
    REFLECTION_INTERVAL_SESSIONS,
    REFLECTION_MAX_INSIGHTS,
    REFLECTION_MEMORY_FETCH_LIMIT,
    EMOTIONAL_TREND_SESSIONS,
)

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
# MemoryManager
# ════════════════════════════════════════════════════════════════════════════

class MemoryManager:
    """
    Singleton (module-level instance at bottom of file) providing:
      • add_memories           — background extraction + importance scoring
      • retrieve_memories      — composite-scored retrieval (recency × importance × relevance)
      • save_session_summary   — end-of-session summarisation (Gemini)
      • load_session_summary   — hydrate session context on reconnect
      • synthesize_procedural_memory — extract coping strategies from therapeutic conversations
      • generate_reflections   — periodic higher-level insight synthesis
      • get_emotional_trend    — cross-session emotional continuity
      • get_user_memory_stats  — lightweight stats for admin/debug
    """

    # ── Intent → retrieval limit mapping ──────────────────────────────────
    _INTENT_LIMITS = {
        "casual": MEMORY_LIMIT_CASUAL,
        "emotional": MEMORY_LIMIT_EMOTIONAL,
        "therapeutic": MEMORY_LIMIT_THERAPEUTIC,
        "crisis": MEMORY_LIMIT_CRISIS,
    }

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
        self._groq_client = None   # for importance scoring
        self._init_lock = threading.Lock()

        # Emotional trend cache: user_id → (trend_text, timestamp)
        # Avoids redundant Groq LLM calls within the same session (~1 hour)
        self._emotional_trend_cache: Dict[str, Tuple[str, float]] = {}
        self._EMOTIONAL_TREND_CACHE_TTL_S: float = 3600.0  # 1 hour

        logger.debug("[MEMORY] Spawning background init thread (mem0-init)")
        threading.Thread(target=self._deferred_init, daemon=True, name="mem0-init").start()

    # ── deferred (background) initialisation ─────────────────────────────
    @retry(
        stop=stop_after_attempt(10),
        wait=wait_random_exponential(multiplier=1, max=30),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
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
                self._glm = GLMController()
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

    def retrieve_memories(
        self,
        query: str,
        user_id: str,
        intent: str = "emotional",
        limit: int = 5,
        threshold: float = 0.3,
    ) -> str:
        """
        Search mem0 for memories relevant to the current user message, then
        re-rank using composite scoring: recency × importance × relevance.

        Returns a structured, formatted string for system prompt injection
        with separate sections for semantic, procedural, and reflection memories.

        Returns "" on failure or when nothing is found.

        Scoring formula (Generative Agents inspired):
            score = α_v · relevance + α_i · importance + α_r · recency
        Where:
            relevance  = cosine similarity from mem0 (0–1)
            importance = importance_score / 10 from Supabase (0–1)
            recency    = 0.999^hours_since_last_access (exponential decay)
        """
        if not self._ready or not self._mem0:
            return ""

        try:
            _t = time.monotonic()

            # ── Step 1: Over-fetch from mem0 (pure vector similarity) ────
            results = self._mem0.search(
                query=query,
                user_id=user_id,
                limit=MEMORY_OVERFETCH_LIMIT,
            )
            raw_memories = results.get("results", [])

            if not raw_memories:
                logger.info(f"✅ [MEMORY] retrieve_memories: 0 results (intent={intent})")
                return ""

            # ── Step 2: Fetch metadata from Supabase for scoring ─────────
            metadata_map = self._fetch_metadata_for_scoring(user_id)

            # ── Step 3: Compute composite scores ─────────────────────────
            now = datetime.now(timezone.utc)
            scored_memories: List[Tuple[float, Dict[str, Any], str]] = []

            for m in raw_memories:
                mem_id = m.get("id", "")
                relevance = m.get("score", 0.0)
                meta = metadata_map.get(mem_id, {})

                # Importance: normalize to 0–1
                imp_score = meta.get("importance_score", 5)
                importance = imp_score / 10.0

                # Recency: exponential decay based on hours since last access
                last_accessed = meta.get("last_accessed_at")
                if last_accessed:
                    if isinstance(last_accessed, str):
                        try:
                            last_accessed = datetime.fromisoformat(last_accessed.replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            last_accessed = now
                    hours_elapsed = max(0, (now - last_accessed).total_seconds() / 3600)
                else:
                    hours_elapsed = 0  # new memory, no decay

                recency = math.pow(RECENCY_DECAY_RATE, hours_elapsed)

                # Composite score
                composite = (
                    SCORE_WEIGHT_RELEVANCE * relevance
                    + SCORE_WEIGHT_IMPORTANCE * importance
                    + SCORE_WEIGHT_RECENCY * recency
                )

                memory_type = meta.get("memory_type", "semantic")
                scored_memories.append((composite, m, memory_type))

            # ── Step 4: Sort by composite score, apply intent-based limit ─
            scored_memories.sort(key=lambda x: x[0], reverse=True)
            final_limit = self._INTENT_LIMITS.get(intent, MEMORY_LIMIT_EMOTIONAL)

            # Separate by type for structured injection
            semantic_memories = []
            procedural_memories = []
            reflection_memories = []

            for composite_score, mem, mtype in scored_memories:
                if composite_score < MEMORY_RELEVANCE_THRESHOLD:
                    continue

                entry = {
                    **mem,
                    "composite_score": composite_score,
                    "memory_type": mtype,
                }

                if mtype == "procedural":
                    procedural_memories.append(entry)
                elif mtype == "reflection":
                    reflection_memories.append(entry)
                else:  # semantic, crisis, general
                    if len(semantic_memories) < final_limit:
                        semantic_memories.append(entry)

            # For therapeutic/crisis intents, always include ALL procedural memories
            if intent in ("therapeutic", "crisis"):
                pass  # keep all procedural memories
            else:
                procedural_memories = procedural_memories[:2]  # cap for casual/emotional

            # Always include ALL reflections (they represent deep understanding)
            # but cap at REFLECTION_MAX_INSIGHTS
            reflection_memories = reflection_memories[:REFLECTION_MAX_INSIGHTS]

            total = len(semantic_memories) + len(procedural_memories) + len(reflection_memories)

            elapsed = (time.monotonic() - _t) * 1000
            logger.info(
                f"✅ [MEMORY] retrieve_memories: {total} results "
                f"(semantic={len(semantic_memories)}, procedural={len(procedural_memories)}, "
                f"reflections={len(reflection_memories)}, intent={intent}) in {elapsed:.0f}ms"
            )

            if total == 0:
                return ""

            # ── Step 5: Update last_accessed_at for retrieved memories ────
            accessed_ids = [
                m.get("id", "")
                for _, m, _ in scored_memories[:total]
                if m.get("id")
            ]
            if accessed_ids:
                threading.Thread(
                    target=self._update_access_timestamps,
                    args=(accessed_ids,),
                    daemon=True,
                ).start()

            # ── Step 6: Format into structured sections ──────────────────
            return self._format_structured_memory_context(
                semantic_memories, procedural_memories, reflection_memories
            )

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

    # ── structured memory formatting ─────────────────────────────────────

    def _format_structured_memory_context(
        self,
        semantic: List[Dict],
        procedural: List[Dict],
        reflections: List[Dict],
    ) -> str:
        """
        Format memories into structured sections for the system prompt.

        Produces:
            🧠 WHAT YOU KNOW ABOUT THIS USER:
            • Fact (importance: high)

            💡 COPING STRATEGIES THAT WORK FOR THEM:
            • Strategy

            🔮 YOUR UNDERSTANDING OF THIS USER:
            • Deep insight
        """
        sections = []

        if semantic:
            lines = ["🧠 WHAT YOU KNOW ABOUT THIS USER:"]
            for m in semantic:
                text = m.get("memory", "")
                score = m.get("composite_score", 0)
                if text:
                    lines.append(f"• {text} (score: {score:.2f})")
            sections.append("\n".join(lines))

        if procedural:
            lines = ["💡 COPING STRATEGIES THAT WORK FOR THEM:"]
            for m in procedural:
                text = m.get("memory", "")
                if text:
                    lines.append(f"• {text}")
            sections.append("\n".join(lines))

        if reflections:
            lines = ["🔮 YOUR UNDERSTANDING OF THIS USER:"]
            for m in reflections:
                text = m.get("memory", "")
                if text:
                    lines.append(f"• {text}")
            sections.append("\n".join(lines))

        return "\n\n".join(sections)

    # ── importance scoring via Groq ──────────────────────────────────────

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
    def _score_to_label(score: int) -> str:
        """Convert numeric score to legacy text label for backward compat."""
        if score >= 9:
            return "critical"
        elif score >= 7:
            return "high"
        elif score >= 4:
            return "medium"
        return "low"

    # ── metadata fetch for composite scoring ─────────────────────────────

    def _fetch_metadata_for_scoring(self, user_id: str) -> Dict[str, Dict]:
        """
        Fetch all memory_metadata for a user from Supabase.
        Returns a dict keyed by mem0_id → {importance_score, last_accessed_at, memory_type}.
        """
        if not supabase_client:
            return {}

        try:
            resp = (
                supabase_client.table("memory_metadata")
                .select("mem0_id, importance_score, last_accessed_at, memory_type")
                .eq("user_id", user_id)
                .execute()
            )

            result = {}
            for row in (resp.data or []):
                result[row["mem0_id"]] = {
                    "importance_score": row.get("importance_score", 5),
                    "last_accessed_at": row.get("last_accessed_at"),
                    "memory_type": row.get("memory_type", "semantic"),
                }
            return result

        except Exception as exc:
            logger.error(f"❌ [MEMORY] _fetch_metadata_for_scoring failed: {exc}")
            return {}

    # ── access timestamp update ──────────────────────────────────────────

    def _update_access_timestamps(self, mem0_ids: List[str]) -> None:
        """Update last_accessed_at for retrieved memories (background)."""
        if not supabase_client or not mem0_ids:
            return
        try:
            now = datetime.now(timezone.utc).isoformat()
            supabase_client.table("memory_metadata").update(
                {"last_accessed_at": now}
            ).in_("mem0_id", mem0_ids).execute()
        except Exception as exc:
            logger.error(f"❌ [MEMORY] _update_access_timestamps failed: {exc}")

    # ── reflection / synthesis layer ─────────────────────────────────────

    def generate_reflections(self, user_id: str) -> Optional[List[str]]:
        """
        Generate higher-level reflective insights about a user by synthesizing
        their top memories and session summaries.

        Inspired by Generative Agents: "synthesize memories into higher level
        reflections over time and guide the agent's future behavior."

        Stores reflections as memories with memory_type='reflection' and
        importance_score=9 so they are always included in future retrievals.

        Returns the list of reflection strings, or None on failure.
        """
        if not self._groq_client:
            logger.warning("⚠️ [MEMORY] Groq unavailable — skipping reflection generation")
            return None

        try:
            _t = time.monotonic()

            # Fetch top memories by importance
            top_memories = self._fetch_top_memories_for_reflection(user_id)
            if len(top_memories) < 3:
                logger.info("[MEMORY] Not enough memories for reflection (need ≥3)")
                return None

            # Fetch all session summaries
            session_data = self._fetch_all_session_summaries(user_id)

            # Build the reflection prompt
            mem_text = "\n".join(f"- {m}" for m in top_memories)
            session_text = ""
            if session_data:
                session_lines = []
                for s in session_data:
                    themes = s.get("themes", [])
                    arc = s.get("emotional_arc", [])
                    summary = s.get("summary_text", "")
                    session_lines.append(
                        f"  Session: {summary[:200]}\n"
                        f"    Themes: {themes}\n"
                        f"    Emotional arc: {arc}"
                    )
                session_text = "\n".join(session_lines)

            prompt = (
                "You are a deeply empathetic AI companion reflecting on everything you know "
                "about this person. Based on the memories and session history below, generate "
                f"{REFLECTION_MAX_INSIGHTS} deep insights about this person.\n\n"
                "Focus on:\n"
                "- Recurring emotional patterns (what keeps coming up?)\n"
                "- Core values and what matters most to them\n"
                "- Growth and positive changes over time\n"
                "- Unresolved struggles or recurring pain points\n"
                "- What makes them feel safe, understood, and connected\n"
                "- Relationship dynamics and family patterns\n\n"
                "Each insight should be one sentence, written as YOUR observation about them. "
                "Use phrases like 'This person...' or 'They tend to...' or 'A recurring pattern is...'\n\n"
                f"MEMORIES (most important):\n{mem_text}\n\n"
            )
            if session_text:
                prompt += f"SESSION HISTORY:\n{session_text}\n\n"
            prompt += (
                f"Return ONLY a JSON array of {REFLECTION_MAX_INSIGHTS} strings. "
                "No other text."
            )

            response = self._groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a reflective memory synthesis agent. Return only a JSON array of insight strings."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=600,
            )

            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            reflections = json.loads(raw)
            if not isinstance(reflections, list):
                logger.warning(f"⚠️ [MEMORY] Reflection returned non-list: {raw}")
                return None

            # Store each reflection as a memory
            for insight in reflections:
                if isinstance(insight, str) and insight.strip():
                    self._mem0.add(
                        messages=[{"role": "assistant", "content": insight.strip()}],
                        user_id=user_id,
                        metadata={
                            "category": "reflection",
                            "source": "reflection_synthesis",
                            "importance": "critical",
                        },
                    )

            # Save metadata for the reflections
            # (we re-fetch to get the newly created mem0 IDs)
            now = datetime.now(timezone.utc).isoformat()
            # Insert metadata records for reflections — search for them in mem0
            for insight in reflections:
                if isinstance(insight, str) and insight.strip():
                    try:
                        # Search for the exact reflection we just added
                        search_result = self._mem0.search(
                            query=insight.strip(),
                            user_id=user_id,
                            limit=1,
                        )
                        found = search_result.get("results", [])
                        if found and found[0].get("score", 0) > 0.9:
                            mem0_id = found[0].get("id", "")
                            if mem0_id:
                                # Check if metadata already exists
                                existing = supabase_client.table("memory_metadata").select("id").eq("mem0_id", mem0_id).limit(1).execute()
                                if not existing.data:
                                    supabase_client.table("memory_metadata").insert({
                                        "user_id": user_id,
                                        "mem0_id": mem0_id,
                                        "category": "reflection",
                                        "importance": "critical",
                                        "importance_score": 9,
                                        "memory_type": "reflection",
                                        "last_accessed_at": now,
                                        "source": "reflection_synthesis",
                                    }).execute()
                    except Exception as meta_exc:
                        logger.warning(f"⚠️ [MEMORY] Reflection metadata save failed: {meta_exc}")

            elapsed = (time.monotonic() - _t) * 1000
            logger.info(
                f"✅ [MEMORY] Generated {len(reflections)} reflections in {elapsed:.0f}ms"
            )
            return reflections

        except Exception as exc:
            logger.error(f"❌ [MEMORY] generate_reflections failed: {exc}")
            return None

    def _fetch_top_memories_for_reflection(self, user_id: str) -> List[str]:
        """Fetch top N memories by importance_score for reflection synthesis."""
        if not supabase_client:
            return []
        try:
            # Get top mem0_ids by importance
            resp = (
                supabase_client.table("memory_metadata")
                .select("mem0_id")
                .eq("user_id", user_id)
                .neq("memory_type", "reflection")  # don't reflect on reflections
                .order("importance_score", desc=True)
                .limit(REFLECTION_MEMORY_FETCH_LIMIT)
                .execute()
            )
            mem0_ids = [r["mem0_id"] for r in (resp.data or [])]

            if not mem0_ids or not self._mem0:
                return []

            # Fetch actual memory texts from mem0
            all_memories = self._mem0.get_all(user_id=user_id, limit=500)
            memory_map = {m["id"]: m.get("memory", "") for m in all_memories.get("results", [])}

            return [memory_map[mid] for mid in mem0_ids if mid in memory_map and memory_map[mid]]

        except Exception as exc:
            logger.error(f"❌ [MEMORY] _fetch_top_memories_for_reflection failed: {exc}")
            return []

    def _fetch_all_session_summaries(self, user_id: str) -> List[Dict]:
        """Fetch all session summaries for a user, ordered by recency."""
        if not supabase_client:
            return []
        try:
            resp = (
                supabase_client.table("session_summaries")
                .select("summary_text, themes, emotional_arc")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(20)
                .execute()
            )
            summaries = []
            for row in (resp.data or []):
                themes = row.get("themes", "[]")
                arc = row.get("emotional_arc", "[]")
                if isinstance(themes, str):
                    try:
                        themes = json.loads(themes)
                    except (json.JSONDecodeError, TypeError):
                        themes = []
                if isinstance(arc, str):
                    try:
                        arc = json.loads(arc)
                    except (json.JSONDecodeError, TypeError):
                        arc = []
                summaries.append({
                    "summary_text": row.get("summary_text", ""),
                    "themes": themes,
                    "emotional_arc": arc,
                })
            return summaries
        except Exception as exc:
            logger.error(f"❌ [MEMORY] _fetch_all_session_summaries failed: {exc}")
            return []

    # ── emotional continuity tracker ─────────────────────────────────────

    def get_emotional_trend(self, user_id: str) -> str:
        """
        Analyze emotional arcs across recent sessions to detect trends.

        Uses a session-scoped cache (TTL ~1 hour) to avoid redundant Groq
        LLM calls within the same session.

        Returns a one-line summary like:
            "User's anxiety has been gradually decreasing over the last 3 sessions"
        or "" if insufficient data.
        """
        if not self._groq_client:
            return ""

        # ── Cache check ──────────────────────────────────────────────
        cached = self._emotional_trend_cache.get(user_id)
        if cached:
            trend_text, cached_at = cached
            if (time.monotonic() - cached_at) < self._EMOTIONAL_TREND_CACHE_TTL_S:
                logger.info(f"✅ [MEMORY] Emotional trend cache hit for {user_id[:12]}")
                return trend_text

        try:
            summaries = self._fetch_recent_session_summaries_for_trend(user_id)
            if len(summaries) < 2:
                return ""

            _t = time.monotonic()

            # Build compact timeline
            timeline = []
            for i, s in enumerate(reversed(summaries), 1):  # oldest first
                arc = s.get("emotional_arc", [])
                themes = s.get("themes", [])
                timeline.append(
                    f"Session {i}: themes={themes}, emotional_arc={arc}"
                )

            timeline_text = "\n".join(timeline)

            prompt = (
                "Based on these session summaries (oldest first), write a single sentence "
                "describing the user's emotional trend over time. Focus on whether things are "
                "improving, worsening, or stable. Be specific about which emotions.\n\n"
                f"{timeline_text}\n\n"
                "Return ONLY a single sentence (no quotes, no JSON). "
                'Example: "User has shown gradually decreasing anxiety but persistent sadness about family relationships."'
            )

            response = self._groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are an empathetic companion analyzing emotional patterns. Return only a single sentence."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=100,
            )

            trend = response.choices[0].message.content.strip().strip('"').strip("'")

            elapsed = (time.monotonic() - _t) * 1000
            logger.info(f"✅ [MEMORY] Emotional trend analysis in {elapsed:.0f}ms: {trend[:80]}…")

            # Cache the result for this session
            self._emotional_trend_cache[user_id] = (trend, time.monotonic())

            return trend

        except Exception as exc:
            logger.error(f"❌ [MEMORY] get_emotional_trend failed: {exc}")
            return ""

    def _fetch_recent_session_summaries_for_trend(self, user_id: str) -> List[Dict]:
        """Fetch last N session summaries for emotional trend analysis."""
        if not supabase_client:
            return []
        try:
            resp = (
                supabase_client.table("session_summaries")
                .select("themes, emotional_arc")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(EMOTIONAL_TREND_SESSIONS)
                .execute()
            )
            results = []
            for row in (resp.data or []):
                themes = row.get("themes", "[]")
                arc = row.get("emotional_arc", "[]")
                if isinstance(themes, str):
                    try:
                        themes = json.loads(themes)
                    except (json.JSONDecodeError, TypeError):
                        themes = []
                if isinstance(arc, str):
                    try:
                        arc = json.loads(arc)
                    except (json.JSONDecodeError, TypeError):
                        arc = []
                results.append({"themes": themes, "emotional_arc": arc})
            return results
        except Exception as exc:
            logger.error(f"❌ [MEMORY] _fetch_recent_session_summaries_for_trend: {exc}")
            return []

    # ── reflection trigger check ─────────────────────────────────────────

    def should_generate_reflections(self, user_id: str) -> bool:
        """
        Check if it's time to generate reflections for this user.
        Returns True when session_count is a multiple of REFLECTION_INTERVAL_SESSIONS.
        """
        stats = self.get_user_memory_stats(user_id)
        session_count = stats.get("session_count", 0)
        return session_count > 0 and session_count % REFLECTION_INTERVAL_SESSIONS == 0

    # ── legacy helpers (kept for backward compat) ────────────────────────

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
