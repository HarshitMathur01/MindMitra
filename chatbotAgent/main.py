from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging
import os
import threading
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client, Client
from workflow import process_user_chat, get_workflow_instance
import jwt
from datetime import datetime

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MindMitra Chatbot Agent", version="1.0.0")

# In-memory message counter as fallback (survives across requests)
session_message_counters = defaultdict(int)

# # Add CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # In production, specify your domain
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
        "https://mindmitra-seven.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",  # For Vercel preview deployments
)

class ChatRequest(BaseModel):
    user_message: str
    session_id: Optional[str] = None
    voice_analysis: Optional[Dict[str, Any]] = None  # Voice analysis is optional
    # Context will be fetched by backend, not passed from frontend

class ChatResponse(BaseModel):
    message: str
    modality: str
    confidence: float
    session_insights: Optional[Dict[str, Any]] = None

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")  # SERVICE_ROLE_KEY for backend operations
supabase_client = None
if supabase_url and supabase_key:
    supabase_client = create_client(supabase_url, supabase_key)
    logger.info("✅ [MAIN] Supabase client initialized with SERVICE_ROLE_KEY")
else:
    logger.warning("⚠️ [MAIN] Supabase credentials not found - memory features disabled")

# JWT configuration for auth validation
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")  # From Supabase project settings
if not JWT_SECRET:
    logger.warning("⚠️ [MAIN] JWT_SECRET not set - will skip strict JWT validation")

def get_session_message_count(session_id: str) -> int:
    """Get total message count for a session from database"""
    if not supabase_client or not session_id:
        logger.warning(f"⚠️ [DB_COUNT] Cannot query - Supabase: {bool(supabase_client)}, Session: {session_id}")
        return 0
    
    try:
        logger.info(f"🔍 [DB_COUNT] Querying database for session: {session_id}")
        response = supabase_client.table('chat_messages').select('id', count='exact').eq('session_id', session_id).execute()
        count = response.count if hasattr(response, 'count') else len(response.data or [])
        
        logger.info(f"📊 [DB_COUNT] Database returned {count} messages for session {session_id}")
        
        if count == 0:
            logger.warning(f"⚠️ [DB_COUNT] Database has 0 messages - messages may not be saved yet")
            # Check if any messages exist at all
            try:
                total_response = supabase_client.table('chat_messages').select('id', count='exact').limit(1).execute()
                total_count = total_response.count if hasattr(total_response, 'count') else 0
                logger.info(f"📊 [DB_COUNT] Total messages in entire database: {total_count}")
            except:
                pass
        
        return count
    except Exception as e:
        logger.error(f"❌ [DB_COUNT] Error getting message count: {e}")
        return 0

def get_hybrid_message_count(session_id: str) -> int:
    """Get message count using both database and in-memory counter"""
    if not session_id:
        return 0
    
    # Try database first
    db_count = get_session_message_count(session_id)
    
    # Get in-memory count
    memory_count = session_message_counters.get(session_id, 0)
    
    logger.info(f"🔢 [HYBRID_COUNT] Session '{session_id}':")
    logger.info(f"   📊 Database count: {db_count}")
    logger.info(f"   💾 In-memory count: {memory_count}")
    
    # Use whichever is higher (database might lag or messages might not be saved)
    final_count = max(db_count, memory_count)
    logger.info(f"   ✅ Using final count: {final_count}")
    
    return final_count

