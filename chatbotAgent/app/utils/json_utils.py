"""
JSON parsing utilities used by LLM wrappers throughout the codebase.
Extracted from workflow.py so every module can import without creating circular deps.
"""
import json
import re
from typing import Any, Dict, List, Optional


def parse_json_from_llm_output(raw: str) -> Optional[Dict[str, Any]]:
    """
    Best-effort JSON object extraction from LLM output.
    Four-tier strategy:
      1. Direct json.loads
      2. First { object found in text (JSONDecoder.raw_decode)
      3. Balanced-brace extraction (handles braces inside quoted strings)
      4. Substring between first '{' and last '}'
    Returns None if all tiers fail.
    """
    if not raw:
        return None

    cleaned = raw.replace("\ufeff", "").strip()
    fenced_match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, flags=re.IGNORECASE | re.DOTALL)
    if fenced_match:
        cleaned = fenced_match.group(1).strip()
    else:
        cleaned = re.sub(r"```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip().rstrip("`")

    # 1) direct parse
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, str):
            parsed = json.loads(parsed)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    # 2) parse first JSON object found in text
    decoder = json.JSONDecoder()
    for i, ch in enumerate(cleaned):
        if ch == "{":
            try:
                parsed, _ = decoder.raw_decode(cleaned[i:])
                if isinstance(parsed, str):
                    parsed = json.loads(parsed)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                continue

    # 3) balanced-brace extraction (ignoring braces inside quoted strings)
    def _extract_balanced_object(text: str, start_idx: int) -> Optional[str]:
        depth = 0
        in_string = False
        escape = False
        for pos in range(start_idx, len(text)):
            ch = text[pos]
            if in_string:
                if escape:
                    escape = False
                    continue
                if ch == "\\":
                    escape = True
                    continue
                if ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start_idx: pos + 1]
        return None

    for i, ch in enumerate(cleaned):
        if ch == "{":
            candidate = _extract_balanced_object(cleaned, i)
            if not candidate:
                continue
            try:
                parsed = json.loads(candidate)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                continue

    # 4) substring between first '{' and last '}'
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1 and last > first:
        try:
            candidate = cleaned[first:last + 1]
            candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def compact_for_merge_prompt(
    value: Any,
    max_depth: int = 4,
    max_items: int = 10,
    max_str: int = 280,
) -> Any:
    """
    Recursively reduce a nested value so it fits in a merge-LLM prompt
    without changing the source dict (operates on a logical copy).
    """
    if max_depth <= 0:
        return "..."

    if isinstance(value, dict):
        return {
            str(k): compact_for_merge_prompt(v, max_depth - 1, max_items, max_str)
            for k, v in value.items()
        }

    if isinstance(value, list):
        sliced = value[:max_items]
        compacted: List[Any] = [
            compact_for_merge_prompt(item, max_depth - 1, max_items, max_str)
            for item in sliced
        ]
        if len(value) > max_items:
            compacted.append(f"... ({len(value) - max_items} more items)")
        return compacted

    if isinstance(value, str) and len(value) > max_str:
        return value[:max_str] + "..."

    return value
