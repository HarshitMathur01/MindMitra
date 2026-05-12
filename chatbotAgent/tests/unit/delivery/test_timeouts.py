"""Per-turn timeout guard tests."""
from __future__ import annotations

import asyncio
import time

import pytest


@pytest.mark.unit
@pytest.mark.asyncio
async def test_await_or_default_returns_without_waiting_for_cancel_cleanup() -> None:
    from app.api.chat_ws import _await_or_default

    async def slow_dependency():
        await asyncio.sleep(10)
        return "late"

    task = asyncio.create_task(slow_dependency())
    started = time.perf_counter()

    result = await _await_or_default("slow_dependency", task, "fallback", 0.05)

    elapsed_ms = (time.perf_counter() - started) * 1000
    assert result == "fallback"
    assert elapsed_ms < 500


@pytest.mark.unit
@pytest.mark.asyncio
async def test_await_or_default_catches_dependency_exception() -> None:
    from app.api.chat_ws import _await_or_default

    async def broken_dependency():
        raise RuntimeError("provider failed")

    result = await _await_or_default(
        "broken_dependency",
        asyncio.create_task(broken_dependency()),
        "fallback",
        1.0,
    )

    assert result == "fallback"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_await_or_default_returns_fast_result() -> None:
    from app.api.chat_ws import _await_or_default

    async def fast_dependency():
        return "ready"

    result = await _await_or_default("fast_dependency", asyncio.create_task(fast_dependency()), "fallback", 1.0)

    assert result == "ready"


@pytest.mark.unit
def test_timeout_llm_result_routes_to_static_fallback_path() -> None:
    from app.api.chat_ws import _timeout_llm_result

    result = _timeout_llm_result()

    assert result.finish_reason == "error"
    assert result.raw_response == ""
    assert result.llm_used == "timeout"
    assert result.fallback_chain == ["llm_generation_timeout"]
