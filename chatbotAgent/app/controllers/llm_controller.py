"""
GLM concurrency controller — thread-safe ZhipuAI wrapper with Groq fallback.
BUG FIX: hardcoded max_tokens/temperature/top_p → use config values from __init__.
"""
import os
import time
import threading
import logging
from typing import Any, List, Optional

from zai import ZhipuAiClient

from ..core.config import config
from ..core.logging import log_timing

logger = logging.getLogger(__name__)


class GLMResponse:
    """Uniform response wrapper so callers always see .content."""

    def __init__(self, content: str):
        self.content = content if content else ""

    def __bool__(self) -> bool:
        return bool(self.content)


class LLMController:
    def __init__(
        self,
        model: str = None,
        max_concurrent: int = None,
        max_retries: int = None,
        base_backoff: float = None,
    ):
        self.api_key = config.get_api_key("zai") or os.getenv("ZHIPUAI_API_KEY", "")
        if not self.api_key:
            logger.warning("⚠️ [GLM] ZAI_API_KEY / ZHIPUAI_API_KEY not set - GLM controller may fail")
            self.api_key = "dummy_key_for_init"

        self.model_name = model or config.get_model("glm")
        # Read generation params from config (FIX: was hardcoded 1000/0.3/0.8)
        self.max_tokens: int = int(config.get("llm_controller.max_tokens", 1000))
        self.temperature: float = float(config.get_temperature("glm"))
        self.top_p: float = float(config.get("llm_controller.top_p", 0.8))

        max_concurrent = max_concurrent or config.get("llm_controller.max_concurrent", 1)
        self._semaphore = threading.Semaphore(max_concurrent)
        self._max_retries: int = max_retries or config.get("llm_controller.max_retries", 2)
        self._base_backoff: float = base_backoff or config.get("llm_controller.base_backoff", 2.0)
        self._groq_fallback = None

        self._client = None
        try:
            self._client = ZhipuAiClient(api_key=self.api_key)
            logger.info(f"✅ [GLM] Controller ready – model={self.model_name}")
        except Exception as e:
            logger.error(f"❌ [GLM] Could not initialise ZhipuAI client: {e}")

    def set_groq_fallback(self, groq_client) -> None:
        """Attach a Groq client for fallback if GLM fails."""
        self._groq_fallback = groq_client

    def invoke(self, messages: List[dict], chunk_callback=None, **kwargs) -> GLMResponse:
        """Thread-safe invoke with semaphore gating and exponential back-off."""
        # Allow per-call overrides for generation params
        _max_tokens = kwargs.pop('max_tokens', self.max_tokens)
        _temperature = kwargs.pop('temperature', self.temperature)
        _top_p = kwargs.pop('top_p', self.top_p)

        if self._client is None:
            logger.error("❌ [GLM] Cannot invoke – client not initialised")
            return GLMResponse("Error: GLM client not initialised")

        for attempt in range(self._max_retries):
            self._semaphore.acquire()
            _released = False
            try:
                # Preserve roles from caller; only inject default system msg if none present
                has_system = any(m.get("role") == "system" for m in messages)
                if has_system:
                    chat_messages = [
                        {"role": m.get("role", "user"), "content": m["content"]}
                        for m in messages
                    ]
                else:
                    chat_messages = [{"role": "system", "content": "You are a helpful assistant."}]
                    chat_messages += [
                        {"role": m.get("role", "user"), "content": m["content"]}
                        for m in messages
                    ]

                with log_timing("GLM LLM Call", model=self.model_name, stream=bool(chunk_callback)):
                    if chunk_callback:
                        response = self._client.chat.completions.create(
                            model=self.model_name,
                            messages=chat_messages,
                            max_tokens=_max_tokens,
                            temperature=_temperature,
                            top_p=_top_p,
                            stream=True,
                            **kwargs,
                        )
                        content = ""
                        for chunk in response:
                            if hasattr(chunk, 'choices') and chunk.choices and hasattr(chunk.choices[0], 'delta') and chunk.choices[0].delta.content:
                                piece = chunk.choices[0].delta.content
                                content += piece
                                chunk_callback(piece)
                    else:
                        response = self._client.chat.completions.create(
                            model=self.model_name,
                            messages=chat_messages,
                            max_tokens=_max_tokens,
                            temperature=_temperature,
                            top_p=_top_p,
                            **kwargs,
                        )
                        content = (
                            response.choices[0].message.content
                            if response and hasattr(response, 'choices') and response.choices
                            else ""
                        )
                
                if not content:
                    logger.warning(
                        f"⚠️ [GLM] Empty response (attempt {attempt + 1}/{self._max_retries})"
                    )
                    if attempt < self._max_retries - 1:
                        wait = self._base_backoff * (2 ** attempt)
                        self._semaphore.release()
                        _released = True
                        time.sleep(wait)
                        continue
                return GLMResponse(content)

            except Exception as e:
                error_str = str(e).lower()

                if "429" in str(e) or "rate" in error_str or "quota" in error_str:
                    wait = self._base_backoff * (2 ** attempt)
                    logger.warning(
                        f"⚠️ [GLM] Rate limited (attempt {attempt + 1}/{self._max_retries}), "
                        f"backing off {wait:.1f}s"
                    )
                    self._semaphore.release()
                    _released = True
                    time.sleep(wait)
                    continue

                if "timeout" in error_str:
                    logger.warning(
                        f"⚠️ [GLM] Timeout (attempt {attempt + 1}/{self._max_retries}): {e}"
                    )
                    self._semaphore.release()
                    _released = True
                    time.sleep(self._base_backoff)
                    continue

                logger.warning(f"⚠️ [GLM] Exception: {e}")
                if self._groq_fallback:
                    try:
                        logger.info("🔄 [GLM] Attempting Groq fallback...")
                        fb_resp = self._groq_fallback.chat.completions.create(
                            model="meta-llama/llama-4-scout-17b-16e-instruct",
                            messages=chat_messages,
                            max_tokens=_max_tokens,
                            temperature=_temperature,
                        )
                        fb_content = (
                            fb_resp.choices[0].message.content if fb_resp.choices else ""
                        )
                        if fb_content:
                            logger.info(
                                f"✅ [GLM] Groq fallback succeeded ({len(fb_content)} chars)"
                            )
                            return GLMResponse(fb_content)
                    except Exception as fb_err:
                        logger.error(f"❌ [GLM] Groq fallback failed: {fb_err}")

                logger.error(f"❌ [GLM] Request failed: {e}")
                if attempt < self._max_retries - 1:
                    self._semaphore.release()
                    _released = True
                    continue
                raise

            finally:
                if not _released:
                    self._semaphore.release()

        raise RuntimeError("[GLM] All retries and fallbacks exhausted")
