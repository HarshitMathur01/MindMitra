"""
Layer C: guarded LLM synthesis for therapist brief (themes / intake hints).

Runs off the chat hot path. Every bullet must cite evidence_ids present in payload.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any, Dict, List, Tuple

from ..core.config import config
from ..utils.json_utils import parse_json_from_llm_output

logger = logging.getLogger(__name__)

FORBIDDEN_DIAG = re.compile(
    r"\b(depression|major depressive|mdd|gad|ptsd|bpd|bipolar|schizo|ocd|adhd)\b",
    re.I,
)

SYSTEM = """You assist licensed mental health professionals by summarizing APP-GENERATED signals only.
Rules:
- Output valid JSON only, no markdown.
- Never diagnose or use DSM/clinical disorder names (no depression, GAD, PTSD, etc.). Use plain language: low mood, worry, sleep difficulty, distress.
- Each narrative bullet MUST include evidence_refs copying ONLY ids from the allowed list provided.
- If uncertain, omit the bullet.
- Suggest intake questions the clinician might ask — not answers.

JSON shape:
{
  "bullets": [
    {"text": "string", "category": "theme|strength|coping|intake_suggestion", "evidence_refs": ["id1"]}
  ]
}
"""


def _collect_allowed_ids(facts: Dict[str, Any], metrics: Dict[str, Any]) -> List[str]:
    ids = [
        "fact:screening",
        "fact:crisis_count",
        "fact:activity_mix",
        "fact:session_summaries",
    ]
    for i, ref in enumerate(metrics.get("topic_evidence_refs") or []):
        ids.append(str(ref))
    for i in range(len(metrics.get("patterns_seed") or [])):
        ids.append(f"metric:pattern:{i}")
    ids.extend(["metric:mood_trend", "metric:topics_lexicon"])
    return ids


def _validate_bullets(bullets: List[Dict[str, Any]], allowed: List[str]) -> List[Dict[str, Any]]:
    allow = set(allowed)
    out = []
    for b in bullets:
        if not isinstance(b, dict):
            continue
        text = (b.get("text") or "").strip()
        if not text or FORBIDDEN_DIAG.search(text):
            continue
        refs = b.get("evidence_refs") or []
        if not isinstance(refs, list):
            continue
        ok_refs = [r for r in refs if str(r) in allow]
        if not ok_refs:
            continue
        cat = b.get("category") or "theme"
        if cat not in ("theme", "strength", "coping", "intake_suggestion"):
            cat = "theme"
        out.append({"text": text, "category": cat, "evidence_refs": ok_refs})
    return out[:12]


def synthesize_narrative_bundle(
    facts: Dict[str, Any],
    metrics: Dict[str, Any],
    emotional_stub: Dict[str, Any],
) -> Tuple[Dict[str, Any], str, str]:
    """
    Returns (narrative dict with bullets merged into patterns-like list, model_id, prompt_hash).
    On failure returns empty narrative and hash of stub.
    """
    from groq import Groq

    api_key = config.get_api_key("groq")
    if not api_key:
        logger.warning("⚠️ [THERAPIST-SYNTH] Groq missing — skipping narrative")
        return {}, "none", "n/a"

    allowed = _collect_allowed_ids(facts, metrics)
    compact = {
        "facts": {
            "activity_types": facts.get("activity_type_counts"),
            "crisis_events": facts.get("crisis_events_count"),
            "session_summaries": facts.get("session_summary_count"),
            "has_screening": bool(facts.get("screening_raw")),
        },
        "metrics": {
            "topics": metrics.get("topics_lexicon")[:6],
            "pattern_titles": [p.get("title") for p in (metrics.get("patterns_seed") or [])[:5]],
            "mood_points": len(metrics.get("mood_trend") or []),
        },
        "allowed_evidence_refs": allowed,
    }
    user_msg = json.dumps(compact, ensure_ascii=False)[:6000]
    prompt_full = SYSTEM + "\n\n" + user_msg
    prompt_hash = hashlib.sha256(prompt_full.encode("utf-8")).hexdigest()[:16]

    model = config.get_model("screening") or config.get_model("nlp")
    try:
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            temperature=0.2,
            max_tokens=700,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": user_msg},
            ],
        )
        raw = (resp.choices[0].message.content or "").strip()
        parsed = parse_json_from_llm_output(raw) or {}
        bullets = parsed.get("bullets") if isinstance(parsed, dict) else None
        if not isinstance(bullets, list):
            bullets = []
        cleaned = _validate_bullets(bullets, allowed)
        return {"bullets": cleaned}, model, prompt_hash
    except Exception as exc:
        logger.error("❌ [THERAPIST-SYNTH] %s", exc)
        return {}, model, prompt_hash


def merge_narrative_into_patterns(
    emotional_profile: Dict[str, Any],
    narrative: Dict[str, Any],
) -> Dict[str, Any]:
    """Append validated bullets as extra pattern rows for clinician visibility."""
    out = dict(emotional_profile)
    patterns = list(out.get("patterns") or [])
    for b in narrative.get("bullets") or []:
        icon = {"theme": "🧩", "strength": "🌿", "coping": "🛠", "intake_suggestion": "❓"}.get(
            b.get("category"), "•"
        )
        patterns.append(
            {
                "icon": icon,
                "title": (b.get("category") or "theme").replace("_", " ").title(),
                "description": b.get("text", ""),
                "evidence_refs": b.get("evidence_refs", []),
            }
        )
    out["patterns"] = patterns
    return out
