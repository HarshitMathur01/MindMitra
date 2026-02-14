import os
import json
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from supabase import create_client, Client
from memory_architecture import UniversalMemorySystem

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Pydantic models for 4-agent parallel architecture
class EmotionAnalysis(BaseModel):
    """Agent 1 output: Deep emotion and sentiment analysis"""
    primary_emotion: str = Field(description="Dominant emotion: anxious/sad/frustrated/overwhelmed/neutral/hopeful/happy")
    emotion_intensity: str = Field(description="Urgency level: low/medium/high/critical")
    sentiment_valence: str = Field(description="Overall message tone: negative/neutral/positive")
    emotional_triggers: List[str] = Field(description="2-3 specific triggers detected: exam/family/career/relationship/identity")
    somatic_indicators: str = Field(description="Physical stress signals mentioned (sleep issues, fatigue, etc.) or 'none'")
    voice_emotion_match: str = Field(description="Text vs voice emotion alignment: matches/conflicts/unavailable")

class CulturalContextAnalysis(BaseModel):
    """Agent 2 output: Cultural framing and language style"""
    cultural_stressors: List[str] = Field(description="Active Indian-context pressures: board_exams/jee/neet/parental_expectations/arranged_marriage/family_honor/peer_comparison/financial")
    family_dynamics: str = Field(description="1-line summary of family pressure pattern detected")
    language_register: str = Field(description="How user communicates: formal/casual/hindi_mixed/hinglish/distressed")
    response_tone_guidance: str = Field(description="Tone instruction for therapist: peer_friend/gentle_elder/professional/grounding")
    cultural_strengths: str = Field(description="Positive cultural assets to leverage: family_support/spiritual/resilience or 'none detected'")

class PsychologicalAnalysis(BaseModel):
    """Agent 3 output: Clinical psychological assessment"""
    stress_categories: List[str] = Field(description="Active stress types: Academic/Family/Social/Emotional/Identity/Career")
    therapeutic_approach: str = Field(description="Best modality: CBT/ACT/MBCT/supportive/crisis")
    coping_assessment: str = Field(description="Current coping capacity: overwhelmed/struggling/managing/resilient")
    intervention_priority: str = Field(description="Urgency: immediate/supportive/long-term")
    key_insight: str = Field(description="Single most important clinical observation for the therapist to address")
    activity_recommendation: str = Field(description="One specific grounding or coping activity suited to current state")

class ConversationSummary(BaseModel):
    """Contextual conversation summarization preserving therapeutic progress"""
    therapeutic_progress: str = Field(description="Therapeutic journey and breakthrough moments")
    emotional_patterns: str = Field(description="Recurring emotional themes and patterns")
    cultural_context: str = Field(description="Family dynamics, academic pressures, cultural factors")
    language_preferences: str = Field(description="Communication style and language mixing patterns")
    key_insights: List[str] = Field(description="Important psychological insights to preserve")
    stress_evolution: str = Field(description="How stress categories and levels have changed")
    intervention_history: str = Field(description="Therapeutic approaches used and their effectiveness")

