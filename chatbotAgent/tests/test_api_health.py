"""API contract tests: health and root (no auth, no LLM)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


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


def test_debug_memory_returns_404_when_disabled(client, monkeypatch):
    """In production (no DEBUG flag) the debug route must be unreachable."""
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("DEBUG", raising=False)
    monkeypatch.delenv("DEBUG_ROUTES", raising=False)
    r = client.get("/debug/memory", params={"user_id": "pytest_user"})
    assert r.status_code == 404


def test_debug_memory_shape_when_enabled(client, monkeypatch):
    """When DEBUG_ROUTES=1 the memory probe should return its usual shape."""
    monkeypatch.setenv("DEBUG_ROUTES", "1")
    monkeypatch.delenv("DEBUG_MEMORY_TOKEN", raising=False)
    r = client.get("/debug/memory", params={"user_id": "pytest_user"})
    assert r.status_code == 200
    data = r.json()
    assert "mem0_ready" in data
    assert "user_id" in data


def test_debug_memory_requires_token_when_set(client, monkeypatch):
    """If DEBUG_MEMORY_TOKEN is configured, missing/wrong header → 401."""
    monkeypatch.setenv("DEBUG_ROUTES", "1")
    monkeypatch.setenv("DEBUG_MEMORY_TOKEN", "s3cr3t")
    r = client.get("/debug/memory", params={"user_id": "pytest_user"})
    assert r.status_code == 401
    r = client.get(
        "/debug/memory",
        params={"user_id": "pytest_user"},
        headers={"X-Debug-Token": "s3cr3t"},
    )
    assert r.status_code == 200
