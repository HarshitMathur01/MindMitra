"""
Telemetry v0 — exercise the no-op-on-missing-OTel and SLO-budget surface.

These tests guarantee:

    * `span()` works as a transparent context manager whether or not
      opentelemetry is installed (it shouldn't be in CI by default).
    * `slo_check()` returns True within budget, False on breach, and never
      raises for unknown stages.
    * `latency_audit()` flags every breach in its returned report.
"""
from __future__ import annotations

import logging

import pytest


def test_span_is_safe_without_otel():
    from app.core.telemetry import span
    with span("unit_test_span", attrs={"k": "v"}):
        # body executes; we just need no exception
        x = 1 + 1
    assert x == 2


def test_slo_check_within_budget_returns_true():
    from app.core.telemetry import slo_check, SLOS
    budget = SLOS["assemble"].p95_ms
    assert slo_check("assemble", elapsed_ms=budget - 1) is True


def test_slo_check_breach_returns_false_and_logs(caplog):
    from app.core.telemetry import slo_check, SLOS
    budget = SLOS["retrieve"].p95_ms
    caplog.set_level(logging.WARNING)
    ok = slo_check("retrieve", elapsed_ms=budget + 100)
    assert ok is False
    assert any("slo_breach" in rec.message for rec in caplog.records)


def test_slo_check_unknown_stage_is_noop():
    from app.core.telemetry import slo_check
    assert slo_check("not_a_real_stage", elapsed_ms=99999) is True


def test_latency_audit_reports_breaches():
    from app.core.telemetry import latency_audit
    report = latency_audit(timings_ms={
        "classify_ms": 5,    # ok
        "retrieve_ms": 9999,  # breach
        "generate_ms": 10,   # ok
    })
    breach_stages = {b["stage"] for b in report["breaches"]}
    assert "retrieve" in breach_stages
    assert "classify" not in breach_stages


def test_init_telemetry_idempotent():
    from app.core.telemetry import init_telemetry
    init_telemetry()
    init_telemetry()  # second call must be a noop
