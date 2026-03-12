"""
IntentRouter — lightweight Groq-based message classifier.

Makes ONE fast Groq call to classify every user message into:
  casual | emotional | therapeutic | crisis

Reuses the already-configured Groq client from GroqNLPModule.
Designed to be instantiated once and called per request.

Guarantee: never raises — always returns a valid dict.
"""
import logging
from typing import Any, Dict, List, Optional

from ..utils.json_utils import parse_json_from_llm_output

logger = logging.getLogger(__name__)

_DEFAULT_RESULT: Dict[str, Any] = {"intent": "emotional", "confidence": 0.5}

_VALID_INTENTS = frozenset(("casual", "emotional", "therapeutic", "crisis"))


class IntentRouter:
    """
    One-call intent classifier backed by Groq.

    Args:
        groq_client: a `groq.Groq` instance (pre-validated, not None)
        model: the Groq model name already configured for the NLP module
    """

    def __init__(self, groq_client, model: str) -> None:
        self.client = groq_client
        self.model = model
        logger.info(f"✅ [INTENT-ROUTER] Ready — model={model}")

    # ── public ─────────────────────────────────────────────────────────────

    def classify(
        self,
        user_message: str,
        recent_messages: Optional[List[Dict]] = None,
        activities: Optional[List[Dict]] = None,
        screening_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Classify `user_message` into one of four intent buckets.

        Args:
            screening_hint: Optional PHQ-9/GAD-7 severity hint (e.g. "PHQ-9=moderate, GAD-7=severe")

        Returns:
            {"intent": str, "confidence": float}

        Never raises — falls back to {"intent": "emotional", "confidence": 0.5}.
        """
        if not self.client or not user_message.strip():
            return _DEFAULT_RESULT.copy()

        history = self._format_history(recent_messages)
        activity_hint = self._format_activity_hint(activities)
        prompt = self._build_prompt(user_message, history, activity_hint, screening_hint)

        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=200,
                reasoning_effort="none",
            )
            raw = (resp.choices[0].message.content.strip()) if resp.choices else ""
            logger.info(f"[INTENT RAW OUTPUT] {raw}")

            parsed = parse_json_from_llm_output(raw)
            logger.info(f"[INTENT PARSED] {parsed}")

            # if (
            #     isinstance(parsed, dict)
            #     and parsed.get("intent") in _VALID_INTENTS
            #     and isinstance(parsed.get("confidence"), (int, float))
            # ):
            #     result = {
            #         "intent": str(parsed["intent"]),
            #         "confidence": float(parsed["confidence"]),
            #     }
            #     logger.info(f"🎯 [INTENT-ROUTER] {result['intent']} ({result['confidence']:.2f})")
            #     return result
            if isinstance(parsed, dict):

                intent = parsed.get("intent", "emotional")

                try:
                    confidence = float(parsed.get("confidence", 0.5))
                except Exception:
                    confidence = 0.5

                if intent not in _VALID_INTENTS:
                    intent = "emotional"

                result = {
                    "intent": intent,
                    "confidence": confidence
                }

                logger.info(f"🎯 [INTENT-ROUTER] {intent} ({confidence:.2f})")

                return result

            logger.warning(f"⚠️ [INTENT-ROUTER] Unexpected response shape, using default")
        except Exception as e:
            logger.warning(f"⚠️ [INTENT-ROUTER] Classification failed: {e}")

        return _DEFAULT_RESULT.copy()

    # ── internals ──────────────────────────────────────────────────────────

    @staticmethod
    def _format_history(recent_messages: Optional[List[Dict]]) -> str:
        if not recent_messages:
            return ""
        last_two = recent_messages[-2:]
        return " | ".join(
            f"{m.get('role', '?')}: {m.get('content', '')[:80]}" for m in last_two
        )

    @staticmethod
    def _format_activity_hint(activities: Optional[List[Dict]]) -> str:
        """Build a short hint about the user's most recent game/assessment activity."""
        if not activities:
            return ""
        latest = activities[0]  # already sorted by completed_at desc
        atype = latest.get("activity_type", "")
        if not atype:
            return ""
        score = latest.get("score")
        wellness = (latest.get("evaluation_data") or {}).get("wellness_level", "")
        hint = f"User just completed the '{atype.replace('_', ' ')}' game/assessment"
        if score is not None:
            hint += f" (score: {score})"
        if wellness:
            hint += f" (wellness: {wellness})"
        return hint

    @staticmethod
    def _build_prompt(user_message: str, history: str, activity_hint: str = "", screening_hint: Optional[str] = None) -> str:
        ctx_line = f"Context: {history}\n" if history else ""
        act_line = f"Recent activity: {activity_hint}\n" if activity_hint else ""
        screening_line = f"Clinical screening: {screening_hint}\n" if screening_hint else ""
        return (
            'Classify the user message. Return ONLY in strict JSON with keys "intent" and "confidence".\n'
            'There should be nothing else other than this strict json format , nno text before or after this json needed, do internal reasoning adn just output the json only.\n'
            '"intent" must be exactly one of: casual, emotional, therapeutic, crisis\n'
            "Definitions:\n"
            "  casual      — greetings, small talk, boredom, playful chat, simple curiosity\n"
            "  emotional   — sharing feelings, mild stress, venting, seeking validation\n"
            "  therapeutic — explicit distress, persistent low mood, trauma disclosure, mental health struggle\n"
            "  crisis      — suicidal ideation, explicit self-harm statements, immediate safety risk. Mark it crisis carefully, you can go for therapeutic response once, even after that if matter esclates mark as crisis.Think Accordingly.You have recent conversation as well so you can detect that.\n"
            '"confidence": float 0.0-1.0\n\n'
            f"{ctx_line}"
            f"{act_line}"
            f"{screening_line}"
            f'Message: "{user_message[:600]}"\n\n'
            "JSON:"
        )
