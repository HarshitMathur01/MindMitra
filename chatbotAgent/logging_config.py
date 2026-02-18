"""
Centralized logging configuration for MindMitra
Controls DEBUG/INFO/WARNING levels via LOG_LEVEL environment variable
"""
import logging
import os

# Read log level from environment variable
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)
logger.info(f"✅ Logging configured: level={LOG_LEVEL}")
