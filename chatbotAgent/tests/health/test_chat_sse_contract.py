"""
Health: POST /chat/stream still emits SSE-shaped events the frontend can parse.

The frontend reads the response body as a byte stream, splits on newlines,
and parses each `data: {...}` line as JSON with optional `chunk` / `message` /
`error` fields. This contract MUST stay stable across the architecture
migration. If it breaks, the chat UI freezes.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest


def _parse_sse_lines(body: bytes) -> list[dict]:
    """Mimic the frontend's SSE parser."""
    out: list[dict] = []
    for raw in body.decode("utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line.startswith("data:"):
            continue
        payload = line[len("data:"):].strip()
        if not payload:
            continue
        try:
            out.append(json.loads(payload))
        except json.JSONDecodeError:
            # Tolerate non-JSON heartbeats but record them so we can see drift.
            out.append({"_raw": payload})
    return out


@pytest.fixture(autouse=True)
def _enable_mitra(monkeypatch):
    monkeypatch.setenv("MITRA_STACK_ENABLED", "1")


@patch("app.api.chat.mitra_dispatch.run_mitra_turn", new_callable=AsyncMock)
@patch("app.api.chat.fetch_user_context", new_callable=AsyncMock)
@patch("app.api.chat.fetch_previous_session_summary", return_value={})
@patch("app.api.chat.get_hybrid_message_count", return_value=0)
def test_chat_stream_returns_sse_events(
    _msg_count, _prev_sum, mock_ctx, mock_chat, client, bypass_chat_auth, fake_chat_pipeline_result
):
    """A single happy-path turn produces SSE events with parseable JSON."""
    mock_ctx.return_value = {
        "recent_messages": [],
        "conversation_summary": {},
        "user_activities": [],
    }

    # Simulate the streaming pipeline: push two chunks via the stream_callback
    # and return a final dict.
    async def fake_process(*args, **kwargs):
        cb = kwargs.get("stream_callback")
        if cb:
            cb("Hi, ")
            cb("I hear you.")
        return fake_chat_pipeline_result

    mock_chat.side_effect = fake_process

    r = client.post(
        "/chat/stream",
        json={
            "user_message": "I'm feeling overwhelmed",
            "session_id": "pytest-session",
            "avatar_visible": False,
            "personality": "mitra",
            "language": "english",
        },
        headers={"Authorization": "Bearer test"},
    )
    assert r.status_code == 200, r.text

    events = _parse_sse_lines(r.content)
    assert events, "No SSE events emitted — frontend would hang"

    # Frontend looks for objects containing chunk OR message OR error.
    has_payload = any(
        ("chunk" in ev) or ("message" in ev) or ("error" in ev)
        for ev in events
    )
    assert has_payload, f"None of the SSE events looked like a frontend payload: {events!r}"


@patch("app.api.chat.mitra_dispatch.run_mitra_turn", new_callable=AsyncMock)
@patch("app.api.chat.fetch_user_context", new_callable=AsyncMock)
@patch("app.api.chat.fetch_previous_session_summary", return_value={})
@patch("app.api.chat.get_hybrid_message_count", return_value=0)
def test_chat_stream_handles_pipeline_error_gracefully(
    _msg_count, _prev_sum, mock_ctx, mock_chat, client, bypass_chat_auth
):
    """If the pipeline blows up, the stream emits an `error` event — never a 500."""
    mock_ctx.return_value = {
        "recent_messages": [],
        "conversation_summary": {},
        "user_activities": [],
    }
    mock_chat.side_effect = RuntimeError("boom")

    r = client.post(
        "/chat/stream",
        json={
            "user_message": "hi",
            "session_id": "pytest-session-err",
            "avatar_visible": False,
            "language": "english",
        },
        headers={"Authorization": "Bearer test"},
    )
    # Streaming endpoints return 200 even on internal error; the error rides
    # in the body so the frontend can show a soft message.
    assert r.status_code == 200, r.text
    events = _parse_sse_lines(r.content)
    assert any("error" in ev for ev in events), f"Pipeline error not reported in SSE: {events!r}"
