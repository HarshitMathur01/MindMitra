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
4. **Quiet noise** — third-party libraries (httpx, qdrant_client, …)
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
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, Iterator, Mapping, Optional

from .config import config


# ── Correlation ids ──────────────────────────────────────────────────────────
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")
session_id_var: ContextVar[str] = ContextVar("session_id", default="-")
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="-")

RESET = "\033[0m"
DIM = "\033[2m"
BOLD = "\033[1m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
WHITE = "\033[37m"
GREEN = "\033[32m"
ORANGE = "\033[38;5;208m"
RED_BOLD = "\033[1;31m"

LAYER_META: Dict[str, tuple[str, str]] = {
    "ingestion": ("🧼 INGESTION", CYAN),
    "signal": ("🟡 SIGNAL", YELLOW),
    "crisis": ("🚨 CRISIS", RED_BOLD),
    "orchestrator": ("🔵 ORCHESTRATOR", BLUE),
    "memory": ("🧠 MEMORY", MAGENTA),
    "prompt": ("📄 PROMPT", WHITE),
    "llm": ("🟢 LLM", GREEN),
    "safety": ("🟠 SAFETY", ORANGE),
    "delivery": ("✅ DELIVERY", BOLD + GREEN),
    "session_end": ("🧾 SESSION_END", DIM),
    "startup": ("🚀 STARTUP", BOLD + BLUE),
    "auth": ("🔐 AUTH", BLUE),
    "ws": ("🔌 WS", GREEN),
    "http": ("🌐 HTTP", WHITE),
    "app": ("⚙️ APP", WHITE),
}

RESERVED_RECORD_KEYS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "message", "asctime", "taskName",
}

# Dev terminals should answer: what happened, where, how slow, and did it fall
# back? Correlation ids remain in ContextVars/JSON logs, but are hidden by
# default because they made every line hard to scan locally.
DEV_FIELD_ORDER = (
    "method", "path", "status_code", "duration_ms",
    "stage", "outcome", "latency_ms", "total_ms", "startup_ms", "TTFT_ms",
    "llm", "model", "providers", "tokens", "total_tokens", "prompt_tokens",
    "completion_tokens", "finish", "mode", "previous_mode", "urgency",
    "source", "response_source", "fallback_chain", "fallback", "retries",
    "conformance", "conformance_score", "harm", "syco", "memory_retrieved",
    "retrieved", "episodic", "semantic", "response_len", "len", "lang",
    "pii", "code_mix", "max_tokens", "timeout_s", "exception_type", "error",
    "reason", "consequence",
)
DEV_FIELD_ALLOWLIST = set(DEV_FIELD_ORDER)
DEV_FIELD_DENYLIST = {
    "session", "session_id", "user", "user_id", "trace", "trace_id",
    "request_id", "taskName", "auth_uuid", "remote", "cache_key",
    "prompt_version_hash", "hash", "blocks", "blocks_used", "key_prefixes",
    "aliases", "urgency_history", "safety_check_result", "extra",
}


def short_id(value: Any) -> str:
    """Return the first 8 characters of an identifier, or ``-``."""
    if value is None:
        return "-"
    text = str(value)
    if not text or text == "-":
        return "-"
    return text[:8]


def _format_value(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.2f}"
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(_format_value(v) for v in value) + "]"
    if isinstance(value, dict):
        return json.dumps(value, default=str, ensure_ascii=False, separators=(",", ":"))
    text = str(value)
    if " " in text:
        return json.dumps(text, ensure_ascii=False)
    return text


def log_context(*, session_id: Any = None, user_id: Any = None, trace_id: Any = None, layer: Optional[str] = None, **fields: Any) -> Dict[str, Any]:
    """Build a safe ``extra`` mapping for logger calls."""
    extra: Dict[str, Any] = dict(fields)
    if session_id is not None:
        extra["session_id"] = short_id(session_id)
    if user_id is not None:
        extra["user_id"] = short_id(user_id)
    if trace_id is not None:
        extra["trace_id"] = short_id(trace_id)
    if layer is not None:
        extra["layer"] = layer
    return extra


