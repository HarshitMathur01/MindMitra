"""Task D — procedural profile EMA update.

Pure Python (no LLM). Inputs are read from the session object; outputs are
the field set that ``profile_service.upsert_procedural`` should write.

Update rule (spec §LAYER 8 Task D)::

    new = 0.3 * session_value + 0.7 * stored
    |new - stored| capped at 0.12 per session
    warmth >= 0.45 (hard floor)

Dependency counter rules::

    +1 if session had 0 social mentions
    -1 if session had ≥ 2 social mentions
    sessions_this_week increments (reset on Monday 00:00 IST elsewhere)

Activity affinity (added with the chat → activity bridge)::

    For each feedback row in this session:
      outcome = 1.0 if action in ("accepted","completed") else 0.0
      ema_new = 0.3 * outcome + 0.7 * ema_old
    Counters (accept_count, dismiss_count) accumulate alongside the EMA.
"""
from __future__ import annotations

import logging
import statistics
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List

from ..core.session import SessionObject

logger = logging.getLogger(__name__)

EMA_ALPHA = 0.3
MAX_DIM_DELTA = 0.12
WARMTH_FLOOR = 0.45
ACTIVITY_EMA_ALPHA = 0.3


def compute_procedural_ema(session: SessionObject) -> Dict[str, Any]:
    procedural = session.procedural_profile or {}
    stored = dict(procedural.get("style_vector") or {})

    session_style = _derive_session_style(session)

    new_style: Dict[str, float] = {}
    for dim, default in stored.items() if stored else {}:
        sv = session_style.get(dim, default)
        ema = EMA_ALPHA * float(sv) + (1.0 - EMA_ALPHA) * float(default)
        # cap delta
        delta = max(-MAX_DIM_DELTA, min(MAX_DIM_DELTA, ema - float(default)))
        new_style[dim] = float(default) + delta
        new_style[dim] = max(0.0, min(1.0, new_style[dim]))

    # If profile was empty, seed from session directly
    if not new_style:
        new_style = {k: max(0.0, min(1.0, v)) for k, v in session_style.items()}

    # Hard floor for clinical safety
    if "warmth" in new_style:
        new_style["warmth"] = max(WARMTH_FLOOR, new_style["warmth"])

    # ── dependency / social tracking ────────────────────────────────────
    social_mentions = int(session.dependency_signals.get("social_mentions_count", 0) or 0)
    dependency_counter = int(procedural.get("dependency_risk_counter", 0) or 0)

    if social_mentions == 0:
        dependency_counter += 1
    elif social_mentions >= 2:
        dependency_counter = max(0, dependency_counter - 1)

    # +2 if 7+ sessions this week AND any urgency >= 2 sustained
    sessions_this_week = int(procedural.get("sessions_this_week", 0) or 0) + 1
    if sessions_this_week >= 7 and session.session_peak_urgency >= 2:
        dependency_counter += 2

    consecutive = int(procedural.get("consecutive_high_urgency_sessions", 0) or 0)
    if session.session_peak_urgency >= 2:
        consecutive += 1
    else:
        consecutive = 0

    return {
        "style_vector": new_style,
        "dependency_risk_counter": dependency_counter,
        "social_mentions_count": social_mentions + int(procedural.get("social_mentions_count", 0) or 0),
        "sessions_this_week": sessions_this_week,
        "last_session_date": date.today().isoformat(),
        "consecutive_high_urgency_sessions": consecutive,
    }


def update_activity_affinity(
    stored_affinity: Dict[str, Any] | None,
    feedback_rows: Iterable[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """Fold a session's worth of activity_feedback rows into the EMA dict.

    ``stored_affinity`` is the JSONB value already on the user_procedural_profiles
    row (or empty dict for new users). ``feedback_rows`` is the list of rows
    fetched from ``activity_feedback`` for this session window. Returns the
    full new affinity dict to be upserted.

    Idempotency: callers should pass only rows that postdate the last EMA
    rollup; this function does not deduplicate by row id.
    """
    out: Dict[str, Dict[str, Any]] = {}
    if stored_affinity:
        for aid, payload in stored_affinity.items():
            if isinstance(payload, dict):
                out[aid] = dict(payload)

    for row in feedback_rows:
        aid = str(row.get("activity_id") or "").strip()
        if not aid:
            continue
        action = str(row.get("action") or "").strip().lower()
        if action not in ("accepted", "dismissed", "completed"):
            continue
        bucket = out.setdefault(aid, {
            "accept_count": 0,
            "dismiss_count": 0,
            "last_shown_at": None,
            "ema_acceptance": 0.5,
        })
        outcome = 1.0 if action in ("accepted", "completed") else 0.0
        ema_old = float(bucket.get("ema_acceptance", 0.5))
        bucket["ema_acceptance"] = round(
            ACTIVITY_EMA_ALPHA * outcome + (1.0 - ACTIVITY_EMA_ALPHA) * ema_old,
            4,
        )
        if outcome >= 1.0:
            bucket["accept_count"] = int(bucket.get("accept_count", 0)) + 1
        else:
            bucket["dismiss_count"] = int(bucket.get("dismiss_count", 0)) + 1
        # last_shown_at is whichever event is most recent for this activity.
        row_ts = row.get("created_at")
        if isinstance(row_ts, str) and row_ts:
            bucket["last_shown_at"] = row_ts
        else:
            bucket["last_shown_at"] = datetime.now(timezone.utc).isoformat()

    return out


def _derive_session_style(session: SessionObject) -> Dict[str, float]:
    # code_mix mean across user turns
    code_mixes = [
        float(a.get("code_mix_ratio", 0.5))
        for a in session.affect_history
        if "code_mix_ratio" in a
    ]
    code_mix = statistics.fmean(code_mixes) if code_mixes else session.code_mix_ratio

    # average user msg length → sentence_length signal
    user_msgs = [
        len(t.get("content", "")) for t in session.turns if t.get("role") == "user"
    ]
    avg_len_chars = statistics.fmean(user_msgs) if user_msgs else 80
    sentence_length = max(0.0, min(1.0, (avg_len_chars - 30) / 220.0))

    # warmth: pulled from any mode the session settled into
    warmth_hint = (
        0.85 if session.current_mode in ("recovery_check", "active_listener") else 0.7
    )

    return {
        "formality": 1.0 - code_mix,  # higher Hindi mix ≈ less formal English structure
        "code_mix": code_mix,
        "sentence_length": sentence_length,
        "warmth": warmth_hint,
        "emoji_use": 0.2,
        "directness": 0.5,
        "humour_tolerance": 0.5,
        "pace": 0.5,
    }
