"""
PsychologistAnalysisAgent — GLM Agent 1: clinical psychological assessment.
"""
import json
import logging
import re
from typing import Any, Dict, List

from ..core.config import config

logger = logging.getLogger(__name__)


class PsychologistAnalysisAgent:
    def __init__(self, glm):
        self.glm = glm
        self.max_memories_per_type = config.get("psychologist_agent.max_memories_per_type", 4)
        self.max_activities = config.get("psychologist_agent.max_activities", 5)
        self.recent_messages_count = config.get("psychologist_agent.recent_messages_count", 5)
        logger.info("✅ [AGENT-1] Psychologist analysis agent ready")

    def run(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("🧠 [AGENT-1] Starting psychological analysis...")
        try:
            prompt = self._build_prompt(user_context)
            resp = self.glm.invoke([{"role": "user", "content": prompt}])
            if not resp or not resp.content:
                logger.error("❌ [AGENT-1] GLM returned empty response, using defaults")
                parsed = self._get_default_analysis()
            else:
                parsed = self._parse_analysis(resp.content)
            user_context["psychological_analysis"] = parsed
            logger.info(
                f"✅ [AGENT-1] Done — state={parsed.get('emotional_state','?')}, "
                f"priority={parsed.get('intervention_priority','?')}"
            )
        except Exception as e:
            logger.error(f"❌ [AGENT-1] Exception: {e}, using defaults")
            user_context["psychological_analysis"] = self._get_default_analysis()
        return user_context

    # ── prompt builder ─────────────────────────────────────────────────────
    def _build_prompt(self, ctx: Dict) -> str:
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})
        session = ctx.get("session_context", {})
        activities = session.get("user_activities", [])

        rag_memories = session.get("retrieved_memories", {})
        old_memories = session.get("session_memories", {})
        memories: Dict[str, List] = {}
        for mtype in ("procedural", "semantic", "episodic"):
            memories[mtype] = rag_memories.get(mtype, []) + old_memories.get(mtype, [])

        mem_lines = []
        for mtype in ("procedural", "semantic", "episodic"):
            for i, m in enumerate(memories.get(mtype, [])[:self.max_memories_per_type]):
                content = m.get("memory_content", m.get("content", ""))
                source = "RAG" if i < len(rag_memories.get(mtype, [])) else "session"
                mem_lines.append(f"  [{mtype}|{source}] {content[:120]}")
        mem_block = "\n".join(mem_lines) if mem_lines else "No prior memories."

        act_lines = []
        for a in activities[:self.max_activities]:
            atype = a.get("activity_type", "unknown")
            score = a.get("score", "?")
            patterns = a.get("insights_generated", {}).get("key_patterns", [])
            act_lines.append(f"  {atype}: score={score}, patterns={patterns[:2]}")
        act_block = "\n".join(act_lines) if act_lines else "No activities yet."

        recent = session.get("recent_messages", [])[-self.recent_messages_count:]
        conv_block = "\n".join(
            f"  {'User' if m.get('role')=='user' else 'AI'}: {m.get('content','')[:100]}"
            for m in recent
        ) or "New conversation."

        return f"""You are a clinical psychologist specialising in Indian youth (16-25).
Analyse this user and return ONLY valid JSON (no markdown fences) matching this schema:

{{
  "emotional_state": "<descriptive string>",
  "stress_categories": ["<Academic|Family|Social|Emotional|Identity|Career|Miscellaneous>"],
  "risk_assessment": "<low|moderate|high|crisis>",
  "coping_assessment": "<description of coping mechanisms & resilience>",
  "intervention_priority": "<immediate|supportive|long-term>",
  "psychological_insights": ["<insight1>", "<insight2>", "<insight3>"],
  "cultural_pressures": "<relevant Indian cultural/family/academic pressures>"
}}

─── DATA ───

USER MESSAGE: "{ctx['user_message'][:800]}"

NLP ANALYSIS:
  Primary emotion: {nlp.get('primary_emotion','unknown')}
  Sentiment: {nlp.get('sentiment',{}).get('label','unknown')} ({nlp.get('sentiment',{}).get('score',0):.2f})
  Intensity: {nlp.get('intensity',0):.2f}
  Urgency: {nlp.get('urgency_flag', False)}
  Key phrases: {nlp.get('key_phrases',[])}

CULTURAL CONTEXT:
  Language style: {cultural.get('language_style','unknown')}
  Cultural flags: {cultural.get('cultural_sensitivity_flags',[])}
  Communication: {cultural.get('communication_pattern','unknown')}
  Formality: {cultural.get('formality_level','medium')}

SESSION MEMORIES:
{mem_block}

RECENT ACTIVITIES:
{act_block}

RECENT CONVERSATION:
{conv_block}

JSON:"""

    def _get_default_analysis(self) -> Dict:
        return {
            "emotional_state": "Assessment needed - please share more",
            "stress_categories": ["General"],
            "risk_assessment": "low",
            "coping_assessment": "Continue with current coping strategies",
            "intervention_priority": "supportive",
            "psychological_insights": ["Let's take time to understand your situation better"],
            "cultural_pressures": "To be explored in conversation",
        }

    def _parse_analysis(self, raw: str) -> Dict:
        defaults = self._get_default_analysis()
        try:
            cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            parsed = json.loads(cleaned)
            for k, v in defaults.items():
                if k not in parsed:
                    parsed[k] = v
            return parsed
        except json.JSONDecodeError:
            logger.warning("[AGENT-1] JSON parse failed, using LLM text as insight")
            defaults["psychological_insights"] = [raw[:300]]
            return defaults
