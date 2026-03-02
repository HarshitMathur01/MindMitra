"""
ResponseGenerator — GLM Agent 3: final therapeutic response generation.
"""
import json
import logging
from typing import Any, Dict

from ..core.config import config

logger = logging.getLogger(__name__)


class ResponseGenerator:
    def __init__(self, glm):
        self.glm = glm
        self.SYSTEM_PROMPT = config.get(
            "response_generator.system_prompt",
            default="""You are MindMitra, a culturally-aware AI therapeutic companion for Indian youth (16-25).

RESPONSE RULES:
• Combine psychology expertise with warm, companion-style delivery
• Match the user's language style (if they use Hindi/Hinglish, mirror appropriately)
• Apply the selected therapeutic technique naturally — do NOT label techniques
• Reference session memories when relevant to show continuity
• Be empathetic, non-judgmental, like a caring friend who understands psychology
• Validate cultural struggles without dismissing traditional values
• Keep responses conversational — concise for casual chat, deeper for heavy topics
• NEVER include numbered annotations, technique labels in parentheses, or meta-commentary
• Generate ONLY the natural conversation response""",
        )
        self.recent_messages_count = config.get("response_generator.recent_messages_count", 3)
        self.max_memories_per_type = config.get("response_generator.max_memories_per_type", 3)
        logger.info("✅ [RESPONSE-GEN] Response generator ready")

    # ── public entry ──────────────────────────────────────────────────────
    def generate(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("💬 [RESPONSE-GEN] Generating therapeutic response...")
        try:
            system_msg = {"role": "system", "content": self.SYSTEM_PROMPT}
            human_msg = {"role": "user", "content": self._build_context(user_context)}
            resp = self.glm.invoke([system_msg, human_msg])

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

{f'MEMORIES:{chr(10)}{mem_block}' if mem_block else ''}

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
