"""
Token-budgeted assembly of retrieved memories into a single LLM injection string.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_INJECTION_PATTERNS = (
    "ignore previous instructions",
    "ignore all previous",
    "system prompt",
    "you are now",
    "forget everything",
    "disregard",
    "new instructions",
    "assistant:",
    "human:",
    "<system>",
    "</system>",
)

_XML_TAG_RE = re.compile(r"<[^>]+>")
_URL_RE = re.compile(r"\bhttps?://\S+\b", flags=re.IGNORECASE)
_FILEPATH_RE = re.compile(r"(?:\b[A-Za-z]:\\|/)\S+", flags=re.IGNORECASE)


def pipeline_intent_to_compose_intent(router_intent: str) -> str:
    """Map pipeline / cognitive intent labels to ContextComposer intent notes."""
    k = (router_intent or "emotional").lower()
    m = {
        "emotional": "venting",
        "therapeutic": "advice_seeking",
        "casual": "casual",
        "crisis": "crisis",
        "advice": "advice_seeking",
        "reflect": "reflection",
    }
    if k in m:
        return m[k]
    if k in ("venting", "advice_seeking", "casual", "crisis", "update", "reflection"):
        return k
    return "venting"


def _get_intent_note(current_intent: str) -> str:
    k = (current_intent or "").lower()
    notes = {
        "venting": "User appears to want to be heard, not advised. Listen first.",
        "advice_seeking": "User is looking for guidance or next steps.",
        "casual": "Lighter conversational mode.",
        "crisis": "PRIORITY: User may be in distress. Safety first, memory second.",
        "reflection": "User is in a reflective, introspective state.",
    }
    return notes.get(k, "")


def _truncate_at_word(text: str, max_len: int) -> str:
    if max_len <= 0:
        return ""
    if len(text) <= max_len:
        return text
    cut = text[: max_len + 1]
    sp = cut.rfind(" ")
    if sp > max_len // 2:
        return cut[:sp].rstrip()
    return cut[:max_len].rstrip()


class ContextComposer:
    MAX_MEMORY_TOKENS = 550
    CHARS_PER_TOKEN = 3.5
    MAX_CHARS = int(MAX_MEMORY_TOKENS * CHARS_PER_TOKEN)

    _HEADER = "WHAT YOU KNOW ABOUT THIS PERSON\n"
    _FOOTER = ""

    @staticmethod
    def get_token_estimate(text: str) -> int:
        return int(len(text or "") / ContextComposer.CHARS_PER_TOKEN)

    @staticmethod
    def sanitize_for_injection(text: str, memory_id: Optional[str] = None) -> str:
        if not text:
            return ""
        s = text.replace("\x00", "")
        s = "".join(ch for ch in s if ord(ch) >= 32 or ch in "\n\t\r")
        s = _XML_TAG_RE.sub("", s)
        s = _URL_RE.sub("", s)
        s = _FILEPATH_RE.sub("", s)
        s = re.sub(r"\s{2,}", " ", s).strip()
        low = s.lower()
        for pat in _INJECTION_PATTERNS:
            if pat in low:
                logger.warning(
                    "[ContextComposer] filtered injection-like content memory_id=%s pattern=%r",
                    memory_id,
                    pat,
                )
                return "[content filtered]"
        if len(s) > 200:
            s = _truncate_at_word(s, 197).rstrip() + "…"
        return s.strip()

    @staticmethod
    def _memory_text(m: Dict[str, Any]) -> str:
        return (m.get("memory") or m.get("content") or "").strip()

    @staticmethod
    def _memory_type_key(m: Dict[str, Any]) -> str:
        t = (m.get("type") or m.get("memory_type") or "contextual")
        if not isinstance(t, str):
            return "contextual"
        t = t.lower()
        if t in ("identity", "preference", "behavioral", "emotional", "contextual"):
            return t
        # Transitional/legacy types
        if t in ("procedural",):
            return "preference"
        if t in ("affective", "crisis"):
            return "emotional"
        if t in ("episodic", "semantic", "reflection", "relational"):
            return "contextual"
        return "contextual"

    @classmethod
    def _format_group(cls, label: str, bullets: List[str]) -> str:
        if not bullets:
            return ""
        lines = [f"{label}"] + [f"- {b}" for b in bullets if b]
        if len(lines) <= 1:
            return ""
        return "\n".join(lines) + "\n"

    @classmethod
    def _shrink_memory_parts(
        cls,
        parts: List[Tuple[str, str]],
        max_chars: int,
    ) -> str:
        """parts: (kind, text) in display order."""
        # Keep identity+preference summary highest priority (never dropped), truncate others first.
        drop_priority = ("patterns", "emotional", "behavioral", "contextual", "narrative")
        working = [(k, t) for k, t in parts if t.strip()]

        def joined() -> str:
            return "".join(t for _, t in working).strip()

        while working and len(joined()) > max_chars:
            removed = False
            for kind in drop_priority:
                for i in range(len(working) - 1, -1, -1):
                    if working[i][0] == kind:
                        working.pop(i)
                        removed = True
                        break
                if removed:
                    break
            if not removed:
                break

        s = joined()
        if len(s) > max_chars:
            fixed = [t for k, t in working if k in ("identity_pref",)]
            other = [t for k, t in working if k not in ("identity_pref",)]
            fixed_s = "".join(fixed)
            budget_other = max(0, max_chars - len(fixed_s))
            other_s = _truncate_at_word("".join(other).strip(), budget_other)
            s = (fixed_s + "\n" + other_s).strip() if fixed_s else _truncate_at_word(s, max_chars)
        return s

    @classmethod
    def compose(
        cls,
        memories: List[Dict[str, Any]],
        user_profile: Dict[str, Any],
        session_count: int,
        current_intent: str,
        *,
        memory_reference_allowed: bool = True,
    ) -> str:
        prof = user_profile or {}
        mem_list = list(memories or [])
        # PDF injection gate: when questions aren't allowed (venting/crisis), suppress
        # painful episodic/affective recall; include only relational + procedural context.
        # In unified taxonomy we treat identity (relational) + preference (procedural) as allowed.
        if not memory_reference_allowed:
            mem_list = [m for m in mem_list if cls._memory_type_key(m) in ("identity", "preference")]
        narrative = prof.get("narrative_paragraph")
        if narrative is not None and not isinstance(narrative, str):
            narrative = str(narrative)
        narrative_ok = bool(
            session_count >= 15
            and narrative
            and str(narrative).strip()
        )
        narrative_section = ""
        if narrative_ok:
            nar_s = cls.sanitize_for_injection(str(narrative).strip(), memory_id="narrative_paragraph")
            narrative_section = f"Who this person is:\n{nar_s}\n"

        grouped: Dict[str, List[str]] = {
            "identity": [],
            "preference": [],
            "contextual": [],
            "behavioral": [],
            "emotional": [],
        }
        for m in mem_list:
            tk = cls._memory_type_key(m)
            if tk not in grouped:
                tk = "contextual"
            raw = cls._memory_text(m)
            mid = str(m.get("id") or m.get("mem0_id") or "") or None
            cleaned = cls.sanitize_for_injection(raw, memory_id=mid)
            if cleaned:
                grouped[tk].append(cleaned)

        # Build sections per PDF injection format.
        language_pref = (prof.get("language_preference") or "").strip()
        name = (prof.get("name") or "").strip()
        occupation = (prof.get("occupation") or "").strip()
        location = (prof.get("location") or "").strip()
        comm_style = (prof.get("communication_style") or "").strip()

        about_line = "About them:"
        bits = []
        if name:
            bits.append(name)
        if occupation:
            bits.append(occupation)
        if location:
            bits.append(f"based in {location}")
        if bits:
            about_line = "About them: " + " · ".join(bits) + "."
        if language_pref:
            about_line += f" Language preference: {language_pref}."
        if comm_style:
            about_line += f" They prefer: {comm_style}."

        identity_lines = [about_line]
        if grouped["identity"]:
            identity_lines.append("Key facts: " + "; ".join(grouped["identity"]) + ".")
        if grouped["preference"]:
            identity_lines.append("They prefer: " + "; ".join(grouped["preference"]) + ".")
        identity_pref_section = "\n".join(identity_lines).strip()

        contextual = cls._format_group("What they're going through:", grouped["contextual"])
        behavioral = cls._format_group("What has helped them before:", grouped["behavioral"])
        emotional = cls._format_group("Things you remember them sharing:", grouped["emotional"])
        patterns = ""
        if session_count > 3:
            patterns = cls._format_group("Patterns you've noticed:", grouped["behavioral"])

        trend_line = (prof.get("emotional_trend_line") or "").strip()
        trend = f"Recent emotional trend: {trend_line}\n" if trend_line else ""

        memory_parts: List[Tuple[str, str]] = []
        if narrative_section.strip():
            memory_parts.append(("narrative", narrative_section.rstrip() + "\n\n"))
        memory_parts.append(("identity_pref", identity_pref_section.strip() + "\n\n"))
        if contextual.strip():
            memory_parts.append(("contextual", contextual.strip() + "\n\n"))
        if behavioral.strip():
            memory_parts.append(("behavioral", behavioral.strip() + "\n\n"))
        if emotional.strip():
            memory_parts.append(("emotional", emotional.strip() + "\n\n"))
        if patterns.strip():
            memory_parts.append(("patterns", patterns.strip() + "\n\n"))
        if trend.strip():
            memory_parts.append(("trend", trend.strip() + "\n\n"))

        inner = "".join(t for _, t in memory_parts).strip()
        if not inner:
            return ""

        cap = cls.MAX_CHARS - len(cls._HEADER) - len(cls._FOOTER)
        if len(inner) > cap:
            inner = cls._shrink_memory_parts(memory_parts, cap).strip()
            if len(inner) > cap:
                inner = _truncate_at_word(inner, cap)

        return f"{cls._HEADER}\n\n{inner}{cls._FOOTER}".strip()
