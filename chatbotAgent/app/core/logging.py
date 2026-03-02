"""
Centralized logging configuration — import once at startup to configure all loggers.
"""
import logging
import os


def configure_logging() -> None:
    """Configure root logger from LOG_LEVEL env variable."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logging.getLogger(__name__).info(f"✅ [LOGGING] Log level set to {level_name}")


# Auto-configure on import (mirrors original logging_config.py behaviour)
configure_logging()
