"""Smoke test: memory retrieval benchmark completes and writes valid JSON."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

import pytest

from tests.memory_retrieval_benchmark import run_benchmark_async


@pytest.mark.asyncio
async def test_run_benchmark_async_produces_doc(tmp_path, monkeypatch):
    out = tmp_path / "report.json"
    monkeypatch.setenv("MEMORY_BENCH_OUTPUT", str(out))
    monkeypatch.setenv("MEMORY_BENCH_USE_JUDGE", "false")
    doc = await run_benchmark_async()
    assert out.exists()
    assert doc["summary_metrics"]["total_queries"] >= 1
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded["per_query"]
