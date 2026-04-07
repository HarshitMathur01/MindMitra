"""
Azure OpenAI controller — drop-in replacement for LLMController.
Uses openai.OpenAI with base_url override (OpenAI-compatible endpoint).
Returns GLMResponse so callers are unaffected.
"""
import time
import threading
import logging
from typing import List

from openai import OpenAI

from ..core.config import config
from .llm_controller import GLMResponse

logger = logging.getLogger(__name__)


class AzureController:
    def __init__(self):
        self.api_key     = config.get_api_key("azure") or ""
        self.model_name  = config.get_model("azure")
        self.base_url    = config.get("azure_controller.base_url", "")
        self.reasoning_effort = config.get("azure_controller.reasoning.effort", config.get("azure_controller.reasoning_effort", ""))
        self.temperature = float(config.get("azure_controller.temperature", 0.45))
        self.top_p       = float(config.get("azure_controller.top_p", 0.85))
        self.max_tokens  = int(config.get("azure_controller.max_tokens", 1000))

        max_concurrent      = int(config.get("azure_controller.max_concurrent", 3))
        self._semaphore     = threading.Semaphore(max_concurrent)
        self._max_retries   = int(config.get("azure_controller.max_retries", 2))
        self._base_backoff  = float(config.get("azure_controller.base_backoff", 2.0))

        self._client = None
        if not self.api_key:
            logger.warning("⚠️ [Azure] AZURE_API_KEY not set — controller may fail")
        try:
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
            logger.info(f"✅ [Azure] Controller ready – model={self.model_name}")
        except Exception as e:
            logger.error(f"❌ [Azure] Could not initialise client: {e}")

    def _token_param_name(self) -> str:
        """Choose completion token parameter expected by the configured model/endpoint."""
        model = (self.model_name or "").lower()
        if model.startswith("gpt-5"):
            return "max_completion_tokens"
        return "max_tokens"

    def _extract_response_text(self, response) -> str:
        """Extract assistant text from string or structured content payloads."""
        try:
            if not response or not getattr(response, "choices", None):
                return ""

            choice0 = response.choices[0]
            message = getattr(choice0, "message", None)
            if not message:
                return ""

            content = getattr(message, "content", None)
            if isinstance(content, str):
                return content.strip()

            if isinstance(content, list):
                pieces = []
                for item in content:
                    if isinstance(item, dict):
                        text = item.get("text") or item.get("content")
                    else:
                        text = getattr(item, "text", None) or getattr(item, "content", None)
                    if text:
                        pieces.append(str(text))
                joined = "".join(pieces).strip()
                if joined:
                    return joined

            refusal = getattr(message, "refusal", None)
            if isinstance(refusal, str) and refusal.strip():
                return refusal.strip()

            # Last-resort parse for SDK variants that encode content in model_dump().
            if hasattr(response, "model_dump"):
                payload = response.model_dump()
                choices = payload.get("choices") or []
                if choices:
                    msg = choices[0].get("message") or {}
                    content_dump = msg.get("content")
                    if isinstance(content_dump, str) and content_dump.strip():
                        return content_dump.strip()
                    if isinstance(content_dump, list):
                        parts = []
                        for part in content_dump:
                            if isinstance(part, dict):
                                text = part.get("text") or part.get("content")
                                if text:
                                    parts.append(str(text))
                        parsed = "".join(parts).strip()
                        if parsed:
                            return parsed

                    # Azure may return empty content with content_filter metadata.
                    filter_results = choices[0].get("content_filter_results") or {}
                    if any(
                        isinstance(v, dict) and v.get("filtered")
                        for v in filter_results.values()
                    ):
                        return (
                            "I want to support you safely. I can continue with grounding and emotional support "
                            "without details about harm."
                        )
        except Exception:
            return ""
        return ""

    def _extract_stream_delta_text(self, delta) -> str:
        """Extract text from streaming delta payloads across SDK payload variants."""
        if delta is None:
            return ""

        try:
            content = getattr(delta, "content", None)
            if isinstance(content, str):
                return content

            if isinstance(content, list):
                pieces = []
                for item in content:
                    if isinstance(item, dict):
                        text = item.get("text") or item.get("content")
                    else:
                        text = getattr(item, "text", None) or getattr(item, "content", None)
                    if text:
                        pieces.append(str(text))
                return "".join(pieces)

            if isinstance(content, dict):
                text = content.get("text") or content.get("content")
                return str(text) if text else ""
        except Exception:
            return ""

        return ""

    @staticmethod
    def _emit_chunked_text(text: str, chunk_callback, chunk_size: int = 120) -> None:
        """Emit fallback text in small chunks so SSE clients still receive progressive updates."""
        if not text:
            return
        for i in range(0, len(text), chunk_size):
            chunk_callback(text[i:i + chunk_size])

    def _invoke_responses_fallback(self, chat_messages: List[dict], max_tokens: int) -> str:
        """Fallback for GPT-5 deployments that return empty chat.completions content."""
        try:
            prompt = "\n".join(
                f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in chat_messages
            ) + "\nASSISTANT:"
            resp = self._client.responses.create(
                model=self.model_name,
                input=prompt,
                max_output_tokens=max_tokens,
            )

            output_text = getattr(resp, "output_text", None)
            if isinstance(output_text, str) and output_text.strip():
                return output_text.strip()

            if hasattr(resp, "model_dump"):
                payload = resp.model_dump()
                txt = payload.get("output_text")
                if isinstance(txt, str) and txt.strip():
                    return txt.strip()

                parts = []
                for item in payload.get("output", []) or []:
                    for part in item.get("content", []) or []:
                        t = part.get("text")
                        if t:
                            parts.append(str(t))
                joined = "".join(parts).strip()
                if joined:
                    return joined
        except Exception as e:
            error_str = str(e).lower()
            if "content_filter" in error_str:
                return (
                    "I want to support you safely. I can continue with grounding and emotional support "
                    "without details about harm."
                )
            logger.warning(f"⚠️ [Azure] responses API fallback failed: {e}")
        return ""

    def invoke(self, messages: List[dict], chunk_callback=None, **kwargs) -> GLMResponse:
        """Thread-safe invoke — identical interface to LLMController.invoke()."""
        _max_tokens  = kwargs.pop("max_completion_tokens", kwargs.pop("max_tokens", self.max_tokens))
        _temperature = kwargs.pop("temperature", self.temperature)
        _top_p       = kwargs.pop("top_p",       self.top_p)
        _token_param = self._token_param_name()
        _use_temperature = True
        _use_top_p = True

        # Proactively drop temperature/top_p for known reasoning models to prevent 4-8s penalty from API retries
        if self.model_name and ("gpt-5" in self.model_name.lower() or "o1" in self.model_name.lower()):
            _use_temperature = False
            _use_top_p = False

        if self._client is None:
            logger.error("❌ [Azure] Cannot invoke – client not initialised")
            return GLMResponse("Error: Azure client not initialised")

        has_system = any(m.get("role") == "system" for m in messages)
        chat_messages = [{"role": m.get("role", "user"), "content": m["content"]} for m in messages]
        if not has_system:
            chat_messages.insert(0, {"role": "system", "content": "You are a helpful assistant."})

        # Reserve a few extra attempts for one-time parameter compatibility adaptation.
        total_attempts = self._max_retries + 3
        for attempt in range(total_attempts):
            self._semaphore.acquire()
            _released = False
            try:
                base_request = {
                    "model": self.model_name,
                    "messages": chat_messages,
                    _token_param: _max_tokens,
                }
                if _use_temperature:
                    base_request["temperature"] = _temperature
                if _use_top_p:
                    base_request["top_p"] = _top_p
                if self.reasoning_effort:
                    base_request["reasoning_effort"] = self.reasoning_effort

                if chunk_callback:
                    response = self._client.chat.completions.create(
                        **base_request,
                        stream=True,
                    )
                    content = ""
                    saw_stream_text = False
                    for chunk in response:
                        if not chunk.choices:
                            continue
                        piece = self._extract_stream_delta_text(chunk.choices[0].delta)
                        if piece:
                            saw_stream_text = True
                            content += piece
                            chunk_callback(piece)

                    # Some GPT-5 deployments return no text deltas via chat.completions stream.
                    # Fall back to responses API and emit in chunks so stream clients still receive updates.
                    if not saw_stream_text and (self.model_name or "").lower().startswith("gpt-5"):
                        logger.warning(f"⚠️ [Azure] Stream failed or empty chunks. Attempting synchronous fallback API..."); fallback_text = self._invoke_responses_fallback(chat_messages, _max_tokens)
                        if fallback_text:
                            self._emit_chunked_text(fallback_text, chunk_callback)
                            content = fallback_text
                else:
                    response = self._client.chat.completions.create(
                        **base_request,
                    )
                    content = self._extract_response_text(response)
                    if not content and (self.model_name or "").lower().startswith("gpt-5"):
                        content = self._invoke_responses_fallback(chat_messages, _max_tokens)

                if not content and attempt < total_attempts - 1:
                    logger.warning(f"⚠️ [Azure] Empty response (attempt {attempt + 1}/{total_attempts})")
                    self._semaphore.release()
                    _released = True
                    time.sleep(self._base_backoff * (2 ** attempt))
                    continue
                return GLMResponse(content)

            except Exception as e:
                error_str = str(e).lower()

                # Some newer OpenAI-compatible models reject max_tokens and require max_completion_tokens.
                if (
                    "unsupported parameter" in error_str
                    and "max_tokens" in error_str
                    and _token_param != "max_completion_tokens"
                ):
                    logger.warning("⚠️ [Azure] Switching token parameter to max_completion_tokens and retrying")
                    _token_param = "max_completion_tokens"
                    self._semaphore.release()
                    _released = True
                    continue

                # Some Azure/OpenAI model deployments only support default sampling settings.
                if (
                    "temperature" in error_str
                    and ("unsupported parameter" in error_str or "unsupported value" in error_str or "does not support" in error_str)
                    and _use_temperature
                ):
                    logger.warning("⚠️ [Azure] Temperature not supported for this model; retrying without temperature")
                    _use_temperature = False
                    self._semaphore.release()
                    _released = True
                    continue

                if (
                    "top_p" in error_str
                    and ("unsupported parameter" in error_str or "unsupported value" in error_str or "does not support" in error_str)
                    and _use_top_p
                ):
                    logger.warning("⚠️ [Azure] top_p not supported for this model; retrying without top_p")
                    _use_top_p = False
                    self._semaphore.release()
                    _released = True
                    continue

                if "429" in str(e) or "rate" in error_str or "quota" in error_str:
                    wait = self._base_backoff * (2 ** attempt)
                    logger.warning(f"⚠️ [Azure] Rate limited (attempt {attempt + 1}/{total_attempts}), backing off {wait:.1f}s")
                    self._semaphore.release()
                    _released = True
                    time.sleep(wait)
                    continue

                if "timeout" in error_str:
                    logger.warning(f"⚠️ [Azure] Timeout (attempt {attempt + 1}/{total_attempts}): {e}")
                    self._semaphore.release()
                    _released = True
                    time.sleep(self._base_backoff)
                    continue

                logger.error(f"❌ [Azure] Request failed: {e}")
                if attempt < total_attempts - 1:
                    self._semaphore.release()
                    _released = True
                    continue
                raise

            finally:
                if not _released:
                    self._semaphore.release()

        raise RuntimeError("[Azure] All retries exhausted")
