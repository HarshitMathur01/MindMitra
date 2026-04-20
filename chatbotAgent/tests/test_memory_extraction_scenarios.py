"""
Heuristic alignment checks for extraction scenarios in memory_benchmark_dataset.json.

Full LLM extraction is covered by integration jobs; here we validate that the
importance gate (write vs skip) matches scenario intent — cheap and deterministic.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.memory.importance import score_turn

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "memory_benchmark_dataset.json"


def _scenarios():
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return data.get("extraction_scenarios") or []


def test_chit_chat_not_memorable():
    for s in _scenarios():
        if s.get("id") != "ext_simple_chit_chat":
            continue
        for line in s.get("user_turns") or []:
            st = score_turn(line.strip())
            assert st.write is False, (line, st)


def test_self_disclosure_memorable():
    for s in _scenarios():
        if s.get("id") != "ext_medium_self_disclosure":
            continue
        text = " ".join(s.get("user_turns") or [])
        st = score_turn(text, intent="vent", affect_vad={"v": -0.6, "a": 0.75, "d": -0.3})
        assert s.get("expect_memorable_turns") is True
        assert st.write is True
        low = text.lower()
        for kw in s.get("keywords_any") or []:
            assert kw.lower() in low


def test_named_commitment_memorable():
    for s in _scenarios():
        if s.get("id") != "ext_complex_named_commitment":
            continue
        text = " ".join(s.get("user_turns") or [])
        st = score_turn(text, intent="reflection")
        assert st.write is True
        low = text.lower()
        for kw in s.get("keywords_any") or []:
            assert kw.lower() in low
