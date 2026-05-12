"""Layer 7 safety gate fallback and retry tests."""
from __future__ import annotations

import pytest

from app.models.signals import SafetyFlags
from app.pipeline import safety_gate
from tests.factories import make_orchestrator, make_signals


async def _static_fallback() -> str:
    return "I'm here with you. Could you say that another way?"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_content_filter_short_circuits_to_static_fallback() -> None:
    async def regenerate(*_args, **_kwargs):
        raise AssertionError("content_filter should not regenerate")

    result = await safety_gate.run_safety_gate(
        raw_response="",
        orchestrator=make_orchestrator(),
        signals=make_signals(),
        finish_reason="content_filter",
        regenerate=regenerate,
        static_fallback=_static_fallback,
    )

    assert result.approved is False
    assert result.response_source == "static_fallback"
    assert result.safety_flags.harm is True
    assert result.safety_flags.harm_category == "azure_content_filter"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_empty_llm_response_uses_static_fallback() -> None:
    async def regenerate(*_args, **_kwargs):
        raise AssertionError("empty response should not regenerate")

    result = await safety_gate.run_safety_gate(
        raw_response="",
        orchestrator=make_orchestrator(),
        signals=make_signals(),
        finish_reason="error",
        regenerate=regenerate,
        static_fallback=_static_fallback,
    )

    assert result.approved is False
    assert result.response_source == "static_fallback"
    assert "another way" in result.approved_response


@pytest.mark.unit
@pytest.mark.asyncio
async def test_harm_classifier_retries_then_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"regenerate": 0}

    async def always_harm(_text: str, *, trace_id: str | None = None):
        return SafetyFlags(harm=True, harm_category="unsafe_self_harm")

    async def regenerate(_instruction: str, _temperature: float) -> str:
        calls["regenerate"] += 1
        return "rewritten but still unsafe"

    monkeypatch.setattr(safety_gate, "_classify_harm_sycophancy", always_harm)

    result = await safety_gate.run_safety_gate(
        raw_response="unsafe response with many enough words to pass length check",
        orchestrator=make_orchestrator(),
        signals=make_signals(),
        finish_reason="stop",
        regenerate=regenerate,
        static_fallback=_static_fallback,
    )

    assert calls["regenerate"] == 2
    assert result.response_source == "static_fallback"
    assert result.safety_flags.harm is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sycophancy_retry_can_recover_to_approved_response(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier_results = [
        SafetyFlags(harm=False, sycophancy=True, sycophancy_type="hopelessness_validation"),
        SafetyFlags(harm=False, sycophancy=False),
    ]

    async def classify(_text: str, *, trace_id: str | None = None):
        return classifier_results.pop(0)

    async def regenerate(_instruction: str, _temperature: float) -> str:
        return "That sounds painfully heavy, and we can slow this down together for a moment."

    monkeypatch.setattr(safety_gate, "_classify_harm_sycophancy", classify)
    orchestrator = make_orchestrator()
    orchestrator.tone_params.code_mix = 0.0

    result = await safety_gate.run_safety_gate(
        raw_response="Yes, it is hopeless and nothing can change for you.",
        orchestrator=orchestrator,
        signals=make_signals(),
        finish_reason="stop",
        regenerate=regenerate,
        static_fallback=_static_fallback,
    )

    assert result.approved is True
    assert result.response_source == "llm_retry"
    assert result.retries_used == 1
    assert "slow this down" in result.approved_response


@pytest.mark.unit
@pytest.mark.asyncio
async def test_classifier_degraded_allows_python_only_checks(monkeypatch: pytest.MonkeyPatch) -> None:
    async def degraded(_text: str, *, trace_id: str | None = None):
        return None

    async def regenerate(*_args, **_kwargs):
        raise AssertionError("degraded classifier should not force regeneration")

    monkeypatch.setattr(safety_gate, "_classify_harm_sycophancy", degraded)

    result = await safety_gate.run_safety_gate(
        raw_response="I'm with you. Let's take this one breath at a time, slowly.",
        orchestrator=make_orchestrator(),
        signals=make_signals(),
        finish_reason="stop",
        regenerate=regenerate,
        static_fallback=_static_fallback,
    )

    assert result.approved is True
    assert result.safety_flags.harm is None
    assert result.safety_flags.sycophancy is None
