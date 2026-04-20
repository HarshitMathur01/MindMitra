"""Phase 0 — provider package imports cleanly without env or SDKs being live.

We verify the *factory* dispatches to the right module path; we do **not**
construct the providers (which would require live API keys / SDKs).
"""
from __future__ import annotations

import importlib

import pytest

from app.core.models import Provider


def test_provider_package_imports():
    pkg = importlib.import_module("app.providers")
    assert hasattr(pkg, "get_llm_provider")
    assert hasattr(pkg, "get_embeddings_provider")


def test_base_classes_exist():
    base = importlib.import_module("app.providers.base")
    assert hasattr(base, "BaseLLMProvider")
    assert hasattr(base, "BaseEmbeddingsProvider")
    assert hasattr(base, "ProviderUnavailable")


def test_factory_rejects_non_llm_provider():
    from app.providers import get_llm_provider
    with pytest.raises(ValueError):
        get_llm_provider(Provider.LOCAL_BGE)


def test_factory_rejects_non_embed_provider():
    from app.providers import get_embeddings_provider
    with pytest.raises(ValueError):
        get_embeddings_provider(Provider.GROQ)


def test_provider_modules_importable():
    """Each concrete provider module must import without raising at import time."""
    for mod in [
        "app.providers.groq_client",
        "app.providers.azure_openai_client",
        "app.providers.gemini_client",
        "app.providers.glm_client",
        "app.providers.embeddings_bge",
        "app.providers.embeddings_gemini",
    ]:
        importlib.import_module(mod)


def test_fallback_wrapper_composes():
    """`with_fallback` returns a wrapper without instantiating providers."""
    from app.providers.base import BaseLLMProvider

    class _Stub(BaseLLMProvider):
        name = "stub"

        async def complete(self, messages, **kwargs):  # type: ignore[override]
            raise NotImplementedError

    a, b = _Stub(), _Stub()
    wrapped = a.with_fallback(b)
    assert "fallback=stub" in wrapped.name
