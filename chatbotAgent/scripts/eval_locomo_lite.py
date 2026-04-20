#!/usr/bin/env python3
"""
LOCOMO-lite — a small offline harness for measuring multi-session memory
retention quality on the MITRA pipeline.

LOCOMO (Long-Conversation Memory) tasks evaluate whether a chatbot can
*recall* facts and *use* them naturally across long gaps. We don't need the
full LOCOMO benchmark to ship — we need a CI-friendly harness that lets us
trend three numbers over time:

    1. recall_acc  — when memory is needed, did we surface it?
    2. precision   — when memory was surfaced, was it relevant (no noise)?
    3. p95_latency — does the memory call meet the SLO?

This script is intentionally **dependency-free** (no LLM calls). It uses the
in-memory test doubles for Qdrant + Supabase that already live under
`tests/` and seeds them with a small, hand-picked transcript. Real LLM-based
LOCOMO eval lives in a separate, optional script that hits live providers.

Run locally:
    cd chatbotAgent
    python scripts/eval_locomo_lite.py
"""
from __future__ import annotations

import asyncio
import json
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


# ── Test doubles -------------------------------------------------------------

class _InMemSupabase:
    """Minimal stub matching the table().select().eq()...execute() pattern."""

    def __init__(self) -> None:
        self.tables: Dict[str, List[Dict[str, Any]]] = {}

    def table(self, name: str):
        rows = self.tables.setdefault(name, [])
        return _Tbl(rows)


class _Tbl:
    def __init__(self, rows: List[Dict[str, Any]]) -> None:
        self.rows = rows
        self._sel: List[str] = []
        self._filters: List[Tuple[str, Any]] = []
        self._limit: Optional[int] = None
        self._order: Optional[Tuple[str, bool]] = None

    def select(self, *_):
        return self

    def eq(self, k: str, v: Any):
        self._filters.append((k, v))
        return self

    def in_(self, k: str, vs: List[Any]):
        self._filters.append((f"_in_{k}", set(vs)))
        return self

    def gte(self, *_):
        return self

    def order(self, k: str, desc: bool = False):
        self._order = (k, desc)
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def insert(self, row: Dict[str, Any]):
        new = dict(row)
        new.setdefault("id", str(len(self.rows) + 1))
        self._pending_insert = new
        return self

    def upsert(self, row: Dict[str, Any], on_conflict: str = ""):
        self._pending_upsert = (dict(row), on_conflict)
        return self

    def update(self, patch: Dict[str, Any]):
        self._patch = patch
        return self

    def delete(self):
        self._delete = True
        return self

    def execute(self):
        # 1. side-effects first (insert/upsert/update/delete)
        if hasattr(self, "_pending_insert"):
            new = self._pending_insert
            self.rows.append(new)
            del self._pending_insert
            return _Result([new])
        if hasattr(self, "_pending_upsert"):
            row, on_conflict = self._pending_upsert
            del self._pending_upsert
            keys = on_conflict.split(",") if on_conflict else []
            for i, r in enumerate(self.rows):
                if keys and all(r.get(k) == row.get(k) for k in keys):
                    self.rows[i] = {**r, **row}
                    return _Result([self.rows[i]])
            row.setdefault("id", str(len(self.rows) + 1))
            self.rows.append(row)
            return _Result([row])

        # 2. read path
        rows = list(self.rows)
        for k, v in self._filters:
            if k.startswith("_in_"):
                key = k[4:]
                rows = [r for r in rows if r.get(key) in v]
            else:
                rows = [r for r in rows if r.get(k) == v]
        if self._order:
            key, desc = self._order
            rows = sorted(rows, key=lambda r: (r.get(key) is None, r.get(key)), reverse=desc)
        if self._limit:
            rows = rows[: self._limit]
        return _Result(rows)


class _Result:
    def __init__(self, data: List[Dict[str, Any]]) -> None:
        self.data = data


# ── Eval task --------------------------------------------------------------

@dataclass
class EvalTask:
    """A single recall task. We seed `seed_memories`, then ask `query` and
    check that at least one of `expected_substrings` appears in the surfaced
    summaries."""
    name: str
    seed_memories: List[Dict[str, Any]]
    query: str
    expected_substrings: List[str]


@dataclass
class EvalResult:
    name: str
    surfaced_summaries: List[str] = field(default_factory=list)
    matched: bool = False
    elapsed_ms: float = 0.0


