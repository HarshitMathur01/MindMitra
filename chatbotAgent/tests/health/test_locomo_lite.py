"""
LOCOMO-lite eval harness — sanity check that the offline harness runs and
returns a usable summary. We don't assert exact accuracy here (the harness
itself is the contract) — only that the structure is correct and recall is
non-zero on the seeded tasks.
"""
from __future__ import annotations

import asyncio


def test_locomo_lite_runs_and_returns_summary():
    import sys
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location(
        "eval_locomo_lite",
        Path(__file__).resolve().parents[2] / "scripts" / "eval_locomo_lite.py",
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    # Register before exec so dataclass annotations can resolve types from
    # the module's own __dict__ (otherwise dataclasses.py raises AttributeError).
    sys.modules[spec.name] = mod
    try:
        spec.loader.exec_module(mod)
        summary = asyncio.run(mod.run_eval())
    finally:
        sys.modules.pop(spec.name, None)

    assert "recall_acc" in summary
    assert "p95_latency_ms" in summary
    assert isinstance(summary["tasks"], list)
    assert summary["total"] >= 1
    # At least one positive task should be matched.
    assert summary["passed"] >= 1