class MHALoggerAdapter(logging.LoggerAdapter):
    """Binds a default layer while preserving per-call extras."""

    def process(self, msg: Any, kwargs: Dict[str, Any]) -> tuple[Any, Dict[str, Any]]:
        supplied = kwargs.pop("extra", None) or {}
        merged = dict(self.extra)
        merged.update(supplied)
        kwargs["extra"] = merged
        return msg, kwargs


def get_logger(name: str, *, layer: Optional[str] = None) -> logging.LoggerAdapter:
    """Return a module logger with an inferred MHA layer."""
    return MHALoggerAdapter(logging.getLogger(name), {"layer": layer or infer_layer(name)})


def infer_layer(name: str) -> str:
    lowered = name.lower()
    if "ingestion" in lowered:
        return "ingestion"
    if "signal_extraction" in lowered:
        return "signal"
    if "crisis" in lowered:
        return "crisis"
    if "orchestrator" in lowered:
        return "orchestrator"
    if "memory_retrieval" in lowered or ".memory." in lowered:
        return "memory"
    if "prompt_builder" in lowered or ".prompts" in lowered:
        return "prompt"
    if "llm_core" in lowered:
        return "llm"
    if "safety_gate" in lowered:
        return "safety"
    if "chat_ws" in lowered:
        return "delivery"
    if "session_end" in lowered:
        return "session_end"
    if ".auth" in lowered:
        return "auth"
    if lowered.endswith(".main"):
        return "startup"
    return "app"


# ── Formatter ────────────────────────────────────────────────────────────────
class CustomFormatter(logging.Formatter):
    """Dev colored formatter or JSON formatter."""

    LEVEL_COLORS = {
        "DEBUG": DIM,
        "INFO": WHITE,
        "WARNING": YELLOW,
        "ERROR": RED_BOLD,
        "CRITICAL": RED_BOLD,
    }

    def __init__(self, use_json: bool = False, use_color: bool = True) -> None:
        super().__init__()
        self.use_json = use_json
        self.use_color = use_color
        self.verbose_context = config.get_bool("logging.verbose_context", False, env="LOG_VERBOSE_CONTEXT")

    def format(self, record: logging.LogRecord) -> str:
        layer = getattr(record, "layer", None) or infer_layer(record.name)
        user_id = short_id(getattr(record, "user_id", None) or user_id_var.get())
        session_id = short_id(getattr(record, "session_id", None) or session_id_var.get())
        trace_id = short_id(getattr(record, "trace_id", None) or trace_id_var.get())
        fields = self._fields(record)
        fields.pop("layer", None)
        fields.pop("user_id", None)
        fields.pop("session_id", None)
        fields.pop("trace_id", None)
        structured = {"session": session_id, "user": user_id, "trace": trace_id, **fields}

        if self.use_json:
            payload: Dict[str, Any] = {
                "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "layer": layer,
                "logger": record.name,
                "message": record.getMessage(),
                "request_id": short_id(request_id_var.get()),
                "user_id": user_id,
                "session_id": session_id,
                "trace_id": trace_id,
                "fields": structured,
                "location": f"{record.filename}:{record.lineno}",
            }
            if record.exc_info:
                payload["exception"] = self.formatException(record.exc_info)
            return json.dumps(payload, default=str)

        ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        layer_label, layer_color = LAYER_META.get(layer, (layer.upper(), WHITE))
        level = f"{record.levelname:<5}"
        display_fields = self._display_fields(structured, record)
        extras_str = " ".join(f"{k}={_format_value(v)}" for k, v in display_fields.items())
        if extras_str:
            extras_str = " | " + extras_str

        if self.use_color:
            level = f"{self.LEVEL_COLORS.get(record.levelname, WHITE)}{level}{RESET}"
            layer_label = f"{layer_color}{layer_label}{RESET}"
            extras_str = f"{DIM}{extras_str}{RESET}" if extras_str else ""

        line = f"[{ts}] {level} [{layer_label}] {record.getMessage()}{extras_str}"
        if record.exc_info:
            line += f"\n{RED_BOLD if self.use_color else ''}{self.formatException(record.exc_info)}{RESET if self.use_color else ''}"
        return line

    def _display_fields(self, fields: Dict[str, Any], record: logging.LogRecord) -> Dict[str, Any]:
        if self.verbose_context:
            return {k: v for k, v in fields.items() if k not in {"taskName"}}

        visible: Dict[str, Any] = {}
        for key in DEV_FIELD_ORDER:
            if key in fields and key not in DEV_FIELD_DENYLIST:
                visible[key] = fields[key]

        if record.levelno >= logging.WARNING:
            for key in ("exception_type", "error", "reason", "consequence", "status_code"):
                if key in fields and key not in visible:
                    visible[key] = fields[key]

        for key, value in fields.items():
            if key in visible or key in DEV_FIELD_DENYLIST:
                continue
            if key in DEV_FIELD_ALLOWLIST:
                visible[key] = value
        return visible

    def _fields(self, record: logging.LogRecord) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        metrics = getattr(record, "metrics", None)
        if isinstance(metrics, Mapping):
            out.update(metrics)
        for key, value in record.__dict__.items():
            if key in RESERVED_RECORD_KEYS or key == "metrics" or key.startswith("_"):
                continue
            out[key] = value
        return out