TASKS: List[EvalTask] = [
    EvalTask(
        name="dad_dinner_followup",
        seed_memories=[
            {"summary": "User said dinners with their father feel cold; "
                        "they hold their breath at the table.",
             "themes": ["family", "father"], "importance": 0.85,
             "affect_label": "anxious", "affect_vad": {"v": -0.4, "a": 0.4, "d": 0.0}},
            {"summary": "User finished a tough finals week; relief but still "
                        "very low energy.",
             "themes": ["academic"], "importance": 0.6,
             "affect_label": "tired", "affect_vad": {"v": -0.1, "a": -0.5, "d": 0.0}},
        ],
        query="dinner with my dad tonight again",
        expected_substrings=["father", "dinner", "cold"],
    ),
    EvalTask(
        name="exam_followup",
        seed_memories=[
            {"summary": "User talked about exam burnout and feeling numb after "
                        "two weeks of finals.",
             "themes": ["academic"], "importance": 0.75,
             "affect_label": "tired", "affect_vad": {"v": -0.2, "a": -0.6, "d": 0.0}},
        ],
        query="i'm so done with studying right now",
        expected_substrings=["exam", "finals", "burnout"],
    ),
    EvalTask(
        name="off_topic_no_memory",
        seed_memories=[
            {"summary": "User likes long evening walks alone.",
             "themes": ["self_care"], "importance": 0.4,
             "affect_label": "calm", "affect_vad": {"v": 0.4, "a": -0.3, "d": 0.0}},
        ],
        query="what's the capital of France",
        expected_substrings=[],  # Negative case — we expect NO surfacing.
    ),
]


# ── Harness ---------------------------------------------------------------

async def _embed(texts: List[str]) -> List[List[float]]:
    """Cheap deterministic 'embedding' — bag-of-chars count per latin letter,
    L2-normalised. Good enough to make cosine reflect substring overlap for
    these tiny tasks."""
    import math
    vecs = []
    for t in texts:
        t = (t or "").lower()
        v = [t.count(chr(c)) for c in range(ord("a"), ord("z") + 1)]
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        vecs.append([x / n for x in v])
    return vecs


async def run_eval() -> Dict[str, Any]:
    from app.memory.episodic import EpisodicService
    from app.memory.qdrant_v2 import InMemoryQdrant

    results: List[EvalResult] = []

    for task in TASKS:
        sb = _InMemSupabase()
        qd = InMemoryQdrant()
        svc = EpisodicService(sb=sb, qdrant=qd, embed_fn=_embed)

        # seed
        for m in task.seed_memories:
            await svc.write(
                user_id="u_eval",
                summary=m["summary"],
                themes=m.get("themes") or [],
                affect_label=m.get("affect_label"),
                affect_vad=m.get("affect_vad"),
                importance=float(m.get("importance") or 0.5),
            )

        # retrieve
        t0 = time.perf_counter()
        episodes = await svc.retrieve(
            user_id="u_eval",
            query=task.query,
            top_k=4,
            current_vad={"v": -0.2, "a": 0.0, "d": 0.0},
        )
        elapsed = (time.perf_counter() - t0) * 1000

        surfaced = [getattr(e, "summary", "") for e in episodes]
        haystack = " ".join(s.lower() for s in surfaced)
        if task.expected_substrings:
            matched = any(s.lower() in haystack for s in task.expected_substrings)
        else:
            # Negative task — pass if NOTHING relevant got surfaced.
            matched = not surfaced

        results.append(EvalResult(
            name=task.name,
            surfaced_summaries=surfaced,
            matched=matched,
            elapsed_ms=elapsed,
        ))

    # Aggregates
    total = len(results)
    passed = sum(1 for r in results if r.matched)
    p95 = statistics.quantiles([r.elapsed_ms for r in results], n=20)[-1] if total >= 20 else max(r.elapsed_ms for r in results)
    summary = {
        "total": total,
        "passed": passed,
        "recall_acc": passed / total if total else 0.0,
        "p95_latency_ms": round(p95, 2),
        "tasks": [r.__dict__ for r in results],
    }
    return summary


def main() -> int:
    summary = asyncio.run(run_eval())
    print(json.dumps(summary, indent=2, default=str))
    # Exit non-zero if recall_acc < 0.66 so CI catches regressions.
    if summary["recall_acc"] < 0.66:
        print("[locomo-lite] FAIL — recall_acc below threshold", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
