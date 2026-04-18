from __future__ import annotations

from typing import Any, Dict, List, Tuple


def _tag_explicitly_referenced(user_message: str, tags: Any) -> bool:
    """True if any memory tag appears as a substring in the current user message."""
    msg = (user_message or "").lower()
    if not msg or not tags:
        return False
    if isinstance(tags, str):
        tags = [tags]
    if not isinstance(tags, (list, tuple)):
        return False
    return any(str(t).strip().lower() and str(t).lower() in msg for t in tags if t)


class MemorySuppressor:
    @staticmethod
    def should_suppress(memory: Dict[str, Any], context: Dict[str, Any]) -> Tuple[bool, str]:
        sid = str(memory.get("id") or memory.get("mem0_id") or "")
        suppressed = context.get("suppressed_ids") or frozenset()
        if sid and suppressed and sid in suppressed:
            return True, "user_suppressed"

        intent = (context.get("intent") or "").lower()
        crisis = intent == "crisis"
        is_sensitive = bool(memory.get("is_sensitive", False))

        if memory.get("is_active") is False:
            return True, "inactive"

        # Crisis: never suppress sensitive memories (overrides b, c, d, e).
        if crisis and is_sensitive:
            return False, ""

        decay_score = float(memory.get("decay_score", 1.0) or 1.0)
        if decay_score < 0.1:
            return True, "decayed"

        conf = memory.get("confidence")
        if conf is not None and float(conf) < 0.4:
            return True, "low_confidence"

        intensity = float(memory.get("emotional_intensity", 0.0) or 0.0)
        session_count = int(context.get("session_count", 0) or 0)
        if (
            is_sensitive
            and intensity > 0.85
            and intent != "crisis"
            and session_count < 6
        ):
            return True, "sensitive_early_session"

        mtype = (memory.get("type") or memory.get("memory_type") or "").lower()
        user_explicitly_references = bool(context.get("user_explicitly_references", False))
        # PDF: resolved emotional events should be suppressed unless explicitly referenced.
        if mtype in ("emotional", "affective", "episodic") and memory.get("is_resolved") and not user_explicitly_references:
            return True, "resolved_event"

        return False, ""

    @staticmethod
    def filter_candidates(memories: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for m in memories:
            explicit = _tag_explicitly_referenced(context.get("user_message", ""), m.get("tags"))
            sub = {**context, "user_explicitly_references": explicit}
            if not MemorySuppressor.should_suppress(m, sub)[0]:
                out.append(m)
        return out
