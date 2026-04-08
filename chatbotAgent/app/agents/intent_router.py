"""
IntentRouter — lightweight Groq-based message classifier.

Makes ONE fast Groq call to classify every user message into:
  casual | emotional | therapeutic | crisis

Reuses the already-configured Groq client from AnalysisAgent.
Designed to be instantiated once and called per request.

Guarantee: never raises — always returns a valid dict.
"""
import logging
from typing import Any, Dict, List, Optional
import time
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
        voice_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Classify `user_message` into one of four intent buckets.

        Args:
            screening_hint: Optional PHQ-9/GAD-7 severity hint (e.g. "PHQ-9=moderate, GAD-7=severe")
            voice_hint: Optional voice prosody summary (e.g. "fast speech, high jitter, low pitch")

        Returns:
            {"intent": str, "confidence": float}

        Never raises — falls back to {"intent": "emotional", "confidence": 0.5}.
        """
        if not self.client or not user_message.strip():
            return _DEFAULT_RESULT.copy()

        history = self._format_history(recent_messages)
        activity_hint = self._format_activity_hint(activities)
        prompt = self._build_prompt(user_message, history, activity_hint, screening_hint, voice_hint)

        try:
            start_time = time.perf_counter()
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "=== Strict OUTPUT FORMAT ===\n"
                            "Output ONLY valid JSON. No markdown, no explanation, no extra text.\n"
                            'Format: {"intent": "<intent>", "confidence": <float between 0.0 and 1.0>}\n\n'

                            "You are a precise intent classifier for a mental health AI companion called MindMitra.\n"
                            "The user may write in ANY language (English, Hindi, Hinglish, Japanese, Telugu, Kannada, Tamil, or others). "
                            "Classify based on meaning regardless of language.\n\n"
                            "Your job is to classify the user's message into EXACTLY one of these four intents:\n"
                            "- casual\n"
                            "- emotional\n"
                            "- therapeutic\n"
                            "- crisis\n\n"

                            "=== DEFINITIONS WITH EXAMPLES ===\n\n"

                            "CASUAL — General conversation, greetings, small talk, curiosity, or neutral questions.\n"
                            "The user is not expressing distress. Tone is light, neutral, or friendly.\n"
                            "Examples:\n"
                            "  'hey, how are you?'\n"
                            "  'what can you help me with?'\n"
                            "  'I had a pretty okay day'\n"
                

                            "EMOTIONAL — The user is expressing or processing feelings, but is not in danger and is not asking for advice.\n"
                            "They want to feel heard and validated. Tone may be sad, frustrated, anxious, overwhelmed, lonely, confused, or numb.\n"
                            "There is NO immediate danger signal. They are sharing, not seeking solutions, or solution is not needed, listning does the therapy.\n"
                            "Examples:\n"
                            "  'I've been feeling really low lately'\n"
                            "  'I don't know why but I've been crying a lot'\n"
                            "  'I feel so alone even when I'm around people'\n"                      

                            "THERAPEUTIC — The user is actively seeking help, strategies, or guidance or you think guidance/councelling is must / needed thing for user.\n"
                            "They want/need coping tools, structured support, information, or a plan.\n"
                            "Tone is solution-oriented or explicitly requesting advice. May also include users who want to understand their feelings.\n"
                            "Examples:(There can be various other situations as well where you have to classify between emotional and THERAPEUTIC)\n"
                            "  'how do I stop overthinking at night?'\n"
                            "  'can you teach me a breathing exercise?'\n"
                            "  'what should I do when I feel a panic attack coming?'\n"
        

                            "CRISIS — The user may be in immediate danger, expressing suicidal ideation, self-harm urges, severe hopelessness, or describes an urgent situation that requires escalation.\n"
                            "This includes direct or indirect signals. ALWAYS err on the side of caution — if there is ANY possibility of danger, classify as crisis.\n"
                            "Indirect signals count: feeling like a burden, saying goodbye, giving away things, feeling completely trapped with no way out.\n"
                            "Examples:\n"
                            "  'I want to die'\n"
                            "  'I can't do this anymore'\n"
                            "  'I've been hurting myself'\n"

                            "=== Strict OUTPUT FORMAT ===\n"
                            "Output ONLY valid JSON. No markdown, no explanation, no extra text.\n"
                            'Format: {"intent": "<intent>", "confidence": <float between 0.0 and 1.0>}\n\n'

                            "===Strict OUTPUT FORMAT ===\n"
                            "Output ONLY valid JSON. No markdown, no explanation, no extra text.\n"
                            'Format: {"intent": "<intent>", "confidence": <float between 0.0 and 1.0>}\n\n'
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
                max_tokens=3000,
            )

            raw = (resp.choices[0].message.content or "").strip()
            # logger.info(f"[INTENT RAW OUTPUT] {raw}")
            parsed = parse_json_from_llm_output(raw)
            # logger.info(f"[INTENT PARSED] {parsed}")


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
                api_time = time.perf_counter()

                logger.info(f"🎯 [INTENT-ROUTER] {intent} ({confidence:.2f})")
                logger.info(f"""⏱️ [TIMING]- API Call: {(api_time - start_time)*1000:.2f} ms""")
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
    def _build_prompt(user_message: str, history: str, activity_hint: str = "", screening_hint: Optional[str] = None, voice_hint: Optional[str] = None) -> str:
        ctx_line = f"Context: {history}\n" if history else ""
        act_line = f"Recent activity: {activity_hint}\n" if activity_hint else ""
        screening_line = f"Clinical screening: {screening_hint}\n" if screening_hint else ""
        voice_line = f"Voice tone indicators: {voice_hint}\n" if voice_hint else ""
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
            f"{voice_line}"
            f'Message: "{user_message[:600]}"\n\n'
            "JSON:"
        )
