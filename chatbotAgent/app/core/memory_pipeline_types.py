from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional, Tuple


@dataclass
class SignalResult:
    is_memory_worthy: bool
    suggested_types: List[str]
    urgency: str  # "normal" | "elevated" | "crisis"


@dataclass
class MemoryCandidate:
    type: str
    content: str
    verbatim_anchor: str
    confidence: float
    emotional_valence: float
    emotional_intensity: float
    tags: List[str]
    is_sensitive: bool
    language: str
    is_resolved: bool = False
    category: Optional[str] = None
    # Populated by QualityGate for reinforce path (not part of LLM output).
    reinforce_existing_id: Optional[str] = None


@dataclass
class QualityGateResult:
    approved: List[MemoryCandidate]
    rejected: List[Tuple[MemoryCandidate, str]]
    contradictions: List[Tuple[MemoryCandidate, str]]
    reinforce: List[Tuple[MemoryCandidate, str]] = field(default_factory=list)
