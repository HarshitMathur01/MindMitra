"""
Phase 5 — MITRA Unified Pipeline.

Covers:
- Classifier: intent, needs_memory, safety pre-screen, Hinglish vent
- Retriever: parallel fanout + per-channel deadline + None-service tolerance
- Assembler: budget enforcement, sections in order, history rendering
- Two-pass generator: ACCEPT short-circuit, SOFT_REWRITE → 2nd pass, REJECT → fallback
- Orchestrator: end-to-end on a stub LLM, crisis short-circuit, trace + working-memory write
- Dispatcher: flag-off → unused; flag-on → adapter shape
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Callable, List, Optional

import pytest

from app.core.prompts.stance import Stage
from app.pipeline.mitra.assembler import ContextAssembler
from app.pipeline.mitra.classifier import IntentClassifier, Intent, classify
from app.pipeline.mitra.generator import TwoPassGenerator
from app.pipeline.mitra.orchestrator import MitraPipeline, TurnInput
from app.pipeline.mitra.retriever import RetrieverOrchestrator


# ── Classifier ──────────────────────────────────────────────────────────────

def test_classify_test_message():
    c = classify("test")
    assert c.intent == Intent.TEST
    assert c.needs_memory is False


def test_classify_check_in_does_not_need_memory():
    c = classify("hey")
    assert c.intent == Intent.CHECK_IN
    assert c.needs_memory is False


def test_classify_vent_english():
    c = classify("i'm so exhausted today")
    assert c.intent == Intent.VENT
    assert c.needs_memory is True


def test_classify_vent_hinglish():
    c = classify("yaar main thak gaya hoon")
    assert c.intent == Intent.VENT
    assert c.needs_memory is True


def test_classify_seek_advice():
    c = classify("what should i do about my exam stress?")
    assert c.intent == Intent.SEEK_ADVICE


def test_classify_share_event():
    c = classify("today i finally talked to my dad about it")
    assert c.intent == Intent.SHARE_EVENT


def test_classify_self_disclosure_pulls_memory_even_for_smalltalk():
    c = classify("do you remember what i told you last time")
    assert c.needs_self_disclosure is True
    assert c.needs_memory is True


def test_classify_hard_safety_short_circuits():
    c = classify("i want to kill myself")
    assert c.intent == Intent.SAFETY
    assert c.safety_signal == "hard"
    assert c.needs_memory is False


def test_classify_soft_safety_pulls_memory():
    c = classify("nothing matters anymore, i'm so tired of living")
    assert c.safety_signal == "soft"
    assert c.needs_memory is True


# ── Retriever ───────────────────────────────────────────────────────────────

def test_retriever_with_no_services_returns_empty_context():
    r = RetrieverOrchestrator()
    ctx = asyncio.run(r.fetch(
        user_id="u1", query="hello", intent="vent",
        needs_memory=True, needs_self_disclosure=False,
    ))
    assert ctx.identity_card is None
    assert ctx.episodes == []


def test_retriever_calls_episodic_only_when_needs_memory():
    calls = {"n": 0}

    class _Eps:
        async def retrieve(self, **_): calls["n"] += 1; return []

    r = RetrieverOrchestrator(episodic_service=_Eps())
    asyncio.run(r.fetch(user_id="u1", query="hi", intent="check_in",
                        needs_memory=False, needs_self_disclosure=False))
    assert calls["n"] == 0
    asyncio.run(r.fetch(user_id="u1", query="hi", intent="vent",
                        needs_memory=True, needs_self_disclosure=False))
    assert calls["n"] == 1


def test_retriever_deadline_drops_slow_services():
    class _SlowEps:
        async def retrieve(self, **_):
            await asyncio.sleep(0.5)
            return ["should_not_appear"]

    r = RetrieverOrchestrator(episodic_service=_SlowEps(), deadline_ms=50)
    ctx = asyncio.run(r.fetch(user_id="u1", query="hi", intent="vent",
                              needs_memory=True, needs_self_disclosure=False))
    assert ctx.episodes == []
    assert ctx.errors.get("episodes") == "deadline"


# ── Assembler ───────────────────────────────────────────────────────────────

class _FakeIdentity:
    preferred_name = "Aman"
    def render_for_prompt(self): return "Name: Aman; Loves: cricket"


class _FakeEpisode:
    def __init__(self, s): self.summary = s
    def render_for_prompt(self): return f"- {self.summary}"


def test_assembler_renders_identity_first_then_memories():
    a = ContextAssembler()
    p = a.assemble(
        user_message="hi", stage=Stage.FAMILIAR,
        identity_card=_FakeIdentity(),
        episodes=[_FakeEpisode("talked about exams")],
    )
    assert "WHO THEY ARE" in p.user
    assert "RELEVANT MEMORIES" in p.user
    # Identity precedes memories.
    assert p.user.index("WHO THEY ARE") < p.user.index("RELEVANT MEMORIES")
    assert p.used_episodes == 1


def test_assembler_truncates_episodes_over_budget():
    a = ContextAssembler()
    huge = [_FakeEpisode("x" * 400) for _ in range(10)]
    p = a.assemble(user_message="hi", stage=Stage.STRANGER, episodes=huge)
    assert p.used_episodes < 10  # budget enforced


def test_assembler_renders_recent_history():
    a = ContextAssembler()
    p = a.assemble(
        user_message="and now",
        stage=Stage.STRANGER,
        recent_turns=[{"role": "user", "content": "earlier"}, {"role": "assistant", "content": "i hear you"}],
    )
    assert "RECENT CONVERSATION" in p.user
    assert "USER: earlier" in p.user
    assert "MITRA: i hear you" in p.user


# ── Two-pass generator ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generator_accepts_clean_draft():
    async def llm(*, system, user, stream_callback=None):
        return "I hear you. That sounds heavy."

    g = TwoPassGenerator(llm_complete=llm)
    res = await g.generate(system="x", user="y", intent="vent")
    assert res.accepted_on_pass == 1
    assert "hear you" in res.text
    assert res.fallback_used is False


@pytest.mark.asyncio
async def test_generator_revises_on_sycophancy_and_returns_revision():
    drafts = iter([
        "Great question! You're absolutely right.",   # sycophancy → SOFT_REWRITE
        "That sounds important. I'm here.",           # clean
    ])

    async def llm(*, system, user, stream_callback=None):
        return next(drafts)

    g = TwoPassGenerator(llm_complete=llm)
    res = await g.generate(system="x", user="y", intent="vent")
    assert res.accepted_on_pass == 2
    assert "Great question" not in res.text


@pytest.mark.asyncio
async def test_generator_falls_back_on_persistent_false_emotion():
    async def llm(*, system, user, stream_callback=None):
        return "I'm sad too. I'm sad too."   # always REJECT

    g = TwoPassGenerator(llm_complete=llm)
    res = await g.generate(system="x", user="y", intent="vent")
    assert res.accepted_on_pass == 3
    assert res.fallback_used is True
    assert "you don't have to carry it alone" in res.text


@pytest.mark.asyncio
async def test_generator_does_not_stream_revisions():
    chunks: List[str] = []
    drafts = iter(["Great question!", "I hear you."])

    async def llm(*, system, user, stream_callback=None):
        out = next(drafts)
        if stream_callback:
            stream_callback(out)
        return out

    g = TwoPassGenerator(llm_complete=llm)
    res = await g.generate(
        system="x", user="y", intent="vent",
        stream_callback=lambda c: chunks.append(c),
    )
    assert res.accepted_on_pass == 2
    # First (rejected) draft was streamed; revision was NOT streamed (one chunk only).
    assert chunks == ["Great question!"]


# ── Orchestrator end-to-end ────────────────────────────────────────────────

class _CapturingTraceRepo:
    def __init__(self):
        self.rows = []
    def insert(self, row):
        self.rows.append(row)
        return row


@pytest.mark.asyncio
async def test_orchestrator_happy_path_writes_trace():
    async def llm(*, system, user, stream_callback=None):
        return "I hear you. Take your time."

    pipeline = MitraPipeline(
        classifier=IntentClassifier(),
        retriever=RetrieverOrchestrator(),
        assembler=ContextAssembler(),
        generator=TwoPassGenerator(llm_complete=llm),
        trace_repo=_CapturingTraceRepo(),
    )
    res = await pipeline.process_turn(TurnInput(
        user_id="u1", session_id="s1",
        user_message="i'm so exhausted today",
    ))
    assert res.is_crisis is False
    assert res.classification.intent == Intent.VENT
    assert "hear you" in res.message
    assert pipeline.trace_repo.rows[-1]["intent"] == "vent"
    assert pipeline.trace_repo.rows[-1]["is_crisis"] is False


@pytest.mark.asyncio
async def test_orchestrator_crisis_short_circuit_skips_llm():
    llm_called = {"n": 0}

    async def llm(*, system, user, stream_callback=None):
        llm_called["n"] += 1
        return "should not be called"

    pipeline = MitraPipeline(
        classifier=IntentClassifier(),
        retriever=RetrieverOrchestrator(),
        assembler=ContextAssembler(),
        generator=TwoPassGenerator(llm_complete=llm),
        trace_repo=_CapturingTraceRepo(),
    )
    res = await pipeline.process_turn(TurnInput(
        user_id="u1", session_id="s1",
        user_message="i want to kill myself",
    ))
    assert res.is_crisis is True
    assert res.modality == "crisis"
    assert llm_called["n"] == 0
    assert pipeline.trace_repo.rows[-1]["is_crisis"] is True


@pytest.mark.asyncio
async def test_orchestrator_streams_chunks_via_callback():
    async def llm(*, system, user, stream_callback=None):
        chunks = ["I hear you. ", "Take your time."]
        for ch in chunks:
            if stream_callback:
                stream_callback(ch)
        return "".join(chunks)

    received: List[str] = []
    pipeline = MitraPipeline(
        classifier=IntentClassifier(),
        retriever=RetrieverOrchestrator(),
        assembler=ContextAssembler(),
        generator=TwoPassGenerator(llm_complete=llm),
    )
    res = await pipeline.process_turn(
        TurnInput(user_id="u1", session_id="s1", user_message="i'm so tired"),
        stream_callback=lambda c: received.append(c),
    )
    assert "".join(received) == res.message


# ── Dispatcher ──────────────────────────────────────────────────────────────

def test_dispatcher_flag_default_off(monkeypatch):
    monkeypatch.delenv("MITRA_STACK_ENABLED", raising=False)
    from app.pipeline.mitra import dispatch
    assert dispatch.is_enabled() is False


def test_dispatcher_flag_on(monkeypatch):
    monkeypatch.setenv("MITRA_STACK_ENABLED", "1")
    from app.pipeline.mitra import dispatch
    assert dispatch.is_enabled() is True


def test_dispatcher_chat_route_returns_503_when_flag_off(monkeypatch):
    """When the flag is off, the chat route must reject the call rather than
    silently dispatch into deleted legacy code."""
    monkeypatch.delenv("MITRA_STACK_ENABLED", raising=False)
    from fastapi import HTTPException

    from app.api import chat as chat_route

    try:
        chat_route._ensure_mitra_enabled()
    except HTTPException as exc:
        assert exc.status_code == 503
    else:
        raise AssertionError("expected HTTPException when MITRA_STACK_ENABLED is off")
