"""
PII-safe logging helpers.

Production logs for a youth mental-health product must never carry raw user
text or transcripts: a log breach would directly expose distress disclosures.
These helpers let call-sites keep useful debugging signal (length, short
hash, locale) without persisting the content itself.

Usage::

    from .pii import redact_text

    logger.info("transcript=%s", redact_text(transcript))
    # → transcript=<text len=87 sha1=4f6a31b9>

In dev (``ENV=dev`` / ``ENVIRONMENT=development`` / ``LOG_RAW_USER_TEXT=1``)
the helper falls back to a short truncated preview to keep debugging
ergonomic — but never ships in production.
"""
from __future__ import annotations

import hashlib
import os


_DEV_ENVS = {"", "dev", "development", "local", "test", "testing"}


def _is_dev_env() -> bool:
    env = os.getenv("ENV", os.getenv("ENVIRONMENT", "")).strip().lower()
    if env in _DEV_ENVS:
        return True
    if os.getenv("LOG_RAW_USER_TEXT", "").lower() in ("1", "true", "yes"):
        return True
    return False


def _short_hash(text: str) -> str:
    digest = hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()
    return digest[:8]


def redact_text(text: str | None, *, preview: int = 24) -> str:
    """Return a log-safe placeholder for a user-supplied string.

    - Production: ``<text len=87 sha1=4f6a31b9>``
    - Dev:        ``<text len=87 sha1=4f6a31b9 preview="i feel ...">``

    Never returns the full string. The dev preview is capped at ``preview``
    characters and stripped of newlines so a single log line cannot drown the
    file in pasted essays.
    """
    if text is None:
        return "<text len=0>"
    s = str(text)
    if not s:
        return "<text len=0>"

    base = f"<text len={len(s)} sha1={_short_hash(s)}>"
    if not _is_dev_env():
        return base
    snippet = s[:preview].replace("\n", " ").replace("\r", " ").strip()
    if len(s) > preview:
        snippet += "…"
    return f'<text len={len(s)} sha1={_short_hash(s)} preview="{snippet}">'
