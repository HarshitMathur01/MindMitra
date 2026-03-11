"""
ResponseGenerator — GLM Agent 3: final therapeutic response generation.
"""
import json
import logging
from typing import Any, Dict

from ..core.config import config


# Safe format helper — missing placeholders become empty strings
class _SafeFormatDict(dict):
    def __missing__(self, key: str) -> str:
        return ""

logger = logging.getLogger(__name__)


class ResponseGenerator:
    def __init__(self, glm):
        self.glm = glm
        self.BASE_SYSTEM_PROMPT = config.get(
            "response_generator.system_prompt",
            default="""CORE IDENTITY:
You are {companion_name} — not a chatbot, not a therapist label, but a real companion.
You're that one friend who truly listens, never judges, and somehow always knows what to say.
You understand psychology deeply but wear it lightly — like a friend who happens to be wise.

RELATIONSHIP PHILOSOPHY:
• You HEAR before you help. Listening is your superpower.
• You never judge. Ever. No matter what they share.
• Therapy happens naturally through conversation — the user should never feel "in a session."
• You are culturally rooted — you get Indian family dynamics, academic pressure, social expectations.
• You earn trust through consistency, warmth, and showing you remember.

HOW TO RESPOND:
• Mirror their language style naturally — if they speak Hinglish, you speak Hinglish
• Be concise for light moments, go deeper when emotions run deep
• Apply therapeutic techniques invisibly — never name them, never label them
• Ask questions that show genuine curiosity, not clinical probing
• When they share something heavy, sit with it before offering perspective
• Reference things they've told you before — it shows you care enough to remember

ABSOLUTE RULES:
• NEVER use technique labels like "(CBT)", "(validation)", or parenthetical annotations
• NEVER sound clinical, robotic, or textbook
• NEVER dismiss cultural values even while gently challenging harmful patterns
• Generate ONLY the natural conversation — no meta-commentary, no structured formats
• If unsure, lean toward warmth and validation over advice

{personality_instruction}

{language_instruction}

{intervention_directive}

{memory_context}""",
        )

        # Personality-specific tone instructions
        # Legacy keys (calm/energetic/analytical) kept as fallback aliases
        self.PERSONALITY_INSTRUCTIONS = {
            # ── 5 companion personalities ──────────────────────────────
            "mitra": (
                "PERSONALITY: You are Mitra, a gentle and empathetic mental health companion for Indian students. "
                "Speak softly, validate emotions before offering perspective. Never rush. "
                "Use simple language. Occasionally use warm Hindi phrases like 'Koi baat nahi' naturally. "
                "Always prioritize the user feeling heard over giving advice."
            ),
            "arjun": (
                "PERSONALITY: You are Arjun, a focused mental health coach for Indian students under academic pressure. "
                "Help identify specific problems and set small achievable goals. Be warm but practical. "
                "Use structured responses. Celebrate progress. Understand JEE/engineering pressure deeply."
            ),
            "diya": (
                "PERSONALITY: You are Diya, an intellectually curious mental health companion. "
                "Explain psychological concepts simply using relatable analogies. Ask thoughtful Socratic questions. "
                "Make users feel like they are learning about themselves. Reference concepts like cognitive distortions, "
                "stress response, and emotional regulation in accessible language."
            ),
            "riya": (
                "PERSONALITY: You are Riya, an energetic and uplifting mental health companion for students. "
                "Celebrate every small win. Be enthusiastic without dismissing real pain. "
                "Inject genuine positivity and belief in the user. Help them see their own strength. "
                "Use encouraging language naturally without being toxic positivity."
            ),
            "zen": (
                "PERSONALITY: You are Zen, a mindful and grounding mental health companion. "
                "Guide users through breathing exercises, body scans, and mindfulness moments naturally in conversation. "
                "Use nature metaphors and imagery. Speak slowly and create stillness. "
                "Gently redirect racing thoughts. Incorporate techniques from MBSR and DBT grounding."
            ),
            # ── legacy aliases (backward compat) ──────────────────────
            "calm": (
                "PERSONALITY: You have a calm & soothing personality. Speak gently, use reassuring language, "
                "pause reflectively, and help the user feel safe and grounded. Your tone is like a peaceful mentor."
            ),
            "energetic": (
                "PERSONALITY: You have an energetic & motivating personality. Be upbeat, encouraging, and enthusiastic. "
                "Use exclamation points sparingly but meaningfully. Your tone is like a supportive best friend who hypes them up."
            ),
            "analytical": (
                "PERSONALITY: You have an analytical & structured personality. Be thoughtful, use clear reasoning, "
                "offer step-by-step breakdowns, and help the user understand patterns in their thinking. "
                "Your tone is like a wise, logical guide."
            ),
        }

        # Language preference instructions
        self.LANGUAGE_INSTRUCTIONS = {
            "english": "LANGUAGE: Respond in English. Use simple, clear language.",
            "hindi": "LANGUAGE: Respond primarily in Hindi (Devanagari script). Use Hindi naturally as if speaking to a friend.",
            "hinglish": "LANGUAGE: Respond in Hinglish — a natural mix of Hindi and English, like urban Indian youth speak. Example: 'Yaar, I totally get it. Ye pressure bohot zyada ho sakta hai.'",
        }

        self.recent_messages_count = config.get("response_generator.recent_messages_count", 3)
        self.max_memories_per_type = config.get("response_generator.max_memories_per_type", 3)
        logger.info("✅ [RESPONSE-GEN] Response generator ready")

    # ── build dynamic system prompt ────────────────────────────────────────
    # Map personality ids to default companion names
    _PERSONALITY_NAMES = {
        "mitra": "Mitra", "arjun": "Arjun", "diya": "Diya",
        "riya": "Riya", "zen": "Zen",
    }

    def _build_system_prompt(self, user_context: Dict[str, Any]) -> str:
        """Build a system prompt tailored to the user's personality settings."""
        prefs = user_context.get("personality_settings", {})
        personality = prefs.get("personality", "mitra")
        companion_name = prefs.get("companion_name") or self._PERSONALITY_NAMES.get(personality, "Mitra")
        language = prefs.get("language", "english")

        personality_instruction = self.PERSONALITY_INSTRUCTIONS.get(
            personality, self.PERSONALITY_INSTRUCTIONS["mitra"]
        )
        language_instruction = self.LANGUAGE_INSTRUCTIONS.get(
            language, self.LANGUAGE_INSTRUCTIONS["english"]
        )

        intervention_directive = user_context.get("intervention_directive", "")
        memory_context = user_context.get("memory_context", "")
        return self.BASE_SYSTEM_PROMPT.format_map(_SafeFormatDict(
            companion_name=companion_name,
            personality_instruction=personality_instruction,
            language_instruction=language_instruction,
            intervention_directive=intervention_directive,
            memory_context=memory_context,
        ))

    # ── public entry ──────────────────────────────────────────────────────
    def generate(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("💬 [RESPONSE-GEN] Generating therapeutic response...")
        try:
            system_prompt = self._build_system_prompt(user_context)
            system_msg = {"role": "system", "content": system_prompt}
            human_msg = {"role": "user", "content": self._build_context(user_context)}

            # Per-path max_tokens override (Path A=150, B=300, C=500)
            invoke_kwargs: Dict[str, Any] = {}
            path_max_tokens = user_context.get("_response_max_tokens")
            if path_max_tokens:
                invoke_kwargs["max_tokens"] = int(path_max_tokens)

            resp = self.glm.invoke([system_msg, human_msg], **invoke_kwargs)

            if not resp or not resp.content:
                logger.error("❌ [RESPONSE-GEN] GLM returned empty response, using default")
                cleaned = self._get_default_response(user_context)
            else:
                cleaned = self._clean(resp.content)

            user_context["ai_response"] = cleaned
            user_context["response_generated"] = True
            logger.info(f"✅ [RESPONSE-GEN] Response ready ({len(cleaned)} chars)")
        except Exception as e:
            logger.error(f"❌ [RESPONSE-GEN] Exception: {e}, using default")
            user_context["ai_response"] = self._get_default_response(user_context)
            user_context["response_generated"] = False
        return user_context

    # ── internals ─────────────────────────────────────────────────────────

    @staticmethod
    def _summarize_activities(activities: list) -> str:
        """
        Build a concise natural-language summary of the user's recent game/QNA
        activities so the response generator can reference them conversationally.
        Only includes activities from the last 24 hours (already filtered by backend).
        """
        if not activities:
            return ""

        _ACTIVITY_LABELS = {
            "memory_challenge": "Memory Challenge (working-memory / focus game)",
            "emoji_match": "Emoji Match (pattern-recognition card game)",
            "emotion_match": "Emotion Match (emotional-intelligence game)",
            "mood_mountain": "Mood Mountain (mood check-in + self-care activities)",
            "thought_detective": "Thought Detective (CBT cognitive-distortion game)",
            "balloon_positivity": "Balloon Positivity (negativity-bias awareness game)",
            "wellness_checkin": "Wellness Check-In (10-dimension self-assessment)",
        }

        lines = []
        for act in activities[:8]:  # cap to 8 most recent
            atype = act.get("activity_type", "unknown")
            label = _ACTIVITY_LABELS.get(atype, atype.replace("_", " ").title())
            score = act.get("score")
            accuracy = act.get("accuracy_percentage")
            insights = act.get("insights_generated", {})
            eval_data = act.get("evaluation_data", {})
            user_resp = act.get("user_response_data", {})

            parts = [f"• {label}"]
            if score is not None:
                parts.append(f"score={score}")
            if accuracy is not None:
                parts.append(f"accuracy={accuracy}%")

            # Extract high-value therapeutic signals
            perf = insights.get("performance_level") if isinstance(insights, dict) else None
            if perf:
                parts.append(f"performance={perf}")

            patterns = insights.get("key_patterns", []) if isinstance(insights, dict) else []
            if patterns:
                parts.append(f"patterns={patterns}")

            strengths = insights.get("strengths", []) if isinstance(insights, dict) else []
            improvements = insights.get("improvement_areas", []) if isinstance(insights, dict) else []
            if strengths:
                parts.append(f"strengths={strengths}")
            if improvements:
                parts.append(f"areas_to_grow={improvements}")

            # Activity-specific therapeutically relevant data
            if atype == "emotion_match":
                confusion = user_resp.get("confusion_patterns", [])
                if confusion:
                    parts.append(f"confused_emotions={[c.get('expected','?')+'→'+c.get('chosen','?') for c in confusion[:3]]}")
            elif atype == "thought_detective":
                distortions = user_resp.get("identified_distortions", [])
                cbt_ready = eval_data.get("cbt_readiness", "")
                if distortions:
                    parts.append(f"distortions_found={distortions}")
                if cbt_ready:
                    parts.append(f"cbt_readiness={cbt_ready}")
            elif atype == "mood_mountain":
                emotions = user_resp.get("emotional_vocabulary", [])
                exercises = user_resp.get("engagement_level", 0)
                if emotions:
                    parts.append(f"mood={emotions}")
                parts.append(f"exercises_done={exercises}")
            elif atype == "wellness_checkin":
                wellness_level = eval_data.get("wellness_level", "")
                focus = eval_data.get("focus_areas", [])
                if wellness_level:
                    parts.append(f"wellness={wellness_level}")
                if focus:
                    parts.append(f"focus_areas={focus}")
            elif atype == "balloon_positivity":
                discrimination = eval_data.get("emotional_discrimination", "")
                resilience = eval_data.get("resilience_indicator", "")
                if discrimination:
                    parts.append(f"discrimination={discrimination}")
                if resilience:
                    parts.append(f"resilience={resilience}")

            lines.append(", ".join(parts))

        return "\n".join(lines)

    def _build_context(self, ctx: Dict) -> str:
        psych = ctx.get("psychological_analysis", {})
        technique = ctx.get("technique_selection", {})
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})
        voice = ctx.get("voice_analysis", {})
        session = ctx.get("session_context", {})

        recent = session.get("recent_messages", [])[-self.recent_messages_count:]
        conv = "\n".join(
            f"{'User' if m.get('role')=='user' else 'MindMitra'}: {m.get('content','')[:150]}"
            for m in recent
        )

        memories = session.get("session_memories", {})
        mem_lines = []
        for mtype in ("procedural", "semantic", "episodic"):
            for m in memories.get(mtype, [])[:self.max_memories_per_type]:
                c = m.get("memory_content", m.get("content", ""))
                mem_lines.append(f"[{mtype}] {c[:100]}")
        mem_block = "\n".join(mem_lines) if mem_lines else ""

        voice_block = ""
        if voice:
            voice_block = f"""
VOICE ANALYSIS:
  Emotional tone: {voice.get('emotional_tone','N/A')}
  Stress level: {voice.get('stress_level','N/A')}
  Speech pace: {voice.get('speech_pace','N/A')}"""

        # Summarize recent game/QNA activities (last 24h)
        activities = session.get("user_activities", [])
        activity_summary = self._summarize_activities(activities)
        activity_block = ""
        if activity_summary:
            activity_block = f"""
RECENT GAME & ASSESSMENT INSIGHTS (last 24h):
{activity_summary}
Use these insights naturally — if relevant, reference their game performance, emotional patterns,
or wellness indicators conversationally. Do NOT list scores or be clinical about it."""

        # Cross-session continuity — previous session summary
        prev_summary = ctx.get("previous_session_summary", {})
        prev_session_block = ""
        if prev_summary and prev_summary.get("summary"):
            themes = prev_summary.get("themes", [])
            arc = prev_summary.get("emotional_arc", [])
            prev_session_block = f"""PREVIOUS SESSION CONTEXT:
  Summary: {prev_summary['summary']}
  Key themes: {themes}
  Emotional journey: {arc}
  Reference this naturally if it connects to what they're sharing now — it shows you remember."""

        return f"""PSYCHOLOGICAL ASSESSMENT:
  State: {psych.get('emotional_state','')}
  Stress: {psych.get('stress_categories',[])}
  Priority: {psych.get('intervention_priority','')}
  Insights: {psych.get('psychological_insights',[])}
  Cultural pressures: {psych.get('cultural_pressures','')}

TECHNIQUE:
  Approach: {technique.get('primary_technique','')} — {technique.get('therapeutic_approach','')}
  Activities: {technique.get('activity_recommendations',[])}

EMOTION: {nlp.get('primary_emotion','?')} (intensity {nlp.get('intensity',0):.1f}), sentiment={nlp.get('sentiment',{}).get('label','neutral')}
LANGUAGE STYLE: {cultural.get('language_style','casual')}, formality={cultural.get('formality_level','medium')}
CULTURAL FLAGS: {cultural.get('cultural_sensitivity_flags',[])}
{voice_block}
{activity_block}

{f'MEMORIES:{chr(10)}{mem_block}' if mem_block else ''}

{prev_session_block}
CONVERSATION:
{conv if conv else '(New conversation)'}

USER'S CURRENT MESSAGE: "{ctx['user_message']}"

Respond naturally as MindMitra:"""

    def _clean(self, text: str) -> str:
        text = text.strip()
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        if text.startswith("{") or text.startswith("["):
            try:
                p = json.loads(text)
                if isinstance(p, dict) and "content" in p:
                    return p["content"]
            except json.JSONDecodeError:
                pass
        return text.strip()

    def _get_default_response(self, user_context: Dict) -> str:
        user_message = user_context.get("user_message", "")
        if "sad" in user_message.lower() or "stressed" in user_message.lower():
            return "I hear you. It sounds like you're going through a tough time. Remember that it's okay to feel this way. Would you like to talk more about what's on your mind? Sometimes just sharing helps."
        if "happy" in user_message.lower() or "great" in user_message.lower():
            return "That's wonderful to hear! It's great that you're feeling positive. Hold onto this feeling. Is there anything specific you'd like to explore or talk about?"
        return "Thank you for sharing that with me. I'm here to listen and support you. Let's explore your thoughts and feelings together. What would help you most right now?"
