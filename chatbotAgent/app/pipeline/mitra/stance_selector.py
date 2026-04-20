"""
Stance Selector — maps a classified turn to ONE of seven therapeutic stances.

The stance is a *structural commitment* about what kind of response is allowed,
NOT just a tone hint. It binds the prompt template, the question budget, and
the critic's checks together.

Stances (in priority order — first match wins):

    CRISIS      — hard self-harm signal (handled by fast-path; we still emit
                  CRISIS so traces are uniform).
    REFER       — clinical-territory ask we shouldn't answer ("am I depressed?",
                  "should I take medication?", drug-interaction questions).
    CO_REGULATE — the user is acutely dysregulated (panic, racing thoughts,
                  acute grief). Slow down, body-aware, very short sentences.
    VALIDATE    — venting, self-disclosure, low affect. Lead with reflection.
    REFLECT     — open processing without explicit ask; mirror + invite more.
    INQUIRE     — explicit "what should I…" / "kya karoon" → ONE small clarifying
                  question, never advice yet.
    INFORM      — psycho-education question ("what is anxiety?") — short,
                  factual, non-prescriptive.

Deterministic. No LLM call. Output is a `Stance` plus a tiny `StanceConstraints`
record the assembler/critic can read.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

from .classifier import Intent, TurnClassification


class Stance(str, Enum):
    VALIDATE   = "validate"
    REFLECT    = "reflect"
    INQUIRE    = "inquire"
    CO_REGULATE = "co_regulate"
    INFORM     = "inform"
    REFER      = "refer"
    CRISIS     = "crisis"


@dataclass(frozen=True)
class StanceConstraints:
    """What the chosen stance is *allowed* and *forbidden* to do.
    Read by the prompt builder + critic guardrail."""
    stance: Stance
    max_questions: int            # questions allowed in THIS turn
    max_sentences: int            # soft upper bound on length
    must_validate_first: bool     # the response must open with a validation move
    advice_allowed: bool          # may the response offer suggestions?
    callbacks_allowed: bool       # may the response reference past sessions?
    body_aware: bool              # bias toward grounding/breath cues
    rationale: str                # short human-readable explanation


# ── Lexical patterns that bypass intent for stance routing ─────────────────

_REFER = re.compile(
    r"\b(am\s+i\s+(?:depressed|bipolar|adhd|autistic|borderline)|"
    r"should\s+i\s+take\s+(?:antidepressant|medication|pill)|"
    r"diagnose|"
    r"will\s+(?:therapy|counsel|psychiatrist)\s+help|"
    r"can\s+you\s+prescribe|"
    r"interaction\s+(?:between|of)\s+\w+\s+and\s+\w+)\b",
    re.IGNORECASE,
)

_CO_REGULATE = re.compile(
    r"\b(panic\s+attack|i\s+can'?t\s+breathe|heart\s+(?:racing|pounding)|"
    r"shaking|trembling|hyperventilat|dissociat|going\s+to\s+pass\s+out|"
    r"saans\s+nahi|panic\s+ho\s+raha|haath\s+kaap)\b",
    re.IGNORECASE,
)

_INFORM = re.compile(
    r"^(what\s+is|define|explain)\b",
    re.IGNORECASE,
)


def select_stance(
    *,
    classification: TurnClassification,
    affect_pattern: Optional[Any] = None,
    user_message: str = "",
    preferences: Optional[Any] = None,
) -> StanceConstraints:
    """Pick a stance from the (classified turn × current affect × preferences)."""

    msg = (user_message or "").strip()
    intent = classification.intent
    safety = classification.safety_signal

    # 1. Hard safety always → CRISIS (the fast-path will fire too; keep parity).
    if safety == "hard" or intent == Intent.SAFETY:
        return _crisis_constraints()

    # 2. Clinical-territory questions → REFER.
    if _REFER.search(msg):
        return _refer_constraints()

    # 3. Acute dysregulation cue → CO_REGULATE.
    if _CO_REGULATE.search(msg):
        return _co_regulate_constraints()

    # 4. Affect pattern + soft safety → CO_REGULATE.
    if safety == "soft" and _affect_is_negative(affect_pattern):
        return _co_regulate_constraints()

    # 5. Explicit psycho-education ask → INFORM.
    if _INFORM.match(msg) and intent == Intent.ASK_INFO:
        return _inform_constraints()

    # 6. Explicit advice request → INQUIRE (one clarifier first, never advice).
    if intent == Intent.SEEK_ADVICE:
        return _inquire_constraints()

    # 7. Vent or strong self-disclosure → VALIDATE.
    if intent == Intent.VENT:
        return _validate_constraints(prefers_listening=_prefers_listening(preferences))

    # 8. Anything else (smalltalk, share_event, check_in) → REFLECT.
    return _reflect_constraints()


# ── Constraint factories ────────────────────────────────────────────────────

def _validate_constraints(prefers_listening: bool) -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.VALIDATE,
        max_questions=0 if prefers_listening else 1,
        max_sentences=4,
        must_validate_first=True,
        advice_allowed=False,
        callbacks_allowed=True,
        body_aware=False,
        rationale="user is venting / disclosing — listen, don't fix",
    )


def _reflect_constraints() -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.REFLECT,
        max_questions=1,
        max_sentences=4,
        must_validate_first=False,
        advice_allowed=False,
        callbacks_allowed=True,
        body_aware=False,
        rationale="open processing — mirror and invite",
    )


def _inquire_constraints() -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.INQUIRE,
        max_questions=1,
        max_sentences=3,
        must_validate_first=True,
        advice_allowed=False,
        callbacks_allowed=False,
        body_aware=False,
        rationale="advice ask — clarify before solving (MI spirit)",
    )


def _co_regulate_constraints() -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.CO_REGULATE,
        max_questions=0,
        max_sentences=3,
        must_validate_first=True,
        advice_allowed=False,
        callbacks_allowed=False,
        body_aware=True,
        rationale="acute dysregulation — slow, embodied, very short",
    )


def _inform_constraints() -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.INFORM,
        max_questions=0,
        max_sentences=5,
        must_validate_first=False,
        advice_allowed=False,
        callbacks_allowed=False,
        body_aware=False,
        rationale="psycho-education — short, factual, non-prescriptive",
    )


def _refer_constraints() -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.REFER,
        max_questions=0,
        max_sentences=4,
        must_validate_first=True,
        advice_allowed=False,
        callbacks_allowed=False,
        body_aware=False,
        rationale="clinical territory — refer warmly to a professional",
    )


def _crisis_constraints() -> StanceConstraints:
    return StanceConstraints(
        stance=Stance.CRISIS,
        max_questions=0,
        max_sentences=6,
        must_validate_first=True,
        advice_allowed=False,
        callbacks_allowed=False,
        body_aware=True,
        rationale="hard safety signal — handled by fast-path",
    )


# ── helpers ─────────────────────────────────────────────────────────────────

def _affect_is_negative(affect_pattern) -> bool:
    if not affect_pattern:
        return False
    v = getattr(affect_pattern, "valence_mean", None)
    if v is None and isinstance(affect_pattern, dict):
        v = affect_pattern.get("valence_mean")
    try:
        return float(v) < -0.2
    except (TypeError, ValueError):
        return False


def _prefers_listening(preferences) -> bool:
    if preferences is None:
        return False
    return bool(getattr(preferences, "prefers_listening", False))
