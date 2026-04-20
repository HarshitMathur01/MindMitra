"""
Offline episodic memory retrieval benchmark.

Loads `tests/fixtures/memory_benchmark_dataset.json`, writes gold memories into
InMemorySupabase + InMemoryQdrant, runs EpisodicService.retrieve, computes IR
metrics (Precision@K, Recall@K, Hit@K, MRR, nDCG@K) and optionally calls the
Groq retrieval judge.

Run from `chatbotAgent/`:

    python -m tests.memory_retrieval_benchmark

Env:
    MEMORY_BENCH_OUTPUT   — JSON report path (default: evaluations/memory_benchmark_report.json)
    MEMORY_BENCH_USE_JUDGE — 1/true to call GROQ_API_KEY judge (adds cost/latency)
    MEMORY_BENCH_TOP_K    — override default k per query if set (else use each query's k)

This does NOT replace integration tests against live Qdrant/embeddings; it gives
reproducible, non-hallucinated ranking metrics on a deterministic stub embedder.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Allow `python -m tests.memory_retrieval_benchmark` from chatbotAgent/
_CHATBOT_ROOT = Path(__file__).resolve().parents[1]
if str(_CHATBOT_ROOT) not in sys.path:
    sys.path.insert(0, str(_CHATBOT_ROOT))

from app.memory.episodic import EpisodicService
from app.memory.qdrant_v2 import InMemoryQdrant
from app.memory.repositories import InMemorySupabase

from tests.memory_ir_metrics import (
    aggregate_mean,
    hit_at_k,
    ndcg_binary_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)
from tests.memory_retrieval_judge import run_retrieval_judge_groq

logger = logging.getLogger(__name__)

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "memory_benchmark_dataset.json"


def _theme_tag(memory_id: str) -> str:
    return f"__bench_id_{memory_id}__"


class _StubEmbedder:
    """Same deterministic embedding as test_memory_v2 (reproducible retrieval)."""

    def __init__(self, dim: int = 16):
        self.dim = dim

    async def __call__(self, texts: List[str]) -> List[List[float]]:
        import math

        out: List[List[float]] = []
        for t in texts:
            v = [0.0] * self.dim
            for i, ch in enumerate((t or "").lower()):
                v[i % self.dim] += (ord(ch) % 13) / 13.0
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            out.append([x / n for x in v])
        return out


def _build_relevance_vector(
    retrieved_themes_list: List[List[str]],
    relevant_ids: List[str],
    k: int,
) -> Tuple[List[bool], int]:
    """Mark each retrieved slot relevant if its episode themes include a bench id tag."""
    rel_set = set(relevant_ids)
    tags = {_theme_tag(r) for r in rel_set}
    vec: List[bool] = []
    for i in range(min(k, len(retrieved_themes_list))):
        th = retrieved_themes_list[i] or []
        vec.append(any(t in tags for t in th))
    total_rel_in_corpus = len(rel_set)
    return vec, total_rel_in_corpus


async def _run_one_query(
    svc: EpisodicService,
    *,
    user_id: str,
    query: Dict[str, Any],
    default_k: int,
    use_judge: bool,
) -> Dict[str, Any]:
    text = (query.get("text") or "").strip()
    k = int(query.get("k") or default_k)
    qid = query.get("query_id") or "q"
    relevant_ids = list(query.get("relevant_memory_ids") or [])
    expects_empty = bool(query.get("expects_no_relevant_retrieval"))
    off_topic_same_user = bool(query.get("off_topic_same_user"))
    current_vad = query.get("current_vad")
    # Cross-user isolation: retrieve as a different user than corpus (expect no episodes).
    retrieve_as_user = str(query.get("retrieve_as_user_id") or user_id)

    episodes = await svc.retrieve(
        user_id=retrieve_as_user,
        query=text,
        top_k=k,
        overfetch=32,
        current_vad=current_vad,
    )

    summaries = [(e.summary or "")[:1200] for e in episodes]
    themes_list = [list(e.themes or []) for e in episodes]

    rel_vec: List[bool]

    if off_topic_same_user and expects_empty and not relevant_ids:
        # Same user, but gold says *no* stored memory should matter for this query.
        # Any retrieval is counted as noise (stub embeddings may still match something).
        fp = len(episodes) > 0
        rel_vec = []
        metrics = {
            "precision_at_k": 0.0 if fp else 1.0,
            "recall_at_k": 1.0,
            "hit_at_k": None,
            "reciprocal_rank": 0.0,
            "ndcg_at_k": 0.0 if fp else 1.0,
            "expects_no_relevant_retrieval": True,
            "off_topic_same_user": True,
            "false_positive_retrieval": fp,
            "silence_preferred": not fp,
            "empty_retrieval": len(episodes) == 0,
        }
    elif not episodes and expects_empty:
        rel_vec = []
        metrics = {
            "precision_at_k": 1.0,
            "recall_at_k": 1.0,
            "hit_at_k": 0.0,
            "reciprocal_rank": 0.0,
            "ndcg_at_k": 1.0,
            "expects_no_relevant_retrieval": True,
            "empty_retrieval": True,
        }
    else:
        rel_vec, _ = _build_relevance_vector(themes_list, relevant_ids, k)
        tr = max(len(relevant_ids), 1)
        metrics = {
            "precision_at_k": precision_at_k(rel_vec, k),
            "recall_at_k": recall_at_k(rel_vec, k, len(relevant_ids)),
            "hit_at_k": hit_at_k(rel_vec, k),
            "reciprocal_rank": reciprocal_rank(rel_vec),
            "ndcg_at_k": ndcg_binary_at_k(rel_vec, k, tr),
            "expects_no_relevant_retrieval": False,
            "empty_retrieval": len(episodes) == 0,
        }

    judge: Dict[str, Any] = {"skipped": True}
    if use_judge and summaries:
        judge = run_retrieval_judge_groq(
            query=text,
            retrieved_summaries=summaries,
            relevant_memory_ids_expected=relevant_ids or None,
        )

    return {
        "query_id": qid,
        "query_text": text,
        "k": k,
        "retrieved_count": len(episodes),
        "retrieved_summaries_preview": [s[:240] for s in summaries],
        "relevance_vector": rel_vec,
        "metrics": metrics,
        "judge": judge,
    }


async def run_benchmark_async() -> Dict[str, Any]:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    use_judge = os.getenv("MEMORY_BENCH_USE_JUDGE", "false").lower() in ("1", "true", "yes")
    default_k = int(os.getenv("MEMORY_BENCH_TOP_K", "8"))
    out_path = Path(os.getenv("MEMORY_BENCH_OUTPUT", _CHATBOT_ROOT / "evaluations" / "memory_benchmark_report.json")).resolve()

    raw = json.loads(FIXTURE.read_text(encoding="utf-8"))
    cases: List[Dict[str, Any]] = raw.get("cases", [])
    meta_design = raw.get("evaluation_design", {})

    per_query_rows: List[Dict[str, Any]] = []
    by_difficulty: Dict[str, List[float]] = {}

    for case in cases:
        cid = case.get("id", "unknown")
        difficulty = case.get("difficulty", "unknown")
        user_id = case.get("user_id") or f"bench_{cid}"
        corpus = case.get("corpus") or []

        sb, qd = InMemorySupabase(), InMemoryQdrant()
        embed = _StubEmbedder()
        svc = EpisodicService(sb=sb, qdrant=qd, embed_fn=embed.__call__)

        for mem in corpus:
            mid = mem.get("memory_id") or "m"
            summary = (mem.get("summary") or "").strip()
            themes = [str(t) for t in (mem.get("themes") or [])]
            themes.append(_theme_tag(mid))
            await svc.write(
                user_id=user_id,
                summary=summary,
                verbatim_quote=mem.get("verbatim_quote"),
                affect_label=mem.get("affect_label"),
                affect_vad=mem.get("affect_vad"),
                themes=themes,
                importance=float(mem.get("importance") or 0.55),
                source_session=mem.get("source_session") or "bench",
            )

        for q in case.get("queries") or []:
            row = await _run_one_query(
                svc,
                user_id=user_id,
                query=q,
                default_k=default_k,
                use_judge=use_judge,
            )
            m = row["metrics"]
            hit = m.get("hit_at_k")
            if isinstance(hit, (int, float)):
                by_difficulty.setdefault(difficulty, []).append(float(hit))

            per_query_rows.append(
                {
                    "case_id": cid,
                    "difficulty": difficulty,
                    "case_description": case.get("description", ""),
                    **row,
                }
            )

    # Aggregate
    all_hits = [
        r["metrics"]["hit_at_k"]
        for r in per_query_rows
        if r.get("metrics") and r["metrics"].get("hit_at_k") is not None
    ]
    all_p = [r["metrics"]["precision_at_k"] for r in per_query_rows]
    all_mrr = [r["metrics"]["reciprocal_rank"] for r in per_query_rows]

    def _r(x: float | None, nd: int = 4) -> float | None:
        if x is None:
            return None
        return round(float(x), nd)

    summary = {
        "mean_hit_at_k": _r(aggregate_mean(all_hits), 4),
        "mean_precision_at_k": _r(aggregate_mean(all_p), 4),
        "mean_reciprocal_rank": _r(aggregate_mean(all_mrr), 4),
        "by_difficulty_mean_hit_at_k": {d: _r(aggregate_mean(vs), 4) for d, vs in by_difficulty.items()},
        "total_queries": len(per_query_rows),
    }

    judge_scores = [
        r["judge"]["retrieval_quality"]
        for r in per_query_rows
        if r.get("judge") and r["judge"].get("retrieval_quality") is not None
    ]
    summary["mean_judge_retrieval_quality"] = _r(aggregate_mean([float(x) for x in judge_scores]), 4) if judge_scores else None

    doc = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "fixture": str(FIXTURE),
            "dataset_version": raw.get("version"),
            "evaluation_design": meta_design,
            "stub_embedder": "tests.memory_retrieval_benchmark._StubEmbedder",
            "use_groq_judge": use_judge,
            "notes": [
                "IR metrics are gold-label based; they do not depend on LLM self-evaluation.",
                "Groq judge is a secondary signal — compare against hit_at_k when numbers disagree.",
            ],
        },
        "summary_metrics": summary,
        "per_query": per_query_rows,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Wrote %s", out_path)
    return doc


def main() -> None:
    asyncio.run(run_benchmark_async())


if __name__ == "__main__":
    main()
