"""
Pluggable memory extraction (Groq by default; swap implementation via config).
"""
from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Any, List, Optional

from .language_detector import LanguageDetector
from .memory_pipeline_types import MemoryCandidate, SignalResult

logger = logging.getLogger(__name__)


def _strip_json_fences(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _format_conversation(messages: List[dict]) -> str:
    lines: List[str] = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        role = m.get("role", "?")
        content = (m.get("content") or "").strip()
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


_GROQ_SYSTEM_PROMPT = """You are a memory extraction engine for a mental health AI assistant. Extract only what the user explicitly stated. Never infer, assume, or generalize beyond what was directly said. Every extracted memory must be anchored to exact words from the conversation.

Output valid JSON only. No preamble, no explanation, no markdown code fences. If nothing is worth extracting, output: {"memories": []}"""


def _groq_user_prompt(
    messages: List[dict],
    signal: SignalResult,
) -> str:
    formatted = _format_conversation(messages)
    n = len([m for m in messages if isinstance(m, dict)])
    types_hint = ", ".join(signal.suggested_types) if signal.suggested_types else "any of identity, preference, behavioral, emotional, contextual"
    signal_block = (
        f"Pre-classifier (heuristic): memory-worthy={signal.is_memory_worthy}, "
        f"suggested_types=[{types_hint}], urgency={signal.urgency}. "
        "Prefer the suggested types when they fit the user's words; still only extract explicit statements."
    )
    return f"""{signal_block}

Conversation (last {n} messages):
{formatted}

Extract memories in this exact JSON structure:
{{
  "memories": [
    {{
      "type": "identity|preference|behavioral|emotional|contextual",
      "content": "A clear, third-person memory statement. Example: User works as a software engineer at a startup.",
      "verbatim_anchor": "The exact phrase(s) from the conversation that justify this memory. Must be a direct quote.",
      "confidence": 0.0-1.0,
      "emotional_valence": -1.0-1.0 (negative=distress, positive=joy, 0=neutral),
      "emotional_intensity": 0.0-1.0,
      "tags": ["named entities", "topics", "people mentioned"],
      "is_sensitive": true/false (true if trauma, grief, abuse, crisis, suicidal content),
      "is_resolved": true/false (contextual/emotional: true if the user indicated the situation is resolved),
      "category": "short free-text label for semantic/affective memories (e.g. work, family, health) or null"
    }}
  ]
}}

Rules:
1. Only extract what the user explicitly said. No inference.
2. verbatim_anchor must be a real quote from the conversation above. If you cannot find one, do not extract this memory.
3. confidence below 0.5 means you are uncertain — omit unless genuinely useful; the pipeline rejects below 0.5.
4. Maximum 6 memories per call. Prioritize the most significant.
5. Use identity for stable facts (name, city, job). Preference for how they like to be treated. Behavioral for patterns. Contextual for ongoing situations. Emotional for cross-session emotional history.
6. Do not extract anything the AI said — only the user's words matter."""


class BaseMemoryExtractionProvider(ABC):
    @abstractmethod
    def extract(
        self,
        messages: List[dict],
        signal: SignalResult,
        user_id: str,
        session_id: str,
    ) -> List[MemoryCandidate]:
        ...


class GroqMemoryExtractionProvider(BaseMemoryExtractionProvider):
    def __init__(self, groq_client: Any, model: Optional[str] = None) -> None:
        self._groq = groq_client
        import os

        self._model = model or os.getenv(
            "GROQ_MEMORY_EXTRACTION_MODEL",
            "llama-3.3-70b-versatile",
        )
        self._detector = LanguageDetector()

    def extract(
        self,
        messages: List[dict],
        signal: SignalResult,
        user_id: str,
        session_id: str,
    ) -> List[MemoryCandidate]:
        del user_id, session_id
        if not self._groq:
            logger.warning("[MEMORY_EXTRACT] Groq client not available")
            return []

        user_prompt = _groq_user_prompt(messages, signal)

        try:
            response = self._groq.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _GROQ_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=4000,
            )
            raw = (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.error("[MEMORY_EXTRACT] Groq call failed: %s", exc, exc_info=True)
            return []

        try:
            data = json.loads(_strip_json_fences(raw))
        except json.JSONDecodeError as exc:
            logger.warning("[MEMORY_EXTRACT] Invalid JSON from model: %s — raw=%r", exc, raw[:500])
            return []

        memories = data.get("memories")
        if not isinstance(memories, list):
            return []

        out: List[MemoryCandidate] = []
        for item in memories[:6]:
            if not isinstance(item, dict):
                continue
            mtype = str(item.get("type", "semantic")).split("|")[0].strip()
            content = str(item.get("content", "")).strip()
            anchor = str(item.get("verbatim_anchor", "") or "").strip()
            try:
                confidence = float(item.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            try:
                valence = float(item.get("emotional_valence", 0.0))
            except (TypeError, ValueError):
                valence = 0.0
            try:
                intensity = float(item.get("emotional_intensity", 0.0))
            except (TypeError, ValueError):
                intensity = 0.0
            tags = item.get("tags")
            if not isinstance(tags, list):
                tags = []
            tags = [str(t) for t in tags if t is not None][:32]
            is_sensitive = bool(item.get("is_sensitive", False))
            is_resolved = bool(item.get("is_resolved", False))
            cat_raw = item.get("category")
            category = str(cat_raw).strip()[:120] if cat_raw is not None and str(cat_raw).strip() else None
            lang = self._detector.detect(content or anchor)
            out.append(
                MemoryCandidate(
                    type=mtype,
                    content=content,
                    verbatim_anchor=anchor,
                    confidence=confidence,
                    emotional_valence=valence,
                    emotional_intensity=intensity,
                    tags=tags,
                    is_sensitive=is_sensitive,
                    language=lang,
                    is_resolved=is_resolved,
                    category=category,
                )
            )
        return out


class AnthropicMemoryExtractionProvider(BaseMemoryExtractionProvider):
    def __init__(self, anthropic_client: Any, model: Optional[str] = None) -> None:
        self._client = anthropic_client
        import os

        self._model = model or os.getenv("ANTHROPIC_MEMORY_EXTRACTION_MODEL", "claude-haiku-4-5")
        self._detector = LanguageDetector()

    def extract(
        self,
        messages: List[dict],
        signal: SignalResult,
        user_id: str,
        session_id: str,
    ) -> List[MemoryCandidate]:
        del user_id, session_id
        if not self._client:
            logger.warning("[MEMORY_EXTRACT] Anthropic client not available")
            return []

        user_prompt = _groq_user_prompt(messages, signal)
        system_prompt = _GROQ_SYSTEM_PROMPT

        try:
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=1200,
                temperature=0.1,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            # anthropic SDK returns a list of content blocks; take first text.
            raw = ""
            for blk in getattr(resp, "content", []) or []:
                if getattr(blk, "type", "") == "text":
                    raw = (getattr(blk, "text", "") or "").strip()
                    break
            raw = raw.strip()
        except Exception as exc:
            logger.error("[MEMORY_EXTRACT] Anthropic call failed: %s", exc, exc_info=True)
            return []

        try:
            data = json.loads(_strip_json_fences(raw))
        except json.JSONDecodeError as exc:
            logger.warning("[MEMORY_EXTRACT] Invalid JSON from model: %s — raw=%r", exc, raw[:500])
            return []

        memories = data.get("memories")
        if not isinstance(memories, list):
            return []

        out: List[MemoryCandidate] = []
        for item in memories[:6]:
            if not isinstance(item, dict):
                continue
            mtype = str(item.get("type", "contextual")).split("|")[0].strip()
            content = str(item.get("content", "")).strip()
            anchor = str(item.get("verbatim_anchor", "") or "").strip()
            try:
                confidence = float(item.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            try:
                valence = float(item.get("emotional_valence", 0.0))
            except (TypeError, ValueError):
                valence = 0.0
            try:
                intensity = float(item.get("emotional_intensity", 0.0))
            except (TypeError, ValueError):
                intensity = 0.0
            tags = item.get("tags")
            if not isinstance(tags, list):
                tags = []
            tags = [str(t) for t in tags if t is not None][:32]
            is_sensitive = bool(item.get("is_sensitive", False))
            is_resolved = bool(item.get("is_resolved", False))
            cat_raw = item.get("category")
            category = str(cat_raw).strip()[:120] if cat_raw is not None and str(cat_raw).strip() else None
            lang = self._detector.detect(content or anchor)
            out.append(
                MemoryCandidate(
                    type=mtype,
                    content=content,
                    verbatim_anchor=anchor,
                    confidence=confidence,
                    emotional_valence=valence,
                    emotional_intensity=intensity,
                    tags=tags,
                    is_sensitive=is_sensitive,
                    language=lang,
                    is_resolved=is_resolved,
                    category=category,
                )
            )
        return out


def build_memory_extraction_provider(*, groq_client: Any = None, anthropic_client: Any = None) -> BaseMemoryExtractionProvider:
    from ..core.config import config

    name = (config.get("memory.extraction_provider", "groq") or "groq").lower()
    if name == "anthropic":
        return AnthropicMemoryExtractionProvider(anthropic_client)
    if name == "groq":
        return GroqMemoryExtractionProvider(groq_client)
    logger.warning("[MEMORY_EXTRACT] Unknown memory.extraction_provider=%r — using groq", name)
    return GroqMemoryExtractionProvider(groq_client)
