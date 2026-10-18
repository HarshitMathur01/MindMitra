"""Lexical crisis floor — the backstop for a dead signal-extraction model.

Regression cover for the 2026-08-30 outage: Groq decommissioned the configured
llama models, ``_call_groq`` began returning None for every turn, and
``_fallback_raw`` degraded urgency to the session's last known value (0 on a
new session). Because ``crisis_bypass_check`` fires only at urgency 3, an
explicit suicidal message was answered with an ordinary greeting on both
``POST /chat`` and ``POST /anam/crisis-check``.

The floor only runs on the degraded path — see the design note in
``app/pipeline/signal_extraction.py``.
"""
from __future__ import annotations

import re

import pytest

from app.models.signals import AffectVector, GroqSignalRaw
from app.pipeline import signal_extraction
from tests.factories import make_ingested, make_session


async def _groq_down(_message: str, _session):
    """Stand in for a decommissioned / unreachable model."""
    return None


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    [
        "I want to kill myself tonight, I have the pills ready",
        "i think im going to end my life",
        "I've been having suicidal thoughts",
        "honestly i just want to die",
        "main khudkushi karna chahta hoon",
        "mujhe jaan de deni hai",
        "ab jeena nahi chahta",
        "मैं आत्महत्या करना चाहता हूँ",
    ],
)
def test_lexical_hit_matches_explicit_intent(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    [
        "I have a lot of assignments due this week and I am tired",
        "hello",
        "my exams are killing me",
        "that lecture was dead boring",
        "I'm dying to see the new movie",
        # Negated — the thought is described as past/absent.
        "I don't want to kill myself anymore, that phase passed",
    ],
)
def test_lexical_hit_ignores_benign_and_negated(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is None


# -- Negation guard -------------------------------------------------------
#
# The guard may only ever *narrow* what it suppresses. Every list below that
# must escalate is a message a negation in the wrong place used to mute.

NEGATION_IN_ANOTHER_CLAUSE = [
    "I am not okay, I want to die",
    "I don't know, I want to kill myself",
    # No punctuation - how students actually type. A guard that only splits
    # on commas and "but" would still suppress these.
    "im not okay i want to die",
    "im not gonna lie i want to die",
]

NEGATION_INSIDE_THE_RISK_STATEMENT = [
    "I don't want to be here anymore",
    "i dont want to be here",
    "I don’t want to live anymore",  # curly apostrophe, iOS default
    "I'm not lying I don't want to live anymore",
    "nahi yaar, ab jeena nahi",
    "nahi ab jeena nahi",
    "nahi, mujhe zinda nahi rehna",
    "अब जीना नहीं है",
]

HINDI_NEGATION_THAT_MUST_ESCALATE = [
    # nahi in an earlier clause, or as a bare "no" answering "are you ok?"
    "nahi pata yaar, khudkushi kar lunga",
    "kuch theek nahi hai, mar jaunga",
    "nahi I want to die",
    # Bare "nahi" ahead of an English phrase is "No," - Hindi's own "not"
    # follows the verb - so English scope words must not extend it.
    "nhi am feeling suicidal",
    "nahi want to die",
    "nhi going to kill myself",
    # mat - "don't stop me", "I tell myself don't"
    "mujhe roko mat, main khudkushi kar lunga",
    "khud ko bolti hoon khudkushi mat karna",
    "मुझे मत रोको, मैं आत्महत्या कर लूँगा",
]

# Hindi is SOV, so negation usually *follows* the keyword. The guard only
# looks backwards and "mat" is not a negation token at all: both fire today,
# and teaching the guard either would mute messages it currently escalates.
# Over-firing on the degraded path is the accepted cost.
HINDI_NEGATION_AFTER_THE_KEYWORD = [
    "main khudkushi nahi karunga",
    "khudkushi mat karna",
]

NEGATION_THAT_GOVERNS_THE_PHRASE = [
    "I would never kill myself",
    "I'm not suicidal",
    "I don't want to die",
    "I no longer feel suicidal",
    "I'm not going to kill myself",
    "main nahi chahti khudkushi karna",
    "ab nhi sochta suicide ke baare mein",
]

LATER_UNNEGATED_MENTION = [
    "I told my mom I'm not suicidal but I am suicidal",
    "i said i would never kill myself. i want to kill myself",
]


@pytest.mark.unit
@pytest.mark.parametrize("message", NEGATION_IN_ANOTHER_CLAUSE)
def test_negation_in_another_clause_does_not_suppress(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.parametrize("message", NEGATION_INSIDE_THE_RISK_STATEMENT)
def test_negation_inside_the_risk_statement_still_escalates(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.parametrize("message", HINDI_NEGATION_THAT_MUST_ESCALATE)
def test_hindi_negation_does_not_suppress_risk(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.parametrize("message", HINDI_NEGATION_AFTER_THE_KEYWORD)
def test_hindi_negation_after_the_keyword_never_suppresses(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.parametrize("message", NEGATION_THAT_GOVERNS_THE_PHRASE)
def test_negation_that_governs_the_phrase_still_suppresses(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is None


@pytest.mark.unit
@pytest.mark.parametrize("message", LATER_UNNEGATED_MENTION)
def test_a_later_unnegated_mention_still_escalates(message: str) -> None:
    assert signal_extraction._lexical_crisis_hit(message) is not None


# The guard exactly as it shipped after the 2026-08-30 fix, kept as an oracle.
# Run over the current patterns, it isolates the guard: the floor may fire on
# more messages than this, never fewer.
_ORIGINAL_NEGATION = re.compile(
    r"\b(?:don'?t|dont|never|no longer|nahi|nhi|not)\b[^.!?]{0,24}$",
    re.IGNORECASE,
)


def _original_guard_hit(message: str) -> bool:
    text = message.lower()
    for pattern in signal_extraction._CRISIS_LEXICAL_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match and not _ORIGINAL_NEGATION.search(text[: match.start()]):
            return True
    return False


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    NEGATION_IN_ANOTHER_CLAUSE
    + NEGATION_INSIDE_THE_RISK_STATEMENT
    + HINDI_NEGATION_THAT_MUST_ESCALATE
    + HINDI_NEGATION_AFTER_THE_KEYWORD
    + NEGATION_THAT_GOVERNS_THE_PHRASE
    + LATER_UNNEGATED_MENTION
    + [
        "I want to kill myself tonight, I have the pills ready",
        "I don't want to kill myself anymore, that phase passed",
        "I don’t want to die",
        "not-suicidal",
        "I'm not really actually ever going to kill myself",
    ],
)
def test_guard_never_suppresses_what_the_original_fired_on(message: str) -> None:
    if _original_guard_hit(message):
        assert signal_extraction._lexical_crisis_hit(message) is not None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_floor_forces_urgency_3_when_extraction_is_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The exact regression: model gone + explicit intent must still reach 3."""
    monkeypatch.setattr(signal_extraction, "_call_groq", _groq_down)
    session = make_session()

    signals = await signal_extraction.extract_signals(
        make_ingested("I want to kill myself tonight, I have the pills ready"),
        session=session,
    )

    assert signals.fallback_used is True
    assert signals.urgency_score == 3


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message",
    ["I am not okay, I want to die", "nahi pata yaar, khudkushi kar lunga"],
)
async def test_floor_survives_negation_in_an_earlier_clause_when_extraction_is_down(
    monkeypatch: pytest.MonkeyPatch, message: str
) -> None:
    """Negation-guard gap: these scored urgency 0 with Groq down."""
    monkeypatch.setattr(signal_extraction, "_call_groq", _groq_down)

    signals = await signal_extraction.extract_signals(
        make_ingested(message),
        session=make_session(),
    )

    assert signals.fallback_used is True
    assert signals.urgency_score == 3


@pytest.mark.unit
@pytest.mark.asyncio
async def test_floor_leaves_benign_message_alone_when_extraction_is_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(signal_extraction, "_call_groq", _groq_down)
    session = make_session()

    signals = await signal_extraction.extract_signals(
        make_ingested("I have a lot of assignments due this week and I am tired"),
        session=session,
    )

    assert signals.fallback_used is True
    assert signals.urgency_score == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_floor_does_not_override_a_healthy_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When Groq answers we defer to it, even on crisis-shaped wording.

    A false crisis erodes trust in the one response that has to be believed,
    so the lexical layer is a backstop for the outage case only.
    """

    async def healthy(_message: str, _session):
        return GroqSignalRaw(
            affect_vector=AffectVector(valence=-0.2, arousal=0.5, dominance=0.5),
            urgency_score=0,
            language_register="casual",
            code_mix_ratio=0.2,
            sarcasm_detected=False,
            implicit_distress_signals=[],
            topic_keywords=["film"],
        )

    monkeypatch.setattr(signal_extraction, "_call_groq", healthy)

    signals = await signal_extraction.extract_signals(
        make_ingested("that plot twist made me want to die, so good"),
        session=make_session(),
    )

    assert signals.fallback_used is False
    assert signals.urgency_score == 0
