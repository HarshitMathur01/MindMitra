"""Memory benchmark fixture schema + memory judge helpers (no HTTP)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.memory_benchmark_schema import validate_benchmark_dataset
from tests.memory_judge import format_transcript_for_memory_judge, run_memory_deep_judge

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "memory-benchmark-dataset.json"


def test_memory_benchmark_fixture_schema():
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    ok, errors = validate_benchmark_dataset(doc)
    assert ok, errors


def test_single_session_conversations_meet_turn_budget():
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for c in doc["conversations"]:
        if c.get("type", "single_session") != "single_session":
            continue
        assert len(c["turns"]) >= 15, c["id"]


def test_format_transcript_includes_preview_snippet():
    rows = [
        {
            "user_turn": 1,
            "user_message": "Hello there",
            "assistant_message": "Hi back",
            "eval_trace": {"memory_injected": True, "memory_context_preview": "User likes tea."},
        }
    ]
    txt = format_transcript_for_memory_judge(rows)
    assert "User: Hello there" in txt
    assert "tea" in txt


def test_run_memory_deep_judge_stub_without_groq(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    out = run_memory_deep_judge(
        conversation_id="stub_01",
        conversation_type="single_session",
        transcript_with_previews="x" * 200,
        expected_items_json="[]",
        evaluation_focus="test",
        heuristic_failure_cases=["surface form miss"],
    )
    assert out.get("skipped") is True
    assert out.get("source") == "heuristic_stub"
