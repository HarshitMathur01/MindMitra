#!/usr/bin/env python
"""Fuzz the lexical crisis floor against the version it replaced.

The floor in ``app/pipeline/signal_extraction.py`` must only ever get
stricter: every message the original floor escalated must still escalate.
This generates random English / Hinglish / Devanagari messages from a fixed
seed and compares the live floor with a frozen copy of the original (patterns,
negation guard and first-occurrence-only matching, as of commit 1e10be2).

    python scripts/fuzz_negation_guard.py                 # 300k messages, fixed seed
    python scripts/fuzz_negation_guard.py --n 1000000 --seed 7

Exits 1 if any message the original escalated is no longer escalated.
"""
from __future__ import annotations

import argparse
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.pipeline.signal_extraction import _lexical_crisis_hit  # noqa: E402

DEFAULT_SEED = 20261018
DEFAULT_N = 300_000

# -- Frozen original floor (1e10be2). Do not edit: it is the oracle. --------
_ORIGINAL_PATTERNS = (
    r"\bkill(?:ing)? my ?self\b",
    r"\bend(?:ing)? my life\b",
    r"\btake my own life\b",
    r"\bsuicid(?:e|al)\b",
    r"\b(?:want|wanna|going) to die\b",
    r"\bbetter off dead\b",
    r"\bdon'?t want to (?:live|be alive)\b",
    r"\bno reason to live\b",
    r"\bhang my ?self\b",
    r"\boverdos(?:e|ing)\b",
    r"\bslit my wrists?\b",
    r"\bkhud ?kushi\b",
    r"\batma ?hatya\b",
    r"\bjaan de ?(?:du|dun|dunga|dungi|deni|dena|dene)\b",
    r"\bmar ?jau?(?:n|nga|ngi)\b",
    r"\bj(?:ee|i|e)na nahi(?: chahta| chahti)?\b",
    r"\bzinda nahi rehna\b",
    "खुदकुशी",
    "आत्महत्या",
    "जान दे ?दू",
    "मर ?जाऊ",
    "जीना नहीं",
)
_ORIGINAL_NEGATION = re.compile(
    r"\b(?:don'?t|dont|never|no longer|nahi|nhi|not)\b[^.!?]{0,24}$",
    re.IGNORECASE,
)


def _original_hit(message: str) -> bool:
    text = message.lower()
    for pattern in _ORIGINAL_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match and not _ORIGINAL_NEGATION.search(text[: match.start()]):
            return True
    return False


# -- Generator --------------------------------------------------------------
# Negations, scope words, content words that break scope, risk phrases and
# clause breaks, in all three scripts. Weighted towards collisions: short
# messages where a negation lands near a risk phrase.
_WORDS = (
    "i im i'm me my not never no longer don't dont don’t nahi nhi mat "
    "really ever even actually at all any anymore once am be been feel feeling "
    "have had want wanna to going gonna plan try tried would will think about of on "
    "chahta chahti sochta okay fine lie joking yaar ab hai pata main mujhe and do "
    "but however lekin par magar phir bhi "
    "kill killing myself die suicidal suicide end my life take own overdose hang "
    "better off dead reason live alive here "
    "khudkushi atmahatya jaan de du mar jaunga jaun jeena zinda rehna "
    "मैं नहीं मत मुझे आत्महत्या खुदकुशी जीना मर जाऊँगा"
).split()
_PUNCT = ("", "", "", "", ",", ".", "!", "?", ";", " -", "...")


def _message(rng: random.Random) -> str:
    return " ".join(
        rng.choice(_WORDS) + rng.choice(_PUNCT) for _ in range(rng.randint(2, 12))
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--n", type=int, default=DEFAULT_N)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    original_fired = current_fired = newly_fired = 0
    weakened: list[str] = []
    for _ in range(args.n):
        message = _message(rng)
        was = _original_hit(message)
        now = _lexical_crisis_hit(message) is not None
        original_fired += was
        current_fired += now
        newly_fired += now and not was
        if was and not now:
            weakened.append(message)

    print(f"seed={args.seed} messages={args.n}")
    print(f"original floor escalated: {original_fired}")
    print(f"current floor escalated:  {current_fired}")
    print(f"newly escalated (stricter): {newly_fired}")
    print(f"weakened (escalated before, not now): {len(weakened)}")
    for message in weakened[:10]:
        print(f"  WEAKENED: {message!r}")
    return 1 if weakened else 0


if __name__ == "__main__":
    raise SystemExit(main())
