"""
Critic v0/v1 — therapeutic + safety + style critic.

v0 (Phase 1): five rules with deterministic regex/heuristic checks; LLM is
optional. Returns a list of `Issue` and a `verdict` ∈ {ACCEPT, SOFT_REWRITE, REJECT}.

v1 (Phase 5): adds question-budget enforcement using prior turn traces.

The whole module is dependency-light so the critic can run on hot path
without pulling Supabase/Qdrant.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class Verdict(str, Enum):
    ACCEPT = "ACCEPT"
    SOFT_REWRITE = "SOFT_REWRITE"
    REJECT = "REJECT"


class Severity(str, Enum):
    INFO = "info"
    WARN = "warn"
    BLOCK = "block"


@dataclass
class Issue:
    rule_id: str
    severity: Severity
    detail: str
    suggestion: Optional[str] = None


@dataclass
class CritiqueReport:
    verdict: Verdict
    issues: List[Issue] = field(default_factory=list)
    rewrite_hint: Optional[str] = None


# ── Rule 1 — Sycophancy guard ────────────────────────────────────────────────

_SYCOPHANCY_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\bgreat\s+question\b",
        r"\bwhat\s+a\s+(?:wonderful|beautiful|amazing|powerful)\b",
        r"\byou(?:\s+are|'re)\s+(?:absolutely|completely)\s+right\b",
        r"\byou(?:\s+are|'re)\s+so\s+(?:strong|brave|amazing|incredible)\b",
        r"\bi(?:\s+am|'m)\s+so\s+(?:proud|happy|honoured|honored)\s+(?:to|of)\b",
    ]
]


def _check_sycophancy(draft: str) -> List[Issue]:
    out: List[Issue] = []
    for rx in _SYCOPHANCY_PATTERNS:
        m = rx.search(draft)
        if m:
            out.append(Issue(
                rule_id="sycophancy",
                severity=Severity.WARN,
                detail=f"Sycophantic opener: {m.group(0)!r}",
                suggestion="Replace with a quiet acknowledgement.",
            ))
    return out


# ── Rule 2 — False-emotion claims ────────────────────────────────────────────

_FALSE_EMOTION_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        # "I am sad" or "I'm sad" — note 'm has no leading whitespace
        r"\bi(?:\s+am|'m)\s+(?:so\s+|really\s+|truly\s+)?(?:sad|sorry|hurt|crying|heartbroken|devastated|in\s+pain)\b",
        r"\bi\s+feel\s+your\s+pain\b",
        r"\bmy\s+heart\s+(?:is\s+)?(?:breaking|broken)\b",
        r"\bi\s+truly\s+understand\s+how\s+you\s+feel\b",
    ]
]


def _check_false_emotion(draft: str) -> List[Issue]:
    out: List[Issue] = []
    for rx in _FALSE_EMOTION_PATTERNS:
        m = rx.search(draft)
        if m:
            out.append(Issue(
                rule_id="false_emotion",
                severity=Severity.BLOCK,
                detail=f"Bot claims emotion it can't have: {m.group(0)!r}",
                suggestion='Use "that sounds…" / "I can imagine that…" framing.',
            ))
    return out


# ── Rule 3 — Premature advice (when intent likely vent) ──────────────────────

_ADVICE_OPENERS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\byou\s+should\b",
        r"\byou\s+need\s+to\b",
        r"\bhave\s+you\s+tried\b",
        r"\bwhy\s+don'?t\s+you\b",
        r"\bjust\s+(?:try|do|stop)\b",
    ]
]


def _check_premature_advice(draft: str, *, intent: Optional[str]) -> List[Issue]:
    if intent not in {"vent", "reflection"}:
        return []
    out: List[Issue] = []
    for rx in _ADVICE_OPENERS:
        m = rx.search(draft)
        if m:
            out.append(Issue(
                rule_id="premature_advice",
                severity=Severity.WARN,
                detail=f"Advice in a venting/reflection turn: {m.group(0)!r}",
                suggestion="Reflect first; only offer suggestions if explicitly asked.",
            ))
    return out


# ── Rule 4 — Memory hallucination guard ──────────────────────────────────────

_MEMORY_CLAIM_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\bi\s+remember\s+you\s+(?:said|told\s+me)\b",
        r"\blast\s+time\s+you\s+(?:said|mentioned)\b",
        r"\byou\s+(?:once\s+)?told\s+me\s+that\b",
    ]
]


def _check_memory_hallucination(draft: str, *, retrieved_memories: List[str]) -> List[Issue]:
    """v1 false-memory verification:

    1. If the draft *claims* memory but none was retrieved → BLOCK.
    2. If the draft cites a quoted phrase ('"…"') AND the phrase doesn't appear
       (substring, case-insensitive) in any retrieved memory → BLOCK as
       fabrication.

    The cited-phrase check is intentionally conservative — we only fire on
    explicit quotation, not paraphrase.
    """
    issues: List[Issue] = []
    if not retrieved_memories:
        for rx in _MEMORY_CLAIM_PATTERNS:
            m = rx.search(draft)
            if m:
                issues.append(Issue(
                    rule_id="memory_hallucination",
                    severity=Severity.BLOCK,
                    detail=f"Draft claims memory but none retrieved: {m.group(0)!r}",
                    suggestion="Drop the callback; respond from this turn only.",
                ))
        return issues

    # Verify quoted citations are actually grounded.
    quoted = re.findall(r'"([^"\n]{4,80})"', draft)
    if not quoted:
        return issues
    haystack = " ".join((s or "").lower() for s in retrieved_memories)
    for q in quoted:
        if q.lower().strip() not in haystack:
            issues.append(Issue(
                rule_id="memory_quote_unverified",
                severity=Severity.BLOCK,
                detail=f"Quoted phrase not in any retrieved memory: {q!r}",
                suggestion="Remove the direct quote or paraphrase without quoting.",
            ))
    return issues


# ── Rule 5 — Question budget (Phase 3 hardens this with windowed counts) ────

def _count_real_questions(draft: str) -> int:
    """Count `?` excluding clearly-rhetorical patterns."""
    if "?" not in draft:
        return 0
    rhetorical = re.findall(r"(?:right\?|isn'?t\s+it\?|na\?|haina\?)", draft, re.IGNORECASE)
    return draft.count("?") - len(rhetorical)


def _check_question_budget(draft: str, *, max_per_turn: int) -> List[Issue]:
    n = _count_real_questions(draft)
    if n <= max_per_turn:
        return []
    return [Issue(
        rule_id="question_budget_per_turn",
        severity=Severity.WARN,
        detail=f"Draft has {n} questions; budget is {max_per_turn}.",
        suggestion="Collapse trailing questions into reflective statements.",
    )]


# ── Rule 6 — Diagnosis claims (clinical-overreach guard) ───────────────────

_DIAGNOSIS_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\byou\s+(?:are|have|might\s+be|seem\s+to\s+have|sound\s+like\s+you\s+have)\s+"
        r"(?:depressed|depression|anxious|anxiety|bipolar|borderline|adhd|"
        r"autistic|ptsd|ocd|schizophren|psychotic)\b",
        r"\byou\s+suffer\s+from\b",
        r"\bdiagnos(?:ed|is)\s+with\b",
        r"\byou\s+meet\s+criteria\s+for\b",
    ]
]


def _check_diagnosis_claim(draft: str) -> List[Issue]:
    issues: List[Issue] = []
    for rx in _DIAGNOSIS_PATTERNS:
        m = rx.search(draft)
        if m:
            issues.append(Issue(
                rule_id="diagnosis_claim",
                severity=Severity.BLOCK,
                detail=f"Draft makes a clinical-style claim: {m.group(0)!r}",
                suggestion="Avoid diagnostic language. Reflect feelings, refer to a "
                           "professional if asked.",
            ))
    return issues


# ── Rule 7 — Empathy floor (don't ship a cold reply to a vent) ─────────────

_EMPATHY_MARKERS = re.compile(
    r"\b(that\s+sounds|that\s+seems|i\s+can\s+(?:imagine|hear)|"
    r"it\s+(?:sounds|seems)|sounds\s+like|"
    r"yeh\s+(?:sun|lag)|lag\s+raha|samajh\s+sakta|samajh\s+sakti|"
    r"i'?m\s+here|i\s+hear\s+you|you'?re\s+not\s+alone)\b",
    re.IGNORECASE,
)


def _check_empathy_floor(draft: str, *, intent: Optional[str], stance_constraints) -> List[Issue]:
    """Vent / co_regulate / validate stances must contain at least one
    empathy marker. Without it, the response feels clinical or dismissive."""
    requires_empathy = (
        (intent in {"vent", "share_event"}) or
        (stance_constraints is not None
         and getattr(stance_constraints, "must_validate_first", False))
    )
    if not requires_empathy:
        return []
    if _EMPATHY_MARKERS.search(draft or ""):
        return []
    return [Issue(
        rule_id="empathy_floor",
        severity=Severity.INFO,
        detail="Draft lacks any empathy marker for a vent/validate context.",
        suggestion="Open with a brief reflection naming what they seem to feel.",
    )]


# ── Rule 8 — Length floor (one-liner = dismissive in this product) ─────────

def _check_length_floor(draft: str, *, stance_constraints) -> List[Issue]:
    if not draft or not draft.strip():
        return [Issue(
            rule_id="length_floor",
            severity=Severity.BLOCK,
            detail="Empty draft.",
            suggestion="Generate a substantive reply.",
        )]
    n_chars = len(draft.strip())
    # Crisis & co-regulate are intentionally short, so use a softer minimum.
    floor = 40
    if stance_constraints is not None:
        sv = getattr(getattr(stance_constraints, "stance", None), "value", "")
        if sv in {"crisis", "co_regulate", "inform"}:
            floor = 20
    if n_chars < floor:
        return [Issue(
            rule_id="length_floor",
            severity=Severity.INFO,
            detail=f"Draft only {n_chars} chars (floor {floor}).",
            suggestion="Add one more line of reflection — a one-liner reads as cold.",
        )]
    return []


# ── Rule 9 — Stance compliance (length + advice + validation-first) ────────

_VALIDATION_OPENERS = re.compile(
    r"^\s*(?:that\s+sounds|that\s+seems|i\s+can\s+(?:imagine|hear)|"
    r"it\s+(?:sounds|seems)|sounds\s+like|"
    r"yeh\s+(?:sun|lag)|lag\s+raha|samajh\s+sakta|samajh\s+sakti)",
    re.IGNORECASE,
)

_ADVICE_OPENERS_STRICT = re.compile(
    r"\b(you\s+should|you\s+need\s+to|i\s+(?:would\s+)?suggest|"
    r"my\s+advice|try\s+(?:to|this)|here'?s\s+what\s+to\s+do)\b",
    re.IGNORECASE,
)


def _count_sentences(draft: str) -> int:
    if not draft:
        return 0
    return len([s for s in re.split(r"[.!?]+", draft) if s.strip()])


def _check_stance_compliance(draft: str, *, stance_constraints) -> List[Issue]:
    if stance_constraints is None:
        return []
    issues: List[Issue] = []
    max_sent = int(getattr(stance_constraints, "max_sentences", 8))
    if _count_sentences(draft) > max_sent + 1:
        issues.append(Issue(
            rule_id="stance_length",
            severity=Severity.WARN,
            detail=f"Draft exceeds stance length budget ({max_sent} sentences).",
            suggestion="Tighten — keep only the validation + one core line.",
        ))
    if not getattr(stance_constraints, "advice_allowed", True):
        m = _ADVICE_OPENERS_STRICT.search(draft)
        if m:
            issues.append(Issue(
                rule_id="stance_advice_forbidden",
                severity=Severity.BLOCK,
                detail=f"Stance forbids advice; found {m.group(0)!r}.",
                suggestion="Replace advice with reflection or a soft invitation.",
            ))
    if getattr(stance_constraints, "must_validate_first", False):
        # Look at the first ~120 chars for a validation move.
        head = (draft or "").strip()[:120]
        if head and not _VALIDATION_OPENERS.search(head):
            issues.append(Issue(
                rule_id="stance_no_validation",
                severity=Severity.WARN,
                detail="Stance requires a validation opener; none detected.",
                suggestion="Open with a brief reflection naming what they seem to feel.",
            ))
    return issues


# ── Public API ───────────────────────────────────────────────────────────────

def _check_question_budget_windowed(
    draft: str, *, max_per_window: int, prior_questions_in_window: int,
) -> List[Issue]:
    n = _count_real_questions(draft)
    if (prior_questions_in_window + n) <= max_per_window:
        return []
    return [Issue(
        rule_id="question_budget_per_window",
        severity=Severity.WARN,
        detail=(
            f"Draft has {n} questions; prior window already used "
            f"{prior_questions_in_window}/{max_per_window}."
        ),
        suggestion="Drop or convert at least one trailing question.",
    )]


def critique(
    draft: str,
    *,
    intent: Optional[str] = None,
    retrieved_memories: Optional[List[str]] = None,
    max_questions_per_turn: int = 1,
    max_questions_per_window: Optional[int] = None,
    prior_questions_in_window: int = 0,
    stance_constraints=None,
) -> CritiqueReport:
    """Run all v0 rules on a draft and return a verdict.

    `max_questions_per_window` enables the Phase 3 windowed question budget;
    when supplied, `prior_questions_in_window` should be the count of questions
    the bot asked across the last 5 turns of this session (from turn traces).

    `stance_constraints` (StanceConstraints) is optional but recommended — when
    present, the critic adds stance-compliance checks (length, validation-first,
    advice-when-forbidden).
    """
    issues: List[Issue] = []
    issues.extend(_check_false_emotion(draft))
    issues.extend(_check_memory_hallucination(draft, retrieved_memories=retrieved_memories or []))
    issues.extend(_check_diagnosis_claim(draft))
    issues.extend(_check_sycophancy(draft))
    issues.extend(_check_premature_advice(draft, intent=intent))
    issues.extend(_check_question_budget(draft, max_per_turn=max_questions_per_turn))
    if max_questions_per_window is not None:
        issues.extend(_check_question_budget_windowed(
            draft,
            max_per_window=max_questions_per_window,
            prior_questions_in_window=prior_questions_in_window,
        ))
    issues.extend(_check_stance_compliance(draft, stance_constraints=stance_constraints))
    issues.extend(_check_empathy_floor(draft, intent=intent, stance_constraints=stance_constraints))
    issues.extend(_check_length_floor(draft, stance_constraints=stance_constraints))

    if any(i.severity == Severity.BLOCK for i in issues):
        verdict = Verdict.REJECT
    elif any(i.severity == Severity.WARN for i in issues):
        verdict = Verdict.SOFT_REWRITE
    else:
        verdict = Verdict.ACCEPT

    rewrite_hint = (
        "Rewrite preserving the user's emotional content but: "
        + " | ".join(i.suggestion for i in issues if i.suggestion)
    ) if issues else None

    return CritiqueReport(verdict=verdict, issues=issues, rewrite_hint=rewrite_hint)
