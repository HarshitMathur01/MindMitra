"""Session-end pipeline.

Runs the 5 concurrent post-session tasks:
  A. write_session_record (Supabase ``sessions``)
  B. generate_episodic_memory (Gemini → MiniLM → Qdrant)
  C. extract_semantic_facts (Groq → Supabase semantic profile)
  D. update_procedural_profile (EMA, Python only)
  E. update_longitudinal_trajectory (slope detection)

Triggered by:
  * explicit close hooks where available
  * Redis keyspace ``expired`` event on ``session:*:*``
  * The Redis sorted-set sweep job (fallback when keyspace notifications are disabled)

A distributed lock guards against the multi-instance case where two backend
pods both see the same TTL expiry.
"""
from __future__ import annotations

import statistics
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Dict, List, Optional, Tuple

from ..core.connections import get_supabase
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..core.session import SessionObject
from ..services import profile_service, session_service

logger = get_logger(__name__)


# ── public entry point ───────────────────────────────────────────────────
async def handle_session_end(user_id: str, session_id: str) -> Dict[str, Any]:
    """Idempotent session-end pipeline. Safe to call multiple times.

    Returns a small report so callers can log how many tasks succeeded.
    """
    import asyncio

    locked = await session_service.acquire_session_end_lock(session_id)
    if not locked:
        logger.info("session end lock already held; skipping", extra=log_context(session_id=session_id, user_id=user_id, outcome="locked_out"))
        return {"locked_out": True}

    try:
        session = await session_service.load_session(user_id, session_id)
        if session is None:
            logger.info("no session payload; nothing to do", extra=log_context(session_id=session_id, user_id=user_id, outcome="missing"))
            return {"missing": True}

        if session.turn_count < 2:
            logger.info("session too short for memory pipeline; marking ended only", extra=log_context(session_id=session_id, user_id=user_id, turns=session.turn_count, outcome="too_short"))
            await session_service.mark_session_ended(session)
            return {"too_short": True}

        started = time.perf_counter()
        duration_min = _duration_minutes(session)
        logger.info(
            f"━━━━━━ SESSION END {session.session_id[:8]} ━━━━━━",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                turns=session.turn_count,
                peak_urgency=session.session_peak_urgency,
                duration_min=duration_min,
                tokens_used=session.llm_tokens_used,
            ),
        )
        logger.info("running 5 async end tasks...", extra=log_context(session_id=session.session_id, user_id=session.user_id, task_count=5))

        # All 6 tasks run concurrently. ``return_exceptions=True`` keeps a
        # single failure from cancelling the rest. The crisis-flag write sits
        # alongside Task A because it shares the same destination (Supabase
        # longitudinal table) and is independent of the heavier memory
        # pipeline in B/C/D/E — failing it must not block the rest.
        results = await asyncio.gather(
            _timed_task("[A] session record → Supabase", _task_a_write_session(session)),
            _timed_task("[A2] crisis cooldown flag → Supabase", _maybe_set_crisis_flag(session)),
            _timed_task("[B] episodic memory → Gemini → Qdrant", _task_b_generate_episodic(session)),
            _timed_task("[C] semantic facts → Groq → Supabase", _task_c_extract_semantic(session)),
            _timed_task("[D] procedural EMA → Supabase", _task_d_update_procedural(session)),
            _timed_task("[E] longitudinal → slope detection → Supabase", _task_e_update_longitudinal(session)),
            return_exceptions=True,
        )

        labels = ("write_session", "crisis_flag", "episodic", "semantic", "procedural", "longitudinal")
        report: Dict[str, Any] = {}
        for label, result in zip(labels, results):
            if isinstance(result, Exception):
                logger.error(
                    "session end task failed",
                    extra=log_context(
                        session_id=session.session_id,
                        user_id=session.user_id,
                        task=label,
                        exception_type=type(result).__name__,
                        error=str(result),
                        retry_attempt="none",
                        outcome="failed_non_blocking",
                    ),
                    exc_info=(type(result), result, result.__traceback__),
                )
                report[label] = {"ok": False, "error": str(result)}
            else:
                task_report = result if isinstance(result, dict) else {"value": result}
                logger.info(
                    f"{task_report.get('display', label)} {'✓' if task_report.get('ok') else '✗'} ({task_report.get('latency_ms', 0):.0f}ms)",
                    extra=log_context(
                        session_id=session.session_id,
                        user_id=session.user_id,
                        task=label,
                        latency_ms=task_report.get("latency_ms", 0),
                        outcome="success" if task_report.get("ok") else "soft_failure",
                    ),
                )
                report[label] = task_report

        await session_service.mark_session_ended(session)
        logger.info(
            "all tasks complete ✓",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                latency_ms=(time.perf_counter() - started) * 1000,
                outcome="complete",
            ),
        )
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", extra=log_context(session_id=session.session_id, user_id=session.user_id))
        return report

    finally:
        await session_service.release_session_end_lock(session_id)


async def _timed_task(display: str, awaitable: Awaitable[Any]) -> Dict[str, Any]:
    started = time.perf_counter()
    value = await awaitable
    return {
        "ok": bool(value),
        "value": value,
        "display": display,
        "latency_ms": (time.perf_counter() - started) * 1000,
    }


