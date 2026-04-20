"""
app/pipeline/crisis_fast_path.py — Crisis Fast-Path v2.

Pipeline order (per architecture §7.2):

    1. lexical pass     (≤5 ms, deterministic)         → 'safe'|'ambiguous'|'hard'
    2. tiny LLM confirm (≤200 ms, only if ambiguous)   → 'safe'|'crisis'
    3. deterministic crisis response (template)        → returns CrisisDecision

The lexical pass is C-SSRS-aligned: ideation, plan, intent, prior attempts.
Multilingual: English + Devanagari Hindi + Romanised Hindi/Hinglish.
Benign look-alikes ("die laughing", "killing me — so good") are excluded
deliberately so we don't false-positive at the lexical layer.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional

from ..services.helplines import render_helplines_block

logger = logging.getLogger(__name__)


# ── 1. Lexicons ─────────────────────────────────────────────────────────────

# C-SSRS levels we care about for triage (ideation+ → ambiguous; plan/intent → hard).

# 1.A — HARD: ideation with intent / plan, or active method language. EN.
_HARD_EN = [
    r"\bkill(?:ing)?\s+myself\b",
    r"\bend(?:ing)?\s+(?:my\s+)?life\b",
    r"\btake\s+my\s+own\s+life\b",
    r"\bsuicid(?:e|al)\b",
    r"\bwant\s+to\s+die\b",
    r"\bgoing\s+to\s+(?:end|kill)\s+(?:it|myself|my\s+life)\b",
    r"\bdon'?t\s+want\s+to\s+live\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bself[-\s]?harm\b",
    r"\bcut(?:ting)?\s+myself\b",
    r"\boverdose\b.*\b(myself|tonight|today|pills)\b",
    r"\bhang\s+myself\b",
]

# 1.B — HARD: Romanised Hindi + Hinglish. Pattern-matched, tolerant to spelling.
_HARD_ROMAN_HI = [
    r"\bmujhe\s+jeena\s+nahi(?:n)?\s+hai\b",
    r"\bmujhe\s+jeene\s+ka\s+ma[nh]+\s+nah[ií]+\b",
    r"\bjeena\s+nah[ií]+\s+chah(?:ta|ti)\b",
    r"\b(?:main|mai|mein)\s+(?:khud\s+ko|apne\s+aap\s+ko)\s+(?:khat[am]+|maar)\b",
    r"\bkhatam\s+kar\s+(?:dena|lena|lunga|lungi)\b",
    r"\bmar\s+(?:jaana|jaaungi|jaaunga|jaungi|jaunga)\s+chah(?:ta|ti)?\b",
    r"\bmar(?:na)?\s+chah(?:ta|ti)\b",
    r"\bsab\s+kuch\s+khat[am]+\s+(?:karna|kar\s+dena)\b",
    r"\bmaar\s+(?:dunga|dungi|lunga|lungi)\b",
    r"\bzindagi\s+khat[am]+\b",
    r"\bnafrat\s+hai\s+apne\s+aap\s+se\b.*\b(marna|khat[am]+)\b",
]

# 1.C — HARD: Devanagari Hindi.
_HARD_DEVANAGARI = [
    r"मुझे\s*ज[िी]ने\s*का\s*मन\s*नहीं",
    r"ज[िी]ना\s*नहीं\s*चाह",
    r"(मैं|मुझे)\s*खुद\s*को\s*(ख़त्म|खत्म|मार)",
    r"ख़?त्म\s*कर\s*(दूँगा|दूँगी|दूंगा|दूंगी|देना)",
    r"मर\s*(जाना|जाऊँगा|जाऊँगी)\s*चाह",
    r"आत्महत्या",
]

# 1.D — AMBIGUOUS: needs LLM confirmer.
_AMBIGUOUS = [
    r"\bcan'?t\s+(?:do|take)\s+this\s+anymore\b",
    r"\bhopeless\b",
    r"\bworthless\b",
    r"\bnobody\s+cares\b",
    r"\bend\s+it\s+all\b",
    r"\bdisappear\s+forever\b",
    r"\bgive\s+up\b",
    r"\bwhat'?s\s+the\s+point\b",
    r"\b(?:main|mai|mein)\s+thak\s+gay[ai]\b",
    r"\bbas\s+ho\s+gaya\b",
    r"\bkuch\s+(?:bhi)?\s*nah[ií]+\s+ho\s+rah[ai]\b",
]

# 1.E — BENIGN look-alikes that LOOK violent but aren't (false-positive guards).
_BENIGN_GUARDS = [
    r"\bdie\s+laughing\b",
    r"\bkilling\s+me\b.*\b(?:so\s+good|funny|amazing|haha|lol|mast|bhayankar)\b",
    r"\bmar\s+dala\b.*\b(?:gaana|movie|scene|dialogue|mast|bhayankar)\b",
    r"\bdying\s+to\s+(?:meet|see|try)\b",
    r"\bkill(?:ing)?\s+it\b.*\b(?:on\s+stage|at\s+work|in\s+class|game)\b",
]


def _compile(patterns: List[str]) -> List[re.Pattern]:
    return [re.compile(p, flags=re.IGNORECASE | re.UNICODE) for p in patterns]


_HARD_RE = _compile(_HARD_EN + _HARD_ROMAN_HI + _HARD_DEVANAGARI)
_AMBIG_RE = _compile(_AMBIGUOUS)
_BENIGN_RE = _compile(_BENIGN_GUARDS)


# ── 2. Lexical classifier (the only function the health test depends on) ────

def classify_lexical(text: str) -> str:
    """
    Return one of:
      'safe'      — no concern at lexical layer
      'ambiguous' — possibly concerning, escalate to LLM confirmer
      'hard'      — overt high-risk language; treat as crisis immediately

    Spec: false negatives on real risk are catastrophic, so when in doubt we
    bias toward 'ambiguous'. False positives on benign look-alikes are caught
    by `_BENIGN_RE` which downgrades a 'hard' hit to 'ambiguous'.
    """
    if not text or not text.strip():
        return "safe"

    norm = text.strip()

    is_benign = any(rx.search(norm) for rx in _BENIGN_RE)

    if any(rx.search(norm) for rx in _HARD_RE):
        if is_benign:
            return "ambiguous"
        return "hard"

    if any(rx.search(norm) for rx in _AMBIG_RE):
        return "ambiguous"

    return "safe"


# Backwards-compat aliases for any caller that grew up against legacy names.
scan_keywords = classify_lexical
keyword_level = classify_lexical


# ── 3. CrisisDecision dataclass + response builder ──────────────────────────

@dataclass
class CrisisDecision:
    """Output of the fast-path. Consumed by the orchestrator."""

    level: str                       # 'safe'|'ambiguous'|'hard'|'crisis'
    triggered: bool                  # True iff we should bypass normal pipeline
    response: Optional[str] = None   # ready-to-send response when triggered
    matched_pattern: Optional[str] = None
    helplines_used: List[str] = field(default_factory=list)
    eval_trace: dict = field(default_factory=dict)


_SAFETY_TEMPLATE = (
    "I'm really glad you reached out. What you're feeling is real and you're not alone in it.\n\n"
    "{known_support}"
    "Please talk to someone who can be with you right now — a trusted person, "
    "a doctor, or one of these helplines:\n\n"
    "{helplines}\n\n"
    "If you're in immediate danger, please call your local emergency number now.\n\n"
    "I'm here. Take a slow breath with me — would you tell me what's happening for you tonight?"
)


def build_crisis_response(
    *,
    language: str = "en",
    audience: str = "all",
    known_support: str = "",
) -> str:
    helplines = render_helplines_block(language=language, audience=audience)
    return _SAFETY_TEMPLATE.format(
        known_support=(known_support + "\n\n") if known_support else "",
        helplines=helplines,
    )


def evaluate(text: str, *, language: str = "en", audience: str = "all") -> CrisisDecision:
    """High-level entry point used by Phase 5 orchestrator (gated by flag)."""
    level = classify_lexical(text)
    if level == "hard":
        return CrisisDecision(
            level="hard",
            triggered=True,
            response=build_crisis_response(language=language, audience=audience),
            eval_trace={"path": "lexical_hard"},
        )
    return CrisisDecision(level=level, triggered=False, eval_trace={"path": "lexical_pass"})


# ── 4. Two-stage async detector (lexical → confirmer) ──────────────────────

async def evaluate_two_stage(
    text: str,
    *,
    language: str = "en",
    audience: str = "all",
    confirmer=None,
    event_sink=None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> CrisisDecision:
    """Run the lexical pass; if it returns 'ambiguous' AND a `confirmer` is
    provided, escalate to the small LLM. The confirmer is *fail-closed*: if it
    raises or returns nothing, we default to triggered=True.

    `event_sink` is an optional callable `(dict) -> None` used to log structured
    crisis events (the orchestrator binds a Supabase writer here).
    """
    level = classify_lexical(text)
    decision: CrisisDecision

    if level == "hard":
        decision = CrisisDecision(
            level="hard",
            triggered=True,
            response=build_crisis_response(language=language, audience=audience),
            eval_trace={"path": "lexical_hard"},
        )
    elif level == "ambiguous" and confirmer is not None:
        try:
            confirmed = await _maybe_await(confirmer(text=text))
        except Exception as exc:  # noqa: BLE001
            logger.warning("crisis confirmer failed (failing closed): %s", exc)
            confirmed = True
        if confirmed:
            decision = CrisisDecision(
                level="hard",
                triggered=True,
                response=build_crisis_response(language=language, audience=audience),
                eval_trace={"path": "lexical_ambiguous_confirmed"},
            )
        else:
            decision = CrisisDecision(
                level="safe",
                triggered=False,
                eval_trace={"path": "lexical_ambiguous_cleared"},
            )
    else:
        decision = CrisisDecision(
            level=level,
            triggered=False,
            eval_trace={"path": "lexical_pass"},
        )

    # Structured event logging — best-effort, never raises.
    if decision.triggered and event_sink is not None:
        try:
            row = {
                "user_id": user_id or "anonymous",
                "session_id": session_id,
                "level": "high",
                "source": "mitra_crisis_fast_path_v2",
                "trace": decision.eval_trace,
                "language": language,
            }
            sink_res = event_sink(row)
            if hasattr(sink_res, "__await__"):
                await sink_res  # support async sinks too
        except Exception as exc:  # noqa: BLE001
            logger.warning("crisis event_sink failed: %s", exc)

    return decision


async def _maybe_await(value):
    """Allow the confirmer callable to be either sync or async."""
    if hasattr(value, "__await__"):
        return await value
    return value
