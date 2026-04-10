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


def test_debug_memory_shape(client):
    r = client.get("/debug/memory", params={"user_id": "pytest_user"})
    assert r.status_code == 200
    data = r.json()
    assert "mem0_ready" in data
    assert "user_id" in data
