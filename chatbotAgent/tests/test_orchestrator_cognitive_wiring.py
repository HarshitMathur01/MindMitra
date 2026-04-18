"""Orchestrator cognitive / COMPASS wiring (mocked; no live LLM)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.core.cognitive_layer_types import CognitivLayerOutput
from app.pipeline.pipeline_orchestrator import PipelineOrchestrator


def _orch(**kwargs):
    groq = MagicMock()
    groq.client = MagicMock()
    groq.model = "llama-test"
    glm = MagicMock()
    response_gen = MagicMock()
    response_gen.generate = MagicMock()
    crisis = MagicMock()
    crisis.check_crisis_keywords = MagicMock(return_value="safe")
    crisis.log_crisis_event = MagicMock()
    return PipelineOrchestrator(
        groq_nlp=kwargs.get("groq_nlp", groq),
        glm=glm,
        response_gen=response_gen,
        crisis_manager=crisis,
        supabase=None,
    )


def _base_ctx():
    return {
        "user_message": "hey",
        "session_context": {"recent_messages": [], "user_activities": []},
        "personality_settings": {"language": "english", "companion_name": "Mitra"},
        "session_id": None,
        "user_id": "test-user",
    }


@pytest.fixture(autouse=True)
def _quiet_memory(monkeypatch):
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
        "app.pipeline.pipeline_orchestrator.memory_manager.get_user_profile",
        lambda *a, **k: {"session_count": 0, "trust_tier": 1, "language_preference": "en"},
    )
    monkeypatch.setattr(
        "app.services.supabase_service.get_hybrid_message_count",
        lambda *a, **k: 1,
    )


def test_compass_crisis_returns_warm_template(monkeypatch):
    orch = _orch()
    orch.crisis_manager.check_crisis_keywords = MagicMock(return_value="hard")
    groq_analyze = MagicMock(
        return_value=CognitivLayerOutput(
            intent="venting",
            risk_level="crisis",
            primary_emotion="distress",
            question_allowed=False,
        )
    )
    orch.cognitive_layer.analyze = groq_analyze
    ctx = _base_ctx()
    ctx["user_message"] = "I want to kill myself"
    orch.route_and_execute(ctx, None, message_count=1)
    assert "9152987821" in ctx["ai_response"]
    assert "iCall" in ctx["ai_response"]
    assert ctx.get("response_generated") is True
    groq_analyze.assert_not_called()
    orch.response_gen.generate.assert_not_called()


def test_compass_casual_uses_unified_path(monkeypatch):
    orch = _orch()
    orch.cognitive_layer.analyze = MagicMock(
        return_value=CognitivLayerOutput(
            intent="casual",
            risk_level="moderate",
            primary_emotion="neutral",
        )
    )
    ctx = _base_ctx()
    orch.route_and_execute(ctx, None, message_count=1)
    orch.response_gen.generate.assert_called_once()
    assert ctx["_pipeline_path"] == "COMPASS-v2"
    assert ctx["psychological_analysis"]["risk_assessment"] == "moderate"


def test_compass_venting_uses_unified_path(monkeypatch):
    orch = _orch()
    orch.cognitive_layer.analyze = MagicMock(
        return_value=CognitivLayerOutput(
            intent="venting",
            risk_level="moderate",
            question_allowed=False,
            intervention_sequence=["validate", "reflect"],
        )
    )
    ctx = _base_ctx()
    orch.route_and_execute(ctx, None, message_count=1)
    orch.response_gen.generate.assert_called_once()
    assert ctx["_pipeline_path"] == "COMPASS-v2"
    assert ctx.get("cl_question_allowed") is False
    assert ctx.get("intervention_directive")


def test_compass_advice_uses_unified_path(monkeypatch):
    orch = _orch()
    orch.cognitive_layer.analyze = MagicMock(
        return_value=CognitivLayerOutput(intent="advice", risk_level="moderate")
    )
    ctx = _base_ctx()
    orch.route_and_execute(ctx, None, message_count=1)
    orch.response_gen.generate.assert_called_once()
    assert ctx["_pipeline_path"] == "COMPASS-v2"


def test_dummy_data_eliminated(monkeypatch):
    orch = _orch()
    orch.cognitive_layer.analyze = MagicMock(
        return_value=CognitivLayerOutput(
            intent="casual",
            risk_level="moderate",
            primary_emotion="calm",
        )
    )
    ctx = _base_ctx()
    orch.route_and_execute(ctx, None, message_count=1)
    assert ctx["psychological_analysis"]["risk_assessment"] == "moderate"
    assert ctx["psychological_analysis"]["risk_assessment"] != "low"


def test_build_intervention_directive_ordering():
    orch = _orch()
    ctx = {"cl_arc_trajectory": "stable", "cl_mi_move": "reflection", "cl_question_allowed": True, "cl_language_mirror": "en"}
    out = orch._build_intervention_directive(["validate", "reflect", "ground"], ctx)
    i1 = out.index("Step 1")
    i2 = out.index("Step 2")
    i3 = out.index("Step 3")
    assert i1 < i2 < i3


def test_build_intervention_directive_no_question():
    orch = _orch()
    ctx = {
        "cl_arc_trajectory": "stable",
        "cl_mi_move": "open_question",
        "cl_question_allowed": False,
        "cl_language_mirror": "en",
    }
    out = orch._build_intervention_directive(["validate"], ctx)
    assert "Do NOT ask any question this turn" in out


def test_build_intervention_directive_falling_arc():
    orch = _orch()
    ctx = {
        "cl_arc_trajectory": "falling",
        "cl_mi_move": "reflection",
        "cl_question_allowed": True,
        "cl_language_mirror": "en",
    }
    out = orch._build_intervention_directive(["validate"], ctx)
    assert "declining" in out


def test_build_intervention_directive_hinglish():
    orch = _orch()
    ctx = {
        "cl_arc_trajectory": "stable",
        "cl_mi_move": "reflection",
        "cl_question_allowed": True,
        "cl_language_mirror": "hinglish",
    }
    out = orch._build_intervention_directive(["validate"], ctx)
    assert "Hinglish" in out


def test_crisis_sentinel_hard_skips_cognitive_layer(monkeypatch):
    orch = _orch()
    calls = []

    def _analyze(**kwargs):
        calls.append(kwargs)
        return CognitivLayerOutput(intent="crisis", risk_level="crisis")

    orch.cognitive_layer.analyze = _analyze
    orch.crisis_manager.check_crisis_keywords = MagicMock(return_value="hard")
    ctx = _base_ctx()
    ctx["user_message"] = "I want to kill myself"
    orch.route_and_execute(ctx, None, message_count=1)
    assert not calls
    orch.response_gen.generate.assert_not_called()


def test_eval_trace_requested_records_cognitive_layer(monkeypatch):
    orch = _orch()
    ctx = _base_ctx()
    ctx["_eval_trace_requested"] = True
    orch.route_and_execute(ctx, None, message_count=1)
    assert "cognitive_layer" in (ctx.get("_eval_data") or {})


def test_to_ctx_dict_integration_compass(monkeypatch):
    orch = _orch()
    orch.cognitive_layer.analyze = MagicMock(
        return_value=CognitivLayerOutput(
            intent="reflect",
            risk_level="low",
            primary_emotion="hopeful",
            emotional_valence=0.2,
            emotional_intensity=0.5,
        )
    )
    ctx = _base_ctx()
    ctx["_eval_trace_requested"] = True
    orch.route_and_execute(ctx, None, message_count=1)
    d = {k: ctx[k] for k in ctx if k.startswith("cl_")}
    assert len(d) == 14
    assert "_eval_data" in ctx
