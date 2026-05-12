"""Task C — extract semantic facts from a finished session and merge them
into ``user_semantic_profiles``.

Uses Groq structured output to pull names/themes/comfort/discomfort.

Merge semantics:
  * relationship_map: APPEND (do not overwrite); dedupe by lowercased name
  * recurring_themes: weighted average ``new = 0.4 * extracted + 0.6 * stored``
  * comfort_topics / discomfort_topics: set union, cap 12 entries
  * occupation_detail / city: write only if newly revealed
  * If ``user_corrected_anything`` is True, write an audit event (no auto-
    overwrite — flag for human review).
"""
from __future__ import annotations

import json
import logging
import asyncio
from typing import Any, Dict, List, Optional

from ..core.connections import get_gemini, get_groq, guarded_call
from ..core.env import env
from ..core.session import SessionObject
from ..services import profile_service

logger = logging.getLogger(__name__)


SEMANTIC_PROMPT = (
    "Extract structured facts from this mental-health conversation. Return "
    "STRICT JSON matching this schema (no markdown):\n"
    "{\n"
    '  "new_names_mentioned": [{"name": string, "relation": string, "context": string}],\n'
    '  "new_themes_detected": [{"theme": string, "strength": float[0..1]}],\n'
    '  "updated_comfort_topics": [string],\n'
    '  "updated_discomfort_topics": [string],\n'
    '  "user_corrected_anything": bool,\n'
    '  "occupation_detail_revealed": string|null,\n'
    '  "city_revealed": string|null,\n'
    '  "phq2_sleep_score": int|null,  (0-3, only if a sleep question was asked this session)\n'
    '  "phq2_mood_score": int|null    (0-3, only if a mood question was asked this session)\n'
    "}\n"
    "Be conservative: only include facts ACTUALLY stated by the user. Do not "
    "fabricate. No phone/email/address fields."
)


async def extract_and_merge_semantic(session: SessionObject) -> bool:
    raw = await _call_groq(session) or await _call_gemini(session)
    if raw is None:
        logger.error("[v3 semantic] Groq and Gemini extraction failed; writing transcript to failed_extractions")
        await profile_service.write_failed_extraction(session.user_id, session.session_id, _format_transcript(session))
        return False

    semantic = session.semantic_profile or {}
    updates = _merge(semantic, raw)
    if not updates:
        return False

    # Flag user_corrected_anything via audit log
    if raw.get("user_corrected_anything"):
        try:
            await profile_service.write_audit_log(
                {
                    "session_id": session.session_id,
                    "user_id": session.user_id,
                    "event_type": "user_correction_flagged",
                    "extra": {"raw": raw},
                }
            )
        except Exception:  # noqa: BLE001
            pass

    # PHQ-2 entries go into longitudinal store as advisory data
    phq2_sleep = raw.get("phq2_sleep_score")
    phq2_mood = raw.get("phq2_mood_score")
    session_number = int(session.total_sessions_at_start or 0) + 1
    if session_number % 3 == 0 and (phq2_sleep is not None or phq2_mood is not None):
        await _append_phq2(session.user_id, phq2_sleep, phq2_mood)

    return await profile_service.upsert_semantic(session.user_id, updates)


def _merge(stored: Dict[str, Any], raw: Dict[str, Any]) -> Dict[str, Any]:
    updates: Dict[str, Any] = {}

    # ── relationship_map: append, dedupe ────────────────────────────────
    existing_rels: List[Dict[str, Any]] = list(stored.get("relationship_map") or [])
    seen_names = {(r.get("name") or "").lower() for r in existing_rels}
    for new_rel in raw.get("new_names_mentioned") or []:
        name = (new_rel.get("name") or "").strip()
        if not name or name.lower() in seen_names:
            continue
        existing_rels.append(
            {
                "name": name,
                "relation": new_rel.get("relation") or "",
                "context": new_rel.get("context") or "",
            }
        )
        seen_names.add(name.lower())
    if existing_rels != list(stored.get("relationship_map") or []):
        updates["relationship_map"] = existing_rels[:30]

    # ── recurring_themes weighted average ───────────────────────────────
    themes: Dict[str, float] = dict(stored.get("recurring_themes") or {})
    for tobj in raw.get("new_themes_detected") or []:
        theme = (tobj.get("theme") or "").strip().lower()
        if not theme:
            continue
        strength = float(tobj.get("strength") or 0.0)
        prior = float(themes.get(theme, 0.0))
        themes[theme] = round(0.4 * strength + 0.6 * prior, 3)
    if themes != dict(stored.get("recurring_themes") or {}):
        updates["recurring_themes"] = themes

    # ── comfort / discomfort ────────────────────────────────────────────
    for key in ("comfort_topics", "discomfort_topics"):
        raw_key = "updated_comfort_topics" if key == "comfort_topics" else "updated_discomfort_topics"
        union = list({*(stored.get(key) or []), *(raw.get(raw_key) or [])})
        if union and union != list(stored.get(key) or []):
            updates[key] = union[:12]

    # ── occupation / city (only if newly revealed) ──────────────────────
    if raw.get("occupation_detail_revealed") and not stored.get("occupation_detail"):
        updates["occupation_detail"] = raw["occupation_detail_revealed"]
    if raw.get("city_revealed") and not stored.get("city"):
        updates["city"] = raw["city_revealed"]

    return updates


async def _call_groq(session: SessionObject) -> Optional[Dict[str, Any]]:
    client = get_groq()
    if client is None:
        return None
    e = env()
    transcript = "\n".join(
        f"{'User' if t.get('role') == 'user' else 'Agent'}: {t.get('content', '')}"
        for t in session.turns
    )
    try:
        resp = await guarded_call(
            "groq",
            lambda: client.chat.completions.create(
                model=e.groq_signal_model,
                messages=[
                    {"role": "system", "content": SEMANTIC_PROMPT},
                    {"role": "user", "content": transcript},
                ],
                temperature=0.2,
                max_tokens=512,
                response_format={"type": "json_object"},
            ),
            timeout_s=5.0,
        )
        content = resp.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 semantic] groq extract failed: %s", exc)
        return None


async def _call_gemini(session: SessionObject) -> Optional[Dict[str, Any]]:
    model = get_gemini()
    if model is None:
        return None
    transcript = _format_transcript(session)

    def _call() -> Optional[Dict[str, Any]]:
        try:
            resp = model.generate_content(
                SEMANTIC_PROMPT + "\n\nConversation:\n" + transcript,
                generation_config={"temperature": 0.2, "max_output_tokens": 512},
            )
            text = getattr(resp, "text", None) or "{}"
            return json.loads(text)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[v3 semantic] gemini extract fallback failed: %s", exc)
            return None

    return await asyncio.to_thread(_call)


def _format_transcript(session: SessionObject) -> str:
    return "\n".join(
        f"{'User' if t.get('role') == 'user' else 'Agent'}: {t.get('content', '')}"
        for t in session.turns
    )


async def _append_phq2(user_id: str, sleep: Optional[int], mood: Optional[int]) -> None:
    long = await profile_service.load_longitudinal(user_id)
    entries: List[Dict[str, Any]] = list(long.get("phq2_scores") or [])
    entry = {
        "date": _today_iso(),
        "sleep": int(sleep) if sleep is not None else None,
        "mood": int(mood) if mood is not None else None,
    }
    entries.append(entry)
    await profile_service.upsert_longitudinal(user_id, {"phq2_scores": entries[-50:]})


def _today_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).date().isoformat()
