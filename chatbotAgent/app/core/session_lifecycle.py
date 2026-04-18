"""
Session-scoped memory lifecycle: start warm-up, periodic extraction, checkpoints, session end.
"""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ALL_COMPLETED, ThreadPoolExecutor, wait
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from ..agents.memory_manager import MemoryManager

logger = logging.getLogger(__name__)


class SessionLifecycle:
    """Orchestrates memory-related work at session start, during chat, and at session end."""

    def __init__(self, memory_manager: "MemoryManager") -> None:
        self._mm = memory_manager

    @property
    def _crud(self) -> Any:
        return getattr(self._mm.store, "memory_crud", None)

    @staticmethod
    def _sb_client() -> Any:
        from ..services.supabase_service import supabase_client

        return supabase_client

    def _synthetic_query_for_session_start(self, user_id: str, session_id: str) -> str:
        sb = self._sb_client()
        if not sb or not user_id:
            return "general context about this person"
        try:
            resp = (
                sb.table("session_summaries")
                .select("summary_text, session_id")
                .eq("user_id", user_id)
                .neq("session_id", session_id)
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
            rows = resp.data or []
            if rows and (rows[0].get("summary_text") or "").strip():
                return str(rows[0]["summary_text"]).strip()[:4000]
        except Exception as exc:
            logger.debug("[SessionLifecycle] previous summary fetch failed: %s", exc)
        return "general context about this person"

    def on_session_start(self, user_id: str, session_id: str, session_message_count: int = 1) -> Dict[str, Any]:
        """
        Register session, proactive retrieval + cache snapshot, return user profile.
        Target: parallel profile + retrieval under ~300ms when services are warm.
        """
        if self._crud and session_id and user_id and user_id != "anonymous":
            try:
                self._crud.ensure_session_registry_row(session_id, user_id)
            except Exception as exc:
                logger.debug("[SessionLifecycle] ensure_session_registry_row: %s", exc)

        query = self._synthetic_query_for_session_start(user_id, session_id)
        profile: Dict[str, Any] = {}
        snapshot = ""

        def _prof() -> Dict[str, Any]:
            return self._mm.get_user_profile(user_id)

        def _mem() -> str:
            try:
                return self._mm.retrieve_memories(
                    query,
                    user_id,
                    "emotional",
                    session_id=session_id,
                    session_message_count=session_message_count,
                )
            except Exception as exc:
                logger.warning("[SessionLifecycle] session-start retrieve failed: %s", exc)
                return ""

        with ThreadPoolExecutor(max_workers=2) as ex:
            fp = ex.submit(_prof)
            fm = ex.submit(_mem)
            wait((fp, fm), return_when=ALL_COMPLETED)
            profile = fp.result() or {}
            snapshot = fm.result() or ""

        if session_id and snapshot.strip():
            self._mm.set_session_memory_snapshot(session_id, snapshot)
        return profile

    def on_message(
        self,
        messages: List[Dict[str, Any]],
        user_id: str,
        session_id: str,
        message_count: int,
        content_locale: Optional[str] = None,
        emotional_intensity: Optional[float] = None,
    ) -> None:
        """Registry bump (async); extraction every 12 msgs; checkpoint every 36."""
        if not session_id or not user_id or user_id == "anonymous":
            return

        def _bump_registry() -> None:
            try:
                if self._crud:
                    self._crud.increment_session_registry_message_count(session_id, user_id)
            except Exception as exc:
                logger.debug("[SessionLifecycle] registry increment failed: %s", exc)

        threading.Thread(target=_bump_registry, daemon=True, name="session-registry-bump").start()

        # PDF: hot-path immediate extraction for high-intensity turns (>0.7).
        try:
            if emotional_intensity is not None and float(emotional_intensity) > 0.7:
                logger.info(
                    "🔥 [MEMORY-WRITE] Hot-path extraction triggered | session=%s user=%s intensity=%.2f",
                    session_id[-8:], str(user_id)[-8:], float(emotional_intensity),
                )

                def _extract_hot() -> None:
                    import time as _time
                    _t = _time.monotonic()
                    try:
                        from .redis_working_memory import extraction_rate_allow

                        if not extraction_rate_allow(session_id):
                            logger.info(
                                "[MEMORY-WRITE] Hot-path extraction skipped — redis hourly rate cap | session=%s",
                                session_id[-8:],
                            )
                            return
                        tail = messages[-12:] if len(messages) >= 12 else messages
                        if not tail:
                            return
                        self._mm.store.add_structured(tail, user_id, session_id)
                        self._mm.clear_session_memory_snapshot(session_id)
                        logger.info(
                            "✅ [MEMORY-WRITE] Hot-path extraction complete | session=%s latency_ms=%.0f",
                            session_id[-8:], (_time.monotonic() - _t) * 1000,
                        )
                    except Exception as exc:
                        logger.error(
                            "❌ [MEMORY-WRITE] Hot-path extraction failed | session=%s error=%s",
                            session_id[-8:], exc, exc_info=True,
                        )

                threading.Thread(target=_extract_hot, daemon=True, name="memory-extract-hot").start()
        except Exception:
            pass

        if message_count > 0 and message_count % 12 == 0:
            logger.info(
                "💾 [MEMORY-WRITE] Extraction triggered | session=%s user=%s msg_count=%d "
                "interval=12 tail_size=%d",
                session_id[-8:], str(user_id)[-8:], message_count,
                min(12, len(messages)),
            )

            def _extract() -> None:
                import time as _time
                _t = _time.monotonic()
                try:
                    from .redis_working_memory import extraction_rate_allow

                    if not extraction_rate_allow(session_id):
                        logger.info(
                            "[MEMORY-WRITE] Extraction skipped — redis hourly rate cap | session=%s",
                            session_id[-8:],
                        )
                        return
                    tail = messages[-12:] if len(messages) >= 12 else messages
                    if not tail:
                        return
                    self._mm.store.add_structured(tail, user_id, session_id)
                    self._mm.clear_session_memory_snapshot(session_id)
                    logger.info(
                        "✅ [MEMORY-WRITE] Extraction complete | session=%s latency_ms=%.0f",
                        session_id[-8:], (_time.monotonic() - _t) * 1000,
                    )
                except Exception as exc:
                    logger.error(
                        "❌ [MEMORY-WRITE] Extraction failed | session=%s error=%s",
                        session_id[-8:], exc, exc_info=True,
                    )

            threading.Thread(target=_extract, daemon=True, name="memory-extract-12").start()

        if message_count > 0 and message_count % 36 == 0:
            logger.info(
                "💾 [MEMORY-CHECKPOINT] Triggered | session=%s user=%s msg_count=%d interval=36",
                session_id[-8:], str(user_id)[-8:], message_count,
            )

            def _checkpoint() -> None:
                try:
                    self.on_session_checkpoint(messages, user_id, session_id)
                except Exception as exc:
                    logger.error("[SessionLifecycle] checkpoint failed: %s", exc, exc_info=True)

            threading.Thread(target=_checkpoint, daemon=True, name="memory-checkpoint-36").start()

    def on_session_checkpoint(
        self,
        messages: List[Dict[str, Any]],
        user_id: str,
        session_id: str,
    ) -> None:
        if not messages:
            return
        try:
            self._mm.store.add_structured(messages, user_id, session_id)
        except Exception as exc:
            logger.error("[SessionLifecycle] checkpoint add_structured failed: %s", exc, exc_info=True)
        if len(messages) > 30:
            try:
                self._mm.reflection.generate_session_summary(user_id, session_id, messages)
            except Exception as exc:
                logger.error("[SessionLifecycle] checkpoint summary failed: %s", exc, exc_info=True)

    def on_session_end(
        self,
        messages: List[Dict[str, Any]],
        user_id: str,
        session_id: str,
    ) -> None:
        if not session_id or not user_id or user_id == "anonymous":
            return
        try:
            if messages:
                self._mm.store.add_structured(messages, user_id, session_id)
        except Exception as exc:
            logger.error("[SessionLifecycle] session-end add_structured failed: %s", exc, exc_info=True)

        try:
            self._mm.reflection.generate_session_summary(user_id, session_id, messages or [])
        except Exception as exc:
            logger.error("[SessionLifecycle] session-end summary failed: %s", exc, exc_info=True)

        try:
            if self._crud:
                self._crud.update_session_end(session_id, summary_written=True)
        except Exception as exc:
            logger.debug("[SessionLifecycle] update_session_end failed: %s", exc)

        new_count = self._increment_profile_session_count(user_id)
        if new_count and new_count % 10 == 0:
            try:
                self._mm.reflection.update_user_narrative(user_id)
            except Exception as exc:
                logger.error("[SessionLifecycle] narrative update failed: %s", exc, exc_info=True)

    def _increment_profile_session_count(self, user_id: str) -> int:
        sb = self._sb_client()
        if not sb or not user_id:
            return 0
        try:
            prof = self._mm.get_user_profile(user_id)
            sc = int(prof.get("session_count", 0) or 0) + 1
            prof["session_count"] = sc
            from datetime import datetime, timezone

            sb.table("user_memory_profile").upsert(
                {
                    "user_id": user_id,
                    "profile": prof,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="user_id",
            ).execute()
            return sc
        except Exception as exc:
            logger.warning("[SessionLifecycle] increment profile session_count failed: %s", exc)
            return 0

    def trigger_narrative_update(self, user_id: str) -> None:
        """Delegate to MemoryReflection (single Gemini client)."""
        self._mm.reflection.update_user_narrative(user_id)
