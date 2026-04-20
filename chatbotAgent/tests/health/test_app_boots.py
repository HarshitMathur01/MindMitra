"""
Health: the FastAPI app imports and registers its expected routes.

If this test fails, the website is broken at the most basic level
(import error, missing dependency, mis-wired router). This is the
single highest-signal smoke test.
"""
from __future__ import annotations


def test_app_imports_cleanly(app):
    assert app is not None
    assert app.title == "MindMitra Chatbot Agent"


def test_health_endpoint_responds(client):
    r = client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("status") in {"healthy", "ok"}, body


def test_root_endpoint_responds(client):
    r = client.get("/")
    assert r.status_code == 200, r.text


def test_required_routes_registered(app):
    """Frontend depends on these exact paths. Don't let them disappear silently."""
    paths = {route.path for route in app.routes if hasattr(route, "path")}
    required = {
        "/health",
        "/chat",
        "/chat/stream",
        "/chat/greeting",
        "/chat/end-session",
        "/transcribe",
    }
    missing = required - paths
    assert not missing, f"Frontend contract routes missing: {missing}"


def test_cors_includes_frontend_origins(app):
    """The Vite dev server (localhost:8080) and Vercel must remain allow-listed."""
    cors_mws = [mw for mw in app.user_middleware if "CORSMiddleware" in str(mw.cls)]
    assert cors_mws, "CORS middleware not configured"
    origins = cors_mws[0].kwargs.get("allow_origins", [])
    assert any("localhost:8080" in o for o in origins), origins
    assert any("vercel.app" in o or "mindmitra" in o for o in origins), origins
