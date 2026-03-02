"""
CulturalContextModule — rule-based + optional Groq LLM cultural analysis.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

from ..core.config import config

logger = logging.getLogger(__name__)


class CulturalContextModule:
    """
    Detects Hindi/Hinglish code-switching, formality, and Indian cultural pressure flags.
    Optionally calls a low-cost Groq model for deeper classification.
    """

    _HINDI_MARKERS = {
        "yaar", "bhai", "didi", "maa", "papa", "ghar", "padhai", "exam",
        "nahi", "kya", "hai", "mein", "toh", "acha", "theek", "kuch",
        "kaise", "kyun", "bohot", "bahut", "zyada", "bilkul", "sach",
        "samajh", "dukh", "tension", "pareshan", "darr", "chinta",
        "mann", "dil", "sapna", "zindagi", "rishta", "shaadi",
        "arre", "haan", "naa", "abhi", "bas", "matlab", "lekin",
        "accha", "suno", "bata", "bol", "rona", "akela", "thak",
    }

    def __init__(self, groq_nlp=None):
        self.groq_nlp = groq_nlp

        cultural_flags = config.get("cultural_module.detect_cultural_flags", [])
        default_keywords = {
            "parental_pressure": ["parents", "papa", "maa", "mom", "dad", "family", "ghar", "expect", "disappoint", "proud"],
            "exam_stress": ["exam", "jee", "neet", "boards", "cgpa", "marks", "rank", "topper", "padhai", "result", "semester"],
            "career_anxiety": ["career", "job", "placement", "package", "future", "engineer", "doctor", "startup", "salary"],
            "social_pressure": ["friends", "relationship", "breakup", "lonely", "akela", "judge", "log kya kahenge", "society"],
            "identity_struggle": ["identity", "confused", "who am i", "purpose", "meaning", "self", "worth"],
            "marriage_pressure": ["shaadi", "marriage", "rishta", "arrange", "partner", "settle"],
            "mental_health_stigma": ["pagal", "crazy", "weak", "therapy", "stigma", "shame", "hide"],
        }
        self._CULTURAL_KEYWORDS = {k: v for k, v in default_keywords.items() if k in cultural_flags} if cultural_flags else default_keywords

        self._DEEP_GROQ_MODEL = config.get_model("cultural_deep")
        self._deep_enabled = (
            config.is_enabled("cultural_module.deep_analysis_enabled")
            and bool(self.groq_nlp and getattr(self.groq_nlp, "client", None))
        )
        self._temperature = config.get_temperature("cultural")
        self._max_tokens = config.get_max_tokens("cultural")

        logger.info(f"✅ [CULTURAL] Initialised (deep={self._deep_enabled})")

    # ── public entry ──────────────────────────────────────────────────────
    def analyse(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        text = user_context.get("user_message", "").lower()
        history = user_context["session_context"].get("recent_messages", [])
        nlp_analysis = user_context.get("nlp_analysis", {})

        result = {
            "language_style": self._detect_language_style(text),
            "hindi_english_ratio": self._compute_hindi_ratio(text),
            "code_switching_detected": False,
            "cultural_sensitivity_flags": self._detect_cultural_flags(text),
            "communication_pattern": self._detect_communication_pattern(text, history),
            "regional_context": self._infer_regional_context(text, history),
            "formality_level": self._detect_formality(text),
        }
        result["code_switching_detected"] = result["hindi_english_ratio"] > 0.1

        if history:
            result = self._enrich_from_history(result, history)

        deep_result = self._deep_analyse_with_groq(text, history, nlp_analysis)
        if deep_result:
            result = self._merge_deep_result(result, deep_result)

        user_context["cultural_context"] = result
        logger.info(
            f"✅ [CULTURAL] Style={result['language_style']}, "
            f"Hindi%={result['hindi_english_ratio']:.0%}, "
            f"Flags={result['cultural_sensitivity_flags']}"
        )
        return user_context

    # ── detection helpers ─────────────────────────────────────────────────
    def _detect_language_style(self, text: str) -> str:
        words = set(text.split())
        ratio = len(words & self._HINDI_MARKERS) / max(len(words), 1)
        if ratio > 0.25:
            return "hindi-mixed"
        if ratio > 0.08:
            return "hinglish"
        return "english"

    def _compute_hindi_ratio(self, text: str) -> float:
        words = text.split()
        if not words:
            return 0.0
        return round(sum(1 for w in words if w.lower() in self._HINDI_MARKERS) / len(words), 3)

    def _detect_cultural_flags(self, text: str) -> List[str]:
        text_lower = text.lower()
        return [
            flag for flag, kws in self._CULTURAL_KEYWORDS.items()
            if any(kw in text_lower for kw in kws)
        ]

    def _detect_communication_pattern(self, text: str, history: List) -> str:
        if len(text.split()) < 5:
            return "terse"
        if len(text.split()) > 80:
            return "verbose"
        if text.endswith("?"):
            return "questioning"
        if any(w in text.lower() for w in ["feel", "feeling", "felt", "lagta", "mehsoos"]):
            return "emotionally_expressive"
        return "conversational"

    def _detect_formality(self, text: str) -> str:
        words = set(text.lower().split())
        if words & {"lol", "haha", "omg", "wtf", "bruh", "yaar", "arre", "bc", "mc"}:
            return "low"
        if words & {"sir", "ma'am", "respected", "kindly", "please", "would you"}:
            return "high"
        return "medium"

    def _infer_regional_context(self, text: str, history: List) -> str:
        all_text = text + " ".join(m.get("content", "") for m in history[-5:])
        all_lower = all_text.lower()
        if any(w in all_lower for w in ["kota", "jee", "iit", "coaching"]):
            return "competitive_exam_belt"
        if any(w in all_lower for w in ["bangalore", "bengaluru", "hyderabad", "pune", "it job", "startup"]):
            return "tech_hub"
        if any(w in all_lower for w in ["village", "gaon", "rural"]):
            return "rural"
        return "urban_metro"

    def _enrich_from_history(self, result: Dict, history: List) -> Dict:
        all_text = " ".join(m.get("content", "") for m in history if m.get("role") == "user")
        session_flags = set(result["cultural_sensitivity_flags"])
        for flag, kws in self._CULTURAL_KEYWORDS.items():
            if any(kw in all_text.lower() for kw in kws):
                session_flags.add(flag)
        result["cultural_sensitivity_flags"] = list(session_flags)
        session_hindi = self._compute_hindi_ratio(all_text)
        if session_hindi > result["hindi_english_ratio"]:
            result["hindi_english_ratio"] = round((result["hindi_english_ratio"] + session_hindi) / 2, 3)
            if session_hindi > 0.2:
                result["language_style"] = "hindi-mixed"
        return result

    def _deep_analyse_with_groq(self, text: str, history: List, nlp_analysis: Dict) -> Dict:
        if not self._deep_enabled or len(text.split()) < 5:
            return {}
        recent_user_msgs = [m.get("content", "") for m in history[-5:] if m.get("role") == "user"]
        history_snippet = " | ".join(msg[:140] for msg in recent_user_msgs)

        prompt = f"""Classify this message for an Indian youth mental-health assistant.
