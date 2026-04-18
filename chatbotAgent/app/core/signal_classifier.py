from __future__ import annotations

import re
from typing import List, Set

from .memory_pipeline_types import SignalResult


_CRISIS = frozenset(
    {
        "suicide",
        "kill myself",
        "end my life",
        "don't want to live",
        "dont want to live",
        "hurt myself",
        "self harm",
        "self-harm",
        "cutting",
        "overdose",
    }
)

_FIRST_PERSON_EN = (
    "i am ",
    "i'm ",
    "i have ",
    "i've ",
    "my ",
    "i work",
    "i live",
    "i feel",
    "i hate",
    "i love",
    "i want",
    "i need",
)

_FIRST_PERSON_HI = ("mera ", "meri ", "mai ", "mujhe ", "mujhe", "main ")

_EMOTIONAL_STRONG = frozenset(
    {
        "never",
        "always",
        "every time",
        "i can't",
        "i wont",
        "i won't",
        "terrified",
        "devastated",
        "ecstatic",
        "breakdown",
        "panic",
        "crisis",
        "hurt",
        "abandoned",
        "worthless",
        "hopeless",
    }
)

_DISCLOSURE = (
    "i haven't told anyone",
    "i've never said this",
    "honestly",
    "truth is",
    "actually",
)

_SELF_QUESTIONS = ("do you think i", "am i", "why do i always")


def _user_text(messages: List[dict]) -> str:
    parts: List[str] = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        if m.get("role") != "user":
            continue
        c = (m.get("content") or "").strip()
        if c:
            parts.append(c)
    return "\n".join(parts)


def _lower(text: str) -> str:
    return text.lower()


def _has_crisis(lower: str) -> bool:
    return any(k in lower for k in _CRISIS)


def _has_first_person(lower: str) -> bool:
    pad = f" {lower} "
    for p in _FIRST_PERSON_EN:
        q = p if p.endswith(" ") else f" {p} "
        if q in pad or lower.startswith(p.strip()):
            return True
    if any(p in lower for p in _FIRST_PERSON_HI):
        return True
    return False


def _has_named_entity_proper_noun(text: str) -> bool:
    """Consecutive Title Case words (simple proper-noun proxy), not only line-start."""
    for line in re.split(r"[\n\r]+", text):
        line = line.strip()
        if not line:
            continue
        # Skip first token as likely sentence-start capital.
        rest = line.split(None, 1)
        tail = rest[1] if len(rest) > 1 else ""
        if re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", tail):
            return True
        if len(rest) == 1 and re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+", line):
            # Single-token line with two capitals e.g. "New York"
            if re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+\b", line):
                return True
    return False


def _suggested_types(lower: str) -> List[str]:
    types: Set[str] = set()
    if any(
        x in lower
        for x in (
            "i work",
            "i am a",
            "i'm a",
            "i live",
            "my name",
            "my job",
            "teacher",
            "engineer",
            "mera naam",
            "meri job",
        )
    ):
        types.add("semantic")
    if any(x in lower for x in ("yesterday", "last week", "when i was", "happened", "went to", "met ")):
        types.add("episodic")
    if any(x in lower for x in _EMOTIONAL_STRONG) or "i feel" in lower or "i hate" in lower:
        types.add("affective")
    if any(x in lower for x in ("breathing", "meditation", "therapy", "coping", "technique", "helps me")):
        types.add("procedural")
    if not types:
        types.add("semantic")
    return sorted(types)


class SignalClassifier:
    def classify(self, messages: List[dict], user_id: str) -> SignalResult:
        del user_id  # reserved for optional future LLM confirmation
        text = _user_text(messages)
        lower = _lower(text)
        if not lower.strip():
            return SignalResult(False, [], "normal")

        if _has_crisis(lower):
            return SignalResult(
                True,
                ["episodic", "affective"],
                "crisis",
            )

        urgency = "normal"
        if any(k in lower for k in _EMOTIONAL_STRONG):
            urgency = "elevated"

        worthy = False
        if _has_first_person(lower):
            worthy = True
        if _has_named_entity_proper_noun(text):
            worthy = True
        if any(k in lower for k in _EMOTIONAL_STRONG):
            worthy = True
        if any(d in lower for d in _DISCLOSURE):
            worthy = True
        if any(q in lower for q in _SELF_QUESTIONS):
            worthy = True

        if not worthy:
            return SignalResult(False, [], urgency)

        return SignalResult(True, _suggested_types(lower), urgency)
