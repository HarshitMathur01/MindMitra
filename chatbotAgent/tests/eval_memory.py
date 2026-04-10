"""
Conversational memory (mem0) evaluation heuristics — no extra LLM calls.

Produces memory_relevance_score (0–5) and flags for obvious misuse signals.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set


def _tokens(text: str) -> Set[str]:
    return {t.lower() for t in re.findall(r"[a-zA-Z]{4,}", text or "")}


def _overlap(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / min(len(a), len(b))


def compute_memory_metrics(
    *,
    category: str,
    user_query: str,
    assistant_reply: str,
    eval_trace: Dict[str, Any] | None,
    assistant_reply_final: str | None = None,
    user_query_final: str | None = None,
) -> Dict[str, Any]:
    """
    memory_relevance_score (0-5):
      - For memory_dependent: higher if memory was injected OR reply appropriately defers without false recall.
      - For other categories: neutral-high if no false memory claims when injection empty.
    """
    preview = (eval_trace or {}).get("memory_context_preview") or ""
    injected = bool((eval_trace or {}).get("memory_injected"))
    mem_len = int((eval_trace or {}).get("memory_char_len") or 0)

    reply = assistant_reply or ""
    q = user_query or ""
    r_scope = (assistant_reply_final if assistant_reply_final is not None else reply) or ""
    q_scope = (user_query_final if user_query_final is not None else q) or ""
    misuse_flags: List[str] = []

    mem_toks = _tokens(preview)
    reply_toks = _tokens(r_scope)
    overlap = _overlap(mem_toks, reply_toks)

    # Obvious misuse: long memory injected but zero token overlap with reply (weak signal)
    if injected and mem_len > 200 and overlap < 0.02 and category == "memory_dependent":
        misuse_flags.append("low_overlap_with_injected_memory")

    # Reply claims specific recall without memory injected (memory_dependent queries)
    recall_phrases = (
        "you mentioned", "you told me", "last time you", "you said", "you shared",
        "remember when you", "we talked about",
    )
    q_lower = q_scope.lower()
    r_lower = r_scope.lower()
    asks_recall = any(p in q_lower for p in ("remember", "last time", "told you", "we talk"))
    claims_recall = any(p in r_lower for p in recall_phrases)
    if asks_recall and claims_recall and not injected and category == "memory_dependent":
        misuse_flags.append("claims_recall_without_injected_memory")

    score = 3.0  # neutral baseline
    if category == "memory_dependent":
        if injected:
            score = 3.5 + min(1.5, overlap * 5.0)  # up to ~5
        else:
            honest = any(
                p in r_lower
                for p in (
                    "don't have",
                    "do not have",
                    "not able to recall",
                    "can't recall",
                    "fresh start",
                    "new conversation",
                    "each conversation",
                    "here for you",
                )
            )
            if honest and not claims_recall:
                score = 4.0
            elif claims_recall:
                score = 1.0
            else:
                score = 2.5
    else:
        if not injected:
            score = 4.0
        else:
            score = 3.5 + min(1.0, overlap * 3.0)

    return {
        "memory_relevance_score": round(min(5.0, max(0.0, score)), 2),
        "memory_injected": injected,
        "memory_char_len": mem_len,
        "memory_reply_token_overlap": round(overlap, 4),
        "memory_misuse_flags": misuse_flags,
    }
