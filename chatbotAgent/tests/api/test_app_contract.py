"""FastAPI app import, health, route, and CORS contract tests."""
from __future__ import annotations

import pytest


@pytest.mark.api
def test_app_imports_cleanly(app) -> None:
    assert app is not None
    assert app.title == "MindMitra Chatbot Agent"


@pytest.mark.api
def test_health_endpoint_responds(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200, response.text
    assert response.json().get("status") in {"healthy", "ok"}


@pytest.mark.api
def test_root_endpoint_responds(client) -> None:
    response = client.get("/")

    assert response.status_code == 200, response.text


@pytest.mark.api
def test_required_routes_registered(app) -> None:
    paths = {route.path for route in app.routes if hasattr(route, "path")}

    assert {"/health", "/chat", "/onboarding", "/transcribe"} <= paths
    assert "/ws/chat" not in paths
    assert "/chat/stream" not in paths
    assert "/me-memory" not in paths


@pytest.mark.api
def test_cors_includes_frontend_origins(app) -> None:
    cors_middleware = [mw for mw in app.user_middleware if "CORSMiddleware" in str(mw.cls)]

    assert cors_middleware, "CORS middleware not configured"
    origins = cors_middleware[0].kwargs.get("allow_origins", [])
    assert any("localhost:8080" in origin for origin in origins), origins
    assert any("vercel.app" in origin or "mindmitra" in origin for origin in origins), origins
