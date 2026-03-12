"""Pydantic request models for MindMitra API endpoints."""
from typing import Any, Dict, Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_message: str
    session_id: Optional[str] = None
    voice_analysis: Optional[Dict[str, Any]] = None  # Voice analysis is optional
    audio_data: Optional[str] = None  # Base64-encoded WAV audio for prosodic analysis
    avatar_visible: bool = True  # Whether avatar is visible (controls TTS generation)
    # Personality settings from user preferences
    personality: Optional[str] = None  # 'mitra' | 'arjun' | 'diya' | 'riya' | 'zen' (legacy: 'calm' | 'energetic' | 'analytical')
    companion_name: Optional[str] = None  # Custom name the user chose for the AI
    language: Optional[str] = None  # 'english' | 'hindi' | 'hinglish'
