"""
Offline information-retrieval metrics for episodic / RAG retrieval evaluation.

These are standard ranking metrics used in retrieval benchmarks (see e.g. discussions
of Precision@K, Recall@K, MRR, nDCG for RAG systems). They are computed from *binary*
relevance labels you assign per retrieved slot (gold dataset), not from model self-scores.

References (for methodology, not code dependencies):
- Precision@K / Recall@K: fraction of top-K that are relevant / coverage of relevant set in top-K.
- MRR: mean reciprocal rank of the first relevant item.
- nDCG@K: discounted cumulative gain with binary or graded relevance (Jarvelin & Kekalainen, 2002).
"""

from __future__ import annotations

import math
from typing import Iterable, List, Sequence


def precision_at_k(relevance: Sequence[bool], k: int) -> float:
    """Fraction of the top-k positions that are relevant."""
    if k <= 0:
        return 0.0
    top = relevance[:k]
    if not top:
        return 0.0
    return sum(1 for r in top if r) / float(min(k, len(top)))


def recall_at_k(relevance: Sequence[bool], k: int, total_relevant: int) -> float:
    """Fraction of all relevant documents (in the corpus) that appear in top-k.

    If total_relevant == 0, returns 1.0 when no positive is expected (vacuous success),
    0.0 if any relevant was marked expected but none defined (caller should validate).
    """
    if total_relevant <= 0:
        return 1.0
    found = sum(1 for r in relevance[:k] if r)
    return min(1.0, found / float(total_relevant))


def hit_at_k(relevance: Sequence[bool], k: int) -> float:
    """1.0 if at least one relevant item appears in top-k, else 0.0."""
    if k <= 0:
        return 0.0
    return 1.0 if any(relevance[:k]) else 0.0


def reciprocal_rank(relevance: Sequence[bool]) -> float:
    """1/rank of first relevant (1-indexed), or 0.0 if none."""
    for i, r in enumerate(relevance):
        if r:
            return 1.0 / float(i + 1)
    return 0.0


def dcg_at_k(relevance: Sequence[float | bool], k: int) -> float:
    """DCG with binary or graded gains (bool coerced to 0/1)."""
    s = 0.0
    for i in range(min(k, len(relevance))):
        g = float(relevance[i]) if not isinstance(relevance[i], bool) else (1.0 if relevance[i] else 0.0)
        s += g / math.log2(i + 2.0)
    return s


def idcg_binary_at_k(k: int, total_relevant_in_corpus: int) -> float:
    """Ideal DCG when there are `total_relevant_in_corpus` binary-relevant docs (best rank: relevant first)."""
    if total_relevant_in_corpus <= 0:
        return 0.0
    gains = [1.0] * min(k, total_relevant_in_corpus) + [0.0] * max(0, k - min(k, total_relevant_in_corpus))
    return dcg_at_k(gains, k)


def ndcg_binary_at_k(relevance: Sequence[bool], k: int, total_relevant_in_corpus: int) -> float:
    """nDCG@K for binary labels; `relevance[i]` is whether retrieved item i is relevant."""
    rel = list(relevance[:k])
    if not rel:
        return 0.0
    dcg = dcg_at_k(rel, k)
    idcg = idcg_binary_at_k(k, total_relevant_in_corpus)
    if idcg <= 0:
        return 1.0 if not any(rel) and total_relevant_in_corpus == 0 else 0.0
    return dcg / idcg


def aggregate_mean(values: Iterable[float]) -> float | None:
    v = [float(x) for x in values]
    if not v:
        return None
    return sum(v) / len(v)
