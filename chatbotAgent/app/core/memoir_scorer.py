from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from .decay_engine import LAMBDA_MAP, _parse_ts


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


_INTENT_TYPE_MATRIX = {
    # Unified taxonomy alignment (identity/preference/behavioral/emotional/contextual)
    ("venting", "emotional"): 1.5,
    ("venting", "contextual"): 1.2,
    ("venting", "identity"): 0.8,
    ("venting", "preference"): 0.9,
    ("venting", "behavioral"): 1.1,
    ("advice_seeking", "behavioral"): 1.4,
    ("advice_seeking", "preference"): 1.2,
    ("advice_seeking", "contextual"): 1.1,
    ("advice_seeking", "identity"): 0.9,
    ("advice_seeking", "emotional"): 1.0,
    ("casual", "identity"): 1.2,
    ("casual", "contextual"): 1.0,
    ("casual", "preference"): 1.0,
    ("casual", "behavioral"): 0.9,
    ("casual", "emotional"): 0.7,
    ("crisis", "emotional"): 1.5,
    ("crisis", "contextual"): 1.2,
    ("reflection", "behavioral"): 1.2,
    ("reflection", "contextual"): 1.1,
    ("reflection", "emotional"): 1.1,
    ("reflection", "identity"): 1.0,
    ("reflection", "preference"): 1.0,
    # Transitional (legacy) types still present in older rows
    ("venting", "affective"): 1.5,
    ("venting", "episodic"): 1.3,
    ("venting", "semantic"): 0.8,
    ("advice_seeking", "procedural"): 1.5,
    ("advice_seeking", "semantic"): 1.3,
    ("advice_seeking", "episodic"): 1.1,
    ("casual", "semantic"): 1.2,
    ("casual", "affective"): 0.7,
    ("crisis", "affective"): 1.5,
    ("crisis", "episodic"): 1.3,
    ("reflection", "episodic"): 1.5,
    ("reflection", "semantic"): 1.3,
}

_WEIGHTS = {"M": 0.25, "E": 0.20, "Mm": 0.15, "O": 0.15, "I": 0.15, "R": 0.10}


def _memory_type_key(memory: Dict[str, Any]) -> str:
    t = (memory.get("type") or memory.get("memory_type") or "semantic")
    if isinstance(t, str):
        return t.lower()
    return "semantic"


def select_top_diverse(
    scored: List[Tuple[float, Dict[str, Any]]],
    top_n: int = 7,
    max_per_type: int = 3,
) -> List[Dict[str, Any]]:
    """Pick up to top_n memories, at most max_per_type per type; backfill with next-best other types."""
    by = sorted(scored, key=lambda x: x[0], reverse=True)
    chosen: List[Dict[str, Any]] = []
    chosen_ids: set = set()
    counts: Dict[str, int] = defaultdict(int)

    def _mid(mem: Dict[str, Any]) -> str:
        return str(mem.get("id") or mem.get("mem0_id") or id(mem))

    for _sc, m in by:
        if len(chosen) >= top_n:
            break
        mid = _mid(m)
        if mid in chosen_ids:
            continue
        t = _memory_type_key(m)
        if counts[t] >= max_per_type:
            continue
        chosen.append(m)
        chosen_ids.add(mid)
        counts[t] += 1

    return chosen[:top_n]


class MEMOIRScorer:
    @staticmethod
    def score(
        memory: Dict[str, Any],
        query_embedding: List[float],
        memory_embedding: List[float],
        current_affect: Dict[str, Any],
        intent: str,
        session_count: int,
    ) -> float:
        m_meaning = cosine_similarity(query_embedding, memory_embedding)

        mv = float(memory.get("emotional_valence", 0.0) or 0.0)
        cv = float(current_affect.get("valence", 0.0) or 0.0)
        ci = float(current_affect.get("intensity", 0.0) or 0.0)
        e_emotional = 1.0 - abs(mv - cv) * ci
        e_emotional = max(0.0, e_emotional)

        now = datetime.now(timezone.utc)
        accessed = _parse_ts(memory.get("last_accessed")) or _parse_ts(memory.get("last_accessed_at")) or now
        days_since_accessed = max(0, (now - accessed).days)

        tkey = _memory_type_key(memory)
        lam = LAMBDA_MAP.get(tkey, 0.002)
        m_momentum = math.exp(-lam * days_since_accessed)

        access_count = int(memory.get("access_count", 1) or 1)
        o_reinforcement = min(access_count / 8.0, 1.0)

        raw_intent = _INTENT_TYPE_MATRIX.get((intent, tkey), 1.0)
        i_intent = raw_intent / 1.5

        is_sensitive = bool(memory.get("is_sensitive", False))
        if session_count <= 3:
            # PDF: sessions 1–3: sensitive memories are down-weighted across the board.
            r_relationship = 0.3 if is_sensitive else 1.0
        elif session_count <= 8:
            r_relationship = 0.7 if is_sensitive else 1.0
        else:
            r_relationship = 1.0

        s = (
            _WEIGHTS["M"] * m_meaning
            + _WEIGHTS["E"] * e_emotional
            + _WEIGHTS["Mm"] * m_momentum
            + _WEIGHTS["O"] * o_reinforcement
            + _WEIGHTS["I"] * i_intent
            + _WEIGHTS["R"] * r_relationship
        )
        return round(max(0.0, min(1.0, s)), 4)
