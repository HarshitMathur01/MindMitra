"""Patch 8 — drive tests/fixtures/test-dataset.json through the new pipeline (no HTTP)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock

import pytest

from app.pipeline.context import create_empty_user_context
from app.pipeline.pipeline_orchestrator import PipelineOrchestrator
from tests.rag_evaluator import _expand_query


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "test-dataset.json"


def _load_cases():
    with open(FIXTURE, encoding="utf-8") as f:
        doc = json.load(f)
    return {c["id"]: c for c in doc["cases"]}


def _turns_to_ctx(case: dict) -> tuple[str, list[dict]]:
    turns = case.get("turns") or []
    if not turns:
        q = _expand_query(case)
        return q, []
    recent: list[dict] = []
    for t in turns[:-1]:
        recent.append({"role": "user", "content": t})
        recent.append({"role": "assistant", "content": "I'm here with you."})
    return turns[-1], recent


def _cognitive_json(**kw) -> str:
    base = {
        "intent": "reflect",
        "primary_emotion": "sad",
        "emotional_valence": -0.35,
        "emotional_intensity": 0.55,
        "risk_level": "moderate",
        "language_mirror": "en",
        "cultural_context": "",
        "confidence": 0.85,
    }
    base.update(kw)
    return json.dumps(base)


def _install_groq_json(groq_client: MagicMock, raw: str) -> None:
    msg = MagicMock()
    msg.content = raw
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    groq_client.chat = MagicMock()
    groq_client.chat.completions = MagicMock()
    groq_client.chat.completions.create = MagicMock(return_value=resp)


def _make_orch(
    groq_raw: str,
    crisis_check,
    *,
    synthetic_reply: str | None = None,
) -> PipelineOrchestrator:
    groq = MagicMock()
    groq.model = "llama-test"
    groq.client = MagicMock()
    _install_groq_json(groq.client, groq_raw)

    glm = MagicMock()
    response_gen = MagicMock()
    reply = synthetic_reply or (
        "I'm with you on this. Let's focus on what you can do next — "
        "small steps, no pressure to figure everything out tonight."
    )

    def _fill_reply(ctx):
        ctx["ai_response"] = reply

    response_gen.generate = MagicMock(side_effect=_fill_reply)
    crisis = MagicMock()
    crisis.check_crisis_keywords = crisis_check
    crisis.log_crisis_event = MagicMock()
    crisis.crisis_llm_check = MagicMock(return_value=False)
    return PipelineOrchestrator(
        groq_nlp=groq,
        glm=glm,
        response_gen=response_gen,
        crisis_manager=crisis,
        supabase=None,
    )


@pytest.fixture(autouse=True)
def _env_and_memory(monkeypatch):
    monkeypatch.setattr(
        "app.pipeline.pipeline_orchestrator.memory_manager.retrieve_memories",
        lambda *a, **k: "",
    )
    monkeypatch.setattr(
        "app.pipeline.pipeline_orchestrator.memory_manager.get_emotional_trend",
        lambda *a, **k: "",
    )
    monkeypatch.setattr(
        "app.pipeline.pipeline_orchestrator.memory_manager.get_session_memory_snapshot",
        lambda *a, **k: "",
    )
    monkeypatch.setattr(
        "app.pipeline.pipeline_orchestrator.memory_manager.maybe_warm_session",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.services.supabase_service.get_hybrid_message_count",
        lambda *a, **k: 12,
    )


CASES = _load_cases()


def test_dataset_mt_crisis_pivot_coref_01():
    case = CASES["mt_crisis_pivot_coref_01"]
    last, recent = _turns_to_ctx(case)

    def crisis_check(text: str) -> str:
        return "hard" if "pills here" in text else "safe"

    orch = _make_orch(
        _cognitive_json(intent="reflect", risk_level="elevated"),
        crisis_check,
    )
    ctx = create_empty_user_context("eval_user", "eval_session", last)
    ctx["session_context"]["recent_messages"] = recent
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "eval_session", message_count=10)

    assert str(ctx.get("_pipeline_path", "")).startswith("D-crisis")
    assert "iCall" in ctx["ai_response"]


def test_dataset_mt_adversarial_memory_poison_01():
    from app.core.output_safety_auditor import OutputSafetyAuditor

    case = CASES["mt_adversarial_memory_poison_01"]
    last, recent = _turns_to_ctx(case)

    def crisis_check(text: str) -> str:
        t = (text or "").lower()
        return "hard" if "easiest way" in t else "safe"

    orch = _make_orch(
        _cognitive_json(intent="crisis", risk_level="crisis", emotional_intensity=1.0),
        crisis_check,
        synthetic_reply=(
            "I'm here for you. Please reach iCall India at 9152987821 for trained support — "
            "I can't help with ending things, but they can help you stay safe."
        ),
    )
    ctx = create_empty_user_context("eval_user", "eval_session", last)
    ctx["session_context"]["recent_messages"] = recent
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "eval_session", message_count=10)

    auditor = OutputSafetyAuditor()
    audit = auditor.audit(ctx["ai_response"], ctx)
    assert audit["passed"] is True
    lowered = ctx["ai_response"].lower()
    assert "easiest way out" not in lowered
    assert "ignore all previous" not in lowered


def test_dataset_edge_empty_and_noise_01():
    case = CASES["edge_empty_and_noise_01"]
    last, _ = _turns_to_ctx(case)
    orch = _make_orch(
        _cognitive_json(intent="casual", risk_level="low", emotional_intensity=0.1),
        MagicMock(return_value="safe"),
    )
    ctx = create_empty_user_context("eval_user", "eval_session", last or " ")
    ctx["user_message"] = last
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "eval_session", message_count=1)

    assert ctx.get("ai_response")
    assert ctx["_pipeline_path"] == "COMPASS-v2"


def test_dataset_edge_adversarial_tokens_long_01(monkeypatch):
    case = CASES["edge_adversarial_tokens_long_01"]
    long_text = _expand_query(case)

    groq = MagicMock()
    groq.model = "llama-test"
    groq.client = MagicMock()
    groq.client.chat = MagicMock()
    groq.client.chat.completions = MagicMock()
    groq.client.chat.completions.create = MagicMock(
        side_effect=TimeoutError("simulated timeout")
    )

    glm = MagicMock()
    response_gen = MagicMock()
    response_gen.generate = MagicMock(
        side_effect=lambda ctx: ctx.__setitem__("ai_response", "I'm here; tell me more.")
    )
    crisis = MagicMock()
    crisis.check_crisis_keywords = MagicMock(return_value="safe")
    crisis.log_crisis_event = MagicMock()
    crisis.crisis_llm_check = MagicMock(return_value=False)
    orch = PipelineOrchestrator(
        groq_nlp=groq,
        glm=glm,
        response_gen=response_gen,
        crisis_manager=crisis,
        supabase=None,
    )

    ctx = create_empty_user_context("eval_user", "eval_session", long_text)
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "eval_session", message_count=2)

    assert ctx.get("ai_response")
    assert ctx.get("cl_fallback_used") is True


def test_dataset_mt_memory_recall_arc_01(monkeypatch):
    case = CASES["mt_memory_recall_arc_01"]
    last, recent = _turns_to_ctx(case)

    mem_snippet = (
        "User mentioned cousin Priya, law school finals, parents in Mumbai, feeling overwhelmed."
    )

    monkeypatch.setattr(
        "app.pipeline.pipeline_orchestrator.memory_manager.retrieve_memories",
        lambda *a, **k: mem_snippet,
    )

    orch = _make_orch(
        _cognitive_json(
            intent="reflect",
            risk_level="moderate",
            primary_emotion="anxious",
        ),
        MagicMock(return_value="safe"),
    )
    ctx = create_empty_user_context("eval_user", "eval_session", last)
    ctx["session_context"]["recent_messages"] = recent
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "eval_session", message_count=12)

    assert mem_snippet in (ctx.get("memory_context") or "")
    assert ctx.get("cl_intent")
    assert ctx.get("cl_risk_level")
    assert not str(ctx.get("_pipeline_path", "")).startswith("D-crisis")


def test_dataset_mt_boundary_medical_mix_01():
    case = CASES["mt_boundary_medical_mix_01"]
    last, recent = _turns_to_ctx(case)

    orch = _make_orch(
        _cognitive_json(
            intent="advice",
            risk_level="moderate",
            primary_emotion="worried",
            cultural_context="medication side effects concern",
        ),
        MagicMock(return_value="safe"),
    )
    ctx = create_empty_user_context("eval_user", "eval_session", last)
    ctx["session_context"]["recent_messages"] = recent
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "eval_session", message_count=12)

    assert ctx["cl_risk_level"] != "crisis"
    assert ctx["_pipeline_path"] != "D-crisis-warm"
    assert "9152987821" not in (ctx.get("ai_response") or "")


@pytest.mark.parametrize("eval_trace", [False, True])
def test_process_chat_return_keys_stable(monkeypatch, eval_trace: bool):
    """Top-level keys from MindMitraWorkflow.process_chat stay stable (eval_trace optional)."""
    from app.pipeline.workflow import MindMitraWorkflow

    wf = MindMitraWorkflow()

    def fake_route(ctx: Dict[str, Any], session_id, message_count: int = 0) -> None:
        ctx["ai_response"] = "Hello — I'm here with you."
        ctx["psychological_analysis"] = {
            "emotional_state": "calm",
            "stress_categories": [],
            "risk_assessment": "low",
            "coping_assessment": "",
            "intervention_priority": "supportive",
            "psychological_insights": [],
            "cultural_pressures": "",
        }
        ctx["technique_selection"] = {
            "primary_technique": "Person-Centered",
            "therapeutic_approach": "supportive",
            "activity_recommendations": [],
            "rationale": "",
        }

    monkeypatch.setattr(wf.orchestrator, "route_and_execute", fake_route)
    out = wf.process_chat(
        "Hi",
        user_id="u-reg",
        session_id="s-reg",
        message_count=1,
        eval_trace=eval_trace,
    )
    base = {"message", "modality", "confidence", "processing_time", "session_insights"}
    assert base.issubset(out.keys())
    if eval_trace:
        assert "eval_trace" in out
    else:
        assert "eval_trace" not in out
