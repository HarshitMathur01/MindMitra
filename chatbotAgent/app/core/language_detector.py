from __future__ import annotations

from typing import FrozenSet

# Romanized Hindi cues often mis-tagged as English by langdetect.
HINGLISH_MARKERS: FrozenSet[str] = frozenset(
    {
        "yaar",
        "nahi",
        "kya",
        "hai",
        "hoon",
        "tha",
        "raha",
        "bahut",
        "theek",
        "acha",
        "sahi",
        "bilkul",
        "bohot",
        "matlab",
        "bas",
        "abhi",
        "kal",
        "aaj",
    }
)


class LanguageDetector:
    def detect(self, text: str) -> str:
        raw = (text or "").strip()
        if not raw:
            return "en"
        try:
            from langdetect import detect as langdetect_detect

            lang = langdetect_detect(raw)
        except Exception:
            return "en"

        lower = raw.lower()
        hits = sum(1 for marker in HINGLISH_MARKERS if marker in lower)
        has_devanagari = any("\u0900" <= c <= "\u097f" for c in raw)

        if has_devanagari and lang == "hi":
            return "hi"
        # Romanized Hindi / code-mixed: langdetect often says "hi" or "en".
        if hits >= 2 and not has_devanagari:
            return "hinglish"
        if lang == "hi":
            return "hi"
        if lang == "en":
            return "en"
        return "en"

    def get_embedding_text(self, text: str, language: str) -> str:
        return text or ""
