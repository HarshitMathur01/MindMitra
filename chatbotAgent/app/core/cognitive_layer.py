"""
Groq-backed cognitive extraction for response architecture (Patch 2).

Uses the same Groq client instance as ``AnalysisAgent``;
does not open new connections.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from .cognitive_layer_types import CognitivLayerOutput
from .emotional_arc import EmotionalArcReader

logger = logging.getLogger(__name__)

_VALID_INTENTS = frozenset(("venting", "advice", "casual", "reflect", "update", "crisis"))
_VALID_RISK = frozenset(("low", "moderate", "elevated", "crisis"))
_VALID_LANG = frozenset(("en", "hi", "hinglish"))


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


class CognitiveLayer:
    """Single Groq JSON extraction + deterministic safety and style rules."""

    INTERVENTION_RULES: Dict[Tuple[str, str], List[str]] = {
        ("crisis", "*"): ["validate", "ground"],
        ("elevated", "falling"): ["validate", "ground", "reflect"],
        ("elevated", "volatile"): ["validate", "reflect"],
        ("elevated", "*"): ["validate", "reflect"],
        ("moderate", "falling"): ["validate", "reflect"],
        ("moderate", "rising"): ["reflect", "affirm"],
        ("moderate", "*"): ["validate", "reflect"],
        ("low", "casual"): ["no_intervention"],
        ("low", "*"): ["reflect", "affirm"],
    }

    MI_MOVE_MAP: Dict[str, str] = {
        "venting": "reflection",
        "emotional": "reflection",
        "advice": "open_question",
        "casual": "no_move",
        "reflect": "summary",
        "update": "affirmation",
        "crisis": "reflection",
    }

    RESPONSE_LENGTH_MAP: Dict[str, str] = {
        "casual": "short",
        "venting": "medium",
        "emotional": "medium",
        "advice": "medium",
        "reflect": "long",
        "update": "short",
        "crisis": "medium",
    }

    def __init__(self, groq_client: Any, model: str) -> None:
        self.client = groq_client
        self.model = model
        self.arc_reader = EmotionalArcReader()
        self._TIMEOUT_S = 8.0

    def _format_turns(self, recent_turns: List[dict]) -> Tuple[str, int]:
        msgs = [
            m
            for m in (recent_turns or [])
            if (m or {}).get("role") and str((m or {}).get("role")).lower() != "system"
        ]
        tail = msgs[-6:]
        lines: List[str] = []
        for m in tail:
            role = (m.get("role") or "user").lower()
            label = "User" if role == "user" else "Companion"
            content = str(m.get("content") or "").replace("\n", " ").strip()
            lines.append(f"{label}: {content}")
        return "\n".join(lines), len(tail)

    def _build_prompt(
        self,
        user_message: str,
        recent_turns: List[dict],
        arc: dict,
        session_count: int,
        trust_tier: Optional[Any] = None,
    ) -> str:
        formatted_turns, n = self._format_turns(recent_turns)
        arc_direction = arc.get("arc_direction", "stable")
        current_valence = arc.get("current_valence", 0.0)
        session_low = arc.get("session_low", 0.0)
        turn_count = arc.get("turn_count", 0)
        trust_block = ""
        if trust_tier is not None and str(trust_tier).strip() != "":
            trust_block = (
                f"\nRelational context:\n"
                f"- Approximate session message depth: {session_count}\n"
                f"- Trust tier (1-5, from stored relational profile): {trust_tier}\n"
            )
        return f"""You are a clinical reasoning engine for a mental health companion AI.
Analyze the user's message and conversation context. Output ONLY valid JSON, no preamble, no markdown, no explanation.

Conversation (last {n} turns):
{formatted_turns}

Current user message:
"{user_message}"
{trust_block}
Emotional arc context:
- Valence trajectory: {arc_direction} (current score: {current_valence})
- Session low point: {session_low}
- Session length so far: {turn_count} user turns

Output this exact JSON structure:
{{
  "intent": "venting|advice|casual|reflect|update|crisis",
  "primary_emotion": "one word — e.g. anxious, sad, overwhelmed, hopeful, frustrated, lonely, numb, angry, relieved",
  "emotional_valence": float from -1.0 to 1.0,
  "emotional_intensity": float from 0.0 to 1.0,
  "risk_level": "low|moderate|elevated|crisis",
  "language_mirror": "en|hi|hinglish",
  "cultural_context": "brief note on cultural pressure if present, else empty string",
  "confidence": float from 0.0 to 1.0
}}

