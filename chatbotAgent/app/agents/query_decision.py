"""
QueryDecisionAgent — decides when RAG memory retrieval is useful.
BUG FIX: model name now read from config instead of hardcoded 'llama-3.1-8b-instant'.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from ..core.config import config

logger = logging.getLogger(__name__)


class QueryDecisionAgent:
    """
    Decides if retrieving past memories would improve response quality.
    Uses Groq (fast) with GLM-4 fallback.
    """

    def __init__(self, groq_client=None, glm_controller=None):
        self.groq_client = groq_client
        self.glm_controller = glm_controller
        # FIX: read from config, fall back to sensible default
        self.model: str = config.get(
            "rag_memory.query_decision_model", "llama-3.1-8b-instant"
        )
        logger.info("✅ [QueryAgent] Query decision agent initialised")

    # ── public API ─────────────────────────────────────────────────────────
    def should_query_memories(
        self,
        user_message: str,
        recent_messages: List[Dict],
        emotional_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Return a decision dict: needs_memory, urgency, memory_types, confidence_threshold, query_hint."""
        recent_context = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')[:100]}"
            for m in recent_messages[-3:]
        )

        primary_emotion = emotional_state.get("primary_emotion", "unknown")
        intensity = emotional_state.get("intensity", 0)

        prompt = f"""You are a memory retrieval decision agent for MindMitra therapeutic chatbot. Decide if retrieving past memories would improve response quality.

Current message: "{user_message[:500]}"

Recent conversation:
{recent_context[:400]}

Emotional state: {primary_emotion} (intensity: {intensity:.1f})

Analyze:
1. Does user reference past events/patterns? (e.g., "like last time", "again", "remember when")
2. Would procedural coping strategies from history help?
3. Is there urgency requiring full context?

Output ONLY valid JSON (no markdown):
{{
  "needs_memory": <true|false>,
  "urgency": "<low|medium|high>",
  "memory_types": ["semantic", "procedural"],
  "confidence_threshold": <float: 0.3 for high urgency, 0.5 for medium, 0.7 for low>,
  "query_hint": "<brief search keywords for retrieval>"
}}

JSON:"""

        result = self._call_groq(prompt) or self._call_glm(prompt)

        if not result:
            logger.error("❌ [QueryAgent] Both Groq and GLM failed – skipping retrieval")
            return {
                "needs_memory": False,
                "urgency": "low",
                "memory_types": [],
                "confidence_threshold": 0.6,
                "query_hint": "",
            }

        logger.info(
            f"🧠 [QueryAgent] Decision: needs={result['needs_memory']}, "
            f"urgency={result['urgency']}, threshold={result['confidence_threshold']:.2f}"
        )
        return result

    def generate_query(self, decision: Dict[str, Any], user_message: str) -> str:
        query_hint = decision.get("query_hint", "")
        keywords = [w for w in user_message.lower().split() if len(w) > 4 and w.isalpha()][:5]
        query = f"{query_hint} {' '.join(keywords)}".strip()
        return query if query else user_message[:100]

    # ── internals ──────────────────────────────────────────────────────────
    def _call_groq(self, prompt: str) -> Optional[Dict[str, Any]]:
        if not self.groq_client:
            return None
        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150,
                timeout=5.0,
            )
            content = response.choices[0].message.content.strip()
            result = self._parse_response(content)
            if result:
                logger.debug("✅ [QueryAgent] Decision via Groq")
            return result
        except Exception as e:
            logger.warning(f"⚠️ [QueryAgent] Groq failed: {e}")
            return None

    def _call_glm(self, prompt: str) -> Optional[Dict[str, Any]]:
        if not self.glm_controller:
            return None
        try:
            logger.info("🔄 [QueryAgent] Trying GLM-4 fallback...")
            response = self.glm_controller.invoke([{"role": "user", "content": prompt}])
            content = response.content if response and response.content else ""
            result = self._parse_response(content)
            if result:
                logger.info("✅ [QueryAgent] Decision via GLM-4 fallback")
            return result
        except Exception as e:
            logger.error(f"❌ [QueryAgent] GLM-4 fallback failed: {e}")
            return None

    def _parse_response(self, content: str) -> Optional[Dict[str, Any]]:
        if not content:
            return None
        try:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip().strip("`")

            parsed = json.loads(cleaned)
            required = [
                "needs_memory",
                "urgency",
                "memory_types",
                "confidence_threshold",
                "query_hint",
            ]
            if not all(k in parsed for k in required):
                logger.warning("⚠️ [QueryAgent] Missing required fields")
                return None

            parsed["needs_memory"] = bool(parsed["needs_memory"])
            parsed["confidence_threshold"] = float(parsed["confidence_threshold"])
            if not isinstance(parsed["memory_types"], list):
                parsed["memory_types"] = ["semantic", "procedural"]
            return parsed
        except Exception as e:
            logger.warning(f"⚠️ [QueryAgent] Parse error: {e}")
            return None
