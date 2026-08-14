"""Contract tests for GET /anam/session-token — the route the frontend calls.

This route used to send ``{"personaId": ..., "avatarOnly": true}`` and nothing
else, which froze the entire conversation surface inside a persona stored in
Anam Lab. It now builds the persona server-side from ``config.yaml``.

What is pinned here:
  * ``avatarOnly`` never comes back — it strips the persona's LLM and TTS, and
    turnkey mode needs both,
  * blank config values are omitted rather than sent as ``""``, which Anam
    rejects, while ``0`` / ``False`` survive (a silence timeout of 0 disables
    auto-hangup and is a deliberate choice on this surface),
  * the client cannot supply persona config,
  * upstream error bodies are never echoed back — they mirror the request, and
    the request carries the system prompt.
"""
from __future__ import annotations

import dataclasses
from typing import Any, Dict

import httpx
import pytest

from app.api import anam as anam_mod
from app.api import avatar as avatar_mod
from app.services import anam_quota


ENDPOINT = "/anam/session-token"

# Large enough that the daily-quota clamp in GET /anam/session-token never
# binds against the fixture's session.max_session_length_seconds (1200) —
# these tests are about the persona payload, not the quota gate. See
# test_anam_quota.py for the gate itself.
_ABUNDANT_QUOTA_S = 999_999


@pytest.fixture(autouse=True)
def _abundant_anam_quota(monkeypatch):
    """Every test in this file gets effectively-unlimited daily quota unless
    it opts out by re-patching these within the test body."""
    async def fake_remaining(_user_id: str) -> int:
        return _ABUNDANT_QUOTA_S

    async def fake_mark_start(_user_id: str) -> None:
        return None

    monkeypatch.setattr(anam_quota, "get_remaining_seconds", fake_remaining)
    monkeypatch.setattr(anam_quota, "mark_session_start", fake_mark_start)


def _patch_env(monkeypatch, **overrides):
    """V3Env is a frozen dataclass, so swap in a modified copy of the real one."""
    patched = dataclasses.replace(avatar_mod.env(), **overrides)
    monkeypatch.setattr(avatar_mod, "env", lambda: patched)
    monkeypatch.setattr(anam_mod, "env", lambda: patched)
    return patched


def _patch_avatar_section(monkeypatch, section: Dict[str, Any]):
    """``config`` is a singleton shared by both modules — patch it once."""
    monkeypatch.setattr(
        avatar_mod.config,
        "get_section",
        lambda name: section if name == "avatar" else {},
    )


@pytest.fixture
def anam_env(monkeypatch):
    _patch_env(
        monkeypatch,
        anam_api_key="test-anam-key",
        anam_api_base="https://api.anam.test/v1",
        anam_llm_id="llm-under-test",
    )
    _patch_avatar_section(
        monkeypatch,
        {
            "avatar_model": "cara-4",
            "session": {
                "max_session_length_seconds": 1200,
                "skip_greeting": False,
                "initial_message": "Hey, I'm here.",
                "language_code": "en",
                "video_quality": "auto",
                "enable_session_replay": False,
            },
            "voice_detection": {
                "end_of_speech_sensitivity": 0.35,
                "silence_before_session_end_seconds": 0,
            },
            "voice_generation": {"speed": 0.95, "emotion": "calm"},
            "director_notes": {"preset_style": "supportive", "expressivity": 0.45},
            "tool_ids": ["tool-change-language", "tool-end-call"],
            "personas": {
                "brunette": {
                    "name": "Aria",
                    "avatar_id": "anam-aria",
                    "voice_id": "voice-aria",
                },
                "avaturn": {"name": "Maya", "avatar_id": "anam-maya", "voice_id": ""},
                "olaf": {"name": "Olaf", "avatar_id": "", "voice_id": ""},
            },
        },
    )


