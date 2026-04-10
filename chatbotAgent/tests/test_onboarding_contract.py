"""Onboarding routes: validation-only (avoids accidental LLM spend in default pytest)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_mirror_response_validation_error_on_empty_body(client):
    r = client.post("/onboarding/mirror-response")
    assert r.status_code == 422


def test_crisis_check_validation_error_on_empty_body(client):
    r = client.post("/onboarding/crisis-check")
    assert r.status_code == 422
