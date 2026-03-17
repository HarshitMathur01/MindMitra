"""
Centralized logging configuration — import once at startup to configure all loggers.

Format: HH:MM:SS L <message>  (L = single-char level: D/I/W/E/C)
Third-party HTTP, LLM SDK, and vector-store loggers are silenced to WARNING+
so the terminal only shows application-level logs.
"""
import logging
import os


# ── Third-party loggers to silence (set to WARNING) ──────────────────────────
_NOISY_LOGGERS = [
    # HTTP clients
    "httpx",
    "httpcore",
    "httpcore.http11",
    "httpcore.http2",
    "httpcore.connection",
    "urllib3",
    "urllib3.connectionpool",
    # gRPC / h2
    "hpack",
    "h2",
    "grpc",
    # LLM SDKs
    "groq",
    "groq._base_client",
    "openai",
    "openai._base_client",
    "openai.http_client",
    "zhipuai",
    "zhipuai.api_resource.chat.completions",
    # Vector store & memory
    "qdrant_client",
    "qdrant_client.http",
    "qdrant_client.async_qdrant_client",
    "mem0",
    "mem0.memory",
    "mem0.utils",
    # Google / cloud
    "google",
    "google.auth",
    "google.auth.transport",
    "google.generativeai",
    # Async infrastructure
    "asyncio",
    "multipart",
    "multipart.multipart",
    "uvicorn.access",            # HTTP access log — too verbose at INFO
    "watchfiles",
    "watchfiles.main",
]


# Use a flag instead of checking handlers — handlers check is unreliable
_LOGGING_CONFIGURED = False

def configure_logging() -> None:
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return                    # ← hard exit, no duplicate runs ever
    _LOGGING_CONFIGURED = True

    # 1. Try config.yaml
    level_name = None
    try:
        from app.core.config import config as _cfg
        level_name = _cfg.get("logging.level", None)
    except Exception:
        pass

    # 2. Env var overrides
    env_level = os.getenv("LOG_LEVEL")
    if env_level:
        level_name = env_level.strip().strip('"').strip("'")  # strip quotes if any

    # 3. Fallback
    if not level_name:
        level_name = "INFO"

    level_name = str(level_name).upper()
    level = getattr(logging, level_name, logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname).1s %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )

    for name in _NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        f"✅ [LOGGING] Level={level_name} | Third-party loggers suppressed"
    )


# Auto-configure on import
configure_logging()