"""
ScreeningAssessmentAgent — generates PHQ-9 / GAD-7 estimates from conversation.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..core.config import config
from ..utils.json_utils import parse_json_from_llm_output

logger = logging.getLogger(__name__)


class ScreeningAssessmentAgent:
    """
    Estimates PHQ-9 and GAD-7 scores from conversation context.
    Uses Groq first, with GLM fallback. Safe validation enforces schema consistency.
    """

    def __init__(self, groq_nlp, glm):
        self.groq_nlp = groq_nlp
        self.glm = glm

        self._GROQ_MODEL = config.get_model("screening")
        self._temperature = config.get_temperature("screening")
        self._max_tokens = config.get_max_tokens("screening")

        logger.info("✅ [SCREENING] PHQ-9 / GAD-7 screening agent ready")

    # ── public API ─────────────────────────────────────────────────────────
    def generate(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        user_message = user_context.get("user_message", "")
        session = user_context.get("session_context", {})
        recent = session.get("recent_messages", [])[-6:]
        nlp = user_context.get("nlp_analysis", {})
        psych = user_context.get("psychological_analysis", {})

        if not user_message.strip() and not recent:
            return {}

        history_snippet = "\n".join(
            f"{m.get('role','user')}: {m.get('content','')[:140]}" for m in recent
        )
        prompt = f"""Estimate screening scores for PHQ-9 and GAD-7 from the text context below.
Return ONLY valid JSON with exactly this structure:
{{
  "phq9": {{"responses": [<9 integers 0-3>], "score": <0-27 integer>, "severity": "<minimal|mild|moderate|moderately_severe|severe>"}},
  "gad7": {{"responses": [<7 integers 0-3>], "score": <0-21 integer>, "severity": "<minimal|mild|moderate|severe>"}}
}}

Rules:
- Infer cautiously from available data; do not exaggerate risk.
- If evidence is weak, keep scores low and conservative.
- No markdown, no extra keys.

Current message: "{user_message[:1200]}"
Recent conversation:
{history_snippet[:1000]}

Signals:
- NLP primary emotion: {nlp.get('primary_emotion','unknown')}
- NLP intensity: {nlp.get('intensity',0)}
- Psychological state: {psych.get('emotional_state','')}

JSON:"""

        parsed = self._call_groq(prompt) or self._call_glm(prompt)
        if not parsed:
            return {}
        return self._validate(parsed)

    # ── internals ──────────────────────────────────────────────────────────
    def _call_groq(self, prompt: str) -> Optional[Dict]:
        if not self.groq_nlp or not getattr(self.groq_nlp, "client", None):
            return None
        try:
            resp = self.groq_nlp.client.chat.completions.create(
                model=self._GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            )
            content = resp.choices[0].message.content if resp and resp.choices else ""
            out = parse_json_from_llm_output(content)
            if isinstance(out, dict):
                logger.info("✅ [SCREENING] Generated via Groq")
                return out
        except Exception as e:
            logger.warning(f"⚠️ [SCREENING] Groq failed: {e}")
        return None

    def _call_glm(self, prompt: str) -> Optional[Dict]:
        try:
            resp = self.glm.invoke([{"role": "user", "content": prompt}])
            content = resp.content if resp and resp.content else ""
            out = parse_json_from_llm_output(content)
            if isinstance(out, dict):
                logger.info("✅ [SCREENING] Generated via GLM fallback")
                return out
        except Exception as e:
            logger.warning(f"⚠️ [SCREENING] GLM fallback failed: {e}")
        return None

    def _validate(self, parsed: Dict) -> Dict:
        now = datetime.now(timezone.utc).isoformat()
        phq = parsed.get("phq9", {}) if isinstance(parsed.get("phq9"), dict) else {}
        gad = parsed.get("gad7", {}) if isinstance(parsed.get("gad7"), dict) else {}

        def _clean_responses(raw, n):
            resp = raw.get("responses", []) if isinstance(raw.get("responses"), list) else []
            clean = [int(min(max(int(v), 0), 3)) for v in resp[:n] if str(v).strip().lstrip("-").isdigit()]
            while len(clean) < n:
                clean.append(0)
            return clean

        phq_r = _clean_responses(phq, 9)
        gad_r = _clean_responses(gad, 7)

        def _to_int(val, fallback):
            try:
                return int(val)
            except Exception:
                return fallback

        phq_score = min(max(_to_int(phq.get("score"), sum(phq_r)), 0), 27)
        gad_score = min(max(_to_int(gad.get("score"), sum(gad_r)), 0), 21)

        return {
            "phq9": {"score": phq_score, "severity": self._phq9_severity(phq_score), "responses": phq_r, "last_updated": now},
            "gad7": {"score": gad_score, "severity": self._gad7_severity(gad_score), "responses": gad_r, "last_updated": now},
        }

    @staticmethod
    def _phq9_severity(score: int) -> str:
        if score <= 4: return "minimal"
        if score <= 9: return "mild"
        if score <= 14: return "moderate"
        if score <= 19: return "moderately_severe"
        return "severe"

    @staticmethod
    def _gad7_severity(score: int) -> str:
        if score <= 4: return "minimal"
        if score <= 9: return "mild"
        if score <= 14: return "moderate"
        return "severe"