class MindMitraWorkflow:
    """4-agent parallel workflow with background summarization"""

    def __init__(self):
        logger.info("🧠 [WORKFLOW] Initializing MindMitra 4-Agent Parallel Workflow...")
        self.llm = self._initialize_llm()
        # 4-agent structured LLMs (emotion + cultural + psychological run in parallel)
        try:
            self.emotion_llm = self.llm.with_structured_output(EmotionAnalysis)
            self.cultural_llm = self.llm.with_structured_output(CulturalContextAnalysis)
            self.analyst_llm = self.llm.with_structured_output(PsychologicalAnalysis)
            self.summarizer_llm = self.llm.with_structured_output(ConversationSummary)
            logger.info("✅ [WORKFLOW] 4-agent LLMs initialized (emotion + cultural + psychological + therapist)")
        except Exception as e:
            logger.error(f"❌ [WORKFLOW] Failed to initialize 4-agent LLMs: {e}")
            raise e
        self.workflow = self._create_workflow()
        
        # Background summarization tracking
        self._summarization_cache = {}
        self._last_summarization_count = {}
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        if supabase_url and supabase_key:
            self.supabase: Client = create_client(supabase_url, supabase_key)
            logger.info("✅ [WORKFLOW] Supabase client initialized")
        else:
            self.supabase = None
            logger.warning("⚠️ [WORKFLOW] Supabase credentials not found - memory features disabled")
        
        # Initialize memory system
        try:
            google_api_key = os.getenv('GOOGLE_API_KEY')
            if google_api_key:
                self.memory_system = UniversalMemorySystem(api_key=google_api_key)
                logger.info("✅ [WORKFLOW] Memory system initialized")
            else:
                self.memory_system = None
                logger.warning("⚠️ [WORKFLOW] GOOGLE_API_KEY not found - memory extraction disabled")
        except Exception as e:
            self.memory_system = None
            logger.error(f"❌ [WORKFLOW] Memory system initialization failed: {e}")
        
        logger.info("✅ [WORKFLOW] MindMitra Workflow fully initialized and ready for voice-enhanced therapy")
    
    def fetch_session_memories(self, session_id: str) -> Dict[str, List[Dict]]:
        """Fetch all memories for a session from database (FIXED: Works with JSONB schema)"""
        logger.info(f"🔍 [FETCH_MEMORIES] Starting to fetch memories for session: {session_id}")
        
        if not self.supabase:
            logger.error(f"❌ [FETCH_MEMORIES] Supabase client is not initialized!")
            return {'procedural': [], 'semantic': [], 'episodic': []}
            
        if not session_id:
            logger.warning(f"⚠️ [FETCH_MEMORIES] No session_id provided")
            return {'procedural': [], 'semantic': [], 'episodic': []}
        
        try:
            logger.info(f"📊 [FETCH_MEMORIES] Querying 'memories' table for session_id: {session_id}")
            response = self.supabase.table('memories').select('*').eq('session_id', session_id).order('created_at', desc=True).execute()
            
            logger.info(f"📥 [FETCH_MEMORIES] Database returned {len(response.data)} rows")
            
            if not response.data:
                logger.warning(f"⚠️ [FETCH_MEMORIES] No memory records found in database for this session")
                return {'procedural': [], 'semantic': [], 'episodic': []}
            
            # Parse JSONB arrays from database (each row contains arrays of all 3 memory types)
            memories = {'procedural': [], 'semantic': [], 'episodic': []}
            
            for row in response.data:
                logger.info(f"   Processing memory record ID: {row.get('id')}")
                
                # Parse each JSONB column
                for memory_type in ['procedural', 'semantic', 'episodic']:
                    column_name = f'{memory_type}_memories'
                    jsonb_data = row.get(column_name, [])
                    
                    # Handle both JSON string and parsed list
                    if isinstance(jsonb_data, str):
                        try:
                            jsonb_data = json.loads(jsonb_data)
                        except:
                            logger.warning(f"   Failed to parse {column_name} JSON")
                            jsonb_data = []
                    
                    # Add memories from this row to the accumulated list
                    if isinstance(jsonb_data, list):
                        for mem in jsonb_data:
                            memories[memory_type].append({
                                'memory_content': mem.get('memory_content', mem.get('content', str(mem))),
                                'confidence': mem.get('confidence', mem.get('confidence_level', 0.5)),
                                'created_at': row.get('created_at'),
                                'memory_id': row.get('id'),
                                'importance': mem.get('importance', 'medium'),
                                'category': mem.get('category', 'general')
                            })
            
            logger.info(f"✅ [FETCH_MEMORIES] Organized memories by type:")
            logger.info(f"   - Procedural: {len(memories['procedural'])}")
            logger.info(f"   - Semantic: {len(memories['semantic'])}")
            logger.info(f"   - Episodic: {len(memories['episodic'])}")
            
            return memories
        except Exception as e:
            logger.error(f"❌ [FETCH_MEMORIES] Error fetching session memories: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {'procedural': [], 'semantic': [], 'episodic': []}
    
    def fetch_last_n_messages(self, session_id: str, n: int = 15) -> List[Dict]:
        """Fetch last N unprocessed messages for a session"""
        if not self.supabase or not session_id:
            return []
        
        try:
            response = self.supabase.table('chat_messages').select('id, role, content, created_at').eq('session_id', session_id).eq('processed_into_memory', False).order('created_at', desc=False).limit(n).execute()
            
            messages = []
            for row in response.data:
                messages.append({
                    'id': row['id'],
                    'role': row['role'],
                    'content': row['content'],
                    'timestamp': row['created_at']
                })
            
            logger.info(f"📥 [WORKFLOW] Fetched {len(messages)} unprocessed messages for session {session_id}")
            return messages
        except Exception as e:
            logger.error(f"❌ [WORKFLOW] Error fetching messages: {e}")
            return []
    
    def trigger_memory_extraction(self, session_id: str, user_id: str):
        """
        Trigger memory extraction for a session (runs in background).
        Called every 8 messages.
        """
        try:
            logger.info("=" * 80)
            logger.info(f"🧠 [MEMORY EXTRACTION] Starting Memory Extraction Process")
            logger.info("=" * 80)
            logger.info(f"🔗 [MEMORY] Session ID: {session_id}")
            logger.info(f"👤 [MEMORY] User ID: {user_id}")
            
            # Fetch unprocessed messages
            logger.info(f"📥 [MEMORY] Fetching last 15 messages for extraction...")
            messages = self.fetch_last_n_messages(session_id, n=15)
            
            if not messages:
                logger.warning(f"⚠️ [MEMORY] No messages found for extraction")
                logger.info("=" * 80)
                return
            
            logger.info(f"✅ [MEMORY] Retrieved {len(messages)} messages for processing")
            
            if not self.memory_system:
                logger.error(f"❌ [MEMORY] Memory system not initialized - cannot extract memories")
                logger.info("=" * 80)
                return
            
            # Format as chat data
            chat_data = {
                'data_type': 'chat',
                'user_id': user_id,
                'session_id': session_id,
                'chat_history': messages
            }
            
            # Extract memories
            logger.info(f"🔄 [MEMORY] Calling LLM to extract memories (this may take 10-30 seconds)...")
            logger.info(f"   Using parallel extraction for 3 memory types:")
            logger.info(f"   - Procedural (how-to knowledge)")
            logger.info(f"   - Semantic (general knowledge)")
            logger.info(f"   - Episodic (specific events)")
            
            result = self.memory_system.process_data_to_memories(chat_data)
            
            logger.info(f"✅ [MEMORY] LLM extraction completed!")
            logger.info(f"📊 [MEMORY] Extraction results:")
            logger.info(f"   - Procedural memories: {len(result['memories'].get('procedural', []))}")
            logger.info(f"   - Semantic memories: {len(result['memories'].get('semantic', []))}")
            logger.info(f"   - Episodic memories: {len(result['memories'].get('episodic', []))}")
            
            # Save to database (FIXED: Insert as JSONB arrays matching schema)
            logger.info(f"💾 [MEMORY] Saving memories to database...")
            try:
                # Prepare memory data matching the table schema
                memory_record = {
                    'user_id': user_id,
                    'session_id': session_id,
                    'data_type': 'chat',
                    'procedural_memories': result['memories'].get('procedural', []),
                    'semantic_memories': result['memories'].get('semantic', []),
                    'episodic_memories': result['memories'].get('episodic', []),
                    'memory_summary': {
                        'procedural_count': len(result['memories'].get('procedural', [])),
                        'semantic_count': len(result['memories'].get('semantic', [])),
                        'episodic_count': len(result['memories'].get('episodic', [])),
                        'extraction_timestamp': datetime.now(timezone.utc).isoformat()
                    },
                    'source_message_ids': [msg['id'] for msg in messages],
                    'metadata': {
                        'message_count': len(messages),
                        'extraction_method': 'parallel_llm'
                    },
                    'processed_at': datetime.now(timezone.utc).isoformat()
                }
                
                # Insert single record with all memories as JSONB
                self.supabase.table('memories').insert(memory_record).execute()
                
                total_memories = (len(result['memories'].get('procedural', [])) + 
                                len(result['memories'].get('semantic', [])) + 
                                len(result['memories'].get('episodic', [])))
                logger.info(f"✅ [MEMORY] Successfully saved {total_memories} memories to database")
                
            except Exception as e:
                logger.error(f"❌ [MEMORY] Failed to save memories: {e}")
                import traceback
                logger.error(traceback.format_exc())
            logger.info("=" * 80)

            # Mark messages as processed
            message_ids = [msg['id'] for msg in messages]
            if message_ids:
                try:
                    self.supabase.table('chat_messages').update({'processed_into_memory': True}).in_('id', message_ids).execute()
                    logger.info(f"✅ [MEMORY] Marked {len(message_ids)} messages as processed")
                except Exception as e:
                    logger.error(f"❌ [MEMORY] Failed to mark messages as processed: {e}")
            
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ [MEMORY] Memory extraction failed: {e}")
    
    def _initialize_llm(self) -> ChatGoogleGenerativeAI:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
        
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            google_api_key=api_key,
            timeout=30,
            max_tokens=400,  # Optimized for free tier token limits
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
                    'summary': summary.model_dump(),
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
    
    # ─────────────────────────────────────────────────────────────────
    # PRIVATE ANALYSIS METHODS (run in parallel inside parallel_analysis_node)
    # ─────────────────────────────────────────────────────────────────

    def _run_emotion_analysis(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 1: Deep emotion and sentiment analysis (lightweight, no history needed)"""
        logger.info("🎭 [EMOTION AGENT] Starting emotion & sentiment analysis...")
        user_message = state["user_message"]
        voice_analysis = state.get("voice_analysis", {})

        voice_block = ""
        if voice_analysis:
            voice_block = (
                f"\nVoice data: tone={voice_analysis.get('emotional_tone', 'unknown')}, "
                f"stress={voice_analysis.get('stress_level', 'unknown')}"
            )

        prompt = f"""Analyze the emotional state in this message from an Indian youth (16-25 years).

Message: "{user_message}"{voice_block}

Identify: primary emotion, intensity (low/medium/high/critical), sentiment valence,
2-3 specific triggers, any physical stress signals, and whether voice data matches
text emotion (or 'unavailable' if no voice data)."""

        analysis = self.emotion_llm.invoke([HumanMessage(content=prompt)])
        if analysis is None:
            logger.warning("⚠️ [EMOTION AGENT] Structured output returned None, using fallback")
            analysis = self.emotion_llm.invoke([HumanMessage(content=f'Analyze emotion in: "{user_message}". Fill: primary_emotion, emotion_intensity, sentiment_valence, emotional_triggers, somatic_indicators, voice_emotion_match')])
        if analysis is None:
            raise ValueError("Emotion Agent: LLM returned None")

        result = analysis.model_dump()
        logger.info(f"✅ [EMOTION AGENT] Done — {result.get('primary_emotion')} ({result.get('emotion_intensity')})")
        return result

    def _run_cultural_analysis(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 2: Cultural context and language style analysis"""
        logger.info("🌏 [CULTURAL AGENT] Starting cultural context analysis...")
        user_message = state["user_message"]
        recent_messages = state.get("recent_messages", [])

        # Last 3 messages truncated to 80 chars each for context
        recent_ctx = ""
        for msg in recent_messages[-3:]:
            role = "User" if msg.get("role") == "user" else "AI"
            recent_ctx += f"{role}: {msg.get('content', '')[:80]}\n"

        prompt = f"""Analyze the cultural context for this Indian youth's message.

Message: "{user_message}"

Recent conversation:
{recent_ctx.strip() if recent_ctx else "New conversation"}

Identify: active Indian cultural stressors (board_exams/jee/neet/parental_expectations/
arranged_marriage/family_honor/peer_comparison/financial), family dynamics pattern,
language register (formal/casual/hindi_mixed/hinglish/distressed), what tone MindMitra
should respond in (peer_friend/gentle_elder/professional/grounding), and cultural
strengths to leverage."""

        analysis = self.cultural_llm.invoke([HumanMessage(content=prompt)])
        if analysis is None:
            logger.warning("⚠️ [CULTURAL AGENT] Structured output returned None, using fallback")
            analysis = self.cultural_llm.invoke([HumanMessage(content=f'Cultural analysis for Indian youth: "{user_message}". Fill: cultural_stressors, family_dynamics, language_register, response_tone_guidance, cultural_strengths')])
        if analysis is None:
            raise ValueError("Cultural Agent: LLM returned None")

        result = analysis.model_dump()
        logger.info(f"✅ [CULTURAL AGENT] Done — register: {result.get('language_register')}, tone: {result.get('response_tone_guidance')}")
        return result

    def _run_psychological_assessment(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 3: Clinical psychological assessment using memories and activity data"""
        logger.info("🧠 [PSYCH AGENT] Starting psychological assessment...")
        user_id = state.get("user_id", "anonymous")
        user_message = state["user_message"]
        user_activities = state.get("user_activities", [])
        conversation_summary = state.get("conversation_summary", {})

        # Log activities received
        logger.info(f"📊 [PSYCH AGENT] Activities received: {len(user_activities)}")

        # Fetch session memories
        session_memories = {'procedural': [], 'semantic': [], 'episodic': []}
        if state.get('session_id'):
            session_memories = self.fetch_session_memories(state.get('session_id'))
            memory_count = sum(len(v) for v in session_memories.values())
            logger.info(f"🧠 [PSYCH AGENT] Retrieved {memory_count} memories (procedural={len(session_memories['procedural'])}, semantic={len(session_memories['semantic'])}, episodic={len(session_memories['episodic'])})")
        else:
            logger.warning("⚠️ [PSYCH AGENT] No session_id — skipping memory fetch")

        # Build context blocks
        activities_context = self._format_comprehensive_activities_context(user_activities[:3])
        memory_context = self._format_memory_context_with_content(session_memories, max_per_type=3)

        # Brief summary context (emotional patterns only, truncated)
        effective_summary = self._get_effective_conversation_summary(user_id, conversation_summary)
        summary_context = ""
        if effective_summary:
            patterns = effective_summary.get('emotional_patterns', '')
            if patterns:
                summary_context = f"\nOngoing emotional patterns: {str(patterns)[:200]}"

        prompt = f"""Clinical assessment for Indian youth mental wellness (16-25 years).

User message: "{user_message}"{summary_context}

{activities_context}

{memory_context}

Determine: active stress categories (Academic/Family/Social/Emotional/Identity/Career),
best therapeutic approach (CBT/ACT/MBCT/supportive/crisis), current coping capacity
(overwhelmed/struggling/managing/resilient), intervention urgency (immediate/supportive/long-term),
the single most important clinical insight, and one specific grounding or coping activity."""

        analysis = self.analyst_llm.invoke([HumanMessage(content=prompt)])
        if analysis is None:
            logger.warning("⚠️ [PSYCH AGENT] Structured output returned None, using fallback")
            analysis = self.analyst_llm.invoke([HumanMessage(content=f'Psychological assessment for Indian youth: "{user_message}". Fill: stress_categories, therapeutic_approach, coping_assessment, intervention_priority, key_insight, activity_recommendation')])
        if analysis is None:
            raise ValueError("Psychological Agent: LLM returned None")

        result = analysis.model_dump()
        logger.info(f"✅ [PSYCH AGENT] Done — {result.get('therapeutic_approach')}, priority: {result.get('intervention_priority')}")
        return result

    # ─────────────────────────────────────────────────────────────────
    # PUBLIC WORKFLOW NODES
    # ─────────────────────────────────────────────────────────────────

    def parallel_analysis_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parallel analysis node: runs Emotion, Cultural, and Psychological agents
        concurrently using ThreadPoolExecutor to minimize latency.

        Architecture:
          emotion_agent  ──┐
          cultural_agent ──┼──> all 3 complete → state updated → therapist_response_agent
          psych_agent    ──┘
        """
        logger.info("=" * 80)
        logger.info("🚀 [PARALLEL NODE] Launching 3 analysis agents concurrently...")
        logger.info(f"   User: {state.get('user_id', 'anonymous')} | Session: {state.get('session_id', 'none')}")
        logger.info(f"   Message: '{state['user_message'][:100]}{'...' if len(state['user_message']) > 100 else ''}'")
        logger.info(f"   Activities: {len(state.get('user_activities', []))} | Voice: {'yes' if state.get('voice_analysis') else 'no'}")
        logger.info("=" * 80)

        results = {}
        errors = {}

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_map = {
                executor.submit(self._run_emotion_analysis, state): "emotion",
                executor.submit(self._run_cultural_analysis, state): "cultural",
                executor.submit(self._run_psychological_assessment, state): "psychological",
            }

            for future in as_completed(future_map):
                agent_name = future_map[future]
                try:
                    results[agent_name] = future.result()
                except Exception as e:
                    logger.error(f"❌ [PARALLEL NODE] {agent_name} agent failed: {e}")
                    errors[agent_name] = str(e)

        # Validate all 3 completed
        if len(results) < 3:
            missing = [k for k in ["emotion", "cultural", "psychological"] if k not in results]
            raise ValueError(f"Parallel analysis failed for agents: {missing}. Errors: {errors}")

        state["emotion_analysis"] = results["emotion"]
        state["cultural_context"] = results["cultural"]
        state["psychological_analysis"] = results["psychological"]

        logger.info("=" * 80)
        logger.info("✅ [PARALLEL NODE] All 3 agents completed successfully")
        logger.info(f"   Emotion: {results['emotion'].get('primary_emotion')} ({results['emotion'].get('emotion_intensity')})")
        logger.info(f"   Cultural: {results['cultural'].get('language_register')} / {results['cultural'].get('response_tone_guidance')}")
        logger.info(f"   Psych: {results['psychological'].get('therapeutic_approach')} / {results['psychological'].get('intervention_priority')}")
        logger.info("=" * 80)
        return state

    def therapist_response_agent(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Agent 4: Therapist response generator.
        Uses all 3 parallel analyses to produce a culturally-sensitive,
        psychologically-informed, natural conversation response.
        """
        logger.info("💬 [THERAPIST AGENT] Generating response using all 3 analyses...")

        emotion_analysis = state.get("emotion_analysis", {})
        cultural_context = state.get("cultural_context", {})
        psychological_analysis = state.get("psychological_analysis", {})
        user_message = state["user_message"]

        if not psychological_analysis:
            raise ValueError("Therapist Agent: No psychological_analysis available")

        # Immediate conversation context (last 3 turns for flow)
        immediate_context = self._format_immediate_context_for_response(
            state.get("recent_messages", [])[-3:],
            user_message
        )

        # Build compact system message using pre-computed analysis fields
        therapeutic_approach = psychological_analysis.get("therapeutic_approach", "supportive")
        intervention_priority = psychological_analysis.get("intervention_priority", "supportive")
        key_insight = psychological_analysis.get("key_insight", "")
        activity_rec = psychological_analysis.get("activity_recommendation", "")
        language_register = cultural_context.get("language_register", "casual")
        response_tone = cultural_context.get("response_tone_guidance", "peer_friend")
        primary_emotion = emotion_analysis.get("primary_emotion", "neutral")
        emotion_intensity = emotion_analysis.get("emotion_intensity", "medium")

        system_message = SystemMessage(content=f"""You are MindMitra, a warm AI therapeutic companion for Indian youth (16-25).

Therapeutic approach: {therapeutic_approach}
Communication style: {language_register} — respond in matching register
Tone: {response_tone}
Urgency: {intervention_priority}
Key focus: {key_insight}
Suggest if appropriate: {activity_rec}

RULES:
- No numbered lists, no technique labels like (CBT) or (ACT), no structural annotations
- Natural, conversational response only
- Concise for normal chat; deeper support when emotionally heavy ({emotion_intensity} intensity)
- Mirror language style — use "yaar/bhai" if user does, otherwise match their register
- Validate cultural struggles without dismissing Indian family/social context""")

        user_content = f"""User is feeling: {primary_emotion} ({emotion_intensity} intensity)
Cultural context: {cultural_context.get('cultural_stressors', [])[:3]} | {cultural_context.get('family_dynamics', '')}

Recent conversation:
{immediate_context}

Respond naturally as MindMitra."""

        response = self.llm.invoke([system_message, HumanMessage(content=user_content)])

        if not response or not response.content:
            raise ValueError("Therapist Agent: LLM returned empty response")

        state["ai_response"] = self._clean_response(response.content)
        state["response_generated"] = True

        logger.info(f"✅ [THERAPIST AGENT] Response generated ({len(state['ai_response'])} chars)")
        return state
    
    def _format_messages_for_summarization(self, messages: List[Dict]) -> str:
        """Format ALL messages for comprehensive summarization"""
        if not messages:
            return "No conversation to summarize"
        
        formatted_messages = []
        for i, msg in enumerate(messages, 1):
            role = "User" if msg.get('role') == 'user' else "MindMitra"
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
        logger.info(f"🔄 [FORMAT] Formatting activities context...")
        logger.info(f"📥 [FORMAT] Input: {len(activities)} activities to format")
        
        if not activities:
            logger.warning("⚠️ [FORMAT] No activities to format - returning empty context")
            return "No recent activities"
        
        # Only most recent activities with minimal info
        context_parts = []
        for i, activity in enumerate(activities[:2], 1):
            name = activity.get('activity_type', 'Unknown').replace('_', ' ')
            score = activity.get('score', 'N/A')
            context_parts.append(f"{name}: {score}")
            logger.info(f"   [{i}] {name} (score: {score})")
        
        formatted = " | ".join(context_parts)
        logger.info(f"✅ [FORMAT] Formatted context: '{formatted}'")
        return formatted

    def _format_comprehensive_activities_context(self, activities: List) -> str:
        """
        COMPREHENSIVE activity formatting with FULL therapeutic insights.
        
        🔥 CRITICAL FIX: This replaces the minimal context that was losing 90% of game data!
        
        Previously only showed: "Memory Challenge: 85"
        Now shows: Full psychological analysis including:
        - Performance metrics (score, accuracy, duration)
        - Key behavioral patterns observed
        - Cognitive strengths identified
        - Areas for therapeutic growth
        - Emotional state during activity
        - Personalized recommendations
        
        This enables the chatbot to provide truly data-driven, personalized therapy.
        """
        logger.info(f"🔄 [COMPREHENSIVE_FORMAT] Formatting FULL activity context with insights...")
        logger.info(f"📥 [COMPREHENSIVE_FORMAT] Processing {len(activities)} activities")
        
        if not activities:
            logger.warning("⚠️ [COMPREHENSIVE_FORMAT] No activities to format")
            return "No recent therapeutic activities completed."
        
        context_parts = ["📊 RECENT THERAPEUTIC ACTIVITIES & PSYCHOLOGICAL INSIGHTS:\n"]
        
        for i, activity in enumerate(activities[:5], 1):  # Use up to 5 activities (was 2!)
            activity_type = activity.get('activity_type', 'Unknown').replace('_', ' ').title()
            score = activity.get('score', 0)
            accuracy = activity.get('accuracy_percentage', 0)
            duration = activity.get('game_duration', 0)
            completed_at = activity.get('completed_at', 'Unknown date')
            
            logger.info(f"   [{i}] Processing: {activity_type}")
            
            # Extract rich therapeutic insights from insights_generated field
            insights = activity.get('insights_generated', {})
            performance = insights.get('performance_level', 'unknown')
            patterns = insights.get('key_patterns', [])
            strengths = insights.get('cognitive_strengths', [])
            areas_for_growth = insights.get('areas_for_growth', [])
            emotional_indicators = insights.get('emotional_indicators', [])
            recommendations = insights.get('recommendations', [])
            
            logger.info(f"       Performance: {performance}, Patterns: {len(patterns)}, Strengths: {len(strengths)}")
            
            # Build rich, therapeutically-informed context
            activity_summary = f"""
{i}. {activity_type} (Completed: {completed_at[:10] if completed_at != 'Unknown date' else 'Unknown'})
   📈 Performance Metrics:
      - Score: {score}/100
      - Accuracy: {accuracy}%
      - Duration: {duration} seconds
      - Performance Level: {performance}
   
   🧠 Psychological Analysis:
      - Key Patterns Observed: {', '.join(patterns[:3]) if patterns else 'None identified yet'}
      - Cognitive Strengths: {', '.join(strengths[:3]) if strengths else 'Still assessing'}
      - Growth Opportunities: {', '.join(areas_for_growth[:2]) if areas_for_growth else 'None noted'}
      - Emotional State During Activity: {', '.join(emotional_indicators[:2]) if emotional_indicators else 'Neutral'}
   
   💡 Therapeutic Recommendations:
      - {recommendations[0] if recommendations else 'Continue engaging with therapeutic activities'}
"""
            context_parts.append(activity_summary)
        
        context_parts.append(f"\n📌 Total Activities Analyzed: {len(activities)}")
        context_parts.append("💭 Use these insights to provide personalized, data-driven therapeutic guidance.")
        
        formatted = "\n".join(context_parts)
        logger.info(f"✅ [COMPREHENSIVE_FORMAT] Created rich context: {len(formatted)} characters")
        return formatted

    def _format_emotion_summary_for_prompt(self, emotion_analysis: Dict) -> str:
        """Format emotion analysis into a compact single-line prompt string"""
        if not emotion_analysis:
            return "Emotion: unknown"
        triggers = ", ".join(emotion_analysis.get("emotional_triggers", []))
        return (
            f"Emotion: {emotion_analysis.get('primary_emotion', 'unknown')} "
            f"({emotion_analysis.get('emotion_intensity', 'unknown')} intensity) | "
            f"Triggers: {triggers or 'none'}"
        )

    def _format_cultural_summary_for_prompt(self, cultural_context: Dict) -> str:
        """Format cultural context into a compact single-line prompt string"""
        if not cultural_context:
            return ""
        stressors = cultural_context.get("cultural_stressors", [])
        return (
            f"Cultural stressors: {', '.join(stressors[:3]) or 'none'} | "
            f"Family: {cultural_context.get('family_dynamics', 'N/A')} | "
            f"Language: {cultural_context.get('language_register', 'casual')}"
        )

    def _format_memory_context_with_content(self, memories: Dict, max_per_type: int = 5) -> str:
        """
        Format memory context with ACTUAL CONTENT, not just counts.
        
        🔥 CRITICAL FIX: Previously only showed counts like "12 procedural memories"
        Now shows: The actual memory content so chatbot can reference specific techniques,
        facts, and past events in responses.
        
        This gives the chatbot true memory and therapeutic continuity!
        """
        if not memories or not any(memories.values()):
            return "📝 No session memories yet - this is a new conversation."
        
        parts = ["🧠 SESSION MEMORY BANK (from our past conversations):\n"]
        
        # Procedural memories - coping techniques, skills, strategies
        procedural = memories.get('procedural', [])
        if procedural:
            parts.append("📚 COPING TECHNIQUES & SKILLS YOU'VE LEARNED:")
            for i, mem in enumerate(procedural[:max_per_type], 1):
                content = mem.get('memory_content', mem.get('content', 'N/A'))
                confidence = mem.get('confidence_level', mem.get('confidence', 0.5))
                last_used = mem.get('last_used', 'Not tracked')
                effectiveness = mem.get('effectiveness', 'Unknown')
                
                parts.append(f"   {i}. {content}")
                parts.append(f"      └─ Confidence: {confidence:.1f}/1.0 | Effectiveness: {effectiveness}")
                if last_used != 'Not tracked':
                    parts.append(f"      └─ Last used: {last_used}")
        
        # Semantic memories - facts, preferences, beliefs, identity
        semantic = memories.get('semantic', [])
        if semantic:
            parts.append("\n🎯 WHAT I KNOW ABOUT YOU:")
            for i, mem in enumerate(semantic[:max_per_type], 1):
                content = mem.get('content', 'N/A')
                importance = mem.get('importance', 'medium')
                category = mem.get('category', 'general')
                source = mem.get('source', 'stated')
                
                # Format by importance
                if importance == 'high':
                    prefix = "⭐"
                elif importance == 'critical':
                    prefix = "🔥"
                else:
                    prefix = "  "
                
                parts.append(f"   {prefix} {i}. {content}")
                parts.append(f"      └─ Category: {category} | Source: {source}")
        
        # Episodic memories - past events, experiences, breakthroughs
        episodic = memories.get('episodic', [])
        if episodic:
            parts.append("\n📅 SIGNIFICANT MOMENTS WE'VE SHARED:")
            for i, mem in enumerate(episodic[:max_per_type], 1):
                event = mem.get('event_description', 'N/A')
                outcome = mem.get('outcome', 'Unknown outcome')
                significance = mem.get('significance', 'medium')
                emotional_intensity = mem.get('emotional_intensity', 5)
                learned_from = mem.get('learned_from', '')
                
                parts.append(f"   {i}. {event}")
                parts.append(f"      └─ Outcome: {outcome}")
                parts.append(f"      └─ Significance: {significance} | Emotional intensity: {emotional_intensity}/10")
                if learned_from:
                    parts.append(f"      └─ What you learned: {learned_from}")
        
        # Summary stats
        total_memories = len(procedural) + len(semantic) + len(episodic)
        parts.append(f"\n📊 Memory Bank Stats: {total_memories} total memories across {len([k for k,v in memories.items() if v])} categories")
        parts.append("💭 Reference these specific memories when appropriate to show continuity and personalization.")
        
        return "\n".join(parts)


    
    def _format_immediate_context_for_response(self, last_messages: List, current_message: str) -> str:
        """Format immediate context for response generation"""
        if not last_messages:
            return f"User's message: '{current_message}' (New conversation)"
        
        context_parts = []
        for msg in last_messages:
            role = "User" if msg.get('role') == 'user' else "MindMitra"
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
        """
        2-node LangGraph workflow with internal 3-way parallelism.

        parallel_analysis_node (emotion + cultural + psych run concurrently via ThreadPoolExecutor)
              ↓
        therapist_response_agent (generates final response from all 3 analyses)
        """
        workflow = StateGraph(dict)

        workflow.add_node("parallel_analysis_node", self.parallel_analysis_node)
        workflow.add_node("therapist_response_agent", self.therapist_response_agent)

        workflow.set_entry_point("parallel_analysis_node")
        workflow.add_edge("parallel_analysis_node", "therapist_response_agent")
        workflow.add_edge("therapist_response_agent", END)

        return workflow.compile()
    
    def process_chat(
        self, 
        user_message: str, 
        recent_messages: Optional[List] = None,
        conversation_summary: Optional[Dict] = None,
        user_activities: Optional[List] = None,
        user_patterns: Optional[Dict] = None,
        voice_analysis: Optional[Dict] = None,
        user_id: str = "anonymous",
        session_id: str = None
    ) -> Dict[str, Any]:
        """Process chat with 4-agent parallel workflow (emotion + cultural + psych + therapist)"""
        
        # Initialize with defaults
        recent_messages = recent_messages or []
        user_activities = user_activities or []
        conversation_summary = conversation_summary or {}
        user_patterns = user_patterns or {}
        voice_analysis = voice_analysis or {}  # Default to empty dict
        
        # Log voice analysis if available
        if voice_analysis:
            logger.info(f"🎤 Voice analysis received: {voice_analysis.get('emotional_tone', 'unknown')} tone, {voice_analysis.get('stress_level', 'unknown')} stress")

        # Check if background summarization should be triggered (before invoking workflow)
        will_summarize = self._should_trigger_background_summarization(user_id, recent_messages)
        if will_summarize:
            threading.Thread(
                target=self._background_summarization,
                args=(user_id, recent_messages, conversation_summary, {}),
                daemon=True
            ).start()
            # Note: currently disabled at prototype stage to save tokens — thread starts but pass
            pass

        # Create initial state for 4-agent parallel workflow
        initial_state = {
            "user_id": user_id,
            "session_id": session_id,
            "user_message": user_message.strip(),
            "recent_messages": recent_messages,
            "conversation_summary": conversation_summary,
            "user_activities": user_activities,
            "user_patterns": user_patterns,
            "voice_analysis": voice_analysis,
            "emotion_analysis": {},
            "cultural_context": {},
            "psychological_analysis": {},
            "ai_response": "",
            "response_generated": False
        }

        try:
            logger.info(f"🚀 Starting 4-agent parallel workflow for user: {user_id}")
            start_time = datetime.now()

            final_state = self.workflow.invoke(initial_state)

            processing_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ 4-agent parallel workflow completed in {processing_time:.2f} seconds")

            response = final_state.get("ai_response", "")
            if not response.strip():
                raise ValueError("Workflow completed but no ai_response generated")

            emotion_analysis = final_state.get("emotion_analysis", {})
            cultural_context = final_state.get("cultural_context", {})
            psychological_analysis = final_state.get("psychological_analysis", {})
            therapeutic_approach = psychological_analysis.get("therapeutic_approach", "Person-centered")

            logger.info(f"🧠 Response ready — approach: {therapeutic_approach}, emotion: {emotion_analysis.get('primary_emotion', 'unknown')}")

            return {
                "message": response,
                "modality": therapeutic_approach,
                "confidence": 0.9,
                "processing_time": processing_time,
                "session_insights": {
                    # From Emotion Agent
                    "emotional_state": emotion_analysis.get("primary_emotion", ""),
                    "emotion_intensity": emotion_analysis.get("emotion_intensity", ""),
                    "emotional_triggers": emotion_analysis.get("emotional_triggers", []),
                    "sentiment_valence": emotion_analysis.get("sentiment_valence", ""),
                    # From Cultural Agent
                    "cultural_pressures": cultural_context.get("cultural_stressors", []),
                    "language_style": cultural_context.get("language_register", ""),
                    "response_tone": cultural_context.get("response_tone_guidance", ""),
                    "cultural_strengths": cultural_context.get("cultural_strengths", ""),
                    # From Psychological Agent
                    "stress_categories": psychological_analysis.get("stress_categories", []),
                    "therapeutic_approach": psychological_analysis.get("therapeutic_approach", ""),
                    "coping_assessment": psychological_analysis.get("coping_assessment", ""),
                    "intervention_priority": psychological_analysis.get("intervention_priority", ""),
                    "key_insight": psychological_analysis.get("key_insight", ""),
                    "activity_recommendations": [psychological_analysis.get("activity_recommendation", "")],
                    # Performance metrics
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
            logger.error(f"❌ 4-agent parallel workflow failed: {e}")
            raise e

# Global workflow instance
_workflow_instance = None

def get_workflow_instance() -> MindMitraWorkflow:
    """Get or create 4-agent parallel workflow instance"""
    global _workflow_instance
    if _workflow_instance is None:
        _workflow_instance = MindMitraWorkflow()
    return _workflow_instance

def process_user_chat(
    user_message: str,
    recent_messages: Optional[List] = None,
    conversation_summary: Optional[Dict] = None,
    user_activities: Optional[List] = None,
    user_patterns: Optional[Dict] = None,
    voice_analysis: Optional[Dict] = None,
    user_id: str = "anonymous",
    session_id: str = None
) -> Dict[str, Any]:
    """Main entry point for 4-agent parallel chat processing"""
    
    logger.info("🚀 [ENTRY] MindMitra chat processing initiated")
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
        raise e# Deployment timestamp: Wed Feb  4 03:57:34 IST 2026
