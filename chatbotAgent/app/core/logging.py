import logging
import sys
import os
import json
import time
from datetime import datetime, timezone
from contextvars import ContextVar
from contextlib import contextmanager

# State for request tracing
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def _short_id(v: object, n: int = 12) -> str:
    s = str(v or "")
    return s[:n] if s else ""


def log_event(logger: logging.Logger, message: str, **metrics) -> None:
    """
    Standard event logger.

    - Uses `extra={"metrics": ...}` so JSON and colored formats capture fields.
    - Avoids leaking full identifiers by default (callers should pass short ids).
    """
    try:
        logger.info(message, extra={"metrics": {k: v for k, v in metrics.items() if v is not None}})
    except Exception:
        # Never let logging break the request path.
        logger.info(message)


def log_stage(logger: logging.Logger, stage: str, message: str, **metrics) -> None:
    log_event(logger, f"[{stage}] {message}", stage=stage, **metrics)


class CustomFormatter(logging.Formatter):
    """
    Production-grade JSON and Colored console formatter using pure Python.
    Features correlation IDs, microsecond precision, and aligned outputs.
    """
    COLORS = {
        "DEBUG": "\033[36m",      # Cyan
        "INFO": "\033[32m",       # Green
        "WARNING": "\033[33m",    # Yellow
        "ERROR": "\033[31m",      # Red
        "CRITICAL": "\033[41;37m",# White on Red
    }
    RESET = "\033[0m"
    DIM = "\033[90m"

    def __init__(self, use_json: bool = False):
        super().__init__()
        self.use_json = use_json

    def format(self, record: logging.LogRecord) -> str:
        req_id = request_id_var.get()
        
        # Pull any extra dict kwargs
        extra = getattr(record, "metrics", {})

        if self.use_json:
            log_data = {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
                "request_id": req_id,
                "file": f"{record.filename}:{record.lineno}",
            }
            if extra:
                log_data.update(extra)
            if record.exc_info:
                log_data["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_data)
        else:
            # Colored / readable console output
            color = self.COLORS.get(record.levelname, self.RESET)
            dt = datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            
            req_prefix = f"[{req_id[:8]}] " if req_id != "-" else ""
            caller = f"{record.filename}:{record.lineno}"
            
            extras_str = ""
            if extra:
                pairs = [f"{k}={v}" for k, v in extra.items()]
                extras_str = f" {self.DIM}({' | '.join(pairs)}){self.RESET}"

            msg = f"{self.DIM}{dt}{self.RESET} | {color}{record.levelname:<8}{self.RESET} | {req_prefix}{self.DIM}{caller:<20}{self.RESET} - {color}{record.getMessage()}{self.RESET}{extras_str}"
            
            if record.exc_info:
                msg += f"\n{color}{self.formatException(record.exc_info)}{self.RESET}"
                
            return msg

def configure_logging():
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, log_level_str, logging.INFO)
    use_json = os.getenv("LOG_FORMAT", "colored").lower() == "json"

    # Reset root handlers
    root = logging.getLogger()
    if root.handlers:
        root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(CustomFormatter(use_json=use_json))
    root.addHandler(handler)
    root.setLevel(level)

    # Silence noisy loggers
    noisy = [
        "httpx", "httpcore", "urllib3", "qdrant_client",
        "openai", "watchfiles", "uvicorn.access", "uvicorn.error", "fsevents"
    ]
    for n in noisy:
        logging.getLogger(n).setLevel(logging.WARNING)
        logging.getLogger(n).handlers.clear()

    logging.info("✅ [LOGGING] Pure Python Logging Initialized (Production Grade)", extra={"metrics": {"json": use_json, "level": log_level_str}})

@contextmanager
def log_timing(action: str, **kwargs):
    """
    Context manager to easily profile and log background/foreground tasks.
    Usage:
        with log_timing("Fetching memories", model="llama-3.1-8b"):
            ...
    """
    logger = logging.getLogger("timing")
    start = time.perf_counter()
    logger.debug(f"▶ START: {action}", extra={"metrics": kwargs})
    try:
        yield
        duration_ms = (time.perf_counter() - start) * 1000
        kwargs["duration_ms"] = round(duration_ms, 2)
        logger.info(f"⏭ END: {action} (took {duration_ms:.1f}ms)", extra={"metrics": kwargs})
    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000
        kwargs["duration_ms"] = round(duration_ms, 2)
        logger.exception(f"❌ FAIL: {action} (failed after {duration_ms:.1f}ms)", extra={"metrics": kwargs})
        raise

