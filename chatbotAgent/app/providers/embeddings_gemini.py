"""Gemini embeddings — `text-embedding-004` (768-d), used as cloud fallback."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import List

from .base import BaseEmbeddingsProvider, ProviderUnavailable

logger = logging.getLogger(__name__)


class GeminiEmbeddingsProvider(BaseEmbeddingsProvider):
    name = "gemini-embed"
    dim = 768

    def __init__(self) -> None:
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            raise ProviderUnavailable("GOOGLE_API_KEY missing")
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise ProviderUnavailable(f"google-generativeai not installed: {exc}")
        genai.configure(api_key=api_key)
        self._genai = genai

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        def _call_blocking() -> List[List[float]]:
            out: List[List[float]] = []
            for t in texts:
                resp = self._genai.embed_content(
                    model="models/text-embedding-004",
                    content=t,
                    task_type="retrieval_document",
                )
                out.append(list(resp["embedding"]))
            return out

        return await asyncio.to_thread(_call_blocking)
