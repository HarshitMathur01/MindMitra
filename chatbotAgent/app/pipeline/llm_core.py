"""Layer 6 — LLM inference core.

Emits LLM token deltas through ``on_chunk`` so the HTTP adapter can collect
or forward them. Fallback chain (configurable via env):

  Default (production):
    1. Azure gpt-5-mini  (primary — reasoning model, requires GPT-5 params)
    2. Groq Llama-70B    (fast fallback, always available)
    3. GLM-4-Flash       (third fallback)
    4. Static fallback template (handled by safety gate caller)

  urgency = 3 → handled in crisis_bypass, never reaches this layer.

GPT-5 / reasoning models on Azure Chat Completions:
  - Use ``max_completion_tokens`` instead of ``max_tokens``.
  - Do NOT send ``temperature`` (any non-default value raises 400).
  - Do NOT send ``stop`` sequences.
  - Optional: ``reasoning_effort`` (low / medium / high).
  Auto-detected via ``env().azure_model_family == "gpt5_reasoning"``
  which is inferred from the deployment name or overridden by env var.

Each call returns an ``LLMResult`` with ``raw_response``, ``tokens_used``
metadata, ``finish_reason``, and the ``fallback_chain`` actually exercised.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, List, Optional

from ..core.connections import get_azure, get_glm, get_groq, guarded_call
from ..core.env import env
from ..core.logging import get_logger, log_context
from ..models.signals import LLMResult, OrchestratorOutput, PromptBundle

logger = get_logger(__name__)

OnChunk = Optional[Callable[[str], Awaitable[None] | None]]


async def generate_response(
    *,
    prompt: PromptBundle,
    orchestrator: OrchestratorOutput,
    urgency: int,
    trace_id: str | None = None,
    on_chunk: OnChunk = None,
) -> LLMResult:
    started = time.perf_counter()
    fallback_chain: List[str] = []
    e = env()

    messages = [
        {"role": "system", "content": prompt.system_text},
        {"role": "user", "content": prompt.user_text},
    ]

    providers = _provider_chain(
        e.llm_primary_provider,
        urgency=urgency,
        mode=orchestrator.selected_mode,
    )
    assert not (urgency > 0 and "glm4flash" in providers), "GLM must never be used for urgency > 0"
    logger.debug(
        "provider chain selected",
        extra=log_context(
            providers=providers,
            urgency=urgency,
            trace_id=trace_id,
            mode=orchestrator.selected_mode,
            reason="fallback_routing",
        ),
    )

    result: LLMResult = _error_result("no_provider_attempted", "none")
    for provider in providers:
        if provider == "azure_gpt4o":
            logger.debug(
                "→ Azure GPT-4o",
                extra=log_context(
                    temp=orchestrator.temperature,
                    max_tokens=orchestrator.max_response_tokens,
                    urgency=urgency,
                    trace_id=trace_id,
                    mode=orchestrator.selected_mode,
                    role="primary" if not fallback_chain else "fallback",
                ),
            )
            result = await _try_azure(
                messages,
                max_tokens=orchestrator.max_response_tokens,
                temperature=orchestrator.temperature,
                trace_id=trace_id,
                on_chunk=on_chunk,
            )
        elif provider == "groq_llama70b":
            logger.debug(
                "→ Groq Llama fallback",
                extra=log_context(
                    temp=orchestrator.temperature,
                    max_tokens=orchestrator.max_response_tokens,
                    urgency=urgency,
                    trace_id=trace_id,
                    mode=orchestrator.selected_mode,
                    role="primary" if not fallback_chain else "fallback",
                ),
            )
            result = await _try_groq(
                messages,
                max_tokens=orchestrator.max_response_tokens,
                temperature=orchestrator.temperature,
                trace_id=trace_id,
                on_chunk=on_chunk,
            )
        elif provider == "glm4flash":
            logger.debug(
                "→ GLM fallback",
                extra=log_context(
                    temp=orchestrator.temperature,
                    max_tokens=orchestrator.max_response_tokens,
                    urgency=urgency,
                    trace_id=trace_id,
                    mode=orchestrator.selected_mode,
                    role="primary" if not fallback_chain else "fallback",
                ),
            )
            result = await _try_glm(
                messages,
                max_tokens=orchestrator.max_response_tokens,
                temperature=orchestrator.temperature,
                trace_id=trace_id,
                on_chunk=on_chunk,
            )
        else:
            logger.warning("unknown provider in chain", extra=log_context(provider=provider, outcome="skipped"))
            continue

        fallback_chain.append(provider)
        if _is_success(result):
            result.latency_ms = (time.perf_counter() - started) * 1000.0
            logger.info(
                "provider complete",
                extra=log_context(
                    llm=provider,
                    trace_id=trace_id,
                    latency_ms=result.latency_ms,
                    response_len=len(result.raw_response),
                    finish=result.finish_reason,
                    outcome="success",
                ),
            )
            result.fallback_chain = fallback_chain
            return result

        logger.warning(
            "provider failed; trying fallback",
            extra=log_context(
                llm=provider,
                trace_id=trace_id,
                finish=result.finish_reason,
                reason=result.raw_response[:80] if result.raw_response else "empty_or_error",
                next_available=len(providers) - len(fallback_chain),
            ),
        )

    # All LLMs exhausted — caller (safety gate) uses static fallback template
    logger.error(
        "all LLMs failed — static fallback required",
        extra=log_context(trace_id=trace_id, fallback_chain=fallback_chain, urgency=urgency, outcome="static_fallback"),
    )
    result.fallback_chain = fallback_chain
    result.latency_ms = (time.perf_counter() - started) * 1000.0
    return result


async def generate_safety_retry(
    *,
    prompt: PromptBundle,
    orchestrator: OrchestratorOutput,
    urgency: int,
    trace_id: str | None = None,
) -> LLMResult:
    """Fast regeneration for the safety gate.

    Always uses Groq regardless of the configured primary provider chain.
    This keeps safety retries under 2s so the safety gate timeout budget is
    not consumed by slow Azure GPT-5 reasoning calls.
    """
    started = time.perf_counter()
    messages = [
        {"role": "system", "content": prompt.system_text},
        {"role": "user", "content": prompt.user_text},
    ]
    e = env()
    result = await _try_groq(
        messages,
        max_tokens=orchestrator.max_response_tokens,
        temperature=orchestrator.temperature,
        trace_id=trace_id,
        on_chunk=None,
    )
    result.fallback_chain = ["groq_llama70b"]
    result.latency_ms = (time.perf_counter() - started) * 1000.0
    if _is_success(result):
        logger.info("safety retry complete", extra=log_context(trace_id=trace_id, llm="groq_llama70b", response_len=len(result.raw_response), outcome="success"))
    else:
        logger.warning("safety retry failed", extra=log_context(trace_id=trace_id, llm="groq_llama70b", urgency=urgency, outcome="failed"))
    return result


def _is_success(result: LLMResult) -> bool:
    return result.finish_reason != "error" and bool(result.raw_response.strip())


def _provider_chain(primary: str, *, urgency: int, mode: str) -> List[str]:
    configured_chain = env().llm_provider_chain
    if configured_chain:
        providers = [_normalise_provider_name(item.strip()) for item in configured_chain.split(",")]
        valid = [provider for provider in providers if _provider_allowed(provider, urgency=urgency, mode=mode)]
        if valid:
            return valid
        logger.warning("invalid LLM_PROVIDER_CHAIN; using primary provider", extra=log_context(configured_chain=configured_chain))

    if primary == "groq":
        return [p for p in ["groq_llama70b", "azure_gpt4o", "glm4flash"] if _provider_allowed(p, urgency=urgency, mode=mode)]
    if primary == "azure":
        return [p for p in ["azure_gpt4o", "groq_llama70b", "glm4flash"] if _provider_allowed(p, urgency=urgency, mode=mode)]
    if primary == "glm":
        return [p for p in ["glm4flash", "groq_llama70b", "azure_gpt4o"] if _provider_allowed(p, urgency=urgency, mode=mode)]
    logger.warning("invalid LLM_PRIMARY_PROVIDER; falling back to azure chain", extra=log_context(primary=primary))
    return [p for p in ["azure_gpt4o", "groq_llama70b", "glm4flash"] if _provider_allowed(p, urgency=urgency, mode=mode)]


def _normalise_provider_name(provider: str) -> str:
    mapping = {
        "azure": "azure_gpt4o",
        "azure_gpt4o": "azure_gpt4o",
        "groq": "groq_llama70b",
        "groq_llama70b": "groq_llama70b",
        "glm": "glm4flash",
        "glm4flash": "glm4flash",
    }
    normalised = mapping.get(provider)
    if normalised is None and provider:
        logger.warning("ignoring unknown provider in LLM_PROVIDER_CHAIN", extra=log_context(provider=provider))
    return normalised or ""


def _provider_allowed(provider: str, *, urgency: int, mode: str) -> bool:
    if not provider:
        return False
    # Spec invariant: GLM is a companion-only free fallback and must never
    # answer elevated-distress turns.
    if provider == "glm4flash" and (urgency > 0 or mode != "companion"):
        return False
    return True


def _is_gpt5_reasoning(e) -> bool:
    """Return True when the Azure deployment is a GPT-5 / reasoning model.

    Detection order:
    1. Explicit ``AZURE_MODEL_FAMILY=gpt5_reasoning`` env override.
    2. Auto-detection: deployment name contains ``gpt-5``.
    """
    return e.azure_model_family == "gpt5_reasoning"


async def _try_azure(messages, *, max_tokens, temperature, trace_id: str | None = None, on_chunk: OnChunk) -> LLMResult:
    client = get_azure()
    if client is None:
        logger.warning("Azure client unavailable", extra=log_context(trace_id=trace_id, consequence="try_next_provider", reason="missing_env_or_init_failed"))
        return _error_result("azure_unavailable", "azure_gpt4o")
    e = env()
    reasoning = _is_gpt5_reasoning(e)
    logger.debug(
        "Azure request prepared",
        extra=log_context(
            model=e.azure_deployment,
            trace_id=trace_id,
            model_family=e.azure_model_family,
            reasoning_effort=e.azure_reasoning_effort if reasoning else "n/a",
            max_tokens=e.azure_max_completion_tokens if reasoning else max_tokens,
        ),
    )
    try:
        if reasoning:
            # GPT-5 / reasoning models: use max_completion_tokens, no temperature/stop.
            # reasoning_effort controls internal thinking budget (low = fastest).
            create_kwargs: dict = {
                "model": e.azure_deployment,
                "messages": messages,
                "max_completion_tokens": e.azure_max_completion_tokens,
                "reasoning_effort": e.azure_reasoning_effort,
                "stream": True,
                "timeout": e.azure_timeout_s,
            }
        else:
            # Classic GPT-4o / non-reasoning: standard params.
            create_kwargs = {
                "model": e.azure_deployment,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stop": ["\n\n\n"],
                "stream": True,
                "timeout": e.azure_timeout_s,
            }
        stream = await guarded_call("azure", lambda: client.chat.completions.create(**create_kwargs), timeout_s=8.0)
        return await _consume_stream(stream, on_chunk=on_chunk, llm_used="azure_gpt4o", trace_id=trace_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Azure call failed",
            extra=log_context(trace_id=trace_id, exception_type=type(exc).__name__, reason=str(exc), fallback="next_provider"),
        )
        return _error_result(str(exc), "azure_gpt4o")


async def _try_glm(messages, *, max_tokens, temperature, trace_id: str | None = None, on_chunk: OnChunk) -> LLMResult:
    client = get_glm()
    if client is None:
        logger.warning("GLM client unavailable", extra=log_context(trace_id=trace_id, consequence="try_next_provider", reason="missing_env_or_init_failed"))
        return _error_result("glm_unavailable", "glm4flash")
    e = env()
    logger.debug("GLM request prepared", extra=log_context(trace_id=trace_id, model=e.glm_model, max_tokens=max_tokens))
    try:
        stream = await guarded_call(
            "glm",
            lambda: client.chat.completions.create(
                model=e.glm_model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
                timeout=e.glm_timeout_s,
            ),
            timeout_s=8.0,
        )
        return await _consume_stream(stream, on_chunk=on_chunk, llm_used="glm4flash", trace_id=trace_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GLM call failed", extra=log_context(trace_id=trace_id, exception_type=type(exc).__name__, reason=str(exc), fallback="next_provider"))
        return _error_result(str(exc), "glm4flash")


async def _try_groq(messages, *, max_tokens, temperature, trace_id: str | None = None, on_chunk: OnChunk) -> LLMResult:
    client = get_groq()
    if client is None:
        logger.warning("Groq client unavailable", extra=log_context(trace_id=trace_id, consequence="try_next_provider", reason="missing_env_or_init_failed"))
        return _error_result("groq_unavailable", "groq_llama70b")
    e = env()
    logger.debug("Groq fallback request prepared", extra=log_context(trace_id=trace_id, model=e.groq_fallback_model, max_tokens=max_tokens))
    try:
        stream = await guarded_call(
            "groq",
            lambda: client.chat.completions.create(
                model=e.groq_fallback_model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
            ),
            timeout_s=5.0,
        )
        return await _consume_stream(stream, on_chunk=on_chunk, llm_used="groq_llama70b", trace_id=trace_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Groq fallback call failed", extra=log_context(trace_id=trace_id, exception_type=type(exc).__name__, reason=str(exc), fallback="next_provider"))
        return _error_result(str(exc), "groq_llama70b")


async def _consume_stream(stream: Any, *, on_chunk: OnChunk, llm_used: str, trace_id: str | None = None) -> LLMResult:
    started = time.perf_counter()
    first_token_logged = False
    pieces: List[str] = []
    finish: str = "stop"
    prompt_tokens = 0
    completion_tokens = 0
    try:
        async for event in stream:
            choices = getattr(event, "choices", None)
            if not choices:
                continue
            for choice in choices:
                delta = getattr(choice, "delta", None)
                if delta is not None:
                    text = getattr(delta, "content", None)
                    if text:
                        pieces.append(text)
                        if not first_token_logged:
                            first_token_logged = True
                            logger.debug(
                                "first token",
                                extra=log_context(trace_id=trace_id, llm=llm_used, TTFT_ms=(time.perf_counter() - started) * 1000.0),
                            )
                        if on_chunk is not None:
                            await _maybe_await(on_chunk(text))
                fr = getattr(choice, "finish_reason", None)
                if fr:
                    finish = fr if fr in ("stop", "length", "content_filter") else "stop"
            usage = getattr(event, "usage", None)
            if usage is not None:
                prompt_tokens = int(getattr(usage, "prompt_tokens", prompt_tokens) or prompt_tokens)
                completion_tokens = int(getattr(usage, "completion_tokens", completion_tokens) or completion_tokens)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "stream consume failed",
            extra=log_context(trace_id=trace_id, llm=llm_used, exception_type=type(exc).__name__, reason=str(exc)),
        )
        if not pieces:
            return _error_result(str(exc), llm_used)
        finish = "error"

    text = "".join(pieces).strip()
    total_ms = (time.perf_counter() - started) * 1000.0
    if finish == "content_filter":
        logger.warning(
            "content_filter from provider — static fallback will be used",
            extra=log_context(trace_id=trace_id, llm=llm_used, finish=finish, latency_ms=total_ms),
        )
    logger.info(
        "← complete",
        extra=log_context(
            llm=llm_used,
            trace_id=trace_id,
            total_ms=total_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            tokens=prompt_tokens + completion_tokens,
            finish=finish,
        ),
    )
    return LLMResult(
        raw_response=text,
        tokens_used={
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total": prompt_tokens + completion_tokens,
        },
        finish_reason=finish,  # type: ignore[arg-type]
        llm_used=llm_used,
        latency_ms=0.0,
    )


async def _maybe_await(value: Any) -> None:
    if value is None:
        return
    if hasattr(value, "__await__"):
        try:
            await value
        except Exception:  # noqa: BLE001
            pass


def _error_result(message: str, llm_used: str) -> LLMResult:
    return LLMResult(
        raw_response="",
        tokens_used={"prompt_tokens": 0, "completion_tokens": 0, "total": 0},
        finish_reason="error",
        llm_used=llm_used,
        latency_ms=0.0,
    )
