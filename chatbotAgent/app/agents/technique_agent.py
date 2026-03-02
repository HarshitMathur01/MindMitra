"""
TechniqueSelectorAgent — GLM Agent 2: therapeutic technique selection.
"""
import json
import logging
import re
from typing import Any, Dict, List

from ..core.config import config

logger = logging.getLogger(__name__)


class TechniqueSelectorAgent:
    def __init__(self, glm):
        self.glm = glm
        self.max_memories_per_type = config.get("technique_selector_agent.max_memories_per_type", 3)
        self.include_voice = config.get("technique_selector_agent.include_voice_analysis", True)
        self.available_techniques = config.get(
            "technique_selector_agent.available_techniques",
            ["CBT", "ACT", "MBCT", "DBT", "MI", "Solution-Focused", "Person-Centered", "Psychoeducation"],
        )
        logger.info("✅ [AGENT-2] Technique selector agent ready")

    def run(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("💊 [AGENT-2] Selecting therapeutic technique...")
        try:
            prompt = self._build_prompt(user_context)
            resp = self.glm.invoke([{"role": "user", "content": prompt}])
            if not resp or not resp.content:
                logger.error("❌ [AGENT-2] GLM returned empty response, using defaults")
                parsed = self._get_default_selection()
            else:
                parsed = self._parse_selection(resp.content)
            user_context["technique_selection"] = parsed
            logger.info(f"✅ [AGENT-2] Technique={parsed.get('primary_technique','?')}")
        except Exception as e:
            logger.error(f"❌ [AGENT-2] Exception: {e}, using defaults")
            user_context["technique_selection"] = self._get_default_selection()
        return user_context

    # ── prompt builder ─────────────────────────────────────────────────────
    def _build_prompt(self, ctx: Dict) -> str:
        psych = ctx.get("psychological_analysis", {})
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})
        session = ctx.get("session_context", {})
        voice = ctx.get("voice_analysis", {})

        rag_memories = session.get("retrieved_memories", {})
        old_memories = session.get("session_memories", {})
        memories: Dict[str, List] = {}
        for mtype in ("procedural", "semantic", "episodic"):
            memories[mtype] = rag_memories.get(mtype, []) + old_memories.get(mtype, [])

        mem_lines = []
        for mtype in ("procedural", "semantic", "episodic"):
            for m in memories.get(mtype, [])[:self.max_memories_per_type]:
                content = m.get("memory_content", m.get("content", ""))
                mem_lines.append(f"  [{mtype}] {content[:100]}")
        mem_block = "\n".join(mem_lines) if mem_lines else ""

        voice_block = ""
        if self.include_voice and voice:
            voice_block = f"""\nVOICE SIGNALS:
  Emotional tone: {voice.get('emotional_tone','N/A')}
  Stress level: {voice.get('stress_level','N/A')}
  Speech pace: {voice.get('speech_pace','N/A')}"""

        techniques_str = "|".join(self.available_techniques)

        return f"""You are a therapeutic technique advisor for Indian youth (16-25).
Based on the psychological assessment below, select the best therapeutic approach.
Return ONLY valid JSON (no markdown fences):

{{
  "primary_technique": "<{techniques_str}>",
  "therapeutic_approach": "<brief description of how to apply this technique>",
  "activity_recommendations": ["<activity1>", "<activity2>", "<activity3>"],
  "rationale": "<why this technique suits the current situation>"
}}

─── ASSESSMENT ───

Emotional state: {psych.get('emotional_state','')}
Stress categories: {psych.get('stress_categories',[])}
Risk: {psych.get('risk_assessment','low')}
Intervention priority: {psych.get('intervention_priority','supportive')}
Insights: {psych.get('psychological_insights',[])}
Cultural pressures: {psych.get('cultural_pressures','')}

Emotion intensity: {nlp.get('intensity',0):.2f}
Primary emotion: {nlp.get('primary_emotion','unknown')}
Urgency: {nlp.get('urgency_flag', False)}

Language style: {cultural.get('language_style','casual')}
Cultural flags: {cultural.get('cultural_sensitivity_flags',[])}
Formality: {cultural.get('formality_level','medium')}
{voice_block}

{f'RELEVANT MEMORIES:{chr(10)}{mem_block}' if mem_block else ''}

Consider Indian cultural context: family dynamics, academic pressure, mental health stigma.
Prefer culturally appropriate, practical activities (yoga, journaling, grounding exercises).
Reference past successful techniques from memories when relevant.

JSON:"""

    def _get_default_selection(self) -> Dict:
        return {
            "primary_technique": "Person-Centered",
            "therapeutic_approach": "Empathetic listening with gentle exploration of your thoughts and feelings",
            "activity_recommendations": ["Take deep breaths and ground yourself", "Journal your feelings"],
            "rationale": "Building a safe space for you to express yourself",
        }

    def _parse_selection(self, raw: str) -> Dict:
        defaults = self._get_default_selection()
        try:
            cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            parsed = json.loads(cleaned)
            for k, v in defaults.items():
                if k not in parsed:
                    parsed[k] = v
            return parsed
        except json.JSONDecodeError:
            logger.warning("[AGENT-2] JSON parse failed, using defaults")
            return defaults
