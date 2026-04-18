"""
Stage-1 retrieval spec: compact view of query + cognitive signals for MEMOIR.
Built without extra LLM calls (orchestrator / retriever).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class RetrievalSpec:
    """Inputs for hybrid MEMOIR retrieval (dense + lexical + recency + summaries)."""

    query: str
    user_id: str
    memoir_intent: str
    session_count: int
    emotional_valence: float
    emotional_intensity: float
    arc_trajectory: str
    session_message_count: int

    @staticmethod
    def build(
        *,
        query: str,
        user_id: str,
        router_intent: str,
        session_count: int,
        current_affect: Optional[Dict[str, float]],
        cl_arc_trajectory: str,
        session_message_count: int,
        intent_mapper,
    ) -> "RetrievalSpec":
        aff = current_affect or {}
        return RetrievalSpec(
            query=query or "",
            user_id=user_id,
            memoir_intent=intent_mapper(router_intent),
            session_count=int(session_count or 0),
            emotional_valence=float(aff.get("valence", 0.0) or 0.0),
            emotional_intensity=float(aff.get("intensity", 0.0) or 0.0),
            arc_trajectory=(cl_arc_trajectory or "stable").lower(),
            session_message_count=int(session_message_count or 0),
        )

    def to_debug_dict(self) -> Dict[str, Any]:
        return {
            "memoir_intent": self.memoir_intent,
            "session_count": self.session_count,
            "session_message_count": self.session_message_count,
            "affect_v": self.emotional_valence,
            "affect_i": self.emotional_intensity,
            "arc": self.arc_trajectory,
            "q_len": len(self.query or ""),
        }
