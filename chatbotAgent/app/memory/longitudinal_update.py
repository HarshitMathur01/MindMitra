"""Task E — longitudinal trajectory update.

Appends a per-session affect entry to the longitudinal trajectory, drops the
oldest entry past 30, and recomputes a 7-session valence slope. Sets the
``longitudinal_risk_flag`` when the slope crosses the spec's threshold
(``slope < -0.022``, ~0.15 drop over 7 sessions).

Pure numpy + Python — no LLM call. Safe to run on session end.
"""
from __future__ import annotations

import logging
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List

from ..core.session import SessionObject
from ..services import profile_service

logger = logging.getLogger(__name__)

LONGITUDINAL_SLOPE_THRESHOLD = -0.022
MAX_ENTRIES = 30
MIN_FOR_SLOPE = 7


async def update_trajectory(session: SessionObject) -> bool:
    updates = await compute_trajectory_updates(session)
    if not updates:
        return False
    return await profile_service.upsert_longitudinal(session.user_id, updates)


async def compute_trajectory_updates(session: SessionObject) -> Dict[str, Any]:
    long = await profile_service.load_longitudinal(session.user_id)
    series: List[Dict[str, Any]] = list(long.get("affect_series") or [])

    valences = [
        float(a.get("valence", 0.0))
        for a in session.affect_history
        if "valence" in a
    ]
    arousals = [
        float(a.get("arousal", 0.5))
        for a in session.affect_history
        if "arousal" in a
    ]
    if not valences:
        return {}

    entry = {
        "date": _today_iso(),
        "valence_mean": statistics.fmean(valences),
        "arousal_mean": statistics.fmean(arousals) if arousals else 0.5,
        "peak_urgency": session.session_peak_urgency,
    }
    series.append(entry)
    if len(series) > MAX_ENTRIES:
        series = series[-MAX_ENTRIES:]

    slope = _slope(series[-MIN_FOR_SLOPE:]) if len(series) >= MIN_FOR_SLOPE else None
    risk_flag = bool(slope is not None and slope < LONGITUDINAL_SLOPE_THRESHOLD)

    updates: Dict[str, Any] = {
        "affect_series": series,
        "longitudinal_risk_flag": risk_flag,
        "last_slope": slope,
    }
    if risk_flag and not long.get("longitudinal_risk_flag"):
        updates["risk_flag_set_at"] = _today_iso()

    return updates


def _slope(entries: List[Dict[str, Any]]) -> float:
    """Linear-regression slope of valence_mean over the last N entries.

    Uses ``numpy.polyfit`` if available, falls back to a manual formula.
    """
    if not entries:
        return 0.0
    ys = [float(e.get("valence_mean", 0.0)) for e in entries]
    xs = list(range(len(ys)))
    try:
        import numpy as np

        coef = np.polyfit(xs, ys, 1)
        return float(coef[0])
    except Exception:  # noqa: BLE001
        n = len(xs)
        mean_x = sum(xs) / n
        mean_y = sum(ys) / n
        num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
        denom = sum((x - mean_x) ** 2 for x in xs) or 1.0
        return num / denom


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()
