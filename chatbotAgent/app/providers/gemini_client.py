"""Gemini provider — gemini-2.5-flash for extraction, reflection, speculative draft.

Strong on Hindi/Hinglish, 1M context, fast first-token, JSON mode reliable.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List

from .base import BaseLLMProvider, ProviderUnavailable

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    name = "gemini"

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

    @staticmethod
    def _to_gemini_messages(messages: List[Dict[str, str]]) -> tuple[str, List[Dict[str, Any]]]:
        """Split out system message, convert OpenAI-style history → Gemini contents."""
        system_parts = []
        history: List[Dict[str, Any]] = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_parts.append(content)
            else:
                gemini_role = "user" if role in ("user", "human") else "model"
                history.append({"role": gemini_role, "parts": [content]})
        return ("\n\n".join(system_parts).strip(), history)

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
        system_text, history = self._to_gemini_messages(messages)

        def _call_blocking() -> str:
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            if kwargs.get("json_mode"):
                generation_config["response_mime_type"] = "application/json"

            mdl = self._genai.GenerativeModel(
                model_name=model,
                system_instruction=system_text or None,
                generation_config=generation_config,
            )
            resp = mdl.generate_content(history)
            try:
                return resp.text or ""
            except Exception:
                # Fall back: walk candidates manually if .text raises on safety blocks.
                if resp.candidates:
                    parts = resp.candidates[0].content.parts
                    return "".join(getattr(p, "text", "") for p in parts)
                return ""

        if stream:
            return await self._complete_stream(
                system_text, history,
                model=model, max_tokens=max_tokens,
                temperature=temperature, timeout_s=timeout_s,
            )

        return await asyncio.wait_for(asyncio.to_thread(_call_blocking), timeout=timeout_s + 5)

    async def _complete_stream(
        self, system_text: str, history: List[Dict[str, Any]],
        *, model: str, max_tokens: int, temperature: float, timeout_s: float,
    ):
        """Return an async iterator yielding Gemini token chunks as they arrive."""
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        SENTINEL = object()

        def _producer():
            try:
                mdl = self._genai.GenerativeModel(
                    model_name=model,
                    system_instruction=system_text or None,
                    generation_config={
                        "temperature": temperature,
                        "max_output_tokens": max_tokens,
                    },
                )
                stream = mdl.generate_content(history, stream=True)
                for chunk in stream:
                    text = getattr(chunk, "text", "")
                    if text:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:  # noqa: BLE001
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, SENTINEL)

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
