"""
Health routes — registered first so Railway startup checks pass immediately.
"""
import logging
import os

from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "MindMitra Chatbot Agent",
        "version": "2.0.0",
    }


@router.get("/")
async def root():
    return {
        "message": "MindMitra Chatbot Agent v2 is running",
        "docs": "/docs",
        "health": "/health",
    }
