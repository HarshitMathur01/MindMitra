"""Audio and speech-token API contract tests."""
from __future__ import annotations

import base64

import pytest


@pytest.fixture(autouse=True)
def reset_env_cache_after_test():
    yield
    from app.core.env import reload_env

    reload_env()


def _audio_payload() -> str:
    return base64.b64encode(b"RIFF\x00\x00WAVE").decode("ascii")


@pytest.mark.api
def test_transcribe_rejects_empty_audio(client) -> None:
    response = client.post("/transcribe", json={"audio_data": ""})

    assert response.status_code == 400
    assert "audio_data" in response.text


@pytest.mark.api
def test_transcribe_rejects_oversized_audio(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import audio

    monkeypatch.setattr(audio, "_max_audio_bytes", lambda: 4)

    response = client.post("/transcribe", json={"audio_data": _audio_payload()})

    assert response.status_code == 413


@pytest.mark.api
def test_transcribe_requires_groq_when_audio_valid(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import audio

    monkeypatch.setattr(audio, "_get_groq_blocking_client", lambda: None)

    response = client.post("/transcribe", json={"audio_data": _audio_payload()})

    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.text


@pytest.mark.api
def test_transcribe_passes_locale_language_hint(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import audio

    captured: dict = {}

    class FakeTranscriptions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return "नमस्ते"

    class FakeAudio:
        transcriptions = FakeTranscriptions()

    class FakeGroq:
        audio = FakeAudio()

    monkeypatch.setattr(audio, "_get_groq_blocking_client", lambda: FakeGroq())

    response = client.post(
        "/transcribe",
        json={"audio_data": _audio_payload(), "locale": "hi-IN"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["language"] == "hi"
    assert captured["language"] == "hi"


@pytest.mark.api
def test_speech_token_requires_azure_config(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import audio
    from app.core.env import reload_env

    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    monkeypatch.delenv("AZURE_TTS_KEY", raising=False)
    audio._speech_token_cache.update({"token": "", "expires_at": 0.0})
    reload_env()

    response = client.get("/speech/token")

    assert response.status_code == 503


@pytest.mark.api
def test_speech_token_returns_cached_azure_token(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import audio
    from app.core.env import reload_env

    monkeypatch.setenv("AZURE_SPEECH_KEY", "test-speech-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastasia")
    audio._speech_token_cache.update({"token": "", "expires_at": 0.0})
    reload_env()

    class FakeResponse:
        status_code = 200
        text = "speech-token"

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers):
            assert "eastasia.api.cognitive.microsoft.com" in url
            assert headers["Ocp-Apim-Subscription-Key"] == "test-speech-key"
            return FakeResponse()

    monkeypatch.setattr(audio.httpx, "AsyncClient", FakeAsyncClient)

    response = client.get("/speech/token")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token"] == "speech-token"
    assert body["region"] == "eastasia"
    assert body["expires_in"] >= 60
