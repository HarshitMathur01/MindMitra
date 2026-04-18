"""
Crisis Manager — Critical path safety classification.

Keyword sentinel + LLM disambiguation for crisis signals. The warm crisis
response is built via ``crisis_templates.build_warm_crisis_response`` and
dispatched by the orchestrator. This module handles detection (keyword scan +
optional LLM check), Supabase event logging, and non-blocking crisis memory
persistence.
"""
import logging
import threading
import time
from typing import Any, Dict, Optional

from ..core import crisis_templates
from ..core.prompts import CRISIS_LLM_CHECK_PROMPT
from ..agents.analysis_agent import AnalysisAgent
from ..agents.memory_manager import memory_manager
from supabase import Client

logger = logging.getLogger(__name__)


class CrisisManager:
    """
    Crisis Safety System for MindMitra.
    Responsible for keyword scanning, LLM-based crisis disambiguation,
    crisis event persistence, and delegating warm-response building to
    ``crisis_templates``.
    """

    # Keywords that force immediate crisis routing (no LLM gate needed)
    _CRISIS_HARD_KEYWORDS = (
        "kill myself", "killing myself", "end my life", "ending my life",
        "take my life", "taking my life", "suicidal",
        "want to die", "wanna die", "want to hurt myself", "i want to hurt myself",
        "self harm", "self-harm", "cutting myself", "cut myself",
        "no reason to live", "not worth living", "better off dead",
        "don't want to live", "dont want to live", "shouldn't be alive",
        # Hindi / Hinglish equivalents
        "maar dunga", "maar lunga", "maar lungi", "khatam kar lunga",
        "khatam kar lungi", "khatam ho jaana chahta", "khatam ho jaana chahti",
        "zindagi khatam", "jeena nahi chahta", "jeena nahi chahti",
        "marna chahta", "marna chahti", "khud ko maar",
        # Japanese
        "死にたい", "自殺", "自分を傷つけ", "生きたくない", "死のう",
        # Telugu
        "చనిపోవాలని", "ఆత్మహత్య", "బ్రతకాలని లేదు", "నన్ను నేను హర్ట్",
        # Kannada
        "ಸಾಯಬೇಕು", "ಆತ್ಮಹತ್ಯೆ", "ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ",
        # Tamil
        "சாகணும்", "தற்கொலை", "வாழ விரும்பவில்லை",
    )

    # Keywords that may or may not signal crisis — escalate to LLM for disambiguation.
    _CRISIS_AMBIGUOUS_KEYWORDS = (
        "suicide",
        "hurt myself", "hurt yourself", "hurting myself",
        "end it all", "end it", "can't go on", "cant go on",
        "nobody cares", "worthless", "hopeless", "disappear forever",
    )

    def __init__(self, groq_nlp: Optional[AnalysisAgent] = None, supabase: Optional[Client] = None) -> None:
        self.groq_nlp = groq_nlp
        self.supabase = supabase

    def check_crisis_keywords(self, text: str) -> str:
        """
        Fast keyword scan. Returns: "hard" | "ambiguous" | "safe".
        pure-Python, zero I/O, ~0 ms.
        """
        tl = text.lower()
        for kw in self._CRISIS_HARD_KEYWORDS:
            if kw in tl:
                logger.warning(f"🚨 [CRISIS-KW] Hard match: '{kw}'")
                return "hard"
        for kw in self._CRISIS_AMBIGUOUS_KEYWORDS:
            if kw in tl:
                logger.info(f"⚠️ [CRISIS-KW] Ambiguous match: '{kw}'")
                return "ambiguous"
        return "safe"

    def crisis_llm_check(self, text: str) -> bool:
        """
        Lightweight LLM call for ambiguous crisis signals.
        Only called when keyword scan returns "ambiguous".
        Returns True if crisis intent detected.
        """
        if not (self.groq_nlp and self.groq_nlp.client):
            return False
        try:
            resp = self.groq_nlp.client.chat.completions.create(
                model=self.groq_nlp.model,
                messages=[{
                    "role": "user",
                    "content": CRISIS_LLM_CHECK_PROMPT.format(message=text[:300]),
                }],
                temperature=0.0,
                max_tokens=5,
            )
            answer = (resp.choices[0].message.content.strip().lower()) if resp.choices else "no"
            return answer.startswith("yes")
        except Exception as e:
            logger.warning(f"⚠️ [CRISIS-LLM] Check failed: {e}")
            return False

    def build_warm_crisis_response(self, ctx: Dict, cognitive_output=None, **kwargs) -> str:
        """Delegates to ``crisis_templates.build_warm_crisis_response``."""
        return crisis_templates.build_warm_crisis_response(ctx, cognitive_output, **kwargs)

    def log_crisis_event(self, ctx: Dict) -> None:
        """
        Non-blocking: logs a crisis_events row to Supabase and persists a crisis memory.
        Called by the orchestrator immediately after building the warm crisis response.
        """
        logger.critical(
            "🚨 [CRISIS] D-crisis-warm triggered | "
            "session=%s user=%s",
            str(ctx.get("session_id", "?"))[:8],
            str(ctx.get("user_id", "?"))[:12],
        )

        if self.supabase:
            def _log_event() -> None:
                try:
                    _t0 = time.monotonic()
                    voice = ctx.get("voice_analysis") or {}
                    prosody = voice.get("prosody") or {}
                    voice_indicators: Dict[str, Any] = {}
                    if voice.get("speech_rate_wpm"):
                        voice_indicators["speech_rate_wpm"] = voice["speech_rate_wpm"]
                    if prosody.get("jitter_local_percent"):
                        voice_indicators["jitter_percent"] = prosody["jitter_local_percent"]
                    if prosody.get("pitch_mean_hz"):
                        voice_indicators["pitch_mean_hz"] = prosody["pitch_mean_hz"]
                        voice_indicators["pitch_std_hz"] = prosody.get("pitch_std_hz", 0)
                    if prosody.get("hnr_db"):
                        voice_indicators["hnr_db"] = prosody["hnr_db"]

                    crisis_data: Dict[str, Any] = {
                        "user_id": ctx.get("user_id", "anonymous"),
                        "level": "high",
                        "source": "D-crisis-warm",
                    }
                    if voice_indicators:
                        crisis_data["voice_indicators"] = voice_indicators

                    self.supabase.table("crisis_events").insert(crisis_data).execute()
                    logger.info("✅ [CRISIS] crisis_events row written")
                except Exception as exc:
                    logger.error("❌ [CRISIS] Supabase event log failed: %s", exc)
                    try:
                        self.supabase.table("crisis_dead_letter").insert(
                            {
                                "user_id": ctx.get("user_id", "anonymous"),
                                "session_id": ctx.get("session_id"),
                                "component": "crisis_manager",
                                "action": "insert_crisis_events",
                                "error": str(exc),
                                "detail": {"source": "D-crisis-warm"},
                            }
                        ).execute()
                    except Exception:
                        pass
                finally:
                    logger.info(
                        "[CRISIS] crisis_events latency_ms=%.1f",
                        (time.monotonic() - _t0) * 1000,
                    )

            threading.Thread(target=_log_event, daemon=True, name="crisis-event-log").start()

        try:
            threading.Thread(
                target=memory_manager.add_crisis_memory,
                args=(ctx.get("user_id", "anonymous"), ctx.get("user_message", ""), ctx.get("session_id")),
                daemon=True,
                name="crisis-memory-save",
            ).start()
        except Exception as exc:
            logger.error("❌ [CRISIS] Memory save thread failed: %s", exc)
