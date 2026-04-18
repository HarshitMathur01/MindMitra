"""Patch 8 — full response pipeline simulations (in-process, mocked LLMs, no HTTP)."""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.core.output_safety_auditor import OutputSafetyAuditor
from app.pipeline.context import create_empty_user_context
from app.pipeline.pipeline_orchestrator import PipelineOrchestrator


def _cognitive_json_payload(**overrides) -> str:
    base = {
        "intent": "reflect",
        "primary_emotion": "sad",
        "emotional_valence": -0.4,
        "emotional_intensity": 0.55,
        "risk_level": "moderate",
        "language_mirror": "en",
        "cultural_context": "",
        "confidence": 0.9,
    }
    base.update(overrides)
    return json.dumps(base)


def _install_groq_json_response(groq_client: MagicMock, raw: str) -> MagicMock:
    msg = MagicMock()
    msg.content = raw
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    create = MagicMock(return_value=resp)
    groq_client.chat = MagicMock()
    groq_client.chat.completions = MagicMock()
    groq_client.chat.completions.create = create
    return create


def _make_orchestrator(
    *,
    crisis_check: MagicMock | None = None,
    groq_json: str | None = None,
) -> tuple[PipelineOrchestrator, MagicMock, MagicMock]:
    groq = MagicMock()
    groq.model = "llama-test"
    groq.client = MagicMock()
    if groq_json is not None:
        _install_groq_json_response(groq.client, groq_json)

    glm = MagicMock()
    response_gen = MagicMock()
    response_gen.generate = MagicMock(
        side_effect=lambda ctx: ctx.__setitem__("ai_response", "Mock response")
    )

    crisis = MagicMock()
    crisis.check_crisis_keywords = crisis_check or MagicMock(return_value="safe")
    crisis.crisis_llm_check = MagicMock(return_value=False)
    crisis.log_crisis_event = MagicMock()

    orch = PipelineOrchestrator(
        groq_nlp=groq,
        glm=glm,
        response_gen=response_gen,
        crisis_manager=crisis,
        supabase=None,
    )
    return orch, groq.client.chat.completions.create, response_gen.generate


@pytest.fixture(autouse=True)
def _quiet_memory_and_db(monkeypatch):
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
        lambda *a, **k: 4,
    )


def test_simulation_1_venting_hinglish_compass_path(monkeypatch):
    raw = _cognitive_json_payload(
        intent="venting",
        risk_level="moderate",
        language_mirror="hinglish",
        emotional_intensity=0.65,
    )
    orch, _, gen = _make_orchestrator(groq_json=raw)
    ctx = create_empty_user_context(
        "test_user_1", "test_session_1", user_message=""
    )
    ctx["user_message"] = (
        "Yaar main bahut thak gaya hun, koi nahi sunta mujhe, "
        "office mein bhi sab ignore karte hain"
    )
    ctx["session_context"]["recent_messages"] = [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hey! How are you doing?"},
    ]
    ctx["session_message_count"] = 4
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "test_session_1", message_count=4)

    assert ctx["_pipeline_path"] == "COMPASS-v2"
    assert ctx["cl_question_allowed"] is False
    assert ctx["cl_language_mirror"] == "hinglish"
    directive = (ctx.get("intervention_directive") or "").lower()
    assert "validate" in directive or "step 1" in directive
    gen.assert_called_once()


def test_simulation_2_hard_crisis_warm_template_no_generate(monkeypatch):
    crisis = MagicMock()
    crisis.check_crisis_keywords = MagicMock(return_value="hard")
    crisis.crisis_llm_check = MagicMock(return_value=False)
    crisis.log_crisis_event = MagicMock()

    groq = MagicMock()
    groq.model = "llama-test"
    groq.client = MagicMock()
    glm = MagicMock()
    response_gen = MagicMock()
    response_gen.generate = MagicMock(
        side_effect=lambda c: c.__setitem__("ai_response", "should not run")
    )
    orch = PipelineOrchestrator(
        groq_nlp=groq,
        glm=glm,
        response_gen=response_gen,
        crisis_manager=crisis,
        supabase=None,
    )

    analyze_mock = MagicMock()
    orch.cognitive_layer.analyze = analyze_mock

    ctx = create_empty_user_context(
        "test_user_1", "test_session_1",
        user_message="I want to kill myself, I can't take this anymore",
    )
    ctx["session_context"]["recent_messages"] = []
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "test_session_1", message_count=2)

    analyze_mock.assert_not_called()
    assert "iCall" in ctx["ai_response"]
    assert "9152987821" in ctx["ai_response"]
    response_gen.generate.assert_not_called()
    assert ctx.get("response_generated") is True
    assert ctx["_pipeline_path"] == "D-crisis-warm"


def test_simulation_3_casual_compass_path_no_combined_analysis(monkeypatch):
    raw = _cognitive_json_payload(
        intent="casual",
        risk_level="low",
        primary_emotion="neutral",
        emotional_intensity=0.2,
        emotional_valence=0.1,
    )
    orch, _, gen = _make_orchestrator(groq_json=raw)

    ctx = create_empty_user_context(
        "test_user_1", "test_session_1", user_message="Hey what's up"
    )
    ctx["session_context"]["recent_messages"] = []
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "test_session_1", message_count=1)

    assert ctx["_pipeline_path"] == "COMPASS-v2"
    ra = ctx["psychological_analysis"]["risk_assessment"]
    assert ra == ctx.get("cl_risk_level") == "low"
    gen.assert_called_once()


def test_simulation_4_ambiguous_low_llm_becomes_moderate_no_questions(monkeypatch):
    raw = _cognitive_json_payload(
        intent="reflect",
        risk_level="low",
        emotional_intensity=0.85,
        emotional_valence=-0.55,
    )
    orch, _, _ = _make_orchestrator(groq_json=raw)
    orch.crisis_manager.check_crisis_keywords = MagicMock(return_value="ambiguous")

    def _fixed_arc(_recent, window=8):
        return {
            "current_valence": -0.55,
            "arc_direction": "falling",
            "arc_delta": -0.35,
            "session_low": -0.8,
            "session_high": -0.1,
            "turn_count": 3,
        }

    monkeypatch.setattr(
        orch.cognitive_layer.arc_reader,
        "compute_arc",
        _fixed_arc,
    )

    ctx = create_empty_user_context(
        "test_user_1", "test_session_1",
        user_message="Kya farak padta hai mere hone se",
    )
    ctx["session_context"]["recent_messages"] = [
        {"role": "user", "content": "I don't know man"},
        {"role": "user", "content": "Everything feels pointless"},
        {"role": "user", "content": "Kya farak padta hai mere hone se"},
    ]
    ctx["personality_settings"] = {"language": "english", "companion_name": "Mitra"}

    orch.route_and_execute(ctx, "test_session_1", message_count=6)

    assert ctx["cl_risk_level"] != "low"
    assert ctx["cl_risk_level"] == "moderate"
    assert ctx["cl_question_allowed"] is False


def test_simulation_5_output_safety_auditor_self_harm_method():
    ctx = create_empty_user_context("u", "s", user_message="x")
    auditor = OutputSafetyAuditor()
    result = auditor.audit(
        "Maybe you should try cutting to release that pressure",
        ctx,
    )
    assert result["passed"] is False
    assert "self_harm_method" in result["violations"]
    assert result["severity"] == "critical"
