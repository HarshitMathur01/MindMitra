"""Monitoring helpers for the v3 stack.

PostHog product analytics + Sentry exception capture. Both are best-effort:
``enabled = bool(SENTRY_DSN)`` / ``bool(POSTHOG_API_KEY)``.

Direct usage::

    monitoring.posthog_event(
        user_id="...",
        name="turn_completed",
        properties={"latency_ttft_ms": 740, ...},
    )

    monitoring.capture_exception(exc)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from .env import env

logger = logging.getLogger(__name__)

_POSTHOG_CLIENT = None
_SENTRY_INITED = False


def _ensure_posthog():
    global _POSTHOG_CLIENT
    if _POSTHOG_CLIENT is not None:
        return _POSTHOG_CLIENT
    e = env()
    if not e.posthog_api_key:
        return None
    try:
        from posthog import Posthog

        _POSTHOG_CLIENT = Posthog(project_api_key=e.posthog_api_key, host=e.posthog_host)
        return _POSTHOG_CLIENT
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 monitoring] posthog init failed: %s", exc)
        return None


def init_sentry() -> bool:
    """Call once at FastAPI startup."""
    global _SENTRY_INITED
    if _SENTRY_INITED:
        return True
    e = env()
    if not e.sentry_dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.asyncio import AsyncioIntegration

        sentry_sdk.init(
            dsn=e.sentry_dsn,
            integrations=[FastApiIntegration(), AsyncioIntegration()],
            traces_sample_rate=e.sentry_traces_sample_rate,
            environment=e.env_name or "dev",
            send_default_pii=False,
            release=f"mha-v3@{e.azure_deployment}",
        )
        _SENTRY_INITED = True
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 monitoring] sentry init failed: %s", exc)
        return False


def capture_exception(exc: BaseException) -> None:
    if not _SENTRY_INITED:
        return
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception as inner:  # noqa: BLE001
        logger.debug("[v3 monitoring] capture_exception failed: %s", inner)


def posthog_event(
    *,
    user_id: Optional[str],
    name: str,
    properties: Optional[Dict[str, Any]] = None,
) -> None:
    client = _ensure_posthog()
    if client is None:
        return
    try:
        client.capture(distinct_id=user_id or "anonymous", event=name, properties=properties or {})
    except Exception as exc:  # noqa: BLE001
        logger.debug("[v3 monitoring] posthog capture failed: %s", exc)
