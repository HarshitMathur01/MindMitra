"""Unit tests for CognitiveLayer (mocked Groq; no network)."""
from __future__ import annotations

from unittest.mock import MagicMock

from app.core.cognitive_layer import CognitiveLayer
from app.core.cognitive_layer_types import CognitivLayerOutput


def _mock_completion(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def test_analyze_hard_crisis_skips_llm():
    mock_client = MagicMock()
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("pills", [], 0, crisis_sentinel_level="hard")
    mock_client.chat.completions.create.assert_not_called()
    assert out.intent == "crisis"
    assert out.risk_level == "crisis"


def test_analyze_valid_llm_response():
    mock_client = MagicMock()
    payload = (
        '{"intent":"venting","primary_emotion":"sad","emotional_valence":-0.4,'
        '"emotional_intensity":0.5,"risk_level":"moderate","language_mirror":"en",'
        '"cultural_context":"","confidence":0.9}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("I feel awful", [{"role": "user", "content": "hi"}], 3)
    assert out.intent == "venting"
    assert out.risk_level == "moderate"
    assert out.question_allowed is False


def test_analyze_llm_failure_fallback():
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("network down")
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("hello", [], 1)
    assert out.fallback_used is True
    assert out.risk_level == "moderate"
    assert out.risk_level != "low"


def test_analyze_bad_json_fallback():
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_completion("this is not json")
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("hello", [], 1)
    assert out.fallback_used is True
    assert out.risk_level == "moderate"


def test_crisis_sentinel_ambiguous_elevates_low():
    mock_client = MagicMock()
    payload = (
        '{"intent":"casual","primary_emotion":"neutral","emotional_valence":0.0,'
        '"emotional_intensity":0.2,"risk_level":"low","language_mirror":"en",'
        '"cultural_context":"","confidence":0.8}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("maybe", [{"role": "user", "content": "x"}], 2, crisis_sentinel_level="ambiguous")
    assert out.risk_level == "moderate"


def test_arc_falling_sharp_escalates_risk(monkeypatch):
    mock_client = MagicMock()
    payload = (
        '{"intent":"casual","primary_emotion":"neutral","emotional_valence":0.0,'
        '"emotional_intensity":0.2,"risk_level":"low","language_mirror":"en",'
        '"cultural_context":"","confidence":0.85}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    monkeypatch.setattr(
        layer.arc_reader,
        "compute_arc",
        lambda *a, **k: {
            "current_valence": -0.2,
            "arc_direction": "falling",
            "arc_delta": -0.5,
            "session_low": -0.6,
            "session_high": 0.1,
            "turn_count": 5,
        },
    )
    out = layer.analyze("x", [{"role": "user", "content": "a"}], 2)
    assert out.risk_level == "moderate"


def test_intervention_sequence_venting():
    mock_client = MagicMock()
    payload = (
        '{"intent":"venting","primary_emotion":"sad","emotional_valence":-0.2,'
        '"emotional_intensity":0.4,"risk_level":"low","language_mirror":"en",'
        '"cultural_context":"","confidence":0.8}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("vent", [{"role": "user", "content": "ok"}], 4)
    assert out.intervention_sequence[0] in ("reflect", "affirm")


def test_intervention_sequence_crisis():
    mock_client = MagicMock()
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("help", [], 0, crisis_sentinel_level="hard")
    assert out.intervention_sequence[0] == "validate"


def test_question_allowed_false_when_venting():
    mock_client = MagicMock()
    payload = (
        '{"intent":"venting","primary_emotion":"anxious","emotional_valence":-0.3,'
        '"emotional_intensity":0.9,"risk_level":"moderate","language_mirror":"en",'
        '"cultural_context":"","confidence":0.7}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "llama-3.1-8b-instant")
    out = layer.analyze("stress", [{"role": "user", "content": "a"}], 2)
    assert out.question_allowed is False


def test_question_allowed_false_when_crisis():
    mock_client = MagicMock()
    layer = CognitiveLayer(mock_client, "m")
    out = layer.analyze("x", [], 0, crisis_sentinel_level="hard")
    assert out.question_allowed is False


def test_language_mirror_hinglish():
    mock_client = MagicMock()
    payload = (
        '{"intent":"advice","primary_emotion":"worried","emotional_valence":-0.1,'
        '"emotional_intensity":0.5,"risk_level":"moderate","language_mirror":"hinglish",'
        '"cultural_context":"exam pressure","confidence":0.75}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "m")
    out = layer.analyze("yaar kya karun", [], 1)
    assert out.language_mirror == "hinglish"


def test_parse_response_strips_markdown():
    raw = '```json\n{"intent":"venting","primary_emotion":"sad","emotional_valence":-0.2,"emotional_intensity":0.4,"risk_level":"low","language_mirror":"en","cultural_context":"","confidence":0.8}\n```'
    parsed = CognitiveLayer._parse_response(raw)
    assert parsed is not None
    assert parsed["intent"] == "venting"


def test_parse_response_missing_key():
    assert CognitiveLayer._parse_response('{"intent":"venting"}') is None


def test_parse_response_clamps_floats():
    raw = (
        '{"intent":"advice","primary_emotion":"x","emotional_valence":2.5,'
        '"emotional_intensity":3.0,"risk_level":"moderate","language_mirror":"en",'
        '"cultural_context":"","confidence":9.0}'
    )
    parsed = CognitiveLayer._parse_response(raw)
    assert parsed is not None
    assert parsed["emotional_valence"] == 1.0
    assert parsed["emotional_intensity"] == 1.0
    assert parsed["confidence"] == 1.0


def test_to_ctx_dict_integration():
    mock_client = MagicMock()
    payload = (
        '{"intent":"reflect","primary_emotion":"hopeful","emotional_valence":0.2,'
        '"emotional_intensity":0.55,"risk_level":"low","language_mirror":"en",'
        '"cultural_context":"","confidence":0.88}'
    )
    mock_client.chat.completions.create.return_value = _mock_completion(payload)
    layer = CognitiveLayer(mock_client, "m")
    out = layer.analyze("thinking about growth", [{"role": "user", "content": "hi"}], 5)
    d = out.to_ctx_dict()
    expected_keys = {
        "cl_intent",
        "cl_primary_emotion",
        "cl_emotional_valence",
        "cl_emotional_intensity",
        "cl_arc_trajectory",
        "cl_arc_delta",
        "cl_risk_level",
        "cl_intervention_sequence",
        "cl_response_length",
        "cl_question_allowed",
        "cl_language_mirror",
        "cl_mi_move",
        "cl_cultural_context",
        "cl_fallback_used",
    }
    assert set(d.keys()) == expected_keys
    assert d["cl_intent"] == out.intent
    assert d["cl_primary_emotion"] == out.primary_emotion
    assert d["cl_emotional_valence"] == out.emotional_valence
    assert d["cl_emotional_intensity"] == out.emotional_intensity
    assert d["cl_arc_trajectory"] == out.arc_trajectory
    assert d["cl_risk_level"] == out.risk_level
    assert d["cl_intervention_sequence"] == out.intervention_sequence
    assert d["cl_response_length"] == out.response_length
    assert d["cl_question_allowed"] == out.question_allowed
    assert d["cl_language_mirror"] == out.language_mirror
    assert d["cl_mi_move"] == out.mi_move
    assert d["cl_cultural_context"] == out.cultural_context
    assert d["cl_fallback_used"] == out.fallback_used


def test_cognitive_layer_output_defaults():
    CognitivLayerOutput()


def test_to_ctx_dict_keys_only():
    d = CognitivLayerOutput().to_ctx_dict()
    expected = {
        "cl_intent",
        "cl_primary_emotion",
        "cl_emotional_valence",
        "cl_emotional_intensity",
        "cl_arc_trajectory",
        "cl_arc_delta",
        "cl_risk_level",
        "cl_intervention_sequence",
        "cl_response_length",
        "cl_question_allowed",
        "cl_language_mirror",
        "cl_mi_move",
        "cl_cultural_context",
        "cl_fallback_used",
    }
    assert set(d.keys()) == expected


def test_to_ctx_dict_values_roundtrip():
    obj = CognitivLayerOutput(
        intent="venting",
        primary_emotion="sad",
        emotional_valence=-0.4,
        emotional_intensity=0.7,
        arc_trajectory="falling",
        risk_level="moderate",
        arc_current_valence=-0.3,
        arc_session_low=-0.8,
        arc_delta=-0.1,
        intervention_sequence=["validate", "reflect"],
        response_length="short",
        question_allowed=False,
        memory_reference_allowed=False,
        language_mirror="hinglish",
        mi_move="open_question",
        cultural_context="family",
        confidence=0.5,
        fallback_used=True,
    )
    d = obj.to_ctx_dict()
    assert d["cl_intent"] == "venting"
    assert d["cl_primary_emotion"] == "sad"
    assert d["cl_emotional_valence"] == -0.4
    assert d["cl_emotional_intensity"] == 0.7
    assert d["cl_arc_trajectory"] == "falling"
    assert d["cl_risk_level"] == "moderate"
    assert d["cl_intervention_sequence"] == ["validate", "reflect"]
    assert d["cl_response_length"] == "short"
    assert d["cl_question_allowed"] is False
    assert d["cl_language_mirror"] == "hinglish"
    assert d["cl_mi_move"] == "open_question"
    assert d["cl_cultural_context"] == "family"
    assert d["cl_fallback_used"] is True
    assert d["cl_arc_delta"] == -0.1
