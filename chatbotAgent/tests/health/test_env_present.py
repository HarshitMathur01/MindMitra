"""
Health: required environment variables are present.

We don't ping the providers here — that's an integration concern.
We just assert that the keys the architecture depends on exist,
so misconfigured deploys fail loudly before serving traffic.
"""
from __future__ import annotations

import os

import pytest


REQUIRED_ALWAYS = [
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "GROQ_API_KEY",      # classifier, critic, transcribe
    "GOOGLE_API_KEY",    # Gemini (extraction, reflection, fast draft)
    "AZURE_API_KEY",     # GPT-5-mini primary generator
    "GLM_BASE_URL",
    "GLM_MODEL",
]

REQUIRED_FOR_VOICE = [
    "AZURE_SPEECH_KEY",
    "AZURE_SPEECH_REGION",
]

OPTIONAL_BUT_RECOMMENDED = [
    "ZAI_API_KEY",       # GLM/Z.AI fallback
    "ELEVENLABS_API_KEY",
    "QDRANT_HOST",
    "EMBEDDING_MODEL",
]


@pytest.mark.parametrize("var", REQUIRED_ALWAYS)
def test_required_env_present(var):
    val = os.getenv(var, "").strip()
    assert val, f"Required env var {var} is missing or empty"


@pytest.mark.parametrize("var", REQUIRED_FOR_VOICE)
def test_voice_env_present_or_skip(var):
    val = os.getenv(var, "").strip()
    if not val:
        pytest.skip(f"Voice env {var} not set — voice mode will fall back / be disabled")


@pytest.mark.parametrize("var", OPTIONAL_BUT_RECOMMENDED)
def test_optional_env_observability(var):
    val = os.getenv(var, "").strip()
    if not val:
        pytest.skip(f"Optional env {var} not set — feature degraded but website still works")
