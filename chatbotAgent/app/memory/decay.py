"""
Ebbinghaus-style strength decay for episodic memories.

Strength s(t) = s0 * exp(-Δt / τ), where τ is a per-memory time constant
modulated by importance (more important = slower decay) and recall_count
(every recall resets s back toward 1.0 — the testing-effect / spaced repetition).

When `s` falls below `archive_threshold`, the memory is archived (set
`archived_at`) and excluded from active retrieval.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Default time-constant (days). Important memories decay 4x slower; trivial
# ones decay 2x faster. Tuned so a 0.5-importance memory loses ~50% strength
# in ~30 days if never recalled.
_TAU_DAYS = 45.0


def time_constant_days(importance: float) -> float:
    """Higher importance → longer τ (slower decay)."""
    importance = max(0.0, min(1.0, float(importance)))
    return _TAU_DAYS * (0.5 + 1.5 * importance)   # 0 → 22.5d, 0.5 → 56d, 1 → 90d


def apply_decay(
    *, current_strength: float, importance: float,
    last_recalled_at: Optional[str], created_at: Optional[str],
    now: Optional[datetime] = None,
) -> float:
    """Return the new strength after exponential decay."""
    base_ts = last_recalled_at or created_at
    if not base_ts:
        return float(current_strength)
    try:
        ts = datetime.fromisoformat(base_ts.replace("Z", "+00:00"))
    except ValueError:
        return float(current_strength)
    now = now or datetime.now(timezone.utc)
    elapsed_days = max(0.0, (now - ts).total_seconds() / 86400.0)
    tau = time_constant_days(importance)
    s = float(current_strength) * math.exp(-elapsed_days / tau)
    return max(0.0, min(1.0, s))


def reinforce_on_recall(current_strength: float) -> float:
    """Each recall pushes strength back toward 1.0 (testing effect)."""
    return min(1.0, float(current_strength) + 0.30 * (1.0 - float(current_strength)))


ARCHIVE_THRESHOLD = 0.10
