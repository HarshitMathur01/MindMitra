import os
import json
import time
import logging
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Pydantic models for psychology-focused 2-agent architecture
class PsychologicalAnalysis(BaseModel):
    """Psychology-focused analysis for Indian youth mental wellness"""
    emotional_state: str = Field(description="Current emotional condition with psychological markers")
    stress_categories: List[str] = Field(description="Academic/Family/Social/Emotional/Identity/Career/Miscellaneous stress types")
    therapeutic_approach: str = Field(description="CBT/ACT/MBCT recommendation based on psychological assessment")
    cultural_pressures: str = Field(description="Indian family/academic/social pressures affecting mental health")
    language_style: str = Field(description="User's communication pattern (formal/casual/hindi-mixed) to match")
    psychological_insights: List[str] = Field(description="2-3 key psychology-based observations")
    coping_assessment: str = Field(description="Current coping mechanisms and psychological resilience")
    intervention_priority: str = Field(description="Immediate/supportive/long-term intervention needs")
    activity_recommendations: List[str] = Field(description="Psychology-based instant and long-term activities")

class ConversationSummary(BaseModel):
    """Contextual conversation summarization preserving therapeutic progress"""
    therapeutic_progress: str = Field(description="Therapeutic journey and breakthrough moments")
    emotional_patterns: str = Field(description="Recurring emotional themes and patterns")
    cultural_context: str = Field(description="Family dynamics, academic pressures, cultural factors")
    language_preferences: str = Field(description="Communication style and language mixing patterns")
    key_insights: List[str] = Field(description="Important psychological insights to preserve")
    stress_evolution: str = Field(description="How stress categories and levels have changed")
    intervention_history: str = Field(description="Therapeutic approaches used and their effectiveness")

