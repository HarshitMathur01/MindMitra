from pydantic import BaseModel
from typing import Any, List, Dict

class ChatRequest(BaseModel):
    user_message: str
    session_data: Dict[str, Any]
    conversation_history: List[Dict[str, Any]] = []

class ChatResponse(BaseModel):
    message: str
    status: str = "success"