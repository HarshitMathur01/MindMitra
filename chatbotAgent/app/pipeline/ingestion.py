"""Layer 1 — Input ingestion.

Inputs   raw_message, user_id, session_id, device_locale
Outputs  IngestedInput (normalised_message, language_hint, pii_detected,
         session_id, user_id, server_timestamp, is_new_session)

All pure Python (no I/O). PII redaction MUST happen here before any
downstream layer touches the text — Groq, Azure, Qdrant, audit logs, and
PostHog only ever see ``normalised_message`` from this layer's output.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID, uuid4

from ..core.logging import get_logger, log_context
from ..models.signals import IngestedInput

logger = get_logger(__name__)

MAX_MESSAGE_CHARS = 2000


class InputValidationError(ValueError):
    """User-correctable validation failure for a chat message."""

    def __init__(self, reason: str, client_message: str) -> None:
        super().__init__(client_message)
        self.reason = reason
        self.client_message = client_message


def validate_message_content(raw_message: str, *, user_id: str, session_id: str | None = None) -> None:
    raw = raw_message or ""
    if not raw.strip():
        logger.warning("validation failed", extra=log_context(session_id=session_id, user_id=user_id, reason="empty_message"))
        raise InputValidationError("empty_message", "Message cannot be empty.")
    if len(raw) > MAX_MESSAGE_CHARS:
        logger.warning(
            "validation failed",
            extra=log_context(session_id=session_id, user_id=user_id, reason="message_too_long", len=len(raw), max_len=MAX_MESSAGE_CHARS),
        )
        raise InputValidationError("message_too_long", "Message is too long. Please keep it under 2000 characters.")


def validate_requested_session_id(requested_session_id: str | None, *, user_id: str) -> None:
    if not requested_session_id or requested_session_id == "new":
        return
    try:
        UUID(str(requested_session_id))
    except ValueError as exc:
        logger.warning("validation failed", extra=log_context(user_id=user_id, reason="invalid_session_id", session_req=str(requested_session_id)[:32]))
        raise InputValidationError("invalid_session_id", "Invalid session id.") from exc


# ── PII patterns (anchored to Indian context) ─────────────────────────────
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)")
_AADHAAR_RE = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_CC_RE = re.compile(r"\b(?:\d[ -]*?){13,16}\b")  # very rough credit-card-ish

# ── Unicode block detection for language hint ────────────────────────────
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
_LATIN_RE = re.compile(r"[A-Za-z]")
_OTHER_INDIC_RE = re.compile(r"[\u0980-\u0DFF\u0A00-\u0AFF\u0B00-\u0BFF\u0C00-\u0C7F]")


def _redact(text: str) -> Tuple[str, bool, List[str]]:
    cats: List[str] = []
    cleaned = text
    if _CC_RE.search(cleaned):
        cleaned = _CC_RE.sub("[card_number]", cleaned)
        cats.append("card")
    if _PHONE_RE.search(cleaned):
        cleaned = _PHONE_RE.sub("[phone]", cleaned)
        cats.append("phone")
    if _AADHAAR_RE.search(cleaned):
        cleaned = _AADHAAR_RE.sub("[id_number]", cleaned)
        cats.append("aadhaar")
    if _EMAIL_RE.search(cleaned):
        cleaned = _EMAIL_RE.sub("[email]", cleaned)
        cats.append("email")
    return cleaned, bool(cats), cats


def _language_hint(text: str) -> str:
    has_devanagari = bool(_DEVANAGARI_RE.search(text))
    has_latin = bool(_LATIN_RE.search(text))
    has_other_indic = bool(_OTHER_INDIC_RE.search(text))

    if has_devanagari and has_latin:
        return "hinglish"
    if has_devanagari:
        return "hi"
    if has_other_indic and not has_latin:
        return "other_indic"
    if has_latin:
        # Detect roman Hindi/Urdu words for hinglish hint
        lowered = text.lower()
        if any(w in lowered for w in (" hai ", " hai.", " hai,", " yaar", " kya ", " kyun", " accha", " theek", "khud", "main ")):
            return "hinglish"
        return "en"
    return "en"


def ingest_input(
    raw_message: str,
    *,
    user_id: str,
    session_id: str,
    is_new_session: bool,
    device_locale: Optional[str] = None,
) -> IngestedInput:
    validate_message_content(raw_message, user_id=user_id, session_id=session_id)
    trace_id = str(uuid4())[:8]
    raw = raw_message or ""
    text = unicodedata.normalize("NFC", raw)
    normalisation_changed = text != raw
    text = text.strip()
    redacted, pii_detected, cats = _redact(text)
    hint = _language_hint(redacted)
    logger.info(
        "message received",
        extra=log_context(
            session_id=session_id,
            user_id=user_id,
            trace_id=trace_id,
            len=len(redacted),
            lang=hint,
            new_session=is_new_session,
            pii=pii_detected,
            device_locale=device_locale or "-",
        ),
    )
    logger.info(
        "PII scan complete",
        extra=log_context(
            session_id=session_id,
            user_id=user_id,
            trace_id=trace_id,
            pii_detected=pii_detected,
            patterns=",".join(cats) if cats else "none",
            outcome="redacted" if pii_detected else "clean",
        ),
    )
    if normalisation_changed:
        logger.info(
            "Unicode normalisation modified message",
            extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, normalisation="NFC", outcome="modified"),
        )
    else:
        logger.debug(
            "Unicode normalisation unchanged",
            extra=log_context(session_id=session_id, user_id=user_id, trace_id=trace_id, normalisation="NFC", outcome="unchanged"),
        )
    return IngestedInput(
        normalised_message=redacted,
        language_hint=hint,
        session_id=session_id,
        user_id=user_id,
        pii_detected=pii_detected,
        pii_categories=cats,
        server_timestamp=datetime.now(timezone.utc),
        is_new_session=is_new_session,
        trace_id=trace_id,
        device_locale=device_locale,
    )