async def validate_user_token(authorization: str) -> str:
    """Validate JWT token and return user_id. Raises HTTPException if invalid."""
    if not authorization:
        logger.error("❌ [AUTH] No authorization header provided")
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    if not authorization.startswith("Bearer "):
        logger.error("❌ [AUTH] Invalid authorization format")
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization.replace("Bearer ", "")
    
    # Validate using Supabase client
    if not supabase_client:
        logger.error("❌ [AUTH] Supabase client not initialized")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    try:
        # Use Supabase to validate the token
        user_response = supabase_client.auth.get_user(token)
        if not user_response or not user_response.user:
            logger.error("❌ [AUTH] Invalid token - user not found")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_id = user_response.user.id
        logger.info(f"✅ [AUTH] User authenticated: {user_id}")
        return user_id
    except Exception as e:
        logger.error(f"❌ [AUTH] Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def fetch_user_context(user_id: str, session_id: str) -> Dict[str, Any]:
    """Fetch user's activities, messages, and summaries from Supabase."""
    logger.info(f"🔍 [CONTEXT] Fetching context for user {user_id}, session {session_id}")
    
    if not supabase_client:
        logger.warning("⚠️ [CONTEXT] Supabase client not available")
        return {
            "user_activities": [],
            "recent_messages": [],
            "conversation_summary": {}
        }
    
    try:
        # Fetch user activities (last 50)
        activities_response = supabase_client.table('user_activities').select('*').eq('user_id', user_id).order('completed_at', desc=True).limit(50).execute()
        user_activities = activities_response.data or []
        logger.info(f"📊 [CONTEXT] Fetched {len(user_activities)} activities")
        
        # Fetch recent messages for this session (last 20)
        messages_response = supabase_client.table('chat_messages').select('*').eq('session_id', session_id).order('created_at', desc=True).limit(20).execute()
        recent_messages_raw = messages_response.data or []
        
        # Format messages for workflow
        recent_messages = []
        for msg in reversed(recent_messages_raw):  # Reverse to get chronological order
            recent_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        logger.info(f"💬 [CONTEXT] Fetched {len(recent_messages)} messages")
        
        # Fetch conversation summary
        summary_response = supabase_client.table('message_summaries').select('*').eq('session_id', session_id).order('created_at', desc=True).limit(1).execute()
        
        conversation_summary = {}
        if summary_response.data:
            summary_data = summary_response.data[0]
            conversation_summary = {
                "summary": summary_data.get("summary", ""),
                "key_points": summary_data.get("key_points", []),
                "emotional_state": summary_data.get("emotional_state", "neutral"),
                "topics_discussed": summary_data.get("topics_discussed", [])
            }
            logger.info(f"📝 [CONTEXT] Fetched conversation summary")
        else:
            logger.info(f"📝 [CONTEXT] No summary found for session")
        
        return {
            "user_activities": user_activities,
            "recent_messages": recent_messages,
            "conversation_summary": conversation_summary
        }
    
    except Exception as e:
        logger.error(f"❌ [CONTEXT] Error fetching user context: {e}")
        return {
            "user_activities": [],
            "recent_messages": [],
            "conversation_summary": {}
        }

@app.get("/")
async def root():
    return {"message": "MindMitra Chatbot Agent is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "mindmitra-agent"}

@app.get("/debug/session/{session_id}")
async def debug_session(session_id: str):
    """Debug endpoint to check session message count"""
    try:
        db_count = get_session_message_count(session_id)
        memory_count = session_message_counters.get(session_id, 0)
        hybrid_count = get_hybrid_message_count(session_id)
        
        # Try to get recent messages
        recent_messages = []
        if supabase_client:
            try:
                response = supabase_client.table('chat_messages').select('*').eq('session_id', session_id).order('created_at', desc=True).limit(10).execute()
                recent_messages = response.data or []
            except Exception as e:
                logger.error(f"Error fetching messages: {e}")
        
        return {
            "session_id": session_id,
            "counts": {
                "database": db_count,
                "in_memory": memory_count,
                "hybrid_final": hybrid_count
            },
            "recent_messages_found": len(recent_messages),
            "next_memory_trigger": ((hybrid_count // 8) + 1) * 8,
            "messages_until_trigger": 8 - (hybrid_count % 8) if hybrid_count % 8 != 0 else 8,
            "sample_messages": [
                {
                    "role": msg.get("role"),
                    "content": msg.get("content", "")[:100],
                    "created_at": msg.get("created_at")
                } for msg in recent_messages[:3]
            ]
        }
    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        return {"error": str(e)}

@app.post("/chat")
async def process_chat(
    request: ChatRequest,
    authorization: str = Header(None)
):
    try:
        logger.info("=" * 80)
        logger.info("🚀 [MAIN] NEW CHAT REQUEST RECEIVED (DIRECT BACKEND MODE)")
        logger.info("=" * 80)
        
        # Validate authentication
        user_id = await validate_user_token(authorization)
        logger.info(f"👤 [MAIN] Authenticated User: {user_id}")
        logger.info(f"🔗 [MAIN] Session: {request.session_id}")
        logger.info(f"💬 [MAIN] Message: '{request.user_message[:150]}{'...' if len(request.user_message) > 150 else ''}'")
        
        # Fetch user context from Supabase
        context = await fetch_user_context(user_id, request.session_id)
        user_activities = context["user_activities"]
        recent_messages = context["recent_messages"]
        conversation_summary = context["conversation_summary"]
        
        # Detailed activities logging with content preview
        logger.info(f"🎮 [MAIN] User activities: {len(user_activities)} total")
        if user_activities:
            logger.info("✅ [MAIN] ✅ ✅ BACKEND HAS RECEIVED USER ACTIVITIES! ✅ ✅")
            
            # Count by type
            activity_types = {}
            for activity in user_activities:
                activity_type = activity.get('activity_type', 'unknown')
                activity_types[activity_type] = activity_types.get(activity_type, 0) + 1
            
            logger.info(f"   Activity breakdown:")
            for activity_type, count in activity_types.items():
                logger.info(f"   - {activity_type}: {count}")
            
            # Log each activity with 20-word preview
            logger.info(f"\n📋 [MAIN] Detailed Activities Content (20 words each):")
            for i, activity in enumerate(user_activities[:5], 1):  # Show first 5
                logger.info(f"\n   Activity #{i}:")
                logger.info(f"   Type: {activity.get('activity_type', 'N/A')}")
                logger.info(f"   Score: {activity.get('score', 'N/A')}")
                logger.info(f"   Duration: {activity.get('game_duration', activity.get('duration', 'N/A'))}")
                logger.info(f"   Difficulty: {activity.get('difficulty_level', 'N/A')}")
                logger.info(f"   Timestamp: {activity.get('completed_at', 'N/A')}")
                
                # Show 20 words of activity_data if available
                activity_data = activity.get('activity_data', {})
                if activity_data:
                    activity_str = str(activity_data)
                    words = activity_str.split()[:20]
                    preview = ' '.join(words)
                    logger.info(f"   📄 Content (20 words): {preview}...")
                
                # Show evaluation data if available
                evaluation_data = activity.get('evaluation_data', {})
                if evaluation_data:
                    eval_str = str(evaluation_data)
                    words = eval_str.split()[:20]
                    preview = ' '.join(words)
                    logger.info(f"   📊 Evaluation (20 words): {preview}...")
                
                # Show insights if available
                insights = activity.get('insights_generated', '')
                if insights:
                    words = str(insights).split()[:20]
                    preview = ' '.join(words)
                    logger.info(f"   💡 Insights (20 words): {preview}...")
            
            if len(user_activities) > 5:
                logger.info(f"\n   ... and {len(user_activities) - 5} more activities")
        else:
            logger.warning("⚠️ [MAIN] ❌ ❌ NO ACTIVITIES DATA RECEIVED! ❌ ❌")
            logger.warning("   Check if Edge Function is fetching activities from Supabase")
        
        logger.info(f"📝 [MAIN] Recent messages: {len(recent_messages)} messages")
        logger.info(f"🎤 [MAIN] Voice analysis: {'✅ Provided' if request.voice_analysis else '❌ Not provided'}")
        
        if request.voice_analysis:
            logger.info(f"   Voice details:")
            logger.info(f"   - Emotional tone: {request.voice_analysis.get('emotional_tone', 'N/A')}")
            logger.info(f"   - Stress level: {request.voice_analysis.get('stress_level', 'N/A')}")
        
        logger.info("=" * 80)
        
        # Process with the workflow using fetched context
        result = process_user_chat(
            user_message=request.user_message,
            recent_messages=recent_messages,
            conversation_summary=conversation_summary,
            user_activities=user_activities,
            user_patterns={},  # Can be extended later
            voice_analysis=request.voice_analysis or {},
            user_id=user_id,
            session_id=request.session_id
        )
        
        logger.info(f"✅ [MAIN] Chat processing completed successfully")
        logger.info(f"📝 [MAIN] Response length: {len(result.get('message', ''))} characters")
        
        # Trigger memory extraction every 8 messages
        if result and request.session_id:
            try:
                # Increment in-memory counter for this session
                session_message_counters[request.session_id] += 1
                logger.info(f"📈 [COUNTER] Incremented counter for session {request.session_id}")
                
                # Get hybrid count (database + in-memory fallback)
                count = get_hybrid_message_count(request.session_id)
                
                messages_until_memory = 8 - (count % 8) if count % 8 != 0 else 8
                
                logger.info("=" * 80)
                logger.info("🧠 [MEMORY TRIGGER] Memory Extraction Status")
                logger.info("=" * 80)
                logger.info(f"📊 [MEMORY] Current session message count: {count}")
                logger.info(f"🎯 [MEMORY] Memory extraction triggers every 8 messages")
                
                if count > 0 and count % 8 == 0:
                    logger.info(f"🔔 [MEMORY] ✅ ✅ TRIGGERING MEMORY EXTRACTION NOW! ✅ ✅")
                    logger.info(f"   This is message #{count} - memory extraction will run in background")
                    
                    workflow = get_workflow_instance()
                    # Run in background thread
                    threading.Thread(
                        target=workflow.trigger_memory_extraction,
                        args=(request.session_id, request.user_id),
                        daemon=True
                    ).start()
                    logger.info(f"✅ [MEMORY] Memory extraction started in background thread")
                else:
                    logger.info(f"⏳ [MEMORY] {messages_until_memory} messages remaining until next memory extraction")
                    next_milestone = ((count // 8) + 1) * 8
                    logger.info(f"   Next extraction will happen at message #{next_milestone}")
                
                logger.info("=" * 80)
            except Exception as e:
                logger.error(f"❌ [MAIN] Error checking memory extraction: {e}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ [MAIN] Error processing chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")