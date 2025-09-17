from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging
from workflow import process_user_chat

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MindMate Chatbot Agent", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    user_message: str
    recent_messages: Optional[List[Dict[str, Any]]] = []
    conversation_summary: Optional[Dict[str, Any]] = {}
    user_activities: Optional[List[Dict[str, Any]]] = []
    user_patterns: Optional[Dict[str, Any]] = {}
    voice_analysis: Optional[Dict[str, Any]] = {}  # Add voice analysis support
    user_id: Optional[str] = "anonymous"
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    modality: str
    confidence: float
    session_insights: Optional[Dict[str, Any]] = None

@app.get("/")
async def root():
    return {"message": "MindMate Chatbot Agent is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "mindmate-agent"}

@app.post("/chat")
async def process_chat(request: ChatRequest):
    try:
        logger.info(f"🚀 [MAIN] Processing chat request for user: {request.user_id}")
        logger.info(f"📊 [MAIN] Context received:")
        logger.info(f"  - User activities: {len(request.user_activities or [])}")
        logger.info(f"  - Recent messages: {len(request.recent_messages or [])}")
        logger.info(f"  - Voice analysis: {'✅ Provided' if request.voice_analysis else '❌ Not provided'}")
        
        if request.voice_analysis:
            logger.info(f"🎤 [MAIN] Voice analysis details:")
            logger.info(f"  - Emotional tone: {request.voice_analysis.get('emotional_tone', 'unknown')}")
            logger.info(f"  - Stress level: {request.voice_analysis.get('stress_level', 'unknown')}")
            logger.info(f"  - Confidence score: {request.voice_analysis.get('confidence_score', 'unknown')}")
        
        # Process with the workflow including voice analysis
        result = process_user_chat(
            user_message=request.user_message,
            recent_messages=request.recent_messages or [],
            conversation_summary=request.conversation_summary or {},
            user_activities=request.user_activities or [],
            user_patterns=request.user_patterns or {},
            voice_analysis=request.voice_analysis or {},  # Pass voice analysis
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        logger.info(f"✅ [MAIN] Chat processing completed successfully")
        logger.info(f"📝 [MAIN] Response length: {len(result.get('message', ''))} characters")
        return result
        
    except Exception as e:
        logger.error(f"❌ [MAIN] Error processing chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")