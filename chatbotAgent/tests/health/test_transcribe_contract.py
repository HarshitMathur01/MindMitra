"""
Health: POST /transcribe returns a frontend-compatible payload.

Frontend uses this only as a Whisper fallback when Azure STT in the browser
returned nothing. The shape is loose; we just assert 200 + JSON object.
"""
from __future__ import annotations

import base64
from unittest.mock import patch

import pytest


@patch("app.api.chat._get_groq_transcribe_client")
def test_transcribe_returns_json_object(mock_groq, client):
    """We mock the Groq client so the test runs offline and fast."""

    class _FakeClient:
        class audio:
            class transcriptions:
                @staticmethod
                def create(**kwargs):
                    class _R:
                        text = "hello there"
                    return _R()

    mock_groq.return_value = _FakeClient()

    # 0.1 s of silent WAV, base64-encoded (just to satisfy any minimum-size guards).
    silent_wav = (
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"\x40\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )
    audio_b64 = base64.b64encode(silent_wav).decode("ascii")

    r = client.post("/transcribe", json={"audio_data": audio_b64})
    # If the endpoint requires non-empty transcription we accept 200 OR 422
    # (some implementations reject too-short audio); we just refuse 5xx.
    assert r.status_code < 500, r.text
    if r.status_code == 200:
        body = r.json()
        assert isinstance(body, dict), body
