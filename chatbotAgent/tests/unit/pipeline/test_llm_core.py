"""Layer 6 LLM fallback-chain and Azure parameter tests."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.models.signals import LLMResult
from app.pipeline import llm_core
from tests.factories import make_orchestrator, make_prompt


def _error(llm: str) -> LLMResult:
    return LLMResult(
        raw_response="",
        tokens_used={"prompt_tokens": 0, "completion_tokens": 0, "total": 0},
        finish_reason="error",
        llm_used=llm,
        latency_ms=0.0,
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_azure_failure_falls_back_to_groq_for_routine_urgency(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("LLM_PRIMARY_PROVIDER", "azure")
    monkeypatch.delenv("LLM_PROVIDER_CHAIN", raising=False)
    env_mod.reload_env()

    async def azure(*_args, **_kwargs):
        return _error("azure_gpt4o")

    async def groq(*_args, **_kwargs):
        return LLMResult(
            raw_response="I hear you.",
            tokens_used={"prompt_tokens": 1, "completion_tokens": 3, "total": 4},
            finish_reason="stop",
            llm_used="groq_llama70b",
            latency_ms=0.0,
        )

    async def glm(*_args, **_kwargs):
        raise AssertionError("GLM should not run when Groq succeeds")

    monkeypatch.setattr(llm_core, "_try_azure", azure)
    monkeypatch.setattr(llm_core, "_try_groq", groq)
    monkeypatch.setattr(llm_core, "_try_glm", glm)

    result = await llm_core.generate_response(prompt=make_prompt(), orchestrator=make_orchestrator(), urgency=0)

    assert result.raw_response == "I hear you."
    assert result.llm_used == "groq_llama70b"
    assert result.fallback_chain == ["azure_gpt4o", "groq_llama70b"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_all_llm_failures_surface_static_fallback_signal(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("LLM_PRIMARY_PROVIDER", "azure")
    monkeypatch.delenv("LLM_PROVIDER_CHAIN", raising=False)
    env_mod.reload_env()

    async def azure(*_args, **_kwargs):
        return _error("azure_gpt4o")

    async def groq(*_args, **_kwargs):
        return _error("groq_llama70b")

    async def glm(*_args, **_kwargs):
        return _error("glm4flash")

    monkeypatch.setattr(llm_core, "_try_azure", azure)
    monkeypatch.setattr(llm_core, "_try_groq", groq)
    monkeypatch.setattr(llm_core, "_try_glm", glm)

    result = await llm_core.generate_response(prompt=make_prompt(), orchestrator=make_orchestrator(), urgency=1)

    assert result.finish_reason == "error"
    assert result.raw_response == ""
    assert result.fallback_chain == ["azure_gpt4o", "groq_llama70b"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_explicit_provider_chain_can_skip_broken_azure(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("LLM_PROVIDER_CHAIN", "groq")
    env_mod.reload_env()

    async def azure(*_args, **_kwargs):
        raise AssertionError("Azure should be skipped by explicit provider chain")

    async def groq(*_args, **_kwargs):
        return LLMResult(
            raw_response="Only Groq.",
            tokens_used={"prompt_tokens": 1, "completion_tokens": 2, "total": 3},
            finish_reason="stop",
            llm_used="groq_llama70b",
            latency_ms=0.0,
        )

    monkeypatch.setattr(llm_core, "_try_azure", azure)
    monkeypatch.setattr(llm_core, "_try_groq", groq)

    result = await llm_core.generate_response(prompt=make_prompt(), orchestrator=make_orchestrator(), urgency=0)

    assert result.raw_response == "Only Groq."
    assert result.fallback_chain == ["groq_llama70b"]


@pytest.mark.unit
@pytest.mark.parametrize(
    ("deployment", "override", "expected_family"),
    [
        ("gpt-5-mini", None, "gpt5_reasoning"),
        ("gpt-4o", None, "classic"),
        ("gpt-5-mini", "classic", "classic"),
    ],
)
def test_azure_model_family_detection(
    monkeypatch: pytest.MonkeyPatch,
    deployment: str,
    override: str | None,
    expected_family: str,
) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", deployment)
    if override is None:
        monkeypatch.delenv("AZURE_MODEL_FAMILY", raising=False)
    else:
        monkeypatch.setenv("AZURE_MODEL_FAMILY", override)

    env = env_mod.reload_env()

    assert env.azure_model_family == expected_family
    assert llm_core._is_gpt5_reasoning(env) is (expected_family == "gpt5_reasoning")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gpt5_azure_call_uses_reasoning_safe_parameters(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5-mini")
    monkeypatch.setenv("AZURE_MODEL_FAMILY", "gpt5_reasoning")
    monkeypatch.setenv("AZURE_REASONING_EFFORT", "low")
    monkeypatch.setenv("AZURE_MAX_COMPLETION_TOKENS", "400")
    env_mod.reload_env()

    captured_kwargs: dict = {}

    async def fake_create(**kwargs):
        captured_kwargs.update(kwargs)

        chunk = MagicMock()
        chunk.choices = [MagicMock(delta=MagicMock(content="ok"), finish_reason=None)]
        chunk.usage = None
        done = MagicMock()
        done.choices = [MagicMock(delta=MagicMock(content=None), finish_reason="stop")]
        done.usage = MagicMock(prompt_tokens=10, completion_tokens=5)

        class FakeStream:
            async def __aiter__(self):
                yield chunk
                yield done

        return FakeStream()

    mock_client = MagicMock()
    mock_client.chat.completions.create = fake_create

    with patch("app.pipeline.llm_core.get_azure", return_value=mock_client):
        await llm_core._try_azure(
            [{"role": "user", "content": "hello"}],
            max_tokens=80,
            temperature=0.7,
            on_chunk=None,
        )

    assert captured_kwargs["max_completion_tokens"] == 400
    assert captured_kwargs.get("reasoning_effort") == "low"
    assert "max_tokens" not in captured_kwargs
    assert "temperature" not in captured_kwargs
    assert "stop" not in captured_kwargs


@pytest.mark.unit
@pytest.mark.asyncio
async def test_classic_azure_call_uses_classic_chat_parameters(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    monkeypatch.setenv("AZURE_MODEL_FAMILY", "classic")
    env_mod.reload_env()

    captured_kwargs: dict = {}

    async def fake_create(**kwargs):
        captured_kwargs.update(kwargs)

        chunk = MagicMock()
        chunk.choices = [MagicMock(delta=MagicMock(content="ok"), finish_reason=None)]
        chunk.usage = None
        done = MagicMock()
        done.choices = [MagicMock(delta=MagicMock(content=None), finish_reason="stop")]
        done.usage = MagicMock(prompt_tokens=10, completion_tokens=5)

        class FakeStream:
            async def __aiter__(self):
                yield chunk
                yield done

        return FakeStream()

    mock_client = MagicMock()
    mock_client.chat.completions.create = fake_create

    with patch("app.pipeline.llm_core.get_azure", return_value=mock_client):
        await llm_core._try_azure(
            [{"role": "user", "content": "hello"}],
            max_tokens=80,
            temperature=0.7,
            on_chunk=None,
        )

    assert captured_kwargs["max_tokens"] == 80
    assert captured_kwargs["temperature"] == pytest.approx(0.7)
    assert "stop" in captured_kwargs
    assert "max_completion_tokens" not in captured_kwargs
    assert "reasoning_effort" not in captured_kwargs
