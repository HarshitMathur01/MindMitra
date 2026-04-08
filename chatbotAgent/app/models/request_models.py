"""Pydantic request models for MindMitra API endpoints."""
from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel

SupportedLanguage = Literal[
    "english", "hindi", "hinglish",
    "japanese", "telugu", "kannada", "tamil",
]


class ChatRequest(BaseModel):
    user_message: str
    session_id: Optional[str] = None
    voice_analysis: Optional[Dict[str, Any]] = None
    audio_data: Optional[str] = None
    avatar_visible: bool = True
    personality: Optional[str] = None
    companion_name: Optional[str] = None
    language: Optional[SupportedLanguage] = None
