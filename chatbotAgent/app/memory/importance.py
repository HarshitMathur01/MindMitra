"""
Importance scorer (write-time gate).

Decides whether a turn is "memorable" enough to write to episodic store.
Default uses a deterministic heuristic so we can run offline; an optional
LLM-based scorer can be plugged in for production.

Score range: [0.0, 1.0]. Default threshold: 0.55.

Heuristic signals (from research on what humans tend to remember):
    + emotional intensity              (max VAD arousal)
    + named-entity self-disclosure     ("my mum", "my crush", "exam result")
    + first-person narrative           ("I", "me", "my")
    + future commitment / planning     ("tomorrow", "I'll", "I'm going to")
    - generic chit-chat / closers      ("hi", "bye", "ok", "thanks")
    - very short messages              (< 4 tokens)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


_FIRST_PERSON = re.compile(r"\b(?:i|me|my|mine|main|mein|mai|mujhe)\b", re.IGNORECASE)
_FUTURE = re.compile(
    r"\b(?:tomorrow|tonight|next\s+week|i'?ll|i\s+am\s+going\s+to|i\s+will|kal|aaj\s+raat)\b",
    re.IGNORECASE,
)
_SELF_DISCLOSURE_TOKENS = re.compile(
    r"\b(?:my\s+(?:mom|mum|dad|brother|sister|family|friend|crush|partner|gf|bf|girlfriend|boyfriend))"
    r"|\b(?:exam|result|interview|placement|college|hostel|breakup|abuse|trauma|grief)\b",
    re.IGNORECASE,
)
_GENERIC_CLOSERS = {
    "hi", "hello", "hey", "ok", "okay", "thanks", "ty", "thank you", "cool",
    "bye", "goodbye", "good night", "gn", "good morning", "gm", "haan", "haa", "nahi", "no",
}


@dataclass
class ImportanceScore:
    score: float
    reasons: List[str]
    write: bool


def score_turn(
    text: str,
    *,
    affect_vad: Optional[Dict[str, float]] = None,
    intent: Optional[str] = None,
    threshold: float = 0.55,
) -> ImportanceScore:
    """Return an ImportanceScore. Pure-function; no I/O."""
    raw = (text or "").strip()
    reasons: List[str] = []
    score = 0.0

    if not raw:
        return ImportanceScore(score=0.0, reasons=["empty"], write=False)

    if raw.lower() in _GENERIC_CLOSERS:
        return ImportanceScore(score=0.0, reasons=["generic_closer"], write=False)

    tokens = raw.split()
    if len(tokens) < 4:
        score -= 0.3
        reasons.append("short_msg")

    # Emotional intensity: arousal is the most predictive of memorability.
    if affect_vad:
        arousal = float(affect_vad.get("a", 0.0))
        if arousal >= 0.6:
            score += 0.35
            reasons.append(f"high_arousal({arousal:.2f})")
        elif arousal >= 0.4:
            score += 0.15

    # First-person narrative
    if _FIRST_PERSON.search(raw):
        score += 0.15
        reasons.append("first_person")

    # Future commitment / planning
    if _FUTURE.search(raw):
        score += 0.15
        reasons.append("future_plan")

    # Named self-disclosure
    if _SELF_DISCLOSURE_TOKENS.search(raw):
        score += 0.30
        reasons.append("self_disclosure")

    # Intent boost: vent / reflection / crisis are always memorable.
    if intent in {"vent", "reflection"}:
        score += 0.15
        reasons.append(f"intent_{intent}")
    elif intent in {"crisis"}:
        score += 0.50
        reasons.append("intent_crisis")
    elif intent in {"casual", "logistics"}:
        score -= 0.15
        reasons.append(f"intent_{intent}")

    score = max(0.0, min(1.0, 0.4 + score))   # base 0.4 + adjustments, clamp 0..1
    return ImportanceScore(score=score, reasons=reasons, write=score >= threshold)