Return ONLY valid JSON with exactly these keys:
{{
  "language_style": "<english|hinglish|hindi-mixed>",
  "hindi_english_ratio": <float 0 to 1>,
  "code_switching_detected": <boolean>,
  "cultural_sensitivity_flags": ["<parental_pressure|exam_stress|career_anxiety|social_pressure|identity_struggle|marriage_pressure|mental_health_stigma>"],
  "communication_pattern": "<terse|verbose|questioning|emotionally_expressive|conversational>",
  "regional_context": "<competitive_exam_belt|tech_hub|rural|urban_metro>",
  "formality_level": "<low|medium|high>"
}}

NLP language signal: {nlp_analysis.get('language_detected', 'en')}
Recent user history: {history_snippet[:600]}
Current message: "{text[:1200]}"

JSON:"""

        try:
            resp = self.groq_nlp.client.chat.completions.create(
                model=self._DEEP_GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            )
            content = resp.choices[0].message.content.strip() if resp and resp.choices else ""
            if not content:
                return {}
            cleaned = re.sub(r"```(?:json)?", "", content).strip().rstrip("`")
            parsed = json.loads(cleaned)
            return parsed if isinstance(parsed, dict) else {}
        except Exception as e:
            logger.warning(f"⚠️ [CULTURAL] Deep analysis skipped: {e}")
            return {}

    def _merge_deep_result(self, base: Dict, deep: Dict) -> Dict:
        merged = dict(base)
        allowed_language = {"english", "hinglish", "hindi-mixed"}
        allowed_pattern = {"terse", "verbose", "questioning", "emotionally_expressive", "conversational"}
        allowed_region = {"competitive_exam_belt", "tech_hub", "rural", "urban_metro"}
        allowed_formality = {"low", "medium", "high"}
        allowed_flags = set(self._CULTURAL_KEYWORDS.keys())

        if deep.get("language_style") in allowed_language:
            merged["language_style"] = deep["language_style"]
        ratio = deep.get("hindi_english_ratio")
        if isinstance(ratio, (int, float)):
            merged["hindi_english_ratio"] = round(min(max(float(ratio), 0.0), 1.0), 3)
        code_sw = deep.get("code_switching_detected")
        merged["code_switching_detected"] = bool(code_sw) if isinstance(code_sw, bool) else merged.get("hindi_english_ratio", 0.0) > 0.1
        deep_flags = deep.get("cultural_sensitivity_flags", [])
        if isinstance(deep_flags, list):
            combined = set(merged.get("cultural_sensitivity_flags", []))
            for f in deep_flags:
                if isinstance(f, str) and f in allowed_flags:
                    combined.add(f)
            merged["cultural_sensitivity_flags"] = list(combined)
        if deep.get("communication_pattern") in allowed_pattern:
            merged["communication_pattern"] = deep["communication_pattern"]
        if deep.get("regional_context") in allowed_region:
            merged["regional_context"] = deep["regional_context"]
        if deep.get("formality_level") in allowed_formality:
            merged["formality_level"] = deep["formality_level"]
        return merged
