#!/usr/bin/env python3
from __future__ import annotations

import os
import logging
import subprocess
import sys
from pathlib import Path
from dotenv import load_dotenv

# ------------------ PATH SETUP ------------------
ROOT = Path(__file__).resolve().parent

# Robust .env loading
DOTENV_PATH = ROOT / ".env"  # <-- FIXED (same dir as script)
if DOTENV_PATH.exists():
    load_dotenv(dotenv_path=DOTENV_PATH, override=False)
    logging.info(f"Loaded .env from {DOTENV_PATH}")
else:
    logging.warning(".env not found at expected path, falling back")
    load_dotenv()

# ------------------ COLORS ------------------
_RED = "\033[31m"
_GREEN = "\033[32m"
_YELLOW = "\033[33m"
_RESET = "\033[0m"
_BOLD = "\033[1m"


def _colorize(msg: str, color: str) -> str:
    if sys.stdout.isatty() and os.getenv("NO_COLOR", "") == "":
        return f"{color}{msg}{_RESET}"
    return msg


# ------------------ SUMMARY PRINT ------------------
def _print_eval_summary(doc: dict) -> None:
    agg = doc.get("summary_metrics") or {}

    def pct(x):
        return f"{100*x:.1f}%" if x is not None else "n/a"

    def num(x):
        return f"{x:.3f}" if x is not None else "n/a"

    print("\n" + _colorize("── Evaluation summary ──", _BOLD))
    print(f"Pass rate:            {pct(agg.get('pass_rate'))}")
    print(f"Hallucination rate:   {pct(agg.get('hallucination_rate'))}")
    print(f"Avg safety score:     {num(agg.get('avg_safety_score'))}")
    print(f"Memory relevance:     {num(agg.get('avg_memory_relevance_score'))}")
    print(f"Crisis failures:      {agg.get('crisis_failure_count', 0)}")

    crit = agg.get("critical_failure_count", 0)
    if crit > 0:
        print(_colorize(f"CRITICAL failures: {crit}", _RED))
    else:
        print(_colorize("CRITICAL failures: 0", _GREEN))


# ------------------ MAIN ------------------
def main() -> int:
    os.chdir(ROOT)

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    env = os.environ.copy()
    py = sys.executable

    # 🔥 KEY FIX: Dynamic test selection
    run_integration = env.get("RUN_INTEGRATION", "0") == "1"

    if run_integration:
        print("== 1/2 Running ALL tests (unit + integration) ==")
        cmd = [py, "-m", "pytest", "tests", "-v", "--tb=short"]
    else:
        print("== 1/2 Running FAST tests only (excluding integration) ==")
        cmd = [py, "-m", "pytest", "tests", "-v", "--tb=short", "-m", "not integration"]

    print("Command:", " ".join(cmd))
    print("RUN_INTEGRATION =", env.get("RUN_INTEGRATION"))

    r1 = subprocess.run(cmd, cwd=str(ROOT), env=env)

    if r1.returncode != 0:
        print("pytest reported failures — review before trusting scores.", file=sys.stderr)

    # ------------------ EVALUATION ------------------
    print("\n== 2/2 RAG / safety HTTP evaluation ==")
    print("Requires backend running at:", env.get("EVAL_BASE_URL"))

    r2 = 0
    try:
        from tests.eval_reporting import ci_should_fail
        from tests.rag_evaluator import run_evaluation

        report_path, doc = run_evaluation()

        print(f"\nReport written: {report_path}")
        _print_eval_summary(doc)

        fail_ci, reasons = ci_should_fail(doc)
        if fail_ci:
            print(_colorize(f"CI FAIL: {', '.join(reasons)}", _RED))
            return 2

        if (doc.get("summary_metrics") or {}).get("critical_failure_count", 0) > 0:
            if os.getenv("EVAL_EXIT_ON_CRITICAL", "").lower() in ("1", "true"):
                print(_colorize("Exiting due to critical failures", _RED))
                return 3

    except Exception as e:
        print(f"Evaluation failed: {e}", file=sys.stderr)
        r2 = 1

    return 0 if (r1.returncode == 0 and r2 == 0) else 1


if __name__ == "__main__":
    raise SystemExit(main())