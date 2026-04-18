import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional

from .memory_store import MemoryStore
from ..core.decay_engine import DecayEngine
from ..core.session_lifecycle import SessionLifecycle
from ..services.supabase_service import supabase_client
from .memory_retriever import MemoryRetriever
from .memory_reflection import MemoryReflection

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self):
        self.store = MemoryStore()
        self.retriever = MemoryRetriever(self.store)
        self.reflection = MemoryReflection(self.store, self.retriever)
        self.lifecycle = SessionLifecycle(self)
        self._session_memory_snapshots: Dict[str, str] = {}
        self._session_lifecycle_warmed: set = set()

        def _bootstrap_decay() -> None:
            for _ in range(600):
                crud = self.store.memory_crud
                if crud is not None:
                    DecayEngine.schedule_nightly_decay(crud, supabase_client)
                    return
                time.sleep(2.0)

        threading.Thread(target=_bootstrap_decay, daemon=True, name="memory-decay-bootstrap").start()
        
    @property
    def is_ready(self) -> bool:
        return self.store.is_ready

    def retrieve(self, *args, **kwargs) -> str:
        """Alias for retrieve_memories (session lifecycle / proactive warm-up)."""
        return self.retrieve_memories(*args, **kwargs)

    def set_session_memory_snapshot(self, session_id: str, text: str) -> None:
        if session_id:
            self._session_memory_snapshots[session_id] = text or ""

    def get_session_memory_snapshot(self, session_id: str) -> str:
        if not session_id:
            return ""
        return self._session_memory_snapshots.get(session_id, "") or ""

    def clear_session_memory_snapshot(self, session_id: str) -> None:
        if session_id:
            self._session_memory_snapshots.pop(session_id, None)

    def maybe_warm_session(self, user_id: str, session_id: str, session_msg_count: int) -> None:
        """Run session-start lifecycle once per session when early in the conversation."""
        if not session_id or not user_id or user_id == "anonymous":
            return
        if session_msg_count > 1:
            return
        if session_id in self._session_lifecycle_warmed:
            return
        try:
            self.lifecycle.on_session_start(user_id, session_id, session_message_count=session_msg_count)
        except Exception as exc:
            logger.warning("[MEMORY] maybe_warm_session failed: %s", exc)
        self._session_lifecycle_warmed.add(session_id)

    def on_session_start(
        self, user_id: str, session_id: str, session_message_count: int = 1
    ) -> Dict[str, Any]:
        return self.lifecycle.on_session_start(
            user_id, session_id, session_message_count=session_message_count
        )

    def on_message(
        self,
        messages: List[Dict[str, Any]],
        user_id: str,
        session_id: str,
        message_count: int,
        content_locale: Optional[str] = None,
        emotional_intensity: Optional[float] = None,
    ) -> None:
        if messages and session_id:
            try:
                from ..core.redis_working_memory import append_session_turn

                last = messages[-1]
                append_session_turn(
                    session_id,
                    str(last.get("role", "user")),
                    str(last.get("content", "")),
                )
            except Exception:
                pass
        self.lifecycle.on_message(
            messages,
            user_id,
            session_id,
            message_count,
            content_locale,
            emotional_intensity=emotional_intensity,
        )

    def on_session_checkpoint(
        self,
        messages: List[Dict[str, Any]],
        user_id: str,
        session_id: str,
    ) -> None:
        self.lifecycle.on_session_checkpoint(messages, user_id, session_id)

    def on_session_end(
        self,
        messages: List[Dict[str, Any]],
        user_id: str,
        session_id: str,
    ) -> None:
        self.lifecycle.on_session_end(messages, user_id, session_id)

    def add_memories(self, messages, user_id, *args, **kwargs):
        result = self.store.add_memories(messages, user_id, *args, **kwargs)
        # Invalidate the has-memories cache so the next retrieve_memories
        # call re-checks and finds the newly added memories.
        self.retriever.invalidate_has_memories_cache(user_id)
        return result

    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Load merged profile from user_memory_profile.profile JSON (or defaults)."""
        default: Dict[str, Any] = {
            "session_count": 0,
            "trust_tier": 1,
            "language_preference": "en",
            "narrative_paragraph": None,
            "memory_clarification_pending": False,
        }
        if not supabase_client or not user_id or user_id == "anonymous":
            return dict(default)
        try:
            resp = (
                supabase_client.table("user_memory_profile")
                .select("profile")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not resp.data:
                return dict(default)
            p = resp.data[0].get("profile") or {}
            if isinstance(p, str):
                p = json.loads(p)
            if not isinstance(p, dict):
                return dict(default)
            merged = {**default, **p}
            merged["memory_clarification_pending"] = bool(p.get("memory_clarification_pending", False))
            return merged
        except Exception as exc:
            logger.debug("[MEMORY] get_user_profile failed for %s: %s", user_id[:12], exc)
            return dict(default)

    def fetch_memory_records(self, *args, **kwargs):
        """Structured memories for ContextComposer (legacy vs MEMOIR inside retriever)."""
        return self.retriever.fetch_memory_records(*args, **kwargs)

    def retrieve_memories(
        self,
        query: str,
        user_id: str,
        intent: str = "emotional",
        limit: int = 7,
        threshold: float = 0.3,
        *,
        session_id: Optional[str] = None,
        current_affect: Optional[Dict[str, float]] = None,
        memory_reference_allowed: bool = True,
        session_message_count: Optional[int] = None,
        cl_arc_trajectory: str = "stable",
    ) -> str:
        from ..core.config import config
        from ..core.context_composer import ContextComposer, pipeline_intent_to_compose_intent
        from ..core.redis_working_memory import (
            get_cached_memory_context,
            set_cached_memory_context,
            get_user_memory_context,
            set_user_memory_context,
        )

        ttl = int(config.get("memory.redis_context_cache_ttl_seconds", 0) or 0)
        turn_key = str(session_message_count if session_message_count is not None else "")
        if ttl > 0 and session_id and user_id and user_id != "anonymous":
            hit = get_cached_memory_context(user_id, session_id, turn_key)
            if hit:
                return hit
        # PDF: user:{id}:memory_context is a global short-term cache for the last assembled block.
        if ttl > 0 and user_id and user_id != "anonymous":
            hit2 = get_user_memory_context(user_id)
            if hit2:
                return hit2

        if config.get("memory.earned_intimacy_read_gate", True):
            if session_message_count is not None and int(session_message_count) <= 1:
                logger.info(
                    "[MEMORY-READ] Early-session gate — empty retrieved memory block | msg_count=%s",
                    session_message_count,
                )
                return ""

        prof = self.get_user_profile(user_id)
        recs = self.fetch_memory_records(
            query,
            user_id,
            intent,
            limit,
            threshold,
            session_id=session_id,
            current_affect=current_affect,
            session_message_count=int(session_message_count or 0),
            arc_trajectory=cl_arc_trajectory,
        )
        sc = int(prof.get("session_count", 0) or 0)
        composed = ContextComposer().compose(
            recs,
            prof,
            sc,
            pipeline_intent_to_compose_intent(intent),
            memory_reference_allowed=memory_reference_allowed,
        )
        if ttl > 0 and session_id and user_id and user_id != "anonymous" and turn_key != "":
            set_cached_memory_context(user_id, session_id, turn_key, composed, ttl_seconds=ttl)
        if ttl > 0 and user_id and user_id != "anonymous":
            set_user_memory_context(user_id, composed, ttl_seconds=max(600, ttl))
        return composed

    def save_session_summary(self, *args, **kwargs):
        return self.reflection.save_session_summary(*args, **kwargs)

    def generate_session_summary(self, *args, **kwargs):
        return self.reflection.generate_session_summary(*args, **kwargs)

    def update_user_narrative(self, user_id: str) -> str:
        return self.reflection.update_user_narrative(user_id)

    def load_session_summary(self, *args, **kwargs):
        return self.reflection.load_session_summary(*args, **kwargs)

    def synthesize_procedural_memory(self, *args, **kwargs):
        return self.reflection.synthesize_procedural_memory(*args, **kwargs)

    def generate_reflections(self, *args, **kwargs):
        return self.reflection.generate_reflections(*args, **kwargs)

    def get_emotional_trend(self, *args, **kwargs):
        return self.reflection.get_emotional_trend(*args, **kwargs)

    def get_user_memory_stats(self, *args, **kwargs):
        return self.store.get_user_memory_stats(*args, **kwargs)

    def get_all_memories(self, *args, **kwargs):
        return self.store.get_all_memories(*args, **kwargs)
        
    def add_crisis_memory(self, *args, **kwargs):
        return self.store.add_crisis_memory(*args, **kwargs)
        
    def should_generate_reflections(self, *args, **kwargs):
        return self.reflection.should_generate_reflections(*args, **kwargs)
        
    @property
    def _emotional_trend_cache(self):
        return self.reflection._emotional_trend_cache

memory_manager = MemoryManager()
