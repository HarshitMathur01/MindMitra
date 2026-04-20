"""Azure OpenAI provider — GPT-5-mini as primary generator.

Reuses the GLM_BASE_URL / GLM_MODEL env vars which actually point at Azure
(legacy naming). AZURE_API_KEY is the credential.

Model-family quirks
-------------------
The "reasoning" / mini families on Azure (gpt-5*, o1*, o3*, o4*) only
accept ``temperature=1`` — anything else is rejected with HTTP 400
``unsupported_value``. We strip the parameter for those deployments
rather than ship every caller's preferred temperature into the request.

References:
- https://github.com/Azure/azure-sdk-for-python/issues/39938
- https://github.com/microsoft/vscode/issues/254675
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any, Dict, List, Optional

from .base import BaseLLMProvider, ProviderUnavailable

logger = logging.getLogger(__name__)


# Models that *only* accept the default sampling parameters. Match by
# prefix (case-insensitive) against the deployment / model name.
_FIXED_SAMPLING_PREFIXES = ("gpt-5", "o1", "o3", "o4", "o5")


def _model_requires_default_sampling(model: str) -> bool:
    """True for Azure deployments that reject custom temperature/top_p."""
    if not model:
        return False
    name = model.strip().lower()
    return any(name.startswith(p) for p in _FIXED_SAMPLING_PREFIXES)


def _build_kwargs(
    *,
    model: str,
    max_tokens: int,
    temperature: float,
    timeout_s: float,
    stream: bool,
    extra: Dict[str, Any],
) -> Dict[str, Any]:
    """Compose chat.completions kwargs, omitting params the model rejects."""
    kw: Dict[str, Any] = {
        "model": model,
        "max_completion_tokens": max_tokens,
        "timeout": timeout_s,
        "stream": stream,
    }
    if _model_requires_default_sampling(model):
        if temperature is not None and abs(temperature - 1.0) > 1e-6:
            logger.debug(
                "azure_openai: dropping temperature=%.2f for fixed-sampling model %s",
                temperature, model,
            )
        # Strip top_p / penalties too if a caller ever passes them.
        for k in ("top_p", "presence_penalty", "frequency_penalty", "logprobs"):
            extra.pop(k, None)
    else:
        kw["temperature"] = temperature
    kw.update(extra)
    return kw


class AzureOpenAIProvider(BaseLLMProvider):
    name = "azure_openai"

    def __init__(self) -> None:
        api_key = os.getenv("AZURE_API_KEY", "").strip()
        base_url = os.getenv("GLM_BASE_URL", "").strip()
        if not api_key or not base_url:
            raise ProviderUnavailable("AZURE_API_KEY or GLM_BASE_URL missing")
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise ProviderUnavailable(f"openai sdk not installed: {exc}")
        # OpenAI SDK supports an Azure-compatible base_url with API key.
        self._client = OpenAI(api_key=api_key, base_url=base_url)

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
        if stream:
            return await self._complete_stream(
                messages, model=model, max_tokens=max_tokens,
                temperature=temperature, timeout_s=timeout_s, **kwargs,
            )

        call_kwargs = _build_kwargs(
            model=model, max_tokens=max_tokens, temperature=temperature,
            timeout_s=timeout_s, stream=False, extra=dict(kwargs),
        )

        def _call_blocking() -> str:
            resp = self._client.chat.completions.create(
                messages=messages, **call_kwargs,
            )
            return resp.choices[0].message.content or ""

        try:
            return await asyncio.wait_for(
                asyncio.to_thread(_call_blocking), timeout=timeout_s + 5,
            )
        except Exception as exc:
            # Last-ditch retry: if Azure complains about the temperature for
            # a model name we didn't recognise, retry once without it.
            if _looks_like_temperature_400(exc) and "temperature" in call_kwargs:
                logger.warning(
                    "azure_openai: retrying %s without temperature after 400: %s",
                    model, exc,
                )
                call_kwargs.pop("temperature", None)
                return await asyncio.wait_for(
                    asyncio.to_thread(_call_blocking), timeout=timeout_s + 5,
                )
            raise

    async def _complete_stream(
        self,
        messages: List[Dict[str, str]],
        *,
        model: str,
        max_tokens: int,
        temperature: float,
        timeout_s: float,
        **kwargs: Any,
    ):
        """Return an async iterator that yields token deltas as they arrive.

        We launch the SDK's blocking iterator on a worker thread (`asyncio.to_thread`)
        WITHOUT awaiting it — the consumer drains the queue concurrently, so the
        first token reaches the caller as soon as the upstream emits it.
        """
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        SENTINEL = object()

        call_kwargs = _build_kwargs(
            model=model, max_tokens=max_tokens, temperature=temperature,
            timeout_s=timeout_s, stream=True, extra=dict(kwargs),
        )

        def _producer():
            current_kwargs = dict(call_kwargs)
            attempts = 0
            try:
                while True:
                    attempts += 1
                    try:
                        stream = self._client.chat.completions.create(
                            messages=messages, **current_kwargs,
                        )
                        for chunk in stream:
                            delta = (chunk.choices[0].delta.content or "") if chunk.choices else ""
                            if delta:
                                loop.call_soon_threadsafe(queue.put_nowait, delta)
                        return
                    except Exception as exc:  # noqa: BLE001
                        if (
                            attempts == 1
                            and _looks_like_temperature_400(exc)
                            and "temperature" in current_kwargs
                        ):
                            logger.warning(
                                "azure_openai: retrying stream %s without temperature after 400: %s",
                                model, exc,
                            )
                            current_kwargs.pop("temperature", None)
                            continue
                        loop.call_soon_threadsafe(queue.put_nowait, exc)
                        return
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, SENTINEL)

        # Fire-and-forget: produce in a worker thread while the caller drains
        # the queue. Critical: don't `await` here or streaming becomes batch.
        producer_task = asyncio.create_task(asyncio.to_thread(_producer))

        async def _aiter():
            try:
                while True:
                    item = await queue.get()
                    if item is SENTINEL:
                        return
                    if isinstance(item, Exception):
                        raise item
                    yield item
            finally:
                if not producer_task.done():
                    producer_task.cancel()

        return _aiter()


_TEMP_400_RE = re.compile(
    r"temperature.*does not support|"
    r"'temperature' is not supported|"
    r"unsupported_value.*temperature",
    re.IGNORECASE,
)


def _looks_like_temperature_400(exc: BaseException) -> bool:
    """Heuristic: does this exception look like Azure's temperature 400?"""
    msg = str(exc) or ""
    return bool(_TEMP_400_RE.search(msg))
