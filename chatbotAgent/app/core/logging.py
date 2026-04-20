"""
app.core.logging — production-grade logging for MindMitra.

Goals
=====
1. **Visibility**  — every major backend activity is announced with a clear
   tag, an emoji, and a request-id prefix so an engineer can read the terminal
   linearly and follow what the server did for one HTTP request.
2. **Correlation** — a per-request UUID is set on `request_id_var` by the
   FastAPI middleware and printed with every log line. Background threads
   created with `spawn_correlated_thread` inherit that id automatically.
3. **Structure** — when `LOG_FORMAT=json` we emit one JSON object per line so
   the same code works in dev, staging, and Railway.
4. **Quiet noise** — third-party libraries (httpx, qdrant_client, mem0, …)
   are pinned to WARNING so the chat-turn signal is not drowned by chatter.

Public API
----------
* `configure_logging()`           — call once at process start.
* `request_id_var`                — ContextVar holding the current request id.
* `bind_request_context(req_id)`  — context manager that sets/unsets it.
* `log_timing(action, **extras)`  — context manager that times a block.
* `log_stage(stage, **extras)`    — short banner-style INFO log.
* `log_banner(title, lines)`      — multi-line INFO banner for boot / pipeline.
* `spawn_correlated_thread(...)`  — `threading.Thread` that inherits req-id.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, Iterator, Optional


# ── Correlation ids ──────────────────────────────────────────────────────────
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")
session_id_var: ContextVar[str] = ContextVar("session_id", default="-")


# ── Formatter ────────────────────────────────────────────────────────────────
class CustomFormatter(logging.Formatter):
    """Colored console formatter (default) or JSON formatter (LOG_FORMAT=json).

    Console layout (one line per record):

        HH:MM:SS.mmm | LEVEL    | [reqid8] file:line - message  (k=v | k=v)
    """

    COLORS = {
        "DEBUG": "\033[36m",       # cyan
        "INFO": "\033[32m",        # green
        "WARNING": "\033[33m",     # yellow
        "ERROR": "\033[31m",       # red
        "CRITICAL": "\033[41;37m", # white on red
    }
    RESET = "\033[0m"
    DIM = "\033[90m"

    def __init__(self, use_json: bool = False) -> None:
        super().__init__()
        self.use_json = use_json

    def format(self, record: logging.LogRecord) -> str:
        req_id = request_id_var.get()
        user_id = user_id_var.get()
        session_id = session_id_var.get()
        extras: Dict[str, Any] = getattr(record, "metrics", {}) or {}

        if self.use_json:
            payload: Dict[str, Any] = {
                "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
                "request_id": req_id,
                "user_id": user_id,
                "session_id": session_id,
                "loc": f"{record.filename}:{record.lineno}",
            }
            if extras:
                payload["extras"] = extras
            if record.exc_info:
                payload["exception"] = self.formatException(record.exc_info)
            return json.dumps(payload, default=str)

        # Console branch
        color = self.COLORS.get(record.levelname, self.RESET)
        ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S.%f")[:-3]
        prefix = f"[{req_id[:8]}] " if req_id != "-" else ""
        loc = f"{record.filename}:{record.lineno}"

        extras_str = ""
        if extras:
            pairs = [f"{k}={v}" for k, v in extras.items()]
            extras_str = f" {self.DIM}({' | '.join(pairs)}){self.RESET}"

        line = (
            f"{self.DIM}{ts}{self.RESET} | {color}{record.levelname:<8}{self.RESET} | "
            f"{prefix}{self.DIM}{loc:<28}{self.RESET} - {color}{record.getMessage()}{self.RESET}{extras_str}"
        )
        if record.exc_info:
            line += f"\n{color}{self.formatException(record.exc_info)}{self.RESET}"
        return line


# ── Configuration ────────────────────────────────────────────────────────────
def configure_logging() -> None:
    """Install the `CustomFormatter` on the root logger and quiet noisy libs.

    Idempotent — calling it twice is safe (handlers are reset on each call).
    """
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, log_level_str, logging.INFO)
    use_json = os.getenv("LOG_FORMAT", "colored").lower() == "json"

    root = logging.getLogger()
    if root.handlers:
        root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(CustomFormatter(use_json=use_json))
    root.addHandler(handler)
    root.setLevel(level)

    # Pin third-party loggers to WARNING so they don't drown out our signal.
    noisy = (
        "httpx",
        "httpcore",
        "urllib3",
        "qdrant_client",
        "mem0",
        "openai",
        "watchfiles",
        "uvicorn.access",
        "uvicorn.error",
        "fsevents",
        "google",
        "asyncio",
    )
    for n in noisy:
        lg = logging.getLogger(n)
        lg.setLevel(logging.WARNING)
        lg.handlers.clear()
        lg.propagate = True

    logging.getLogger("app").info(
        "🪵 [LOGGING] ready",
        extra={"metrics": {"format": "json" if use_json else "colored", "level": log_level_str}},
    )


# ── Banner / stage helpers ──────────────────────────────────────────────────
_BANNER_BAR = "═" * 70
_RULE = "─" * 70


def log_banner(title: str, lines: Optional[Iterable[str]] = None, *,
               logger: Optional[logging.Logger] = None) -> None:
    """Multi-line banner used for boot and big lifecycle events.

    Renders as::

        ══════════════════════════════════════════════════════════════════════
          🚀 MindMitra v2 — booting
          PORT          : 8000
          MITRA_STACK   : ON
        ══════════════════════════════════════════════════════════════════════
    """
    log = logger or logging.getLogger("app")
    log.info(_BANNER_BAR)
    log.info(f"  {title}")
    for line in (lines or []):
        log.info(f"  {line}")
    log.info(_BANNER_BAR)


def log_stage(stage: str, **extras: Any) -> None:
    """One-line, scannable stage marker.

    Renders as::

        ── STAGE  classify_intent  intent=vent | confidence=0.91 | dur_ms=42
    """
    pairs = " | ".join(f"{k}={v}" for k, v in extras.items())
    msg = f"── STAGE  {stage}"
    if pairs:
        msg = f"{msg}  {pairs}"
    logging.getLogger("app.pipeline").info(msg)


# ── Context binders ─────────────────────────────────────────────────────────
@contextmanager
def bind_request_context(
    request_id: Optional[str] = None,
    *,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Iterator[str]:
    """Set request/user/session ids on the current ContextVar scope.

    Usage::

        with bind_request_context(req_id, user_id=u, session_id=s):
            await do_work()
    """
    rid = request_id or str(uuid.uuid4())
    rid_token = request_id_var.set(rid)
    user_token = user_id_var.set(user_id) if user_id else None
    session_token = session_id_var.set(session_id) if session_id else None
    try:
        yield rid
    finally:
        request_id_var.reset(rid_token)
        if user_token is not None:
            user_id_var.reset(user_token)
        if session_token is not None:
            session_id_var.reset(session_token)


def spawn_correlated_thread(
    target: Callable[..., Any],
    *,
    args: tuple = (),
    kwargs: Optional[Dict[str, Any]] = None,
    name: Optional[str] = None,
    daemon: bool = True,
) -> threading.Thread:
    """`threading.Thread` whose target inherits the current ContextVar scope.

    Use this for any background work spawned from inside a request so the
    request id keeps appearing in the logs.
    """
    ctx = copy_context()
    kwargs = kwargs or {}

    def _runner() -> None:
        ctx.run(target, *args, **kwargs)

    t = threading.Thread(target=_runner, name=name, daemon=daemon)
    t.start()
    return t


# ── Timing context manager ──────────────────────────────────────────────────
@contextmanager
def log_timing(action: str, **extras: Any) -> Iterator[None]:
    """Log start/end of a block with a duration in ms.

    Logs nothing on `start` at INFO (only at DEBUG) so the terminal stays
    readable; the END line carries `duration_ms` so you always see how long
    each stage took.
    """
    log = logging.getLogger("app.timing")
    start = time.perf_counter()
    log.debug(f"▶  {action}", extra={"metrics": extras})
    try:
        yield
    except Exception:
        elapsed = (time.perf_counter() - start) * 1000
        extras["duration_ms"] = round(elapsed, 2)
        log.exception(f"❌ {action} failed after {elapsed:.0f}ms", extra={"metrics": extras})
        raise
    else:
        elapsed = (time.perf_counter() - start) * 1000
        extras["duration_ms"] = round(elapsed, 2)
        log.info(f"⏱  {action} done in {elapsed:.0f}ms", extra={"metrics": extras})
