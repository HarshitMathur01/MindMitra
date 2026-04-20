"""
Verify the chat route is wired exclusively to the MITRA dispatcher.

The legacy `process_user_chat` workflow has been removed; with the flag
off the route should return 503 rather than silently falling back. We
don't call the live endpoint here — we just assert the wiring.
"""
from __future__ import annotations


def test_chat_module_imports_dispatch():
    from app.api import chat
    assert hasattr(chat, "mitra_dispatch")


def test_dispatch_flag_default_off(monkeypatch):
    monkeypatch.delenv("MITRA_STACK_ENABLED", raising=False)
    from app.pipeline.mitra import dispatch
    assert dispatch.is_enabled() is False


def test_legacy_workflow_module_removed():
    """`app.pipeline.workflow` must not exist any more."""
    import importlib

    try:
        importlib.import_module("app.pipeline.workflow")
    except ModuleNotFoundError:
        return
    raise AssertionError("legacy app.pipeline.workflow should be deleted")


def test_chat_module_routes_intact():
    """The /chat, /chat/stream, /chat/greeting, /chat/end-session, /transcribe routes
    must still be registered after the dispatcher import."""
    from app.api.chat import router
    paths = {r.path for r in router.routes}
    expected = {"/chat", "/chat/stream", "/chat/greeting", "/chat/end-session", "/transcribe"}
    missing = expected - paths
    assert not missing, f"missing routes: {missing}"