def _duration_minutes(session: SessionObject) -> float:
    try:
        started = datetime.fromisoformat(str(session.started_at).replace("Z", "+00:00"))
        return round((datetime.now(timezone.utc) - started).total_seconds() / 60.0, 1)
    except Exception:  # noqa: BLE001
        return 0.0


# ── Task A: write session record ─────────────────────────────────────────
async def _task_a_write_session(session: SessionObject) -> bool:
    record = {
        "id": session.session_id,
        "user_id": session.user_id,
        "started_at": session.started_at,
        "ended_at": _now_iso(),
        "turn_count": session.turn_count,
        "peak_urgency": session.session_peak_urgency,
        "mode_sequence": [m.get("mode") for m in session.mode_history] or [session.current_mode],
        "final_affect": _final_affect(session),
        "episodic_memory_written": False,
        "tokens_used": session.llm_tokens_used,
        "llm_primary_used": None,
    }
    return await profile_service.write_session_record(record)


def _final_affect(session: SessionObject) -> Optional[Dict[str, float]]:
    if not session.affect_history:
        return None
    last = session.affect_history[-1]
    return {
        "valence": float(last.get("valence", 0.0)),
        "arousal": float(last.get("arousal", 0.5)),
    }


# ── Task A2: crisis cooldown flag (Sanctuary ambient personalization) ────
async def _maybe_set_crisis_flag(session: SessionObject) -> bool:
    """Mark the user's longitudinal trajectory with a fresh crisis cooldown.

    The SanctuaryHome landing page reads `recent_crisis_flag` from
    /me/snapshot and quiets itself (hides WhisperWall, switches the
    micro-practice card to the sit-with-you variant, locks the orb whisper
    to its 3-string safe-set) for `CRISIS_COOLDOWN_HOURS`. The flag is also
    cleared earlier at session_startup() once the user stabilises.

    Crisis bypass only fires at urgency==3 which is already covered by the
    `>= 2` threshold; sustained urgency 2 also warrants quieting.
    """
    if session.session_peak_urgency < 2:
        return True  # nothing to do — treat as a successful no-op
    sb = get_supabase()
    if sb is None:
        logger.warning(
            "Supabase unavailable; crisis flag not persisted",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                peak_urgency=session.session_peak_urgency,
                consequence="ambience_will_not_quiet",
            ),
        )
        return False

    payload = {
        "user_id": session.user_id,
        "recent_crisis_flag": True,
        "crisis_flag_set_at": _now_iso(),
    }

    def _write() -> bool:
        try:
            sb.table("user_longitudinal_trajectory").upsert(
                payload, on_conflict="user_id"
            ).execute()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "crisis flag upsert failed",
                extra=log_context(
                    session_id=session.session_id,
                    user_id=session.user_id,
                    exception_type=type(exc).__name__,
                    outcome="failed_non_blocking",
                ),
            )
            return False

    import asyncio as _aio

    ok = await _aio.to_thread(_write)
    if ok:
        logger.warning(
            "CRISIS COOLDOWN FLAG SET",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                peak_urgency=session.session_peak_urgency,
                cooldown_hours=env().crisis_cooldown_hours,
                outcome="flag_set",
            ),
        )
    return ok


# ── Task B: generate episodic memory (Gemini → Qdrant) ───────────────────
async def _task_b_generate_episodic(session: SessionObject) -> bool:
    # Lazy import so the worker stays importable when memory modules are
    # still under construction (Phase E adds the real writer).
    try:
        from ..memory.episodic_write import generate_and_store_episodic
    except Exception as exc:  # noqa: BLE001
        logger.info("episodic writer unavailable", extra=log_context(session_id=session.session_id, user_id=session.user_id, exception_type=type(exc).__name__, outcome="skipped"))
        return False
    return await generate_and_store_episodic(session)


# ── Task C: extract semantic facts (Groq → Supabase) ─────────────────────
async def _task_c_extract_semantic(session: SessionObject) -> bool:
    try:
        from ..memory.semantic_write import extract_and_merge_semantic
    except Exception as exc:  # noqa: BLE001
        logger.info("semantic extractor unavailable", extra=log_context(session_id=session.session_id, user_id=session.user_id, exception_type=type(exc).__name__, outcome="skipped"))
        return False
    return await extract_and_merge_semantic(session)


# ── Task D: procedural EMA (Python only, no LLM) ─────────────────────────
async def _task_d_update_procedural(session: SessionObject) -> bool:
    from ..memory.procedural_update import compute_procedural_ema

    updates = compute_procedural_ema(session)
    if not updates:
        return False
    ok = await profile_service.upsert_procedural(session.user_id, updates)
    if not ok:
        logger.error("procedural Supabase write failed — caching pending update", extra=log_context(session_id=session.session_id, user_id=session.user_id, task="procedural"))
        await session_service.cache_pending_profile_update(session.user_id, "procedural", updates)
    return ok


# ── Task E: longitudinal trajectory (numpy slope) ────────────────────────
async def _task_e_update_longitudinal(session: SessionObject) -> bool:
    from ..memory.longitudinal_update import compute_trajectory_updates

    updates = await compute_trajectory_updates(session)
    if not updates:
        return False
    ok = await profile_service.upsert_longitudinal(session.user_id, updates)
    if not ok:
        logger.error("longitudinal Supabase write failed — caching pending update", extra=log_context(session_id=session.session_id, user_id=session.user_id, task="longitudinal"))
        await session_service.cache_pending_profile_update(session.user_id, "longitudinal", updates)
    return ok


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
