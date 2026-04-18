import json
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.cognitive_layer_types import CognitivLayerOutput


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def bypass_chat_auth(monkeypatch):
    async def _fake_validate(_authorization, _client):
        return "pytest-user-id"

    monkeypatch.setattr("app.api.chat.validate_user_token", _fake_validate)


def test_cognitive_layer_to_ctx_dict_is_14_keys():
    out = CognitivLayerOutput()
    d = out.to_ctx_dict()
    assert isinstance(d, dict)
    assert len(d.keys()) == 14
    # Ensure required keys exist (spot-check)
    for k in (
        "cl_intent",
        "cl_primary_emotion",
        "cl_emotional_valence",
        "cl_emotional_intensity",
        "cl_arc_trajectory",
        "cl_arc_delta",
        "cl_risk_level",
        "cl_intervention_sequence",
        "cl_response_length",
        "cl_question_allowed",
        "cl_language_mirror",
        "cl_mi_move",
        "cl_cultural_context",
        "cl_fallback_used",
    ):
        assert k in d


@patch("app.api.chat.process_user_chat")
@patch("app.api.chat.fetch_user_context", new_callable=AsyncMock)
def test_stream_contract_emits_deltas_then_complete(mock_ctx, mock_chat, client):
    mock_ctx.return_value = {
        "recent_messages": [],
        "conversation_summary": {},
        "user_activities": [],
    }

    def _fake_process_user_chat(*args, **kwargs):
        cb = kwargs.get("chunk_callback")
        assert cb is not None
        cb("Hello ")
        cb("world.")
        return {
            "message": "Hello world.",
            "modality": "therapy",
            "confidence": 0.9,
            "cl_emotional_intensity": 0.2,
        }

    mock_chat.side_effect = _fake_process_user_chat

    with client.stream(
        "POST",
        "/chat/stream",
        json={
            "user_message": "hi",
            "session_id": "s1",
            "avatar_visible": False,
            "language": "english",
        },
        headers={"Authorization": "Bearer test"},
    ) as r:
        assert r.status_code == 200
        raw = "\n".join([line.decode("utf-8") if isinstance(line, (bytes, bytearray)) else line for line in r.iter_lines() if line])

    # Must emit deltas
    assert "event: text_chunk_delta" in raw
    # Must not emit legacy events
    assert "event: text_chunk\n" not in raw
    assert "event: avatar_ready" not in raw

    # Must emit complete with final message payload
    assert "event: complete" in raw
    # Extract the last complete payload and validate JSON shape
    complete_lines = [ln for ln in raw.splitlines() if ln.startswith("data: ") and '"status"' in ln]
    assert complete_lines
    payload = json.loads(complete_lines[-1].removeprefix("data: ").strip())
    assert payload.get("status") == "success"
    assert payload.get("message") == "Hello world."


def test_memoir_bucket_selection_drops_below_hard_floor():
    from app.agents.memory_retriever import MemoryRetriever, MEMOIR_HARD_FLOOR

    scored = [
        (0.9, {"id": "1", "type": "identity"}),
        (MEMOIR_HARD_FLOOR - 0.001, {"id": "2", "type": "emotional"}),
        (0.5, {"id": "3", "type": "contextual"}),
    ]
    top = MemoryRetriever._select_top7_intent_buckets(scored, intent_bucket="casual")
    ids = {m.get("id") for m in top}
    assert "2" not in ids