# ── Configuration ────────────────────────────────────────────────────────────
def configure_logging() -> None:
    """Install the `CustomFormatter` on the root logger and quiet noisy libs.

    Idempotent — calling it twice is safe (handlers are reset on each call).
    """
    log_level_str = config.get_str("logging.level", "INFO", env="LOG_LEVEL").upper()
    level = getattr(logging, log_level_str, logging.INFO)
    log_format = config.get_str("logging.format", "dev", env="LOG_FORMAT").lower()
    use_json = log_format == "json"
    use_color = log_format in {"dev", "colored", "color", ""}

    root = logging.getLogger()
    if root.handlers:
        root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(CustomFormatter(use_json=use_json, use_color=use_color))
    root.addHandler(handler)
    root.setLevel(level)

    # Pin third-party loggers to WARNING so they don't drown out our signal.
    noisy = (
        "httpx",
        "httpcore",
        "urllib3",
        "qdrant_client",
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

    get_logger("app.core.logging", layer="startup").info(
        "logging ready",
        extra=log_context(format="json" if use_json else "dev", level=log_level_str),
    )


# ── Banner / stage helpers ──────────────────────────────────────────────────
_BANNER_BAR = "═" * 70
_RULE = "─" * 70


def log_banner(
    title: str,
    lines: Optional[Iterable[str]] = None,
    *,
    logger: Optional[logging.Logger] = None,
    layer: str = "app",
    **fields: Any,
) -> None:
    """Multi-line banner used for boot and big lifecycle events.

    Renders as::

        ══════════════════════════════════════════════════════════════════════
          🚀 MindMitra v2 — booting
          PORT          : 8000
          MITRA_STACK   : ON
        ══════════════════════════════════════════════════════════════════════
    """
    log = logger or get_logger("app", layer=layer)
    extra = log_context(layer=layer, **fields)
    log.info(_BANNER_BAR, extra=extra)
    log.info(f"  {title}", extra=extra)
    for line in (lines or []):
        log.info(f"  {line}", extra=extra)
    log.info(_BANNER_BAR, extra=extra)


def log_stage(stage: str, **extras: Any) -> None:
    """One-line, scannable stage marker.

    Renders as::

        ── STAGE  classify_intent  intent=vent | confidence=0.91 | dur_ms=42
    """
    pairs = " | ".join(f"{k}={v}" for k, v in extras.items())
    msg = f"── STAGE  {stage}"
    if pairs:
        msg = f"{msg}  {pairs}"
    get_logger("app.pipeline").info(msg, extra=extras)


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
    user_token = user_id_var.set(short_id(user_id)) if user_id else None
    session_token = session_id_var.set(short_id(session_id)) if session_id else None
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
    log = get_logger("app.timing")
    start = time.perf_counter()
    log.debug(f"start {action}", extra=extras)
    try:
        yield
    except Exception:
        elapsed = (time.perf_counter() - start) * 1000
        extras["duration_ms"] = round(elapsed, 2)
        log.exception(f"{action} failed", extra=extras)
        raise
    else:
        elapsed = (time.perf_counter() - start) * 1000
        extras["duration_ms"] = round(elapsed, 2)
        log.info(f"{action} complete", extra=extras)


