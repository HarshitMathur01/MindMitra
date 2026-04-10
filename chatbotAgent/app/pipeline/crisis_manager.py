"""
Crisis Manager — Critical path safety classification.

Decoupled critical path evaluation module used to override regular orchestration paths
in case of detected harm/crisis language. Triggers automated escalation scripts and acts
as an overriding gate in the conversation.
"""
import logging
import threading
import time
from typing import Dict, Any, Optional

from ..agents.memory_manager import memory_manager
from ..agents.analysis_agent import AnalysisAgent
from supabase import Client

logger = logging.getLogger(__name__)

class CrisisManager:
    """
    Crisis Safety System for MindMitra.
    Responsible for keyword scanning, LLM-based crisis escalation, 
    and handling the immediate crisis fast-path (Path D).
    """

    # Crisis keywords that trigger immediate fast-path (no LLM needed)
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

    # Hardcoded crisis resources (India-specific) — template-dynamic
    _CRISIS_RESPONSE_TEMPLATES: Dict[str, str] = {
        "english": (
            "I'm really glad you reached out. You're not alone, and what you're feeling is real. "
            "{known_support}"
            "Please talk to someone who can be there with you in person — "
            "a doctor, counselor, or someone you trust:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "You deserve that support. I'm here whenever you want to talk."
        ),
        "hindi": (
            "Mujhe bahut khushi hai ki tumne baat ki. Tum akele nahi ho — jo tum mehsoos kar rahe ho woh real hai. "
            "{known_support}"
            "Please kisi se baat karo jo tumhare saath ho sake — "
            "doctor, counselor, ya koi apna:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "Tum real support ke haqdaar ho. Main yahan hoon jab bhi baat karni ho."
        ),
        "hinglish": (
            "I'm really glad tumne baat ki. You're not alone — jo tum feel kar rahe ho woh real hai. "
            "{known_support}"
            "Please kisi se baat karo who can really be there — "
            "doctor, counselor, ya koi close person:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "You deserve real support. Main hoon — jab bhi baat karni ho."
        ),
        "japanese": (
            "話してくれてありがとうございます。あなたは一人じゃありません。"
            "今感じていることは本物で、大切なことです。"
            "{known_support}"
            "信頼できる人に話してみてください — 医師、カウンセラー、大切な人に:\n\n"
            "📞 いのちの電話: 0570-783-556\n"
            "📞 よりそいホットライン: 0120-279-338\n\n"
            "あなたはサポートを受ける価値があります。話したいときはいつでもここにいます。"
        ),
        "telugu": (
            "మీరు నాతో మాట్లాడినందుకు సంతోషంగా ఉంది. మీరు ఒంటరిగా లేరు — మీరు అనుభవిస్తున్నది నిజమైనది. "
            "{known_support}"
            "దయచేసి మీకు అండగా ఉండగల వారితో మాట్లాడండి — "
            "డాక్టర్, కౌన్సెలర్, లేదా విశ్వసనీయ వ్యక్తి:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "మీకు నిజమైన సహాయం అందాలి. మాట్లాడాలనుకున్నప్పుడు నేను ఇక్కడ ఉన్నాను."
        ),
        "kannada": (
            "ನೀವು ನನ್ನೊಂದಿಗೆ ಮಾತನಾಡಿದ್ದಕ್ಕೆ ಖುಷಿಯಾಗಿದೆ. ನೀವು ಒಬ್ಬಂಟಿಯಲ್ಲ — ನೀವು ಅನುಭವಿಸುತ್ತಿರುವುದು ನಿಜ. "
            "{known_support}"
            "ಬೆಂಬಲ ನೀಡಬಲ್ಲ ಯಾರೊಂದಿಗಾದರೂ ಮಾತನಾಡಿ — "
            "ವೈದ್ಯರು, ಕೌನ್ಸೆಲರ್, ಅಥವಾ ನಂಬಿಕಸ್ಥ ವ್ಯಕ್ತಿ:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "ನಿಮಗೆ ನಿಜವಾದ ಬೆಂಬಲ ಸಿಗಬೇಕು. ಮಾತನಾಡಬೇಕೆನಿಸಿದಾಗ ನಾನು ಇಲ್ಲಿದ್ದೇನೆ."
        ),
        "tamil": (
            "நீங்கள் என்னிடம் பேசியதற்கு மகிழ்ச்சியாக இருக்கிறேன். நீங்கள் தனியாக இல்லை — நீங்கள் உணர்வது உண்மையானது. "
            "{known_support}"
            "உங்களுக்கு ஆதரவாக இருக்கக்கூடிய யாரிடமாவது பேசுங்கள் — "
            "மருத்துவர், ஆலோசகர், அல்லது நம்பகமான நபர்:\n\n"
            "📞 iCall India: 9152987821\n"
            "📞 Vandrevala Foundation: 1860-2662-345\n\n"
            "நீங்கள் உண்மையான ஆதரவைப் பெற தகுதியானவர். பேசவேண்டும் என்றால் நான் இங்கே இருக்கிறேன்."
        ),
    }

    def __init__(self, groq_nlp: Optional[AnalysisAgent] = None, supabase: Optional[Client] = None):
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
                    "content": (
                        "Does this message express intent to harm oneself or end one's life? "
                        f'Answer only "yes" or "no".\nMessage: "{text[:300]}"'
                    ),
                }],
                temperature=0.0,
                max_tokens=5,
            )
            answer = (resp.choices[0].message.content.strip().lower()) if resp.choices else "no"
            return answer.startswith("yes")
        except Exception as e:
            logger.warning(f"⚠️ [CRISIS-LLM] Check failed: {e}")
            return False

    def build_crisis_response(self, ctx: Dict) -> str:
        """
        Builds the fallback crisis template response.
        """
        lang = ctx["personality_settings"].get("language", "english").lower()
        template = self._CRISIS_RESPONSE_TEMPLATES.get(
            lang, self._CRISIS_RESPONSE_TEMPLATES["english"]
        )

        known_support = ""
        mem_text = ctx.get("memory_context", "")
        if "brother" in mem_text.lower() or "sister" in mem_text.lower():
            known_support = "I know you have family who cares about you. "
        elif "friend" in mem_text.lower():
            known_support = "I know you have friends who care about you. "

        return template.format(known_support=known_support)

    def crisis_fast_path(self, ctx: Dict) -> None:
        """
        Path D — immediate empathetic crisis response. Logs event. Under ~1s.
        Sets ctx["ai_response"] directly, sets analysis to crisis defaults.
        """
        logger.critical(
            f"🚨 [CRISIS] Fast-path triggered | session={str(ctx.get('session_id','?'))[:8]}"
        )
        
        # Log to crisis_events table (non-blocking)
        if self.supabase:
            try:
                # Include voice stress indicators in crisis log for clinical review
                voice = ctx.get("voice_analysis", {})
                prosody = voice.get("prosody", {})
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

                crisis_data = {
                    "user_id": ctx.get("user_id", "anonymous"),
                    "level": "high",
                    "source": "intent_router_crisis_path",
                }
                if voice_indicators:
                    crisis_data["voice_indicators"] = voice_indicators

                self.supabase.table("crisis_events").insert(crisis_data).execute()
            except Exception as e:
                logger.error(f"❌ [CRISIS] Supabase log failed: {e}")

        ctx["ai_response"] = self.build_crisis_response(ctx)
        ctx["response_generated"] = True
        ctx["intervention_directive"] = ""

        # Store crisis memory (background, non-blocking)
        try:
            threading.Thread(
                target=memory_manager.add_crisis_memory,
                args=(
                    ctx.get("user_id", "anonymous"),
                    ctx.get("user_message", ""),
                    ctx.get("session_id"),
                ),
                daemon=True,
            ).start()
        except Exception as crisis_mem_exc:
            logger.error(f"❌ [CRISIS] Memory save failed: {crisis_mem_exc}")

        ctx["psychological_analysis"] = {
            "emotional_state": "crisis",
            "stress_categories": ["Crisis"],
            "risk_assessment": "crisis",
            "coping_assessment": "immediate intervention required",
            "intervention_priority": "immediate",
            "psychological_insights": ["User expressed crisis-level distress"],
            "cultural_pressures": "",
        }
        ctx["technique_selection"] = {
            "primary_technique": "Crisis-Protocol",
            "therapeutic_approach": "refer",
            "activity_recommendations": [],
            "rationale": "immediate safety — crisis fast-path",
        }
