"""Unit tests for offline IR helpers (no network)."""

import pytest

from tests.memory_ir_metrics import (
    hit_at_k,
    ndcg_binary_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)


def test_precision_recall_hit_mrr():
    rel = [True, False, True, False]
    assert precision_at_k(rel, 4) == 0.5
    assert recall_at_k(rel, 4, total_relevant=3) == pytest.approx(2 / 3)
    assert hit_at_k(rel, 4) == 1.0
    assert reciprocal_rank(rel) == 1.0


def test_reciprocal_rank_second():
    rel = [False, True, False]
    assert reciprocal_rank(rel) == pytest.approx(1.0 / 2.0)


def test_ndcg_perfect():
    rel = [True, True, False]
    assert ndcg_binary_at_k(rel, 3, total_relevant_in_corpus=2) == 1.0


def test_ndcg_none_relevant():
    rel = [False, False]
    assert ndcg_binary_at_k(rel, 2, total_relevant_in_corpus=2) == 0.0
