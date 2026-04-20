"""
Health-suite fixtures.

This suite is designed to be run with **no external services up** by default.
Anything that needs a live Supabase, Qdrant, LLM, etc. is marked `integration`
and skipped unless `RUN_INTEGRATION=1` is set (see root `tests/conftest.py`).

Run from `chatbotAgent/`:

    pytest tests/health -v

To include integration smoke tests:

    RUN_INTEGRATION=1 pytest tests/health -v
"""
from __future__ import annotations

import os
from typing import Any, Dict
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient


# ── App & client ────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def app():
    """Import the FastAPI app once per session (catches boot-time errors)."""
    # SKIP_AUTH so token validation does not hit Supabase during health checks.
    os.environ.setdefault("SKIP_AUTH", "true")
    os.environ.setdefault("DEV_USER_ID", "pytest-health-user")

    from app.main import app as fastapi_app  # noqa: E402

    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)


# ── Bypass auth for contract tests ───────────────────────────────────────────

@pytest.fixture
def bypass_chat_auth(monkeypatch):
    """Bypass Bearer-token validation for contract tests (no Supabase round-trip)."""

    async def _fake_validate(_authorization, _client):
        return "pytest-health-user"

    monkeypatch.setattr("app.api.chat.validate_user_token", _fake_validate)
    return _fake_validate


# ── Helpers ──────────────────────────────────────────────────────────────────

@pytest.fixture
def fake_chat_pipeline_result() -> Dict[str, Any]:
    """A minimal pipeline result that satisfies the ChatResponse schema."""
    return {
        "message": "I hear you. Tell me a little more about what's been weighing on you.",
        "modality": "Person-Centered",
        "confidence": 0.8,
        "processing_time": 0.05,
        "session_insights": {
            "conversation_stage": "trust_window",
            "emotional_state": "neutral",
            "stress_categories": [],
            "therapeutic_approach": "Person-Centered",
            "cultural_pressures": "",
            "language_style": "english",
            "psychological_insights": [],
            "coping_assessment": "",
            "intervention_priority": "short-term",
            "activity_recommendations": [],
            "nlp_analysis": {},
            "cultural_context": {},
            "technique_rationale": "test",
            "performance_metrics": {
                "context_messages": 0,
                "context_activities": 0,
                "has_summary": False,
                "memory_count": 0,
            },
        },
    }
