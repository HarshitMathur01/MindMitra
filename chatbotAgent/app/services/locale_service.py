"""
Locale resolution for multilingual pipeline.

Rule-based fast path with script detection and Hinglish heuristic.
Never used to override crisis keyword hits.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_CJK = re.compile(r"[\u3000-\u9FFF\uF900-\uFAFF]")
_HIRAGANA_KATAKANA = re.compile(r"[\u3040-\u309F\u30A0-\u30FF]")
_TELUGU = re.compile(r"[\u0C00-\u0C7F]")
_KANNADA = re.compile(r"[\u0C80-\u0CFF]")
_TAMIL = re.compile(r"[\u0B80-\u0BFF]")

_HINGLISH_PARTICLES = re.compile(
    r"\b(hai|nahi|mat|kya|kuch|bohot|bahut|mujhe|tum|acha|theek|haan|yaar|"
    r"bhai|baat|karo|raha|rahi|hoon|hain|tha|thi|wala|wali|kar|le|de|nahi)\b",
    re.I,
)

SUPPORTED_LOCALES = frozenset((
    "english", "hindi", "hinglish",
    "japanese", "telugu", "kannada", "tamil",
))

BCP47_MAP = {
    "english": "en-IN",
    "hindi": "hi-IN",
    "hinglish": "hi-IN",
    "japanese": "ja-JP",
    "telugu": "te-IN",
    "kannada": "kn-IN",
    "tamil": "ta-IN",
}


@dataclass(frozen=True)
class LocaleContext:
    locale: str
    bcp47: str
    confidence: float
    source: str  # "client" | "detected" | "default"


def _script_ratio(text: str, pattern: re.Pattern) -> float:
    if not text:
        return 0.0
    total = sum(1 for c in text if unicodedata.category(c)[0] == "L")
    if total == 0:
        return 0.0
    return len(pattern.findall(text)) / total


def _detect_from_script(text: str) -> Optional[str]:
    if _HIRAGANA_KATAKANA.search(text) or (_CJK.search(text) and _script_ratio(text, _CJK) > 0.3):
        return "japanese"
    if _TELUGU.search(text) and _script_ratio(text, _TELUGU) > 0.2:
        return "telugu"
    if _KANNADA.search(text) and _script_ratio(text, _KANNADA) > 0.2:
        return "kannada"
    if _TAMIL.search(text) and _script_ratio(text, _TAMIL) > 0.2:
        return "tamil"
    if _DEVANAGARI.search(text):
        ratio = _script_ratio(text, _DEVANAGARI)
        if ratio > 0.4:
            return "hindi"
        if ratio > 0.05:
            return "hinglish"
    return None


def _detect_hinglish_latin(text: str) -> bool:
    words = text.split()
    if len(words) < 3:
        return False
    hits = len(_HINGLISH_PARTICLES.findall(text))
    return hits / len(words) > 0.15


def resolve_locale(user_message: str, client_locale: Optional[str] = None) -> LocaleContext:
    """Return best-effort locale for a single message.

    Priority: explicit client choice > script detection > Hinglish heuristic > default.
    """
    if client_locale and client_locale in SUPPORTED_LOCALES:
        return LocaleContext(
            locale=client_locale,
            bcp47=BCP47_MAP.get(client_locale, "en-IN"),
            confidence=0.95,
            source="client",
        )

    detected = _detect_from_script(user_message)
    if detected:
        return LocaleContext(
            locale=detected,
            bcp47=BCP47_MAP.get(detected, "en-IN"),
            confidence=0.80,
            source="detected",
        )

    if _detect_hinglish_latin(user_message):
        return LocaleContext(locale="hinglish", bcp47="hi-IN", confidence=0.65, source="detected")

    return LocaleContext(locale="english", bcp47="en-IN", confidence=0.50, source="default")
