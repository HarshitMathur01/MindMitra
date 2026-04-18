"""
Compatibility shim — extraction logic lives in ``memory_extraction_providers``.
"""
from __future__ import annotations

from typing import Any, List, Optional

from .memory_extraction_providers import GroqMemoryExtractionProvider
from .memory_pipeline_types import MemoryCandidate, SignalResult


class MemoryExtractor:
    """Delegates to Groq provider (configurable model via env)."""

    def __init__(self, groq_client: Any, model: Optional[str] = None) -> None:
        self._provider = GroqMemoryExtractionProvider(groq_client, model=model)

    def extract(
        self,
        messages: List[dict],
        signal: SignalResult,
        user_id: str,
        session_id: str,
    ) -> List[MemoryCandidate]:
        return self._provider.extract(messages, signal, user_id, session_id)
