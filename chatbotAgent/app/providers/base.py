"""
Provider base classes. Async by design; synchronous SDKs are wrapped in
`asyncio.to_thread` inside concrete implementations.
"""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class ProviderUnavailable(RuntimeError):
    """Raised when a provider can't be constructed (missing env, import error)."""


class BaseLLMProvider(ABC):
    """Common surface for all generative-text providers."""

    name: str = "base"

    @abstractmethod
    async def complete(
        self,
        messages: List[Dict[str, str]],
        *,
        model: str,
        max_tokens: int = 512,
        temperature: float = 0.4,
        timeout_s: float = 30.0,
        stream: bool = False,
        **kwargs: Any,
    ) -> Any:
        """Returns a string when stream=False, or an async iterator of token chunks."""

    async def health(self) -> bool:
        """Cheap probe; default returns True if construction succeeded."""
        return True

    def with_fallback(self, other: "BaseLLMProvider") -> "BaseLLMProvider":
        """Return a wrapper that retries on `other` when self fails or times out."""
        return _FallbackLLMProvider(primary=self, fallback=other)


class _FallbackLLMProvider(BaseLLMProvider):
    """Try primary; on exception or timeout fall back to secondary with same args."""

    def __init__(self, primary: BaseLLMProvider, fallback: BaseLLMProvider):
        self.primary = primary
        self.fallback = fallback
        self.name = f"{primary.name}|fallback={fallback.name}"

    async def complete(self, messages, **kwargs):  # type: ignore[override]
        try:
            return await self.primary.complete(messages, **kwargs)
        except Exception as exc:
            logger.warning(
                "Primary provider %s failed (%s); falling back to %s",
                self.primary.name, exc, self.fallback.name,
            )
            return await self.fallback.complete(messages, **kwargs)

    async def health(self) -> bool:
        return await self.primary.health() or await self.fallback.health()


class BaseEmbeddingsProvider(ABC):
    """Common surface for embedding providers."""

    name: str = "base-embed"
    dim: int = 0

    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Return one dense vector per text."""

    async def health(self) -> bool:
        return True
