"""
Memory benchmark runner — drives multi-turn conversations from
``tests/fixtures/memory-benchmark-dataset.json`` and writes a structured report.

Usage (from ``chatbotAgent/``)::

    export ALLOW_EVAL_TRACE=true
    export EVAL_BASE_URL=http://127.0.0.1:8000
    export EVAL_AUTH_TOKEN=...   # or run API with SKIP_AUTH=true
    python -m tests.memory_benchmark_runner

Output: ``memory_benchmark_report.json`` (override with ``MEMORY_BENCHMARK_REPORT_PATH``).

This does **not** replace human review for safety; it automates recall/leakage heuristics.
When ``GROQ_API_KEY`` is set (and ``MEMORY_BENCHMARK_USE_JUDGE`` is not ``0``), each conversation
also gets **``llm_deep_diagnostic``** from ``tests/memory_judge.py`` (Groq): retrieval quality,
grounding, false-recall risk, contamination risk, failure tags, and a root-cause category hint.
See ``docs/MEMORY_QUALITY_EVAL_PROTOCOL.md``.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from tests.memory_benchmark_schema import validate_benchmark_dataset
from tests.memory_judge import format_transcript_for_memory_judge, run_memory_deep_judge

logger = logging.getLogger(__name__)

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "memory-benchmark-dataset.json"


def _memory_judge_enabled() -> bool:
    """
    Groq deep judge runs when GROQ_API_KEY is set unless explicitly disabled.
    Set MEMORY_BENCHMARK_USE_JUDGE=0 to skip (faster / CI without secrets).
    """
    v = os.getenv("MEMORY_BENCHMARK_USE_JUDGE", "").strip().lower()
    if v in ("0", "false", "no"):
        return False
    if v in ("1", "true", "yes"):
        return True
    return bool(os.getenv("GROQ_API_KEY"))


def _attach_llm_memory_judge(conv: Dict[str, Any], result: Dict[str, Any]) -> None:
    """Mutates result with ``llm_deep_diagnostic`` (Groq) when enabled."""
    if not _memory_judge_enabled():
        result["llm_deep_diagnostic"] = {
            "skipped": True,
            "reason": "MEMORY_BENCHMARK_USE_JUDGE=0 or no GROQ_API_KEY",
        }
        return
    transcript_txt = format_transcript_for_memory_judge(result.get("transcript") or [])
    expected = json.dumps(conv.get("expected_memory_items") or [], indent=0)[:12000]
    focus = str(conv.get("evaluation_focus") or conv.get("implicit_dependency_notes") or "")[:4000]
    diag = run_memory_deep_judge(
        conversation_id=str(result.get("id") or conv.get("id") or "unknown"),
        conversation_type=str(result.get("type") or "single_session"),
        transcript_with_previews=transcript_txt,
        expected_items_json=expected,
        evaluation_focus=focus,
        heuristic_failure_cases=list(result.get("failure_cases") or []),
    )
    result["llm_deep_diagnostic"] = diag


def _headers() -> Dict[str, str]:
    h = {"Content-Type": "application/json"}
    tok = os.getenv("EVAL_AUTH_TOKEN", os.getenv("SUPABASE_TEST_JWT", ""))
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    else:
        h["Authorization"] = "Bearer eval-local"
    h["X-MindMitra-Eval-Trace"] = "1"
    return h


def _text_matches_surface(text: str, forms: List[str]) -> Tuple[bool, List[str]]:
    low = (text or "").lower()
    hit = [f for f in forms if f.lower() in low]
    return bool(hit), hit


def _evaluate_expected_items(
    turn_rows: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], float, List[str]]:
    """Match expected_memory_items against previews/assistant on configured turns (1-indexed user turns)."""
    failures: List[str] = []
    results: List[Dict[str, Any]] = []
    if not items:
        return results, 1.0, failures

    by_turn = {r["user_turn"]: r for r in turn_rows}

    hits = 0
    for item in items:
        iid = item.get("id", "?")
        forms: List[str] = list(item.get("surface_forms") or [])
        eval_turns: List[int] = [int(x) for x in (item.get("evaluate_on_user_turns_1_indexed") or [])]
        locs = item.get("match_against") or ["assistant"]

        recalled = False
        evidence_turn: Optional[int] = None
        matched: List[str] = []
        for ut in eval_turns:
            row = by_turn.get(ut)
            if not row:
                failures.append(f"{iid}: missing turn {ut} in transcript")
                continue
            preview = (row.get("eval_trace") or {}).get("memory_context_preview") or ""
            assistant = row.get("assistant_message") or ""
            blob = ""
            if "memory_preview" in locs:
                blob += " " + preview
            if "assistant" in locs:
                blob += " " + assistant
            ok, ms = _text_matches_surface(blob, forms)
            if ok:
                recalled = True
                evidence_turn = ut
                matched = ms
                break

        if recalled:
            hits += 1
        else:
            failures.append(
                f"{iid}: no surface form match on eval turns {eval_turns} (forms={forms!r})"
            )

        results.append(
            {
                "item_id": iid,
                "recalled": recalled,
                "matched_surface_forms": matched,
                "evidence_user_turn_1_indexed": evidence_turn,
            }
        )

    score = hits / len(items) if items else 1.0
    return results, round(score, 4), failures


def _run_single_session(
    client: httpx.Client,
    conv: Dict[str, Any],
    *,
    personality: str = "mitra",
    language: str = "english",
) -> Dict[str, Any]:
    sid = str(uuid.uuid4())
    turns: List[str] = list(conv.get("turns") or [])
    turn_rows: List[Dict[str, Any]] = []
    for i, user_msg in enumerate(turns, start=1):
        t0 = time.perf_counter()
        r = client.post(
            "/chat",
            json={
                "user_message": user_msg,
                "session_id": sid,
                "avatar_visible": False,
                "personality": personality,
                "language": language,
            },
            headers=_headers(),
        )
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        et: Optional[Dict[str, Any]] = None
        assistant = ""
        err = None
        if r.status_code == 200:
            data = r.json()
            assistant = data.get("message") or ""
            et = data.get("eval_trace")
        else:
            err = f"http_{r.status_code}:{r.text[:300]}"

        turn_rows.append(
            {
                "user_turn": i,
                "user_message": user_msg,
                "assistant_message": assistant,
                "latency_ms": latency_ms,
                "http_error": err,
                "eval_trace": et,
                "memory_injected": bool((et or {}).get("memory_injected")),
                "memory_char_len": (et or {}).get("memory_char_len"),
            }
        )
        if err:
            break

    preview_failures: List[str] = []
    for pat in conv.get("must_not_in_memory_preview_regex") or []:
        if not pat:
            continue
        for row in turn_rows:
            prev = ((row.get("eval_trace") or {}).get("memory_context_preview")) or ""
            if re.search(pat, prev, re.I):
                preview_failures.append(f"regex {pat!r} matched memory preview at turn {row['user_turn']}")

    recall_results, acc_score, recall_failures = _evaluate_expected_items(
        turn_rows, list(conv.get("expected_memory_items") or [])
    )

    observations: List[str] = []
    injected_turns = [r["user_turn"] for r in turn_rows if r.get("memory_injected")]
    if injected_turns:
        observations.append(f"memory_injected true on user turns: {injected_turns[:20]}")
    else:
        observations.append(
            "memory_injected never true — extraction may not have fired (interval), "
            "or retrieval empty for this user/session (see seed_eval_memory.py)."
        )

    return {
        "id": conv.get("id"),
        "type": "single_session",
        "session_id": sid,
        "transcript": turn_rows,
        "expected_memory_items": conv.get("expected_memory_items"),
        "recall_results": recall_results,
        "memory_accuracy_score": acc_score,
        "failure_cases": preview_failures + recall_failures + [r["http_error"] for r in turn_rows if r.get("http_error")],
        "observations": observations + (conv.get("implicit_dependency_notes") and [conv["implicit_dependency_notes"]] or []),
    }


def _run_cross_session_pair(
    client: httpx.Client,
    conv: Dict[str, Any],
    *,
    personality: str = "mitra",
    language: str = "english",
    sleep_s: float,
) -> Dict[str, Any]:
    def run_block(sid: str, user_turns: List[str], label: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for j, user_msg in enumerate(user_turns, start=1):
            r = client.post(
                "/chat",
                json={
                    "user_message": user_msg,
                    "session_id": sid,
                    "avatar_visible": False,
                    "personality": personality,
                    "language": language,
                },
                headers=_headers(),
            )
            et = None
            assistant = ""
            err = None
            if r.status_code == 200:
                data = r.json()
                assistant = data.get("message") or ""
                et = data.get("eval_trace")
            else:
                err = f"http_{r.status_code}:{r.text[:300]}"
            out.append(
                {
                    "block": label,
                    "user_turn": j,
                    "user_message": user_msg,
                    "assistant_message": assistant,
                    "eval_trace": et,
                    "http_error": err,
                }
            )
            if err:
                break
        return out

    sa = conv.get("session_a") or {}
    sb = conv.get("session_b") or {}
    turns_a = list(sa.get("turns") or [])
    turns_b = list(sb.get("turns") or [])

    sid_a = str(uuid.uuid4())
    rows_a = run_block(sid_a, turns_a, "session_a")
    if any(r.get("http_error") for r in rows_a):
        return {
            "id": conv.get("id"),
            "type": "cross_session_pair",
            "failure_cases": [r["http_error"] for r in rows_a if r.get("http_error")],
            "transcript": rows_a,
        }

    time.sleep(max(0.0, sleep_s))
    sid_b = str(uuid.uuid4())
    rows_b = run_block(sid_b, turns_b, "session_b")

    joined_b = " ".join(
        (r.get("assistant_message") or "") for r in rows_b if r.get("block") == "session_b"
    ).lower()
    leak_failures: List[str] = []
    for sub in conv.get("must_not_substrings_in_session_b_assistant") or []:
        if sub.lower() in joined_b:
            leak_failures.append(f"session_b assistant contains forbidden substring {sub!r}")

    return {
        "id": conv.get("id"),
        "type": "cross_session_pair",
        "session_a_id": sid_a,
        "session_b_id": sid_b,
        "transcript": rows_a + rows_b,
        "expected_memory_items": [],
        "recall_results": [],
        "memory_accuracy_score": 1.0 if not leak_failures else 0.0,
        "failure_cases": leak_failures + [r.get("http_error") for r in rows_b if r.get("http_error")],
        "observations": [
            "Cross-session check: forbidden tokens should be absent in session B unless memory leaks or model hallucinates niche detail."
        ]
        + (conv.get("implicit_dependency_notes") and [conv["implicit_dependency_notes"]] or []),
    }


def run_benchmark(
    *,
    fixture_path: Path = FIXTURE,
    report_path: Optional[Path] = None,
    base_url: Optional[str] = None,
) -> Tuple[Path, Dict[str, Any]]:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    base = (base_url or os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")).rstrip("/")
    out = Path(
        os.getenv("MEMORY_BENCHMARK_REPORT_PATH", "memory_benchmark_report.json")
    ).resolve()
    if report_path:
        out = report_path.resolve()

    doc = json.loads(fixture_path.read_text(encoding="utf-8"))
    ok, schema_errors = validate_benchmark_dataset(doc)
    if not ok:
        payload = {"meta": {"schema_errors": schema_errors}, "conversations": []}
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return out, payload

    sleep_s = float((doc.get("protocol") or {}).get("between_conversations_sleep_s") or 0)

    per: List[Dict[str, Any]] = []
    with httpx.Client(base_url=base, timeout=180.0) as client:
        try:
            h = client.get("/health")
            if h.status_code != 200:
                raise RuntimeError(f"health {h.status_code}")
        except Exception as e:
            logger.error("Health check failed: %s", e)
            meta = {"base_url": base, "error": str(e), "fixture": str(fixture_path)}
            out.write_text(json.dumps({"meta": meta, "conversations": []}, indent=2), encoding="utf-8")
            return out, {"meta": meta, "conversations": []}

        for conv in doc.get("conversations", []):
            cid = conv.get("id")
            logger.info("Running benchmark conversation %s", cid)
            ctype = conv.get("type", "single_session")
            if ctype == "cross_session_pair":
                row = _run_cross_session_pair(client, conv, sleep_s=sleep_s)
            else:
                row = _run_single_session(client, conv)
            _attach_llm_memory_judge(conv, row)
            per.append(row)
            if sleep_s > 0:
                time.sleep(sleep_s)

    judge_rows = [p for p in per if (p.get("llm_deep_diagnostic") or {}).get("source") == "groq_memory_judge"]
    summary = {
        "conversation_count": len(per),
        "mean_memory_accuracy": round(
            sum(p.get("memory_accuracy_score") or 0.0 for p in per) / max(len(per), 1),
            4,
        ),
        "total_failure_cases": sum(len(p.get("failure_cases") or []) for p in per),
        "groq_memory_judge_calls": len(judge_rows),
        "mean_judge_memory_retrieval_quality_0_5": (
            round(
                sum((p.get("llm_deep_diagnostic") or {}).get("memory_retrieval_quality_0_5") or 0 for p in judge_rows)
                / len(judge_rows),
                3,
            )
            if judge_rows
            else None
        ),
        "mean_judge_false_recall_risk_0_5": (
            round(
                sum((p.get("llm_deep_diagnostic") or {}).get("false_recall_risk_0_5") or 0 for p in judge_rows)
                / len(judge_rows),
                3,
            )
            if judge_rows
            else None
        ),
    }

    payload = {
        "meta": {
            "base_url": base,
            "fixture": str(fixture_path),
            "benchmark_version": doc.get("benchmark_version"),
            "protocol": doc.get("protocol"),
            "summary": summary,
            "memory_judge_enabled": _memory_judge_enabled(),
            "memory_judge_model": os.getenv("EVAL_JUDGE_MODEL", "llama-3.3-70b-versatile"),
        },
        "conversations": per,
    }
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    logger.info("Wrote %s", out)
    return out, payload


def main() -> None:
    ap = argparse.ArgumentParser(description="Run memory benchmark against live API")
    ap.add_argument("--fixture", type=Path, default=FIXTURE, help="Path to memory-benchmark-dataset.json")
    ap.add_argument("--report", type=Path, default=None, help="Output JSON path")
    ap.add_argument("--base-url", default=None, help="Override EVAL_BASE_URL")
    args = ap.parse_args()
    run_benchmark(fixture_path=args.fixture, report_path=args.report, base_url=args.base_url)


if __name__ == "__main__":
    main()
