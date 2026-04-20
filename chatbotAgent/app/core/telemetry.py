"""
Telemetry — per-component spans + an SLO budget table.

Goals:
    1. Per-stage spans (classifier, crisis_detect, retrieve, assemble, generate,
       critic) emitted as OpenTelemetry spans IF the package is installed.
       Otherwise we degrade to a no-op context manager so production never
       crashes for a missing dependency.
    2. A small SLO budget table that lets every stage report how close it is
       to the latency target. Breaches are logged at WARNING and tagged on
       the span, but never block the pipeline.
    3. A `latency_audit` helper the orchestrator calls once per turn with the
       full timings dict — emits a single per-turn summary log line that's
       easy to ship to Logstash / Loki / Datadog.

Usage:
    from app.core.telemetry import span, slo_check, latency_audit

    with span("retrieve", attrs={"user_id": uid}):
        ctx = await retriever.fetch(...)

    slo_check("retrieve", elapsed_ms=ms)

    latency_audit(timings_ms={"classify_ms": 30, "retrieve_ms": 240, ...})

The OpenTelemetry hookup is intentionally deferred to a single
`init_telemetry()` call (called from `app.main` if OTEL_SERVICE_NAME is set).
We do NOT auto-init at import time — that would slow cold starts.
"""
from __future__ import annotations

import contextlib
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Iterator, Optional

logger = logging.getLogger(__name__)


# ── SLO budget (ms) ─────────────────────────────────────────────────────────
#
# These targets reflect the architecture plan's latency SLO table. They are
# *p95 budgets per stage* — we treat any single turn that breaches them as a
# regression signal worth logging. They are intentionally conservative for
# cold-cache behaviour; warm-cache numbers should be 30–50% lower.

@dataclass(frozen=True)
class StageSLO:
    name: str
    p95_ms: int
    notes: str = ""


SLOS: Dict[str, StageSLO] = {
    # Classification = local sklearn-or-rules; near-instant.
    "classify": StageSLO("classify", 80, "intent + safety classification"),

    # Crisis detector = lexical + optional confirmer call. We measure the
    # whole two-stage flow including the confirmer LLM hop.
    "crisis": StageSLO("crisis", 350, "lexical + LLM confirmer (ambiguous only)"),

    # Retrieval = identity card + episodic vector search + affect + prefs.
    # 250ms is the deadline the retriever already enforces.
    "retrieve": StageSLO("retrieve", 250, "five-track parallel fetch"),

    # Prompt assembly = pure CPU work. Should be effectively free.
    "assemble": StageSLO("assemble", 30, "callback budget + stance addendum"),

    # Generation — Track A only. The dual-track Track B has its own budget.
    "generate": StageSLO("generate", 1500, "fast listener (Track A) end-to-end"),

    # Track B is allowed to run longer; it never blocks Track A streaming.
    "track_b": StageSLO("track_b", 1800, "parallel deeper synthesis"),

    # Critic — pure CPU regex/rules + optional small LLM (we count rules only).
    "critic": StageSLO("critic", 80, "rule-based + stance compliance"),

    # Whole turn end-to-end (TTFT not TTLT — first audible token).
    "total_ttft": StageSLO("total_ttft", 400, "time-to-first-token"),
    "total": StageSLO("total", 2200, "end-to-end turn (incl. critic + persistence)"),
}


def slo_for(stage: str) -> Optional[StageSLO]:
    return SLOS.get(stage)


# ── OpenTelemetry hookup (lazy) ─────────────────────────────────────────────

_OTEL_TRACER = None
_OTEL_INITIALISED = False


def init_telemetry(service_name: Optional[str] = None) -> None:
    """Idempotently initialise OpenTelemetry tracing if the SDK is available.

    Reads `OTEL_SERVICE_NAME` from env if `service_name` not passed.
    Does nothing if `opentelemetry-api` is not importable; the rest of the
    pipeline still works (spans become no-ops).
    """
    global _OTEL_TRACER, _OTEL_INITIALISED
    if _OTEL_INITIALISED:
        return
    _OTEL_INITIALISED = True

    name = service_name or os.getenv("OTEL_SERVICE_NAME") or "mindmitra"
    try:
        from opentelemetry import trace  # type: ignore
        _OTEL_TRACER = trace.get_tracer(name)
        logger.info("telemetry: opentelemetry tracer initialised (service=%s)", name)
    except Exception as exc:  # noqa: BLE001
        logger.info("telemetry: opentelemetry not available (%s); spans will no-op", exc)
        _OTEL_TRACER = None


@contextlib.contextmanager
def span(name: str, *, attrs: Optional[Dict[str, Any]] = None) -> Iterator[None]:
    """Context manager that opens an OTel span if the tracer is available,
    else acts as a transparent no-op. Always safe to use.
    """
    if _OTEL_TRACER is None:
        # Lazy init on first use (e.g. when init_telemetry was never called).
        init_telemetry()

    if _OTEL_TRACER is None:
        yield
        return

    with _OTEL_TRACER.start_as_current_span(name) as sp:  # type: ignore[union-attr]
        if attrs:
            for k, v in attrs.items():
                try:
                    sp.set_attribute(k, v)
                except Exception:  # noqa: BLE001
                    pass
        yield


# ── SLO checks + per-turn audit ─────────────────────────────────────────────

def slo_check(stage: str, *, elapsed_ms: float) -> bool:
    """Return True if within budget; log a WARN and return False otherwise.

    Always non-blocking — we never fail a turn for a budget breach. Visibility
    is the whole point.
    """
    slo = slo_for(stage)
    if slo is None or elapsed_ms <= slo.p95_ms:
        return True
    logger.warning(
        "slo_breach stage=%s elapsed_ms=%.1f budget_ms=%d (%s)",
        stage, elapsed_ms, slo.p95_ms, slo.notes,
    )
    return False


def latency_audit(*, timings_ms: Dict[str, float],
                  user_id: Optional[str] = None,
                  session_id: Optional[str] = None) -> Dict[str, Any]:
    """Emit a single per-turn summary log line and return a structured report
    that can be persisted to the trace table.

    The report flags every stage that breached its SLO so we can build a
    latency dashboard from a single field instead of joining timing columns.
    """
    breaches = []
    for stage, slo in SLOS.items():
        # Match either bare stage key or "<stage>_ms" for convenience.
        ms = (
            timings_ms.get(stage)
            if stage in timings_ms
            else timings_ms.get(f"{stage}_ms")
        )
        if ms is None:
            continue
        if ms > slo.p95_ms:
            breaches.append({"stage": stage, "elapsed_ms": float(ms),
                             "budget_ms": slo.p95_ms})

    report = {
        "timings_ms": dict(timings_ms),
        "breaches": breaches,
        "user_id": user_id,
        "session_id": session_id,
    }
    if breaches:
        logger.warning("latency_audit breaches=%d %s", len(breaches), breaches)
    else:
        logger.debug("latency_audit ok %s", timings_ms)
    return report