class MindMateWorkflow:
    """Psychology-focused 2-agent workflow with background summarization"""
    
    def __init__(self):
        logger.info("🧠 [WORKFLOW] Initializing MindMate Psychology Workflow...")
        self.llm = self._initialize_llm()
        # Psychology-focused structured LLMs
        try:
            self.analyst_llm = self.llm.with_structured_output(PsychologicalAnalysis)
            self.summarizer_llm = self.llm.with_structured_output(ConversationSummary)
            logger.info("✅ [WORKFLOW] Psychology-focused 2-agent + background summarizer LLMs initialized successfully")
        except Exception as e:
            logger.error(f"❌ [WORKFLOW] Failed to initialize psychology LLMs: {e}")
            raise e
        self.workflow = self._create_workflow()
        
        # Background summarization tracking
        self._summarization_cache = {}
        logger.info("✅ [WORKFLOW] MindMate Workflow fully initialized and ready for voice-enhanced therapy")
        self._last_summarization_count = {}
    
    def _initialize_llm(self) -> ChatGoogleGenerativeAI:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
        
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=api_key,
            timeout=30,
            max_tokens=300,  # Reduced for faster responses
            temperature=0.3,
            top_p=0.8,
            max_retries=1
        )
    
    def _should_trigger_background_summarization(self, user_id: str, recent_messages: List) -> bool:
        """Check if background summarization should be triggered (much stricter criteria)"""
        current_count = len(recent_messages)
        last_count = self._last_summarization_count.get(user_id, 0)
        
        # Only trigger summarization if:
        # 1. Messages increased by 10+ since last summarization, AND
        # 2. Total messages > 15, OR
        # 3. Total conversation length > 3000 characters
        
        message_increase = current_count - last_count
        total_length = sum(len(msg.get("content", "")) for msg in recent_messages)
        
        should_summarize = (
            message_increase >= 10 and current_count > 15
        ) or (
            total_length > 3000 and message_increase >= 5
        )
        
        if should_summarize:
            logger.info(f"🔄 Background summarization triggered for user {user_id}: {current_count} messages (+{message_increase}), {total_length} chars")
            self._last_summarization_count[user_id] = current_count
        
        return should_summarize
    
    def _background_summarization(self, user_id: str, recent_messages: List, conversation_summary: Dict, psychological_analysis: Dict):
        """Run summarization in background thread (non-blocking)"""
        try:
            logger.info(f"📝 Background summarizer: Processing {len(recent_messages)} messages for user {user_id}")
            
            # Format all messages for comprehensive summarization
            conversation_text = self._format_messages_for_summarization(recent_messages)
            
            # COMBINED PROMPT for structured output (Gemini works better with single comprehensive prompt)
            combined_prompt = f"""Create a comprehensive therapeutic summary for Indian youth mental wellness continuation.

COMPREHENSIVE SUMMARIZATION GUIDELINES:
- Preserve ALL therapeutic progress and breakthrough moments
- Track emotional patterns and psychological developments over time
- Maintain cultural context (family dynamics, academic pressures, Indian youth challenges)
- Document language preferences and communication evolution
- Record therapeutic approaches that worked/didn't work
- Identify stress pattern changes and coping mechanism development
- Preserve important personal details for therapeutic continuity

EXISTING SUMMARY:
{json.dumps(conversation_summary, indent=1) if conversation_summary else 'No previous summary'}

FULL CONVERSATION TO SUMMARIZE:
{conversation_text}

LATEST PSYCHOLOGICAL ANALYSIS:
{json.dumps(psychological_analysis, indent=1)}

Create a rich summary that enables seamless therapeutic conversation continuation."""

            # Generate summary in background (single HumanMessage for better Gemini compatibility)
            summary = self.summarizer_llm.invoke([HumanMessage(content=combined_prompt)])
            
            if summary:
                # Cache the summary for future use
                self._summarization_cache[user_id] = {
                    'summary': summary.dict(),
                    'timestamp': datetime.now(),
                    'message_count': len(recent_messages)
                }
                logger.info(f"✅ Background summarization completed for user {user_id}")
            else:
                logger.warning(f"⚠️ Background summarization failed for user {user_id}")
                
        except Exception as e:
            logger.error(f"❌ Background summarization error for user {user_id}: {e}")
    
    def _get_effective_conversation_summary(self, user_id: str, conversation_summary: Dict) -> Dict:
        """Get the most up-to-date summary (from cache or provided)"""
        cached_summary = self._summarization_cache.get(user_id)
        
        if cached_summary:
            cached_timestamp = cached_summary['timestamp']
            # Use cached summary if it's recent (within last hour)
            if (datetime.now() - cached_timestamp).seconds < 3600:
                logger.info(f"📋 Using cached summary for user {user_id}")
                return cached_summary['summary']
        
        # Use provided summary or empty dict
        return conversation_summary or {}
    
    def psychological_analyst(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 1: Psychology-focused analysis for Indian youth mental wellness"""
        logger.info("🧠 Psychology Agent 1: Indian youth mental wellness analysis starting...")
        
        user_id = state.get("user_id", "anonymous")
        recent_messages = state.get("recent_messages", [])
        conversation_summary = state.get("conversation_summary", {})
        
        # Get effective summary (cached or provided)
        effective_summary = self._get_effective_conversation_summary(user_id, conversation_summary)
        
        # Trigger background summarization if needed (non-blocking)
        if self._should_trigger_background_summarization(user_id, recent_messages):
            psychological_analysis_placeholder = {}  # Will be filled after analysis
            threading.Thread(
                target=self._background_summarization,
                args=(user_id, recent_messages, conversation_summary, psychological_analysis_placeholder),
                daemon=True
            ).start()
        
        # Use only recent messages + summary for fast analysis
        conversation_context = self._format_minimal_conversation_context(
            recent_messages[-5:],  # Only last 5 messages for speed
            effective_summary
        )
        activities_context = self._format_minimal_activities_context(
            state.get("user_activities", [])[:2]
        )
        
        logger.info(f"📊 Psychology Agent 1: Processing context - {len(recent_messages[-5:])} recent messages, summary: {bool(effective_summary)}")
        
        # COMBINED PROMPT for structured output (Gemini works better with single comprehensive prompt)
        # Replace the long combined_prompt with this simplified version
        
        # Include voice analysis if available
        voice_context = ""
        voice_analysis = state.get("voice_analysis", {})
        if voice_analysis:
            voice_context = f"""
            
            VOICE ANALYSIS DATA:
            - Emotional tone: {voice_analysis.get('emotional_tone', 'N/A')}
            - Stress level: {voice_analysis.get('stress_level', 'N/A')}
            - Speech pace: {voice_analysis.get('speech_pace', 'N/A')}
            - Cultural context: {voice_analysis.get('cultural_context', 'N/A')}
            - Voice insights: {voice_analysis.get('insights', [])}"""
        
        combined_prompt = f"""Analyze this user's mental health state for Indian youth (16-25 years).

            User's message: "{state['user_message']}"

            Recent context: {conversation_context[:500]}

            Activities: {activities_context}{voice_context}

            Provide analysis in this exact format:
            - Emotional state: [current condition]
            - Stress categories: [Academic/Family/Social/Emotional/Identity/Career types]
            - Therapeutic approach: [CBT/ACT/MBCT recommendation]
            - Cultural pressures: [Indian family/academic/social pressures]
            - Language style: [formal/casual/hindi-mixed]
            - Psychological insights: [2-3 key observations]
            - Coping assessment: [current resilience level]
            - Intervention priority: [immediate/supportive/long-term]
            - Activity recommendations: [specific helpful activities]

            Focus on practical therapeutic assessment for Indian cultural context."""
        # Use structured output for psychology analysis (single HumanMessage for better Gemini compatibility)
        analysis = None
        analysis = self.analyst_llm.invoke([HumanMessage(content=combined_prompt)])
        if analysis is None:
            logger.info("🔄 Trying minimal prompt for structured output...")
            minimal_prompt = f"""Analyze: "{state['user_message']}"

                Provide psychological analysis for Indian youth with these fields:
                emotional_state, stress_categories, therapeutic_approach, cultural_pressures, language_style, psychological_insights, coping_assessment, intervention_priority, activity_recommendations"""

            analysis = self.analyst_llm.invoke([HumanMessage(content=minimal_prompt)])
    

        if analysis is None:
            raise ValueError("Psychology Agent 1: Structured LLM returned None - possible prompt or model issue")
        
        state["psychological_analysis"] = analysis.dict()
        
        # Update background summarization with analysis (if running)
        if user_id in self._summarization_cache:
            # Update the placeholder with actual analysis
            pass  # Background thread will complete independently
        
        logger.info("✅ Psychology Agent 1: Cultural-sensitive analysis completed successfully")
        return state

    def companion_counselor_response(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 2: Companion-style counselor with psychology expertise for Indian youth"""
        logger.info("💬 Psychology Agent 2: Companion counselor response generation starting...")
        
        psychological_analysis = state.get("psychological_analysis", {})
        user_message = state["user_message"]
        voice_analysis = state.get("voice_analysis", {})
        
        # Get immediate context for culturally sensitive response generation
        immediate_context = self._format_immediate_context_for_response(
            state.get("recent_messages", [])[-3:],  # Last 3 messages for flow
            user_message
        )
        
        if not psychological_analysis:
            raise ValueError("Psychology Agent 2: No psychological_analysis available from Agent 1")
        
        logger.info("📝 Psychology Agent 2: Using psychology-guided companion response generation")
        
        # PSYCHOLOGY + COMPANION STYLE SYSTEM MESSAGE for Indian youth
        system_message = SystemMessage(content="""You are MindMate, a culturally-aware AI therapeutic companion specialized in Indian youth mental wellness (ages 16-25). Generate a response that combines professional psychology expertise with warm, companion-style delivery.

COMPANION COUNSELOR RESPONSE GUIDELINES:

PSYCHOLOGY EXPERTISE:
- Apply CBT techniques: cognitive restructuring, thought challenging, behavioral activation
- Use ACT principles: values clarification, psychological flexibility, mindful awareness
- Employ MBCT approaches: emotional regulation, present-moment awareness, self-compassion
- Address stress categories identified in analysis (academic/family/social/emotional/identity/career)

CULTURAL SENSITIVITY (Indian Youth Context):
- Understand academic pressure (board exams, competitive exams, parental expectations)
- Acknowledge family dynamics (joint family, traditional vs modern values, generation gap)
- Respect cultural nuances (festivals affecting mood, arranged marriage discussions, career path pressures)
- Be sensitive to mental health stigma and family involvement considerations

COMPANION DELIVERY STYLE:
- Use warm, friend-like tone while maintaining professional boundaries
- Match user's language comfort level (if they use "yaar/bhai", mirror appropriately)
- Be empathetic and non-judgmental, like talking to a caring friend who understands psychology
- Validate cultural struggles without dismissing traditional values
- Ask thoughtful questions (if needed) that promote self-exploration 
- Provide practical coping strategies suitable for Indian family/social context

IMPORTANT: Generate ONLY the natural conversation response. Do NOT include:
- Numbered annotations (1., 2., 3.)
- Technique labels in parentheses (CBT), (ACT), (MBCT)
- Structural annotations (validation), (reframe), (strategy)
- Any meta-commentary about the response structure

Don't be rigid in response structure - blend elements naturally.
 Keep responses conversational and appropriately sized for the context. 
For normal chats keep it concise for 2-way communication, but provide deeper responses when user needs more support.
""")

        # USER MESSAGE with analysis and context
        voice_context_for_response = ""
        if voice_analysis:
            voice_context_for_response = f"""
VOICE ANALYSIS INSIGHTS:
{json.dumps(voice_analysis, indent=1)}
"""

        user_content = f"""PSYCHOLOGICAL ANALYSIS:
{json.dumps(psychological_analysis, indent=1)}

CONVERSATION CONTEXT:
{immediate_context}{voice_context_for_response}

USER'S CURRENT MESSAGE: "{user_message}"

Generate a completely natural, conversational response as MindMate."""

        human_message = HumanMessage(content=user_content)

        # Generate direct response using base LLM (not structured output)
        response = self.llm.invoke([system_message, human_message])
        
        if not response or not response.content:
            raise ValueError("Psychology Agent 2: LLM returned empty response")
        
        # Clean up the response and store it
        final_response = self._clean_response(response.content)
        state["ai_response"] = final_response
        state["response_generated"] = True
        
        logger.info("✅ Psychology Agent 2: Companion counselor response completed successfully")
        
        return state
    
    def _format_messages_for_summarization(self, messages: List[Dict]) -> str:
        """Format ALL messages for comprehensive summarization"""
        if not messages:
            return "No conversation to summarize"
        
        formatted_messages = []
        for i, msg in enumerate(messages, 1):
            role = "User" if msg.get('role') == 'user' else "MindMate"
            content = msg.get('content', '')
            timestamp = msg.get('timestamp', '')[:16] if msg.get('timestamp') else f"Message {i}"
            formatted_messages.append(f"{timestamp} {role}: {content}")
        
        return "\n".join(formatted_messages)
    
    def _format_minimal_conversation_context(self, recent_messages: List, conversation_summary: Dict) -> str:
        """MINIMAL context formatting for faster processing"""
        context_parts = []
        
        # Include summary if it exists
        if conversation_summary:
            therapeutic_progress = conversation_summary.get('therapeutic_progress', '')
            emotional_patterns = conversation_summary.get('emotional_patterns', '')
            cultural_context = conversation_summary.get('cultural_context', '')
            
            summary_text = f"Progress: {therapeutic_progress[:100]}... | Patterns: {emotional_patterns[:100]}... | Culture: {cultural_context[:100]}..."
            context_parts.append(f"SUMMARY: {summary_text}")
        
        # Only recent messages, truncated
        if recent_messages:
            context_parts.append("RECENT:")
            for msg in recent_messages:
                role = "User" if msg.get('role') == 'user' else "AI"
                content = msg.get('content', '')[:80]  # Truncated for speed
                context_parts.append(f"{role}: {content}")
        
        return "\n".join(context_parts) if context_parts else "New conversation"
    
    def _format_minimal_activities_context(self, activities: List) -> str:
        """MINIMAL activity formatting for faster processing"""
        if not activities:
            return "No recent activities"
        
        # Only most recent activities with minimal info
        context_parts = []
        for activity in activities[:2]:
            name = activity.get('activity_type', 'Unknown').replace('_', ' ')
            score = activity.get('score', 'N/A')
            context_parts.append(f"{name}: {score}")
        
        return " | ".join(context_parts)
    
    def _format_immediate_context_for_response(self, last_messages: List, current_message: str) -> str:
        """Format immediate context for response generation"""
        if not last_messages:
            return f"User's message: '{current_message}' (New conversation)"
        
        context_parts = []
        for msg in last_messages:
            role = "User" if msg.get('role') == 'user' else "MindMate"
            content = msg.get('content', '')[:100]  # Truncate for efficiency
            context_parts.append(f"{role}: {content}")
        
        context_parts.append(f"User (current): {current_message}")
        
        return "\n".join(context_parts)
    
    def _clean_response(self, response: str) -> str:
        """Clean response of any artifacts"""
        response = response.strip()
        
        # Remove quotes if entire response is quoted
        if response.startswith('"') and response.endswith('"'):
            response = response[1:-1]
        
        # Remove any JSON-like formatting
        if response.startswith('{') or response.startswith('['):
            try:
                parsed = json.loads(response)
                if isinstance(parsed, dict) and 'content' in parsed:
                    response = parsed['content']
                elif isinstance(parsed, str):
                    response = parsed
            except:
                pass
        
        return response.strip()
    
    def _create_workflow(self) -> StateGraph:
        """Create psychology-focused 2-agent workflow (no sequential summarization)"""
        
        workflow = StateGraph(dict)
        
        # Add only the 2 main agents (summarization happens in background)
        workflow.add_node("psychological_analyst", self.psychological_analyst)
        workflow.add_node("companion_counselor_response", self.companion_counselor_response)
        
        # Define the TRUE 2-agent workflow sequence
        workflow.set_entry_point("psychological_analyst")
        workflow.add_edge("psychological_analyst", "companion_counselor_response")
        workflow.add_edge("companion_counselor_response", END)
        
        return workflow.compile()
    
    def process_chat(
        self, 
        user_message: str, 
        recent_messages: Optional[List] = None,
        conversation_summary: Optional[Dict] = None,
        user_activities: Optional[List] = None,
        user_patterns: Optional[Dict] = None,
        voice_analysis: Optional[Dict] = None,  # Add voice analysis parameter
        user_id: str = "anonymous",
        session_id: str = None
    ) -> Dict[str, Any]:
        """Process chat with psychology-focused 2-agent workflow + voice analysis + background summarization"""
        
        # Initialize with defaults
        recent_messages = recent_messages or []
        user_activities = user_activities or []
        conversation_summary = conversation_summary or {}
        user_patterns = user_patterns or {}
        voice_analysis = voice_analysis or {}  # Default to empty dict
        
        # Log voice analysis if available
        if voice_analysis:
            logger.info(f"🎤 Voice analysis received: {voice_analysis.get('emotional_tone', 'unknown')} tone, {voice_analysis.get('stress_level', 'unknown')} stress")
        
        # Create initial state for psychology-focused workflow
        initial_state = {
            "user_id": user_id,
            "session_id": session_id,
            "user_message": user_message.strip(),
            "recent_messages": recent_messages,
            "conversation_summary": conversation_summary,
            "user_activities": user_activities,
            "user_patterns": user_patterns,
            "psychological_analysis": {},
            "ai_response": "",
            "response_generated": False
        }
        
        try:
            logger.info(f"🚀 Starting psychology-focused 2-agent workflow for user: {user_id}")
            start_time = datetime.now()
            
            # Check if background summarization will be triggered
            will_summarize = self._should_trigger_background_summarization(user_id, recent_messages)
            logger.info(f"📊 Context: {len(recent_messages)} messages, Background summarization: {will_summarize}")
            
            # Execute the TRUE 2-agent workflow (summarization happens in background if needed)
            final_state = self.workflow.invoke(initial_state)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ Psychology-focused 2-agent workflow completed in {processing_time:.2f} seconds")
            
            # Extract results from psychology workflow
            response = final_state.get("ai_response", "")
            if not response.strip():
                raise ValueError("Psychology workflow completed but no ai_response generated")
            
            # Determine therapeutic approach from psychological analysis
            psychological_analysis = final_state.get("psychological_analysis", {})
            therapeutic_approach = psychological_analysis.get("therapeutic_approach", "Person-centered")
            
            logger.info(f"🧠 Psychology response ready - Approach: {therapeutic_approach}, Background summarization: {'Active' if will_summarize else 'Not needed'}")
            
            return {
                "message": response,
                "modality": therapeutic_approach,
                "confidence": 0.9,
                "processing_time": processing_time,
                "session_insights": {
                    "emotional_state": psychological_analysis.get("emotional_state", ""),
                    "stress_categories": psychological_analysis.get("stress_categories", []),
                    "therapeutic_approach": psychological_analysis.get("therapeutic_approach", ""),
                    "cultural_pressures": psychological_analysis.get("cultural_pressures", ""),
                    "language_style": psychological_analysis.get("language_style", ""),
                    "psychological_insights": psychological_analysis.get("psychological_insights", []),
                    "coping_assessment": psychological_analysis.get("coping_assessment", ""),
                    "intervention_priority": psychological_analysis.get("intervention_priority", ""),
                    "activity_recommendations": psychological_analysis.get("activity_recommendations", []),
                    "performance_metrics": {
                        "context_messages": len(recent_messages),
                        "context_activities": len(user_activities),
                        "has_summary": bool(conversation_summary),
                        "background_summarization": will_summarize,
                        "cached_summary_available": user_id in self._summarization_cache
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Psychology-focused workflow execution failed: {e}")
            raise e

# Global workflow instance
_workflow_instance = None

def get_workflow_instance() -> MindMateWorkflow:
    """Get or create psychology-focused workflow instance"""
    global _workflow_instance
    if _workflow_instance is None:
        _workflow_instance = MindMateWorkflow()
    return _workflow_instance

def process_user_chat(
    user_message: str, 
    recent_messages: Optional[List] = None,
    conversation_summary: Optional[Dict] = None,
    user_activities: Optional[List] = None,
    user_patterns: Optional[Dict] = None,
    voice_analysis: Optional[Dict] = None,  # Add voice analysis parameter
    user_id: str = "anonymous",
    session_id: str = None
) -> Dict[str, Any]:
    """Main entry point for psychology-focused 2-agent chat processing with voice analysis"""
    
    logger.info("🚀 [ENTRY] MindMate chat processing initiated")
    logger.info(f"📝 [ENTRY] Message preview: '{user_message[:50]}{'...' if len(user_message) > 50 else ''}'")
    logger.info(f"👤 [ENTRY] User ID: {user_id}")
    logger.info(f"🔗 [ENTRY] Session ID: {session_id}")
    logger.info(f"🎤 [ENTRY] Voice analysis: {'✅ PROVIDED' if voice_analysis else '❌ NOT PROVIDED'}")
    
    if voice_analysis:
        logger.info(f"🔍 [ENTRY] Voice analysis details:")
        logger.info(f"   - Emotional tone: {voice_analysis.get('emotional_tone', 'unknown')}")
        logger.info(f"   - Stress level: {voice_analysis.get('stress_level', 'unknown')}")
        logger.info(f"   - Speech pace: {voice_analysis.get('speech_pace', 'unknown')}")
        logger.info(f"   - Cultural context keys: {list(voice_analysis.get('cultural_context', {}).keys())}")
        logger.info(f"   - Psychological markers: {list(voice_analysis.get('psychological_markers', {}).keys())}")
    
    start_time = time.time()
    
    try:
        workflow = get_workflow_instance()
        result = workflow.process_chat(
            user_message, recent_messages, conversation_summary,
            user_activities, user_patterns, voice_analysis, user_id, session_id
        )
        
        processing_time = time.time() - start_time
        result["processing_time"] = round(processing_time, 2)
        result["voice_aware"] = bool(voice_analysis)  # Flag to indicate voice was considered
        
        logger.info(f"✅ [ENTRY] Processing completed successfully in {processing_time:.2f}s")
        logger.info(f"📊 [ENTRY] Response metrics:")
        logger.info(f"   - Message length: {len(result.get('message', ''))} characters")
        logger.info(f"   - Modality: {result.get('modality', 'unknown')}")
        logger.info(f"   - Voice-aware: {result.get('voice_aware', False)}")
        
        return result
        
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"❌ [ENTRY] Processing failed after {processing_time:.2f}s")
        logger.error(f"❌ [ENTRY] Error details: {str(e)}")
        raise e