Rules:
1. intent "crisis" ONLY if explicit suicidal ideation, self-harm intent, or direct statement of wanting to die.
2. risk_level "elevated" for passive ideation, hopelessness, severe distress without direct self-harm intent.
3. risk_level "moderate" for significant distress, rumination, escalating worry.
4. language_mirror: "hinglish" if message mixes Hindi words/phrases with English. "hi" if predominantly Hindi script. "en" otherwise.
5. emotional_valence must match primary_emotion directionally (sad → negative, hopeful → slightly positive).
6. Respond with JSON only. No other text."""

    @staticmethod
    def _parse_response(raw: str) -> Optional[dict]:
        if not raw or not str(raw).strip():
            return None
        text = str(raw).strip()
        fence = re.match(
            r"^```(?:json)?\s*\n?(.*?)\n?```\s*$",
            text,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if fence:
            text = fence.group(1).strip()

        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            return None

        if not isinstance(obj, dict):
            return None

        required = (
            "intent",
            "primary_emotion",
            "emotional_valence",
            "emotional_intensity",
            "risk_level",
            "language_mirror",
        )
        for k in required:
            if k not in obj:
                return None

        if not isinstance(obj.get("intent"), str):
            return None
        if not isinstance(obj.get("primary_emotion"), str):
            return None
        if not isinstance(obj.get("risk_level"), str):
            return None
        if not isinstance(obj.get("language_mirror"), str):
            return None

        if obj["intent"] not in _VALID_INTENTS:
            return None
        if obj["risk_level"] not in _VALID_RISK:
            return None
        if obj["language_mirror"] not in _VALID_LANG:
            return None

        try:
            valence = float(obj["emotional_valence"])
            intensity = float(obj["emotional_intensity"])
        except (TypeError, ValueError):
            return None

        conf_raw = obj.get("confidence", 0.8)
        try:
            confidence = float(conf_raw)
        except (TypeError, ValueError):
            return None

        cultural = obj.get("cultural_context", "")
        if cultural is None:
            cultural = ""
        elif not isinstance(cultural, str):
            cultural = str(cultural)

        return {
            "intent": obj["intent"],
            "primary_emotion": obj["primary_emotion"],
            "emotional_valence": _clamp(valence, -1.0, 1.0),
            "emotional_intensity": _clamp(intensity, 0.0, 1.0),
            "risk_level": obj["risk_level"],
            "language_mirror": obj["language_mirror"],
            "cultural_context": cultural,
            "confidence": _clamp(confidence, 0.0, 1.0),
        }

    @classmethod
    def _intervention_sequence(
        cls, risk_level: str, intent: str, arc_direction: str
    ) -> List[str]:
        rules = cls.INTERVENTION_RULES
        key_arc = (risk_level, arc_direction)
        if key_arc in rules:
            return list(rules[key_arc])
        key_intent = (risk_level, intent)
        if key_intent in rules:
            return list(rules[key_intent])
        key_wild = (risk_level, "*")
        if key_wild in rules:
            return list(rules[key_wild])
        return ["validate", "reflect"]

    def _apply_deterministic_rules(
        self,
        parsed: dict,
        arc: dict,
        crisis_sentinel_level: str,
        *,
        fallback_used: bool = False,
        ambiguous_llm_cleared: bool = False,
    ) -> CognitivLayerOutput:
        p = dict(parsed)

        if crisis_sentinel_level == "hard":
            p["intent"] = "crisis"
            p["risk_level"] = "crisis"
        elif crisis_sentinel_level == "ambiguous" and p.get("risk_level") == "low":
            p["risk_level"] = "moderate"
        elif ambiguous_llm_cleared and p.get("risk_level") == "low":
            # Keyword was ambiguous, LLM disambiguated as non-crisis — still elevate attention slightly.
            p["risk_level"] = "moderate"

        if arc.get("arc_direction") == "falling" and float(arc.get("arc_delta", 0.0)) < -0.4:
            escalation_map = {
                "low": "moderate",
                "moderate": "elevated",
                "elevated": "elevated",
                "crisis": "crisis",
            }
            prev_r = p.get("risk_level", "low")
            p["risk_level"] = escalation_map.get(prev_r, prev_r)

        intent = str(p.get("intent", "venting"))
        risk_level = str(p.get("risk_level", "moderate"))
        arc_direction = str(arc.get("arc_direction", "stable"))

        intervention_sequence = self._intervention_sequence(risk_level, intent, arc_direction)

        mi_move = self.MI_MOVE_MAP.get(intent, "reflection")
        response_length = self.RESPONSE_LENGTH_MAP.get(intent, "medium")

        emotional_intensity = float(p.get("emotional_intensity", 0.5))
        question_allowed = True
        if intent == "venting":
            question_allowed = False
        elif intent == "crisis":
            question_allowed = False
        elif arc_direction == "falling" and emotional_intensity > 0.7:
            question_allowed = False

        memory_reference_allowed = True
        if intent in ("venting", "crisis") or risk_level == "crisis":
            memory_reference_allowed = False

        arc_cv = float(arc.get("current_valence", 0.0) or 0.0)
        arc_sl = float(arc.get("session_low", 0.0) or 0.0)
        arc_d = float(arc.get("arc_delta", 0.0) or 0.0)

        return CognitivLayerOutput(
            intent=intent,
            primary_emotion=str(p.get("primary_emotion", "neutral")),
            emotional_valence=float(p.get("emotional_valence", 0.0)),
            emotional_intensity=emotional_intensity,
            arc_trajectory=arc_direction,
            risk_level=risk_level,
            arc_current_valence=arc_cv,
            arc_session_low=arc_sl,
            arc_delta=arc_d,
            intervention_sequence=intervention_sequence,
            response_length=response_length,
            question_allowed=question_allowed,
            memory_reference_allowed=memory_reference_allowed,
            language_mirror=str(p.get("language_mirror", "en")),
            mi_move=mi_move,
            cultural_context=str(p.get("cultural_context", "")),
            confidence=float(p.get("confidence", 0.8)),
            fallback_used=fallback_used,
        )

    def analyze(
        self,
        user_message: str,
        recent_turns: List[dict],
        session_count: int,
        crisis_sentinel_level: str = "safe",
        supabase_client: Any = None,
        session_id: Optional[str] = None,
        *,
        precomputed_arc: Optional[dict] = None,
        trust_tier: Optional[Any] = None,
        ambiguous_llm_cleared: bool = False,
    ) -> CognitivLayerOutput:
        del supabase_client, session_id  # reserved for future arc-from-DB wiring

        if precomputed_arc is not None:
            arc = dict(precomputed_arc)
        elif recent_turns:
            arc = self.arc_reader.compute_arc(recent_turns)
        else:
            arc = self.arc_reader.compute_arc([])

        if crisis_sentinel_level == "hard":
            return self._apply_deterministic_rules(
                {
                    "intent": "crisis",
                    "primary_emotion": "distress",
                    "emotional_valence": -0.9,
                    "emotional_intensity": 1.0,
                    "risk_level": "crisis",
                    "language_mirror": "en",
                    "cultural_context": "",
                    "confidence": 1.0,
                },
                arc,
                "hard",
                fallback_used=False,
                ambiguous_llm_cleared=False,
            )

        prompt = self._build_prompt(
            user_message, recent_turns, arc, session_count, trust_tier=trust_tier
        )
        parsed: Optional[dict] = None
        fallback_used = False

        if self.client:
            try:
                kwargs = {
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 256,
                    "temperature": 0.1,
                }
                try:
                    resp = self.client.chat.completions.create(
                        **kwargs, timeout=self._TIMEOUT_S
                    )
                except TypeError:
                    resp = self.client.chat.completions.create(**kwargs)
                raw = (resp.choices[0].message.content or "").strip()
                parsed = self._parse_response(raw)
            except Exception as e:
                logger.warning(f"[CognitiveLayer] LLM call failed: {e}")
                parsed = None

        if parsed is None:
            fallback_used = True
            parsed = {
                "intent": "emotional",
                "primary_emotion": "distressed",
                "emotional_valence": float(arc.get("current_valence", 0.0)),
                "emotional_intensity": 0.6,
                "risk_level": "moderate",
                "language_mirror": "en",
                "cultural_context": "",
                "confidence": 0.3,
            }

        return self._apply_deterministic_rules(
            parsed,
            arc,
            crisis_sentinel_level,
            fallback_used=fallback_used,
            ambiguous_llm_cleared=ambiguous_llm_cleared,
        )
