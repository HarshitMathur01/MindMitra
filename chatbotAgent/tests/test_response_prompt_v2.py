"""ResponseGenerator V2 system prompt (no LLM calls)."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.agents.response_agent import ResponseGenerator, _SafeFormatDict
from app.core.prompts import RESPONSE_SYSTEM_PROMPT_V2


@pytest.fixture
def gen():
    return ResponseGenerator(glm=MagicMock())


def test_v2_prompt_contains_companion_name(gen):
    ctx = {
        "personality_settings": {"personality": "mitra", "companion_name": "Riya"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "intervention_directive": "Be kind.",
    }
    out = gen._build_system_prompt(ctx)
    assert "Riya" in out


def test_v2_prompt_contains_memory_context(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "ABOUT THEM:\n• likes cricket",
        "intervention_directive": "Listen.",
    }
    out = gen._build_system_prompt(ctx)
    assert "cricket" in out


def test_v2_prompt_contains_primary_emotion(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_primary_emotion": "weary",
        "intervention_directive": "Hold space.",
    }
    out = gen._build_system_prompt(ctx)
    assert "weary" in out


def test_v2_prompt_no_question_guidance_when_not_allowed(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_question_allowed": False,
        "intervention_directive": "Validate.",
    }
    out = gen._build_system_prompt(ctx)
    assert "Do NOT ask any question" in out


def test_v2_prompt_hinglish_guidance(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_language_mirror": "hinglish",
        "intervention_directive": "X",
    }
    out = gen._build_system_prompt(ctx)
    assert "Hinglish" in out


def test_v2_prompt_falling_arc_note(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_arc_trajectory": "falling",
        "intervention_directive": "Y",
    }
    out = gen._build_system_prompt(ctx)
    assert "increasing" in out or "gentle" in out


def test_v2_prompt_elevated_risk_safety_note(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_risk_level": "elevated",
        "intervention_directive": "Z",
    }
    out = gen._build_system_prompt(ctx)
    assert "iCall" in out
    assert "9152987821" in out


def test_v2_prompt_low_risk_no_safety_note(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_risk_level": "low",
        "intervention_directive": "Z",
    }
    out = gen._build_system_prompt(ctx)
    assert "iCall" not in out


def test_v2_prompt_short_length_guidance(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_response_length": "short",
        "intervention_directive": "Z",
    }
    out = gen._build_system_prompt(ctx)
    assert "1-3 sentences" in out


def test_v2_prompt_mi_reflection_guidance(gen):
    ctx = {
        "personality_settings": {"personality": "mitra"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "cl_mi_move": "reflection",
        "intervention_directive": "Z",
    }
    out = gen._build_system_prompt(ctx)
    assert "reflective statement" in out


def test_system_prompt_is_compass_v2_template(gen):
    ctx = {
        "personality_settings": {"personality": "mitra", "language": "english"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "intervention_directive": "Test directive",
        "technique_selection": {"therapeutic_approach": "validate"},
    }
    out = gen._build_system_prompt(ctx)
    assert "WHAT YOU KNOW ABOUT THIS PERSON" in out
    assert "THIS MOMENT:" in out


def test_v2_safe_format_dict_handles_missing_keys():
    out = RESPONSE_SYSTEM_PROMPT_V2.format_map(_SafeFormatDict(companion_name="OnlyName"))
    assert "OnlyName" in out
    assert "RELATIONSHIP CONTEXT:" in out


def test_generate_strips_questions_when_cl_question_false(gen):
    gen.glm.invoke = MagicMock(
        return_value=MagicMock(content='Hello there? Still here? "ok"')
    )
    ctx = {
        "personality_settings": {"personality": "mitra", "language": "english"},
        "_conversation_stage": "companion",
        "memory_context": "",
        "user_message": "hi",
        "session_context": {"recent_messages": []},
        "cl_question_allowed": False,
        "intervention_directive": "x",
    }
    gen.generate(ctx)
    assert "?" not in ctx["ai_response"]
