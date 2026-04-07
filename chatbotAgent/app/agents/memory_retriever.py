import json
import logging
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from tenacity import retry, stop_after_attempt, wait_random_exponential, before_sleep_log
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai

from ..controllers.llm_controller import LLMController
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

class MemoryRetriever:
    _INTENT_LIMITS = {
        'casual': MEMORY_LIMIT_CASUAL,
        'emotional': MEMORY_LIMIT_EMOTIONAL,
        'therapeutic': MEMORY_LIMIT_THERAPEUTIC,
        'crisis': MEMORY_LIMIT_CRISIS,
    }

    # TTL constants for the has-memories count cache
    _HAS_MEMORIES_TTL_TRUE  = 600.0   # 10 min — once memories exist they persist
    _HAS_MEMORIES_TTL_FALSE = 120.0   # 2 min — recheck soon after first add

    def __init__(self, store):
        self.store = store
        # {user_id: (has_memories: bool, expires_at: float)}
        self._has_memories_cache: Dict[str, Tuple[bool, float]] = {}
        self._cache_lock = threading.Lock()

    @property
    def _ready(self): return self.store._ready
    @property
    def _mem0(self): return self.store._mem0

    # ── fast existence check ──────────────────────────────────────────────

    def _has_any_memories(self, user_id: str) -> bool:
        """
        Single-row COUNT against memory_metadata — cheap Supabase call (~50ms).
        Result is cached per-user so each active session pays the cost at most
        once every 2 minutes (no memories) or 10 minutes (has memories).
        Fails open (returns True) so the full retrieval path is used on error.
        """
        now = time.monotonic()
        with self._cache_lock:
            cached = self._has_memories_cache.get(user_id)
            if cached is not None:
                has_mem, expires_at = cached
                if now < expires_at:
                    return has_mem

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
            logger.debug(f"[MEMORY] _has_any_memories check failed ({exc}) — failing open")
            return True  # fail-open: run full retrieval rather than silently drop context

        ttl = self._HAS_MEMORIES_TTL_TRUE if has_mem else self._HAS_MEMORIES_TTL_FALSE
        with self._cache_lock:
            self._has_memories_cache[user_id] = (has_mem, now + ttl)

        return has_mem

    def invalidate_has_memories_cache(self, user_id: str) -> None:
        """Call this after add_memories so the next request re-checks the DB."""
        with self._cache_lock:
            self._has_memories_cache.pop(user_id, None)

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

        # Fast-path: skip the expensive local embedding + Qdrant round-trip
        # when the user has no stored memories at all (saves ~4–5 s for new users).
        if not self._has_any_memories(user_id):
            logger.info(f"✅ [MEMORY] retrieve_memories: 0 results (no memories stored for user)")
            return ""

        try:
            _t = time.monotonic()

            # ── Steps 1+2: mem0 vector search and Supabase metadata in parallel ──
            # The embedding + Qdrant search and the metadata fetch are independent;
            # running them concurrently saves ~100-200ms.
            with ThreadPoolExecutor(max_workers=2) as _ex:
                fut_search = _ex.submit(
                    self._mem0.search, query=query, user_id=user_id, limit=MEMORY_OVERFETCH_LIMIT
                )
                fut_meta = _ex.submit(self._fetch_metadata_for_scoring, user_id)
                results = fut_search.result()
                metadata_map = fut_meta.result()

            raw_memories = results.get("results", [])

            if not raw_memories:
                logger.info(f"✅ [MEMORY] retrieve_memories: 0 results (intent={intent})")
                return ""

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


    def _format_structured_memory_context(
        self,
        semantic: List[Dict],
        procedural: List[Dict],
        reflections: List[Dict],
    ) -> str:
        """
        Format memories into structured sections for the system prompt.

        Produces:
            THINGS YOU REMEMBER ABOUT THEM (reference naturally, like a friend who remembers):
            • Fact

            WHAT HAS HELPED THEM BEFORE (weave in naturally if relevant):
            • Strategy

            PATTERNS YOU'VE NOTICED (share as gentle observations, not diagnoses):
            • Deep insight
        """
        sections = []

        if semantic:
            lines = ["THINGS YOU REMEMBER ABOUT THEM (reference naturally, like a friend who remembers):"]
            for m in semantic:
                text = m.get("memory", "")
                if text:
                    lines.append(f"• {text}")
            sections.append("\n".join(lines))

        if procedural:
            lines = ["WHAT HAS HELPED THEM BEFORE (weave in naturally if relevant):"]
            for m in procedural:
                text = m.get("memory", "")
                if text:
                    lines.append(f"• {text}")
            sections.append("\n".join(lines))

        if reflections:
            lines = ["PATTERNS YOU'VE NOTICED (share as gentle observations, not diagnoses):"]
            for m in reflections:
                text = m.get("memory", "")
                if text:
                    lines.append(f"• {text}")
            sections.append("\n".join(lines))

        return "\n\n".join(sections)

    # ── importance scoring via Groq ──────────────────────────────────────