def _mock_post(monkeypatch, *, status_code: int = 200, payload=None, raises=None):
    captured: Dict[str, Any] = {}

    async def fake_post(self, url, **kwargs):  # noqa: ANN001
        captured["url"] = url
        captured["headers"] = kwargs.get("headers") or {}
        captured["json"] = kwargs.get("json")
        if raises is not None:
            raise raises
        return httpx.Response(
            status_code=status_code,
            json=payload if payload is not None else {},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return captured


def test_returns_503_when_key_unconfigured(client, monkeypatch):
    _patch_env(monkeypatch, anam_api_key="")
    response = client.get(ENDPOINT)
    assert response.status_code == 503


def test_avatar_only_is_gone(client, anam_env, monkeypatch):
    """avatarOnly strips the persona's brain; turnkey mode cannot use it."""
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-1"})

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    persona = captured["json"]["personaConfig"]
    assert "avatarOnly" not in persona
    assert "personaId" not in persona
    # A full inline persona instead. `ephemeral` is the discriminator the
    # server names in its own validation error for an inline config.
    assert persona["type"] == "ephemeral"
    assert persona["avatarId"] == "anam-aria"
    assert persona["llmId"] == "llm-under-test"
    assert persona["systemPrompt"]


def test_sends_the_full_conversation_surface(client, anam_env, monkeypatch):
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-2"})

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    body = captured["json"]
    persona = body["personaConfig"]

    assert persona["avatarModel"] == "cara-4"
    assert persona["voiceId"] == "voice-aria"
    assert persona["maxSessionLengthSeconds"] == 1200
    assert persona["initialMessage"] == "Hey, I'm here."
    assert persona["voiceDetectionOptions"]["endOfSpeechSensitivity"] == 0.35
    assert persona["voiceGenerationOptions"] == {"speed": 0.95, "emotion": "calm"}
    assert persona["directorNotes"] == {
        "presetStyle": "supportive",
        "expressivity": 0.45,
    }
    # Tools are referenced by id, never inline: the live endpoint rejects
    # `tools[].type: "system"` despite the published spec listing it.
    assert persona["toolIds"] == ["tool-change-language", "tool-end-call"]
    assert "tools" not in persona

    # sessionOptions is a sibling of personaConfig, not a member of it.
    assert body["sessionOptions"]["videoQuality"] == "auto"
    assert body["sessionOptions"]["sessionReplay"] == {"enableSessionReplay": False}


def test_falsey_but_meaningful_values_survive(client, anam_env, monkeypatch):
    """0 disables auto-hangup on silence; dropping it would re-enable it."""
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-3"})

    client.get(ENDPOINT)

    persona = captured["json"]["personaConfig"]
    assert persona["voiceDetectionOptions"]["silenceBeforeSessionEndSeconds"] == 0
    assert persona["skipGreeting"] is False


def test_blank_values_are_omitted_not_sent_empty(client, anam_env, monkeypatch):
    """Anam rejects empty strings; an unset voice must mean 'use the default'."""
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-4"})

    response = client.get(ENDPOINT, params={"avatar_id": "avaturn"})

    assert response.status_code == 200
    persona = captured["json"]["personaConfig"]
    assert persona["avatarId"] == "anam-maya"
    assert "voiceId" not in persona


def test_unknown_avatar_id_is_rejected(client, anam_env, monkeypatch):
    _mock_post(monkeypatch, payload={"sessionToken": "sess-5"})
    response = client.get(ENDPOINT, params={"avatar_id": "not-a-real-avatar"})
    assert response.status_code == 400


def test_unconfigured_persona_fails_loudly(client, anam_env, monkeypatch):
    _mock_post(monkeypatch, payload={"sessionToken": "sess-6"})
    response = client.get(ENDPOINT, params={"avatar_id": "olaf"})
    assert response.status_code == 503


def test_language_is_allowlisted(client, anam_env, monkeypatch):
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-7"})

    client.get(ENDPOINT, params={"language": "hi-IN"})
    assert captured["json"]["personaConfig"]["languageCode"] == "hi"

    # Not on the allow-list — fall back to the configured default rather than
    # forwarding whatever the client asked for.
    client.get(ENDPOINT, params={"language": "klingon"})
    assert captured["json"]["personaConfig"]["languageCode"] == "en"


def test_api_key_never_reaches_the_client(client, anam_env, monkeypatch):
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-8"})

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    assert response.json()["sessionToken"] == "sess-8"
    assert captured["headers"]["Authorization"] == "Bearer test-anam-key"
    assert "test-anam-key" not in response.text


def test_upstream_body_is_not_echoed(client, anam_env, monkeypatch):
    """Anam mirrors the request on validation errors — that includes the prompt."""
    _mock_post(
        monkeypatch,
        status_code=400,
        payload={"error": "bad request", "echo": "You are Mitra — a warm companion"},
    )

    response = client.get(ENDPOINT)

    assert response.status_code == 502
    assert "You are Mitra" not in response.text


def test_returns_502_on_transport_error(client, anam_env, monkeypatch):
    _mock_post(monkeypatch, raises=httpx.ConnectError("boom"))
    response = client.get(ENDPOINT)
    assert response.status_code == 502


def test_returns_502_when_token_missing(client, anam_env, monkeypatch):
    _mock_post(monkeypatch, payload={"somethingElse": "nope"})
    response = client.get(ENDPOINT)
    assert response.status_code == 502


def test_director_notes_drop_invalid_preset(monkeypatch):
    """Cue-only tags like "curious" are rejected by the session-token API."""
    _patch_avatar_section(
        monkeypatch,
        {
            "director_notes": {"preset_style": "curious", "expressivity": 0.5},
            "personas": {"brunette": {"name": "Aria", "avatar_id": "anam-aria"}},
        },
    )
    persona = avatar_mod.build_persona_config("brunette")
    assert persona["directorNotes"] == {"expressivity": 0.5}


def test_director_notes_preset_and_custom_are_mutually_exclusive(monkeypatch):
    _patch_avatar_section(
        monkeypatch,
        {
            "director_notes": {
                "preset_style": "supportive",
                "custom_style_prompt": "Be extremely dramatic.",
            },
            "personas": {"brunette": {"name": "Aria", "avatar_id": "anam-aria"}},
        },
    )
    persona = avatar_mod.build_persona_config("brunette")
    assert persona["directorNotes"] == {"presetStyle": "supportive"}


def test_persona_prompt_carries_spoken_delivery_guidance():
    """The identity block is written for text; TTS reads markdown out loud."""
    prompt = avatar_mod._persona_system_prompt()

    assert "You are Mitra" in prompt
    assert "Tele-MANAS 14416" in prompt
    assert "Crisis is handled before you see the message" not in prompt
    assert "speaking out loud" in prompt
    assert "change_language" in prompt


# ── Daily Anam video quota gate ──────────────────────────────────────────────
# Deeper coverage of the quota arithmetic itself lives in test_anam_quota.py.
# These pin what this specific route does with whatever anam_quota reports.


def test_429_when_quota_already_exhausted(client, anam_env, monkeypatch):
    async def fake_remaining(_user_id: str) -> int:
        return 5  # below min_session_seconds (30) — refuse to mint at all

    monkeypatch.setattr(anam_quota, "get_remaining_seconds", fake_remaining)
    _mock_post(monkeypatch, payload={"sessionToken": "should-not-be-used"})

    response = client.get(ENDPOINT)

    assert response.status_code == 429


def test_max_session_length_is_clamped_to_remaining_quota(client, anam_env, monkeypatch):
    """Anam's own timer is the backstop, so it must never exceed daily quota —
    even though the fixture's configured max_session_length_seconds is 1200."""
    async def fake_remaining(_user_id: str) -> int:
        return 240

    monkeypatch.setattr(anam_quota, "get_remaining_seconds", fake_remaining)
    captured = _mock_post(monkeypatch, payload={"sessionToken": "sess-clamped"})

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    assert captured["json"]["personaConfig"]["maxSessionLengthSeconds"] == 240
    body = response.json()
    assert body["remainingSeconds"] == 240
    assert body["maxSessionLengthSeconds"] == 240


def test_mint_anchors_the_heartbeat_baseline(client, anam_env, monkeypatch):
    """A successful mint must anchor anam_quota's heartbeat baseline — the
    first heartbeat measures elapsed time from here, not from a client value."""
    calls = []

    async def fake_mark_start(user_id: str) -> None:
        calls.append(user_id)

    monkeypatch.setattr(anam_quota, "mark_session_start", fake_mark_start)
    _mock_post(monkeypatch, payload={"sessionToken": "sess-anchor"})

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    assert calls, "mark_session_start must be called on a successful mint"


def test_avatar_broker_route_is_also_quota_gated(client, anam_env, monkeypatch):
    """POST /avatar/session-token is unused by the frontend today but
    reachable — it must not be a way to bypass the daily quota."""
    async def fake_remaining(_user_id: str) -> int:
        return 5

    monkeypatch.setattr(anam_quota, "get_remaining_seconds", fake_remaining)
    _mock_post(monkeypatch, payload={"sessionToken": "should-not-be-used"})

    response = client.post("/avatar/session-token", json={"avatar_id": "brunette"})

    assert response.status_code == 429
