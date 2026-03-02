"""Pydantic request models for MindMitra API endpoints."""
from typing import Any, Dict, Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_message: str
    session_id: Optional[str] = None
    voice_analysis: Optional[Dict[str, Any]] = None  # Voice analysis is optional
    avatar_visible: bool = True  # Whether avatar is visible (controls TTS generation)
