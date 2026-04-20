"""
app/providers — thin async-ish wrappers around each LLM/embedding provider.

Every wrapper exposes:
    - `complete(messages, **kwargs) -> str | AsyncIterator[str]`
    - `health() -> bool`           (cheap reachability check)
    - `with_fallback(other)`       (cross-provider single-turn fallback)

These wrappers are constructed via `get_provider(provider_enum)` so callers
never hard-code provider SDK imports outside this package.

Phase 0: classes exist and are constructible (or skip cleanly when env is
missing). Real call paths land in Phase 5 alongside the new pipeline.
"""
from __future__ import annotations

import logging
from typing import Optional, TYPE_CHECKING

from ..core.models import Provider

if TYPE_CHECKING:
    from .base import BaseLLMProvider, BaseEmbeddingsProvider

logger = logging.getLogger(__name__)


def get_llm_provider(p: Provider) -> "BaseLLMProvider":
    """Lazy-construct an LLM provider wrapper. Raises if env is missing."""
    if p == Provider.GROQ:
        from .groq_client import GroqProvider
        return GroqProvider()
    if p == Provider.AZURE_OPENAI:
        from .azure_openai_client import AzureOpenAIProvider
        return AzureOpenAIProvider()
    if p == Provider.GEMINI:
        from .gemini_client import GeminiProvider
        return GeminiProvider()
    if p == Provider.GLM:
        from .glm_client import GLMProvider
        return GLMProvider()
    raise ValueError(f"{p} is not an LLM provider")


def get_embeddings_provider(p: Provider) -> "BaseEmbeddingsProvider":
    if p == Provider.LOCAL_BGE:
        from .embeddings_bge import BGEM3Provider
        return BGEM3Provider()
    if p == Provider.GEMINI_EMBED:
        from .embeddings_gemini import GeminiEmbeddingsProvider
        return GeminiEmbeddingsProvider()
    raise ValueError(f"{p} is not an embeddings provider")
