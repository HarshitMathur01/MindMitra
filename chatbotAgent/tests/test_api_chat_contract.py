"""HTTP contract tests: /chat (mocked pipeline), /health, /, /debug/memory, /onboarding/*."""

from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def bypass_chat_auth(monkeypatch):
    """Avoid real Supabase JWT validation during contract tests."""

    async def _fake_validate(_authorization, _client):
        return "pytest-user-id"

    monkeypatch.setattr("app.api.chat.validate_user_token", _fake_validate)


def _fake_chat_result():
    return {
        "message": "I'm here with you. That sounds really heavy.",
        "modality": "Person-Centered",
        "confidence": 0.85,
        "processing_time": 0.1,
        "session_insights": {
            "conversation_stage": "trust_window",
            "emotional_state": "distressed",
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


@patch("app.api.chat.process_user_chat")
@patch("app.api.chat.fetch_user_context", new_callable=AsyncMock)
def test_post_chat_response_schema(mock_ctx, mock_chat, client):
    mock_ctx.return_value = {
        "recent_messages": [],
        "conversation_summary": {},
        "user_activities": [],
    }
    mock_chat.return_value = _fake_chat_result()

    r = client.post(
        "/chat",
        json={
            "user_message": "I feel overwhelmed",
            "session_id": "test-session-pytest",
            "avatar_visible": True,
            "personality": "mitra",
            "language": "english",
        },
        headers={"Authorization": "Bearer test"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "message" in data and isinstance(data["message"], str)
    assert "modality" in data
    assert "confidence" in data
    assert isinstance(data["confidence"], (int, float))
    assert "animation" in data
    assert "facial_expression" in data
    assert data.get("eval_trace") is None


@patch("app.api.chat.process_user_chat")
@patch("app.api.chat.fetch_user_context", new_callable=AsyncMock)
def test_eval_trace_passed_when_env_and_header(mock_ctx, mock_chat, client, monkeypatch):
    monkeypatch.setenv("ALLOW_EVAL_TRACE", "true")
    mock_ctx.return_value = {
        "recent_messages": [],
        "conversation_summary": {},
        "user_activities": [],
    }
    out = _fake_chat_result()
    out["eval_trace"] = {
        "pipeline_path": "B-emotional",
        "routed_intent": "emotional",
        "memory_injected": False,
        "memory_context_preview": "",
        "memory_char_len": 0,
    }
    mock_chat.return_value = out

    r = client.post(
        "/chat",
        json={
            "user_message": "hello",
            "session_id": "s1",
            "avatar_visible": False,
            "language": "english",
        },
        headers={
            "Authorization": "Bearer test",
            "X-MindMitra-Eval-Trace": "1",
        },
    )
    assert r.status_code == 200
    assert r.json().get("eval_trace") is not None
    assert r.json()["eval_trace"]["pipeline_path"] == "B-emotional"


# ── /health, /, /debug/memory (no auth) ─────────────────────────────────────


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "healthy"
    assert "service" in data
    assert "version" in data


def test_root_ok(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert "health" in body
    assert "/health" in body.get("health", "")


def test_debug_memory_shape(client):
    r = client.get("/debug/memory", params={"user_id": "pytest_user"})
    assert r.status_code == 200
    data = r.json()
    assert "memory_ready" in data
    assert "user_id" in data


# ── /onboarding (validation-only; no LLM) ───────────────────────────────────


def test_mirror_response_validation_error_on_empty_body(client):
    r = client.post("/onboarding/mirror-response")
    assert r.status_code == 422


def test_crisis_check_validation_error_on_empty_body(client):
    r = client.post("/onboarding/crisis-check")
    assert r.status_code == 422
