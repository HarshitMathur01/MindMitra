"""
Groq NLP module — emotion & sentiment analysis.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

from groq import Groq

from ..core.config import config

logger = logging.getLogger(__name__)


class GroqNLPModule:
    """
    Lightweight emotion / sentiment analysis via Groq (llama/qwen).
    Handles token-limit errors with automatic truncation & retry.
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or config.get_api_key("groq")
        self.model = model or config.get_model("nlp")
        self.temperature = config.get_temperature("nlp")
        self.max_tokens = config.get_max_tokens("nlp")
        self._MODEL_TOKEN_LIMITS = config.get("nlp_module.model_token_limits", {})

        if not self.api_key:
            logger.warning("⚠️ [GROQ-NLP] GROQ_API_KEY not set — NLP module disabled")
            self.client = None
            return

        try:
            self.client = Groq(api_key=self.api_key)
            self._max_input_chars = self._MODEL_TOKEN_LIMITS.get(self.model, 8_192) * 3
            logger.info(f"✅ [GROQ-NLP] Initialised with model={self.model}")
        except ImportError:
            logger.warning("⚠️ [GROQ-NLP] `groq` package not installed — NLP module disabled")
            self.client = None
        except Exception as e:
            logger.error(f"❌ [GROQ-NLP] Init failed: {e}")
            self.client = None

    # ── public entry ──────────────────────────────────────────────────────
    def analyse(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Run emotion + sentiment analysis; write results into user_context['nlp_analysis']."""
        if not self.client:
            logger.info("[GROQ-NLP] Skipped (client not available)")
            return user_context

        text = user_context.get("user_message", "")
        recent = user_context["session_context"].get("recent_messages", [])[-3:]
        history_snippet = " | ".join(
            f"{m.get('role','?')}: {m.get('content','')[:120]}" for m in recent
        )

        prompt = self._build_prompt(text, history_snippet)
        raw = self._call_groq(prompt)
        parsed = self._parse_response(raw)
        user_context["nlp_analysis"] = parsed
        logger.info(
            f"✅ [GROQ-NLP] Emotion={parsed.get('primary_emotion')}, "
            f"Sentiment={parsed['sentiment']['label']}"
        )
        return user_context

    # ── internals ─────────────────────────────────────────────────────────
    def _build_prompt(self, text: str, history: str) -> str:
        return f"""Analyse the following user message for a mental-health chatbot.
Return ONLY valid JSON (no markdown fences) with exactly these keys:

{{
  "emotions": {{"joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "surprise": 0.0, "disgust": 0.0, "trust": 0.0, "anticipation": 0.0}},
  "primary_emotion": "<strongest emotion name>",
  "sentiment": {{"score": <float -1 to 1>, "label": "<positive|negative|neutral|mixed>"}},
  "intensity": <float 0 to 1>,
  "key_phrases": ["<phrase1>", "<phrase2>"],
  "language_detected": "<en|hi|hinglish>",
  "urgency_flag": <true if crisis/self-harm indicators else false>
}}

Recent conversation context: {history[:600]}

User message: \"{text[:1500]}\"

JSON:"""

    def _call_groq(self, prompt: str, _retry: int = 0) -> str:
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            err_str = str(e).lower()
            if ("token" in err_str or "context_length" in err_str or "rate_limit" in err_str) and _retry < 2:
                logger.warning(f"⚠️ [GROQ-NLP] Token/rate limit (attempt {_retry+1}), truncating…")
                return self._call_groq(prompt[: len(prompt) // 2], _retry + 1)
            logger.error(f"❌ [GROQ-NLP] API call failed: {e}")
            return "{}"

    def _parse_response(self, raw: str) -> Dict:
        defaults = {
            "emotions": {},
            "primary_emotion": "unknown",
            "sentiment": {"score": 0.0, "label": "neutral"},
            "intensity": 0.0,
            "key_phrases": [],
            "language_detected": "en",
            "urgency_flag": False,
        }
        if not raw:
            return defaults
        try:
            cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            parsed = json.loads(cleaned)
            for k, v in defaults.items():
                if k not in parsed:
                    parsed[k] = v
            return parsed
        except json.JSONDecodeError:
            logger.warning("[GROQ-NLP] Failed to parse JSON, using defaults")
            return defaults
