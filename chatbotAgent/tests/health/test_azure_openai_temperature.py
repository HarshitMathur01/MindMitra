"""
Unit tests for the Azure OpenAI provider's parameter-shaping helpers.

These pin down the workaround for Azure deployments (gpt-5*, o1*, o3*, o4*)
that reject custom `temperature` / `top_p` with HTTP 400 `unsupported_value`.
"""
from __future__ import annotations

import pytest

from app.providers.azure_openai_client import (
    _build_kwargs,
    _looks_like_temperature_400,
    _model_requires_default_sampling,
)


@pytest.mark.parametrize(
    "model",
    [
        "gpt-5-mini",
        "GPT-5-Mini",
        "gpt-5",
        "o1-preview",
        "o3-mini",
        "o4-mini",
        "o5-experimental",
    ],
)
def test_model_requires_default_sampling_true(model):
    assert _model_requires_default_sampling(model) is True


@pytest.mark.parametrize(
    "model",
    [
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "gemini-2.5-flash",
        "",
    ],
)
def test_model_requires_default_sampling_false(model):
    assert _model_requires_default_sampling(model) is False


def test_build_kwargs_drops_temperature_for_gpt5_family():
    kw = _build_kwargs(
        model="gpt-5-mini",
        max_tokens=200,
        temperature=0.7,
        timeout_s=15.0,
        stream=False,
        extra={"top_p": 0.9, "presence_penalty": 0.2, "logprobs": True},
    )
    assert "temperature" not in kw
    assert "top_p" not in kw
    assert "presence_penalty" not in kw
    assert "logprobs" not in kw
    assert kw["model"] == "gpt-5-mini"
    assert kw["max_completion_tokens"] == 200
    assert kw["stream"] is False


def test_build_kwargs_keeps_temperature_for_gpt4o():
    kw = _build_kwargs(
        model="gpt-4o-mini",
        max_tokens=200,
        temperature=0.7,
        timeout_s=15.0,
        stream=True,
        extra={"top_p": 0.9},
    )
    assert kw["temperature"] == 0.7
    assert kw["top_p"] == 0.9
    assert kw["stream"] is True


def test_build_kwargs_no_warning_when_temperature_is_one_for_gpt5():
    kw = _build_kwargs(
        model="gpt-5-mini",
        max_tokens=10,
        temperature=1.0,
        timeout_s=5.0,
        stream=False,
        extra={},
    )
    assert "temperature" not in kw  # we always omit for fixed-sampling models


def test_looks_like_temperature_400_recognises_azure_message():
    msg = (
        "Error code: 400 - {'error': {'message': \"Unsupported value: "
        "'temperature' does not support 0.7 with this model. Only the "
        "default (1) value is supported.\", 'type': 'invalid_request_error', "
        "'param': 'temperature', 'code': 'unsupported_value'}}"
    )
    assert _looks_like_temperature_400(Exception(msg)) is True


def test_looks_like_temperature_400_recognises_o3_message():
    msg = "BadRequestError: Unsupported parameter: 'temperature' is not supported with this model."
    assert _looks_like_temperature_400(Exception(msg)) is True


def test_looks_like_temperature_400_ignores_unrelated_errors():
    assert _looks_like_temperature_400(Exception("rate limit exceeded")) is False
    assert _looks_like_temperature_400(Exception("network down")) is False
