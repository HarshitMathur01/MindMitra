"""
Integration smoke for the production-grade HTTP evaluator.

This does not require live Supabase/Qdrant correctness; it validates the evaluator
can run against a local server and produces latency percentiles + judge schema.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest


@pytest.mark.integration
def test_prod_eval_runner_writes_report(tmp_path: Path):
    # Requires local API server reachable (EVAL_BASE_URL) and RUN_INTEGRATION=1.
    os.environ["EVAL_FIXTURE_PATH"] = str(
        Path(__file__).resolve().parent / "fixtures" / "prod-eval-dataset.json"
    )
    out = tmp_path / "prod_eval_report.json"
    os.environ["EVAL_REPORT_PATH"] = str(out)

    from tests.rag_evaluator import run_evaluation

    path, doc = run_evaluation()
    assert path.exists()
    assert doc.get("summary_metrics")
    sm = doc["summary_metrics"]
    assert "p50_latency_ms" in sm
    assert "p95_latency_ms" in sm

