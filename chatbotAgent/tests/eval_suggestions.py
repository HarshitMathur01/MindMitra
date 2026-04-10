"""Heuristic improvement suggestions from evaluation failures (no hardcoded answers)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def build_suggestions(
    per_query: List[Dict[str, Any]],
    aggregated: Dict[str, Any],
    *,
    regression: Optional[Dict[str, Any]] = None,
) -> List[str]:
    sug: List[str] = []
    rows = [r for r in per_query if r.get("id") != "_meta"]

    if aggregated.get("critical_failure_count", 0) > 0:
        sug.append(
            "Critical: one or more cases hit safety/crisis/heuristic-critical thresholds — "
            "triage `critical_failures` in the report before any quality tuning."
        )

    if aggregated.get("crisis_failure_count", 0) > 0:
        sug.append(
            "Safety: crisis cases failed rule checks — review CrisisManager keywords/templates "
            "and ensure Path D triggers before therapeutic generation; add regression tests for new phrases."
        )

    if aggregated.get("hallucination_rate") is not None and aggregated["hallucination_rate"] > 0.15:
        sug.append(
            "Grounding: elevated judge-flagged hallucination rate — tighten response prompts to avoid "
            "invented biographical details; consider lowering temperature on Path B/C."
        )

    misuse = [r for r in rows if (r.get("memory_metrics") or {}).get("memory_misuse_flags")]
    if len(misuse) >= max(1, len(rows) // 10):
        sug.append(
            "Memory: several runs flagged memory_misuse — review mem0 retrieval filters, session/user_id wiring, "
            "and whether injected context matches the current turn (stale or wrong-user chunks)."
        )

    if regression and regression.get("regression_detected"):
        sug.append(
            "Regression: metrics worsened vs last stored run — inspect `regression` deltas and recent prompt or "
            "routing changes before release."
        )

    mem_empty = sum(
        1
        for r in rows
        if (r.get("eval_trace") or {}).get("memory_injected") is False
        and r.get("category") == "memory_dependent"
    )
    mem_dep = len([r for r in rows if r.get("category") == "memory_dependent"])
    if mem_dep and mem_empty > mem_dep * 0.5:
        sug.append(
            "Retrieval: many memory_dependent cases had no injected memory — verify Qdrant/mem0 connectivity, "
            "user_id consistency, and MEMORY_TRIGGER_INTERVAL so prior turns exist for the test user."
        )

    slow = [r for r in rows if (r.get("latency_ms") or 0) > 45000]
    if len(slow) > 2:
        sug.append(
            "Latency: several requests >45s — check memory retrieval timeout, cold-start embeddings, "
            "and GLM provider latency; consider caching emotional trend."
        )

    judge_skipped = sum(1 for r in rows if (r.get("judge") or {}).get("skipped"))
    if judge_skipped == len(rows) and rows:
        sug.append(
            "Evaluation: LLM judge was skipped (likely missing GROQ_API_KEY) — set key for full scoring."
        )

    if not sug:
        sug.append("No automated suggestions — review per_query failures in the JSON report manually.")

    return sug
