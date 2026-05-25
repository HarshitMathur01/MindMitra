"""HTTP /chat contract tests with the v3 pipeline mocked at layer boundaries."""
from __future__ import annotations

import pytest

from app.core.session import SessionObject
from app.models.signals import LLMResult, MemoryResult
from tests.factories import make_safety_result, make_signals


@pytest.fixture
def patched_successful_pipeline(monkeypatch: pytest.MonkeyPatch):
    from app.api import chat_ws as chat_mod

    async def fake_session_startup(user_id: str, **_kwargs):
        return SessionObject(
            session_id="session-test",
            user_id=user_id,
            current_mode="companion",
            cultural_frame_id="metro_social",
            is_new_session=True,
        )

    async def fake_save_session(_session):
        return True

    async def fake_load_session(_user_id: str, _session_id: str):
        return None

    async def fake_check_rate_limit(_user_id: str):
        return True, 1

    async def fake_ensure_user_row(auth_uuid: str):
        return auth_uuid

    async def fake_extract_signals(_ingested, *, session):
        return make_signals(urgency=1, code_mix=0.0).model_copy(update={"extraction_latency_ms": 1.0})

    async def fake_get_or_compute_embedding(_text: str):
        return [0.0] * 384

    async def fake_retrieve_memory(*_args, **_kwargs):
        return MemoryResult(memory_retrieved=False)

    async def fake_generate_response(*, prompt, orchestrator, urgency, on_chunk, trace_id=None):
        await on_chunk("hello ")
        await on_chunk("there.")
        return LLMResult(
            raw_response="hello there.",
            tokens_used={"prompt_tokens": 2, "completion_tokens": 2, "total": 4},
            llm_used="fake",
            finish_reason="stop",
            latency_ms=1.0,
            fallback_chain=["fake"],
        )

    async def fake_run_safety_gate(*, raw_response: str, **_kwargs):
        return make_safety_result(raw_response, source="llm_primary")

    async def noop_write_audit_log(_payload: dict):
        return True

    monkeypatch.setattr(chat_mod.session_service, "session_startup", fake_session_startup)
    monkeypatch.setattr(chat_mod.session_service, "save_session", fake_save_session)
    monkeypatch.setattr(chat_mod.session_service, "load_session", fake_load_session)
    monkeypatch.setattr(chat_mod.session_service, "check_and_increment_rate_limit", fake_check_rate_limit)
    monkeypatch.setattr(chat_mod.profile_service, "ensure_user_row", fake_ensure_user_row)
    monkeypatch.setattr(chat_mod.profile_service, "write_audit_log", noop_write_audit_log)
    monkeypatch.setattr(chat_mod.signal_extraction, "extract_signals", fake_extract_signals)
    monkeypatch.setattr(chat_mod, "get_or_compute_embedding", fake_get_or_compute_embedding)
    monkeypatch.setattr(chat_mod.memory_retrieval, "retrieve_memory", fake_retrieve_memory)
    monkeypatch.setattr(chat_mod.llm_core, "generate_response", fake_generate_response)
    monkeypatch.setattr(chat_mod.safety_gate, "run_safety_gate", fake_run_safety_gate)


@pytest.mark.api
def test_chat_http_round_trip(client, patched_successful_pipeline) -> None:
    response = client.post(
        "/chat",
        json={"content": "I'm having a tough day", "session_id": "new"},
        headers={"Authorization": "Bearer dev"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["text"] == "hello there."
    assert body["session_id"] == "session-test"
    assert body["mode"] == "companion"
    assert body["urgency"] == 1
    assert body["source"] == "llm_primary"
    assert body["meta"]["response_source"] == "llm_primary"
    assert body["trace_id"]


@pytest.mark.api
def test_chat_http_meta_carries_personalization_signals(client, patched_successful_pipeline) -> None:
    """Tone params, affect vector, and cultural frame must flow to the client.

    These fields drive the mode-adaptive surface treatment, warmth-tuned
    bubble animation, and affect-reactive ambient overlay in
    useChatPersonalization on the frontend. Regressions here silently
    break those features without throwing — guard them explicitly.
    """
    response = client.post(
        "/chat",
        json={"content": "I'm having a tough day", "session_id": "new"},
        headers={"Authorization": "Bearer dev"},
    )

    assert response.status_code == 200, response.text
    meta = response.json()["meta"]

    assert "tone_params" in meta, "tone_params missing from meta"
    tone = meta["tone_params"]
    for key in (
        "formality", "code_mix", "sentence_length", "warmth",
        "emoji_use", "directness", "humour_tolerance", "pace",
    ):
        assert key in tone, f"tone_params.{key} missing"
        assert isinstance(tone[key], (int, float))
        assert 0.0 <= float(tone[key]) <= 1.0

    assert "affect_vector" in meta, "affect_vector missing from meta"
    affect = meta["affect_vector"]
    for key in ("valence", "arousal", "dominance"):
        assert key in affect, f"affect_vector.{key} missing"
    assert -1.0 <= float(affect["valence"]) <= 1.0
    assert 0.0 <= float(affect["arousal"]) <= 1.0
    assert 0.0 <= float(affect["dominance"]) <= 1.0

    assert "cultural_frame_id" in meta, "cultural_frame_id missing from meta"
    assert isinstance(meta["cultural_frame_id"], str)
    assert meta["cultural_frame_id"]


@pytest.mark.api
def test_chat_rejects_invalid_message_before_pipeline_work(client, patched_successful_pipeline) -> None:
    response = client.post(
        "/chat",
        json={"content": "   ", "session_id": "new"},
        headers={"Authorization": "Bearer dev"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["reason"] == "empty_message"


@pytest.mark.api
def test_chat_rejects_invalid_session_id(client, patched_successful_pipeline) -> None:
    response = client.post(
        "/chat",
        json={"content": "hello", "session_id": "../not-a-session"},
        headers={"Authorization": "Bearer dev"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["reason"] == "invalid_session_id"


@pytest.mark.api
def test_chat_returns_429_when_daily_limit_exceeded(
    client,
    patched_successful_pipeline,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api import chat_ws as chat_mod

    async def denied(_user_id: str):
        return False, 21

    monkeypatch.setattr(chat_mod.session_service, "check_and_increment_rate_limit", denied)

    response = client.post(
        "/chat",
        json={"content": "hello", "session_id": "new"},
        headers={"Authorization": "Bearer dev"},
    )

    assert response.status_code == 429
    assert response.json()["detail"]["reason"] == "rate_limit_exceeded"


@pytest.mark.api
def test_chat_returns_503_when_v3_disabled(
    client,
    patched_successful_pipeline,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import env as env_mod

    monkeypatch.setenv("MHA_V3_ENABLED", "0")
    env_mod.reload_env()

    response = client.post(
        "/chat",
        json={"content": "hello", "session_id": "new"},
        headers={"Authorization": "Bearer dev"},
    )

    assert response.status_code == 503
    assert "MHA disabled" in response.json()["detail"]
