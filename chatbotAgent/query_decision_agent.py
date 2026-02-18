"""
Query Decision Agent for MindMitra RAG System
Intelligently decides when to retrieve memories using Groq Llama with GLM-4 fallback
"""
import os
import json
import logging
import traceback
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class QueryDecisionAgent:
    """
    Decides if memory retrieval would improve response quality
    Uses Groq Llama 3.1 8B (fast) with GLM-4 fallback
    """
    
    def __init__(self, groq_client=None, glm_controller=None):
        """
        Args:
            groq_client: Groq client instance (optional)
            glm_controller: GLM controller instance for fallback
        """
        self.groq_client = groq_client
        self.glm_controller = glm_controller
        self.model = "llama-3.1-8b-instant"
        
        logger.info("✅ [QueryAgent] Query decision agent initialized")
    
    def should_query_memories(
        self,
        user_message: str,
        recent_messages: List[Dict],
        emotional_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze if retrieving past memories would help generate better response
        
        Args:
            user_message: Current user message
            recent_messages: Last 3 messages for context
            emotional_state: NLP emotions analysis
            
        Returns:
            Decision dict with: needs_memory, urgency, memory_types, confidence_threshold, query_hint
        """
        # Build prompt for LLM
        recent_context = "\n".join([
            f"{m.get('role', 'user')}: {m.get('content', '')[:100]}"
            for m in recent_messages[-3:]
        ])
        
        primary_emotion = emotional_state.get('primary_emotion', 'unknown')
        intensity = emotional_state.get('intensity', 0)
        
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
        
        # Try Groq first (fast)
        result = self._call_groq(prompt)
        
        # Fallback to GLM-4 if Groq fails
        if not result:
            result = self._call_glm(prompt)
        
        # Ultimate fallback: skip retrieval
        if not result:
            logger.error("❌ [QueryAgent] Both Groq and GLM failed, skipping memory retrieval")
            return {
                'needs_memory': False,
                'urgency': 'low',
                'memory_types': [],
                'confidence_threshold': 0.6,
                'query_hint': ''
            }
        
        # Log decision
        logger.info(
            f"🧠 [QueryAgent] Decision: needs={result['needs_memory']}, "
            f"urgency={result['urgency']}, threshold={result['confidence_threshold']:.2f}"
        )
        logger.debug(f"  Query hint: {result['query_hint']}")
        
        return result
    
    def _call_groq(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Try Groq Llama first"""
        if not self.groq_client:
            return None
        
        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150,
                timeout=5.0
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
        """Fallback to GLM-4"""
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
        """Parse LLM response into decision dict"""
        if not content:
            return None
        
        try:
            # Remove markdown fences if present
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip().strip("`")
            
            parsed = json.loads(cleaned)
            
            # Validate required fields
            required = ['needs_memory', 'urgency', 'memory_types', 'confidence_threshold', 'query_hint']
            if not all(k in parsed for k in required):
                logger.warning("⚠️ [QueryAgent] Missing required fields in response")
                return None
            
            # Type validation
            parsed['needs_memory'] = bool(parsed['needs_memory'])
            parsed['confidence_threshold'] = float(parsed['confidence_threshold'])
            
            # Ensure memory_types is list
            if not isinstance(parsed['memory_types'], list):
                parsed['memory_types'] = ['semantic', 'procedural']
            
            return parsed
        
        except json.JSONDecodeError as e:
            logger.warning(f"⚠️ [QueryAgent] JSON parse error: {e}")
        except Exception as e:
            logger.error(f"❌ [QueryAgent] Parse error: {e}")
        
        return None
    
    def generate_query(self, decision: Dict[str, Any], user_message: str) -> str:
        """
        Generate natural language search query from decision
        
        Args:
            decision: Decision dict from should_query_memories
            user_message: Current user message
            
        Returns:
            Natural language query string
        """
        query_hint = decision.get('query_hint', '')
        
        # Extract keywords from user message (simple approach)
        words = user_message.lower().split()
        keywords = [w for w in words if len(w) > 4 and w.isalpha()][:5]
        keywords_str = " ".join(keywords)
        
        # Combine hint with keywords
        if query_hint:
            query = f"{query_hint} {keywords_str}".strip()
        else:
            query = keywords_str
        
        logger.debug(f"🔍 [QueryAgent] Generated query: '{query[:50]}...'")
        
        return query if query else user_message[:100]
