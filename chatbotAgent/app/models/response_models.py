"""Pydantic response models for MindMitra API endpoints."""
from typing import Any, Dict, Optional
from pydantic import BaseModel


class ChatResponse(BaseModel):
    message: str
    animation: Optional[str] = "Idle"        # Avatar animation name
    facial_expression: Optional[str] = "default"  # Sentiment-based expression
    modality: str
    confidence: float
    session_insights: Optional[Dict[str, Any]] = None
