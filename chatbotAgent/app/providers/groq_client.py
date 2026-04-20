"""Groq provider — Llama 3.1 8B Instant for classifier/critic, whisper-v3-turbo for ASR."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, AsyncIterator, Dict, List

from .base import BaseLLMProvider, ProviderUnavailable

logger = logging.getLogger(__name__)


class GroqProvider(BaseLLMProvider):
    name = "groq"

    def __init__(self) -> None:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            raise ProviderUnavailable("GROQ_API_KEY missing")
        try:
            from groq import Groq
        except ImportError as exc:
            raise ProviderUnavailable(f"groq sdk not installed: {exc}")
        self._client = Groq(api_key=api_key)

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
        def _call_blocking() -> str:
            resp = self._client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=timeout_s,
                stream=False,
                **kwargs,
            )
            return resp.choices[0].message.content or ""

        if stream:
            # Streaming groq calls are sync iterators; wrap in a queue if needed.
            # MVP: we don't stream from Groq (it's used for classifiers/critic).
            raise NotImplementedError("Groq streaming not used in MITRA stack")

        return await asyncio.wait_for(asyncio.to_thread(_call_blocking), timeout=timeout_s + 2)

    async def health(self) -> bool:
        return self._client is not None
