"""Layer 1 ingestion contract tests."""
from __future__ import annotations

import pytest

from app.pipeline.ingestion import (
    InputValidationError,
    ingest_input,
    validate_message_content,
    validate_requested_session_id,
)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("raw", "expected_lang"),
    [
        ("Hello, how are you?", "en"),
        ("मेरा दिल भारी है", "hi"),
        ("Main thoda overwhelmed feel kar raha hoon", "hinglish"),
        ("ನನಗೆ ಇಂದು ಕಷ್ಟವಾಗುತ್ತಿದೆ", "other_indic"),
    ],
)
def test_language_hint_is_deterministic(raw: str, expected_lang: str) -> None:
    out = ingest_input(raw, user_id="user-1", session_id="session-1", is_new_session=True)

    assert out.language_hint == expected_lang
    assert out.normalised_message
    assert out.trace_id


@pytest.mark.unit
@pytest.mark.parametrize(
    ("raw", "expected_category", "redacted_token", "sensitive_value"),
    [
        ("call me at 9876543210", "phone", "[phone]", "9876543210"),
        ("my aadhaar is 1234 5678 9012", "aadhaar", "[id_number]", "1234 5678 9012"),
        ("email me on jane@example.com please", "email", "[email]", "jane@example.com"),
        ("card 4111 1111 1111 1111", "card", "[card_number]", "4111 1111 1111 1111"),
    ],
)
def test_pii_is_redacted_before_downstream_layers(
    raw: str,
    expected_category: str,
    redacted_token: str,
    sensitive_value: str,
) -> None:
    out = ingest_input(raw, user_id="user-1", session_id="session-1", is_new_session=True)

    assert out.pii_detected is True
    assert expected_category in out.pii_categories
    assert redacted_token in out.normalised_message
    assert sensitive_value not in out.normalised_message


@pytest.mark.unit
def test_unicode_is_normalised_to_nfc() -> None:
    decomposed = "Cafe\u0301 feels heavy today"

    out = ingest_input(decomposed, user_id="user-1", session_id="session-1", is_new_session=False)

    assert "Café" in out.normalised_message


@pytest.mark.unit
@pytest.mark.parametrize(
    ("raw", "reason"),
    [
        ("", "empty_message"),
        ("   ", "empty_message"),
        ("x" * 2001, "message_too_long"),
    ],
)
def test_invalid_message_content_has_client_safe_reason(raw: str, reason: str) -> None:
    with pytest.raises(InputValidationError) as exc_info:
        validate_message_content(raw, user_id="user-1", session_id="session-1")

    assert exc_info.value.reason == reason
    assert exc_info.value.client_message


@pytest.mark.unit
def test_session_id_validation_accepts_new_or_uuid_only() -> None:
    validate_requested_session_id("new", user_id="user-1")
    validate_requested_session_id("00000000-0000-0000-0000-000000000001", user_id="user-1")

    with pytest.raises(InputValidationError) as exc_info:
        validate_requested_session_id("../other-user", user_id="user-1")

    assert exc_info.value.reason == "invalid_session_id"
