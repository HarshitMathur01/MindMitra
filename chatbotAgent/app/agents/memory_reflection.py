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

class MemoryReflection:
    def __init__(self, store, retriever):
        self.store = store
        self.retriever = retriever
        self._emotional_trend_cache = {}
        self._EMOTIONAL_TREND_CACHE_TTL_S = 600.0  # 10-minute TTL (was 1 hour)
        
    @property
    def _ready(self): return self.store._ready
    @property
    def _mem0(self): return self.store._mem0
    @property
    def _gemini_model(self): return self.store._gemini_model
    @property
    def _glm(self): return self.store._glm
    @property
    def _groq_client(self): return self.store._groq_client
    
    def get_user_memory_stats(self, user_id):
        return self.store.get_user_memory_stats(user_id)
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
                model="llama-3.1-8b-instant",  # Insight sentences from memories — 8b is sufficient, 88% cheaper
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
                model="llama-3.1-8b-instant",  # 1-sentence summary — 8b is sufficient, 88% cheaper
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


