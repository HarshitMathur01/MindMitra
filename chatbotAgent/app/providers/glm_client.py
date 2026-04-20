"""GLM (Z.AI / Zhipu) provider — backup generator."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List

from .base import BaseLLMProvider, ProviderUnavailable

logger = logging.getLogger(__name__)


class GLMProvider(BaseLLMProvider):
    name = "glm"

    def __init__(self) -> None:
        api_key = os.getenv("ZAI_API_KEY") or os.getenv("ZHIPUAI_API_KEY") or ""
        api_key = api_key.strip()
        if not api_key:
            raise ProviderUnavailable("ZAI_API_KEY/ZHIPUAI_API_KEY missing")
        try:
            from zai import ZaiClient  # zai-sdk
            self._client = ZaiClient(api_key=api_key)
        except ImportError:
            try:
                from zhipuai import ZhipuAI
                self._client = ZhipuAI(api_key=api_key)
            except ImportError as exc:
                raise ProviderUnavailable(f"no zai or zhipuai sdk installed: {exc}")

    async def complete(
        self,
        messages: List[Dict[str, str]],
        *,
        model: str,
        max_tokens: int = 900,
        temperature: float = 0.7,
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
                stream=False,
            )
            return resp.choices[0].message.content or ""

        if stream:
            raise NotImplementedError("GLM streaming not used in MITRA stack MVP")
        return await asyncio.wait_for(asyncio.to_thread(_call_blocking), timeout=timeout_s + 5)
