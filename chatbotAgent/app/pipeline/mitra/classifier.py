"""
Turn classifier — fast, deterministic, lexical-first.

Outputs:
    intent      ∈ {vent, seek_advice, ask_info, share_event, check_in, test, smalltalk, safety}
    needs_memory ∈ bool   — should we retrieve episodic / relational / procedural?
    needs_self_disclosure ∈ bool  — is the user asking us about ourselves / past?
    safety_signal ∈ {none, soft, hard}  — pre-LLM lexical safety read

Why no LLM here? Latency. The classifier sits on the hot path and fires
sub-millisecond on >95% of turns. The crisis fast-path runs separately
(see `app.pipeline.crisis_fast_path`) for the deepest safety call.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class Intent(str, Enum):
    VENT = "vent"
    SEEK_ADVICE = "seek_advice"
    ASK_INFO = "ask_info"
    SHARE_EVENT = "share_event"
    CHECK_IN = "check_in"
    TEST = "test"
    SMALLTALK = "smalltalk"
    SAFETY = "safety"


@dataclass
class TurnClassification:
    intent: Intent
    needs_memory: bool
    needs_self_disclosure: bool
    safety_signal: str = "none"   # none | soft | hard
    debug: dict = field(default_factory=dict)


# ── Lexicons ────────────────────────────────────────────────────────────────

_VENT = re.compile(
    r"\b(i\s*(?:am|'m|m)\s+(?:so|really|just)?\s*"
    r"(?:tired|exhausted|drained|broken|done|sad|low|angry|anxious|hurt|alone|lonely|"
    r"overwhelmed|stuck|empty|numb|frustrated|stressed|crying))\b",
    re.IGNORECASE,
)
_VENT_ROMAN_HI = re.compile(
    r"\b(thak\s*gaya|thaki?\s*gayi|tang\s*aa\s*gaya|akela\s*hoon|akeli\s*hoon|"
    r"udaas|pareshaan|tension|gussa|rona\s*aa\s*raha|man\s+nahin\s*lag)\b",
    re.IGNORECASE,
)

_SEEK_ADVICE = re.compile(
    r"\b(what\s+should\s+i|how\s+(?:do|can|should)\s+i|"
    r"any\s+(?:advice|tips|suggestion)|help\s+me\s+(?:with|to)|"
    r"what\s+would\s+you|kya\s+karu|kya\s+karoon|kaise\s+karu|salaah)\b",
    re.IGNORECASE,
)

_ASK_INFO = re.compile(
    r"^(what|when|where|who|why|how)\b.*\?\s*$|"
    r"\b(define|explain|tell\s+me\s+about|kya\s+hai)\b",
    re.IGNORECASE,
)

_SHARE_EVENT = re.compile(
    r"\b(today\s+i|yesterday\s+i|just\s+(?:happened|got|did)|"
    r"(?:this|last)\s+(?:week|month)\s+i|aaj\s+(?:mai|main|maine))\b",
    re.IGNORECASE,
)

_CHECK_IN = re.compile(
    r"^(hi|hello|hey|yo|namaste|hii+|heyy+)\b|"
    r"\b(how\s+are\s+you|how(?:'s|s|\s+is)\s+it\s+going|kya\s+hal|kaise\s+ho|kaisi\s+ho)\b",
    re.IGNORECASE,
)

_TEST = re.compile(r"^(test|ping|hello\s*\?\s*$)", re.IGNORECASE)

_SELF_DISCLOSURE = re.compile(
    r"\b(do\s+you\s+remember|what\s+do\s+you\s+(?:remember|know)\s+about\s+me|"
    r"who\s+(?:are\s+you|am\s+i\s+to\s+you)|"
    r"(?:last|previous)\s+time\s+(?:we|i|you)|"
    r"yaad\s+hai|tumhe\s+yaad)\b",
    re.IGNORECASE,
)

_SOFT_SAFETY = re.compile(
    r"\b(hopeless|worthless|burden|can'?t\s+go\s+on|tired\s+of\s+(?:living|life)|"
    r"no\s+(?:point|reason)|nothing\s+matters)\b",
    re.IGNORECASE,
)

# Hard signals are handled by the crisis fast-path; we only mark them here so
# the orchestrator can short-circuit before retrieval if it wants to.
_HARD_SAFETY = re.compile(
    r"\b(kill\s+myself|end\s+(?:my\s+life|it\s+all)|suicide|jaan\s+de\s+du)\b",
    re.IGNORECASE,
)


def classify(user_message: str, *, recent_turns: Optional[List[str]] = None) -> TurnClassification:
    msg = (user_message or "").strip()
    if not msg:
        return TurnClassification(
            intent=Intent.SMALLTALK,
            needs_memory=False,
            needs_self_disclosure=False,
            safety_signal="none",
        )

    debug = {"len": len(msg)}

    # Safety pre-screen (cheap; the fast-path is authoritative).
    if _HARD_SAFETY.search(msg):
        return TurnClassification(
            intent=Intent.SAFETY, needs_memory=False, needs_self_disclosure=False,
            safety_signal="hard", debug=debug,
        )
    safety = "soft" if _SOFT_SAFETY.search(msg) else "none"

    needs_self = bool(_SELF_DISCLOSURE.search(msg))

    # Check intent in priority order: TEST < CHECK_IN < SEEK_ADVICE < SHARE_EVENT < VENT < ASK_INFO < SMALLTALK.
    if _TEST.match(msg):
        intent = Intent.TEST
    elif _VENT.search(msg) or _VENT_ROMAN_HI.search(msg):
        intent = Intent.VENT
    elif _SEEK_ADVICE.search(msg):
        intent = Intent.SEEK_ADVICE
    elif _SHARE_EVENT.search(msg):
        intent = Intent.SHARE_EVENT
    elif _CHECK_IN.match(msg):
        intent = Intent.CHECK_IN
    elif _ASK_INFO.search(msg):
        intent = Intent.ASK_INFO
    else:
        intent = Intent.SMALLTALK

    # Memory retrieval policy: skip on the most trivial intents.
    needs_mem = intent not in (Intent.TEST, Intent.CHECK_IN, Intent.SMALLTALK) or needs_self
    if safety == "soft":
        needs_mem = True   # we want past episodes for grounded support

    return TurnClassification(
        intent=intent,
        needs_memory=needs_mem,
        needs_self_disclosure=needs_self,
        safety_signal=safety,
        debug=debug,
    )


class IntentClassifier:
    """Stateless wrapper so we can dependency-inject in the orchestrator."""

    def classify(self, user_message: str, *, recent_turns: Optional[List[str]] = None) -> TurnClassification:
        return classify(user_message, recent_turns=recent_turns)
