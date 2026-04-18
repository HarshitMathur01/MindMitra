"""
JSON schema validation for memory benchmark fixtures (no network).
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def validate_benchmark_dataset(doc: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    if doc.get("benchmark_version") is None:
        errors.append("missing benchmark_version")
    convs = doc.get("conversations")
    if not isinstance(convs, list) or not convs:
        errors.append("conversations must be a non-empty list")
        return False, errors

    for i, c in enumerate(convs):
        cid = c.get("id", f"index_{i}")
        ctype = c.get("type", "single_session")
        if ctype == "single_session":
            turns = c.get("turns")
            if not isinstance(turns, list):
                errors.append(f"{cid}: turns must be a list")
                continue
            n = len(turns)
            if n < 15:
                errors.append(f"{cid}: expected at least 15 user turns, got {n}")
            for j, t in enumerate(turns):
                if not isinstance(t, str) or len(t.strip()) < 2:
                    errors.append(f"{cid}: turn {j} must be a non-empty string")
        elif ctype == "cross_session_pair":
            sa = c.get("session_a") or {}
            sb = c.get("session_b") or {}
            for label, block in (("session_a", sa), ("session_b", sb)):
                tt = block.get("turns")
                if not isinstance(tt, list) or len(tt) < 3:
                    errors.append(f"{cid}: {label}.turns must be a list with length >= 3")
        else:
            errors.append(f"{cid}: unknown type {ctype!r}")

        emi = c.get("expected_memory_items")
        if emi is not None and not isinstance(emi, list):
            errors.append(f"{cid}: expected_memory_items must be a list or omitted")

    return len(errors) == 0, errors
