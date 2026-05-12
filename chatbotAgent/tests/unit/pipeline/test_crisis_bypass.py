"""Layer 2B crisis bypass safety tests."""
from __future__ import annotations

import asyncio

import pytest

from app.pipeline import crisis_bypass


@pytest.mark.unit
@pytest.mark.parametrize(
    ("ratio", "expected"),
    [
        (-1.0, "en"),
        (0.0, "en"),
        (0.3, "hinglish_formal"),
        (0.6, "hinglish_casual"),
        (0.9, "hi"),
        (2.0, "hi"),
    ],
)
def test_variant_selection_clamps_ratio(ratio: float, expected: str) -> None:
    assert crisis_bypass.select_language_variant(ratio) == expected


@pytest.mark.unit
@pytest.mark.asyncio
async def test_non_tier3_returns_none_without_fetching_template(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_if_called(_variant: str):
        raise AssertionError("template store must not be touched below tier 3")

    monkeypatch.setattr(crisis_bypass.profile_service, "fetch_active_crisis_template", fail_if_called)

    result = await crisis_bypass.crisis_bypass_check(
        urgency_score=2,
        user_id="user-1",
        session_id="session-1",
        code_mix_ratio=0.5,
    )

    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_tier3_uses_hardcoded_floor_when_template_store_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    async def no_template(_variant: str):
        return None

    async def audit_noop(_payload: dict):
        return None

    monkeypatch.setattr(crisis_bypass.profile_service, "fetch_active_crisis_template", no_template)

    result = await crisis_bypass.crisis_bypass_check(
        urgency_score=3,
        user_id="user-1",
        session_id="session-1",
        code_mix_ratio=0.1,
        audit_logger=audit_noop,
    )

    assert result is not None
    assert result.source == "hardcoded"
    assert result.bypassed_llm is True
    assert "iCall" in result.content


@pytest.mark.unit
@pytest.mark.asyncio
async def test_tier3_schedules_audit_without_awaiting_it(monkeypatch: pytest.MonkeyPatch) -> None:
    scheduled: list[dict] = []

    async def template(_variant: str):
        return "Call iCall: 9152987821. You are not alone."

    async def audit(payload: dict):
        scheduled.append(payload)

    monkeypatch.setattr(crisis_bypass.profile_service, "fetch_active_crisis_template", template)

    result = await crisis_bypass.crisis_bypass_check(
        urgency_score=3,
        user_id="user-1",
        session_id="session-1",
        code_mix_ratio=0.9,
        trace_id="trace-1",
        audit_logger=audit,
    )
    await asyncio.sleep(0)

    assert result is not None
    assert result.source == "supabase"
    assert scheduled[0]["llm_used"] == "none"
    assert scheduled[0]["memory_used"] is False
    assert scheduled[0]["safety_flags"]["variant"] == "hi"
