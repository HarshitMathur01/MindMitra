"""Live environment contract checks.

These validate deployment readiness and are skipped unless RUN_LIVE_ENV=1 is
set. The fast local suite should not require real provider secrets.
"""
from __future__ import annotations

import os

import pytest


REQUIRED_ALWAYS = [
    "ENV",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_JWT_SECRET",
    "SECRET_KEY",
    "REDIS_URL",
    "QDRANT_URL",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
]

OPTIONAL_BUT_RECOMMENDED = [
    "GLM_API_KEY",
    "SENTRY_DSN",
    "POSTHOG_API_KEY",
]


def _env(var: str) -> str:
    return os.getenv(var, "").strip()


@pytest.mark.live_env
@pytest.mark.parametrize("var", REQUIRED_ALWAYS)
def test_required_env_present(var: str) -> None:
    assert _env(var), f"Required env var {var} is missing or empty"


@pytest.mark.live_env
@pytest.mark.parametrize("var", OPTIONAL_BUT_RECOMMENDED)
def test_optional_observability_env_present(var: str) -> None:
    if not _env(var):
        pytest.skip(f"Optional env {var} is not set; feature degrades but core chat can still run")
