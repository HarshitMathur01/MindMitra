"""
Deterministic therapist handoff profile builder (Layer A facts + Layer B metrics).

No LLM in this module — synthesis is separate.
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from .supabase_service import fetch_latest_screening_scores, supabase_client

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "This summary is generated from app usage signals and screening estimates. "
    "It is not a medical record or diagnosis. PHQ-9 and GAD-7 scores here are "
    "algorithmic screening aids only; clinical judgment is required."
)


def user_id_as_text(user_id: str) -> str:
    """session_summaries.user_id is TEXT matching auth uid."""
    return str(user_id)


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        s = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _extract_mood_from_activity(row: Dict[str, Any]) -> Optional[Tuple[datetime, float]]:
    """Return (completed_at, mood_1_to_10) if derivable."""
    completed = _parse_ts(row.get("completed_at"))
    if not completed:
        return None
    data = row.get("activity_data") or {}
    if not isinstance(data, dict):
        data = {}
    insights = row.get("insights_generated") or {}
    if not isinstance(insights, dict):
        insights = {}

    for key in ("mood_after", "mood", "mood_score", "rating", "valence"):
        v = data.get(key) if key in data else insights.get(key)
        if v is None:
            continue
        try:
            f = float(v)
            if 0 <= f <= 1:
                f = 1 + f * 9
            if 1 <= f <= 10:
                return (completed, f)
        except (TypeError, ValueError):
            continue
    score = row.get("score")
    if score is not None:
        try:
            s = int(score)
            if 1 <= s <= 10:
                return (completed, float(s))
        except (TypeError, ValueError):
            pass
    return None


def _fetch_activities_window(user_id: str, days: int = 90) -> List[Dict[str, Any]]:
    if not supabase_client:
        return []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        resp = (
            supabase_client.table("user_activities")
            .select("*")
            .eq("user_id", user_id)
            .gte("completed_at", cutoff)
            .order("completed_at", desc=False)
            .execute()
        )
        return resp.data or []
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] activities fetch: %s", exc)
        return []


def _fetch_crisis_events(user_id: str, days: int = 365) -> List[Dict[str, Any]]:
    if not supabase_client:
        return []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        resp = (
            supabase_client.table("crisis_events")
            .select("level, source, created_at")
            .eq("user_id", user_id)
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return resp.data or []
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] crisis_events fetch: %s", exc)
        return []


def _fetch_session_summaries(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    if not supabase_client:
        return []
    try:
        resp = (
            supabase_client.table("session_summaries")
            .select("summary_text, themes, emotional_arc, updated_at")
            .eq("user_id", user_id_as_text(user_id))
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        out = []
        for row in resp.data or []:
            themes = row.get("themes", "[]")
            arc = row.get("emotional_arc", "[]")
            if isinstance(themes, str):
                try:
                    themes = json.loads(themes)
                except (json.JSONDecodeError, TypeError):
                    themes = []
            if isinstance(arc, str):
                try:
                    arc = json.loads(arc)
                except (json.JSONDecodeError, TypeError):
                    arc = []
            out.append(
                {
                    "summary_text": row.get("summary_text", ""),
                    "themes": themes if isinstance(themes, list) else [],
                    "emotional_arc": arc if isinstance(arc, list) else [],
                    "updated_at": row.get("updated_at"),
                }
            )
        return out
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] session_summaries fetch: %s", exc)
        return []


def _build_mood_series(activities: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    gaps: List[str] = []
    by_day: Dict[str, List[float]] = defaultdict(list)
    for row in activities:
        got = _extract_mood_from_activity(row)
        if not got:
            continue
        dt, val = got
        day = dt.date().isoformat()
        by_day[day].append(val)
    if not by_day:
        gaps.append("No structured mood scores in user_activities for the selected window.")
    trend = []
    for day in sorted(by_day.keys()):
        avg = sum(by_day[day]) / len(by_day[day])
        trend.append({"date": f"{day}T12:00:00.000Z", "mood": int(min(10, max(1, round(avg))))})
    if len(trend) >= 14:
        last_14 = [t["mood"] for t in trend[-14:]]
        first_14 = [t["mood"] for t in trend[-28:-14]] if len(trend) >= 28 else last_14
        if first_14 and sum(last_14) / len(last_14) < sum(first_14) / len(first_14) - 0.5:
            gaps.append("Mood trend shows lower recent averages vs prior window (statistical only).")
    return trend, gaps


def _hour_histogram_low_mood(activities: List[Dict[str, Any]]) -> Dict[int, int]:
    counts: Dict[int, int] = defaultdict(int)
    for row in activities:
        got = _extract_mood_from_activity(row)
        if not got:
            continue
        dt, val = got
        if val <= 4:
            counts[dt.hour] += 1
    return dict(counts)


def _activity_type_counts(activities: List[Dict[str, Any]]) -> Dict[str, int]:
    c = Counter()
    for row in activities:
        t = row.get("activity_type") or "unknown"
        c[str(t)] += 1
    return dict(c)


_TOPICS_LEXICON = [
    ("family", ["family", "parent", "mother", "father", "relative"]),
    ("academic", ["exam", "college", "study", "semester", "grade", "academic"]),
    ("sleep", ["sleep", "insomnia", "tired", "fatigue"]),
    ("loneliness", ["lonely", "alone", "isolation"]),
    ("work", ["job", "work", "boss", "career", "workload"]),
    ("anxiety", ["anxious", "worry", "panic", "nervous"]),
    ("low_mood", ["sad", "hopeless", "empty", "depressed"]),
]


def _score_topics_from_summaries(summaries: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    text_blob = " ".join(
        s.get("summary_text", "") for s in summaries
    ).lower()
    for s in summaries:
        for t in s.get("themes") or []:
            text_blob += " " + str(t).lower()
    bucket_scores: Dict[str, int] = {k: 0 for k, _ in _TOPICS_LEXICON}
    for label, words in _TOPICS_LEXICON:
        for w in words:
            bucket_scores[label] += len(re.findall(r"\b" + re.escape(w) + r"\b", text_blob))
    topics = []
    for label, freq in sorted(bucket_scores.items(), key=lambda x: -x[1]):
        if freq <= 0:
            continue
        sentiment = -0.35 if label in ("low_mood", "anxiety", "loneliness") else -0.2
        topics.append({"topic": label.replace("_", " ").title(), "frequency": min(100, freq * 3), "sentiment": sentiment})
    refs = [f"session_summary_lexicon:{label}" for label, f in bucket_scores.items() if f > 0]
    return topics[:8], refs


def _screening_to_assessments(screening: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    today = datetime.now(timezone.utc).date().isoformat()
    phq = screening.get("phq9") or screening.get("phq_9")
    if isinstance(phq, dict) and phq.get("score") is not None:
        sev = str(phq.get("severity", "")).replace("_", " ")
        out.append(
            {
                "type": "PHQ-9",
                "score": int(phq["score"]),
                "severity": sev + " (screening)" if sev else "See score (screening)",
                "date": today,
            }
        )
    gad = screening.get("gad7") or screening.get("gad_7")
    if isinstance(gad, dict) and gad.get("score") is not None:
        sev = str(gad.get("severity", "")).replace("_", " ")
        out.append(
            {
                "type": "GAD-7",
                "score": int(gad["score"]),
                "severity": sev + " (screening)" if sev else "See score (screening)",
                "date": today,
            }
        )
    return out


def _crisis_to_ui(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    mapped = []
    for e in events:
        level = (e.get("level") or "").lower()
        sev = {"critical": "high", "high": "high", "medium": "moderate"}.get(level, level or "unknown")
        ts = _parse_ts(e.get("created_at"))
        mapped.append(
            {
                "date": (ts or datetime.now(timezone.utc)).date().isoformat(),
                "severity": sev,
                "actionTaken": "Crisis pathway triggered in app (no message content stored).",
                "source": e.get("source") or "",
            }
        )
    return mapped


def _extract_mindgym_patterns(activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    patterns = []
    worry_count = 0
    catastrophizing = 0
    reframes = 0
    for row in activities:
        typ = row.get("activity_type", "")
        data = row.get("activity_data", {}) or {}
        meta = data.get("metadata", {}) or {}
        state = meta.get("state", [])
        if not isinstance(state, list):
            continue
        if typ == "mindgym_clinical_worry_vault":
            worry_count += len(state)
        elif typ == "mindgym_clinical_thought_trap":
            catastrophizing += len([x for x in state if "catastrophizing" in str(x.get("trapType", "")).lower()])
        elif typ == "mindgym_clinical_inner_critic":
            reframes += len([x for x in state if isinstance(x, dict) and x.get("reframe")])
            
    if worry_count > 0:
        patterns.append({
            "icon": "🧠",
            "title": "Documented Worries",
            "description": f"Patient has cataloged {worry_count} distinct worries in their mindgym Worry Vault.",
            "evidence_refs": ["mindgym:worry_vault"]
        })
    if catastrophizing > 0:
        patterns.append({
            "icon": "⚠️",
            "title": "Catastrophizing Bias",
            "description": f"Patient self-identified 'Catastrophizing' {catastrophizing} times in Thought Trap exercises.",
            "evidence_refs": ["mindgym:thought_trap"]
        })
    if reframes > 0:
        patterns.append({
            "icon": "🌱",
            "title": "Cognitive Reframing",
            "description": f"Patient actively constructed {reframes} self-compassionate reframes against their Inner Critic.",
            "evidence_refs": ["mindgym:inner_critic"]
        })
    return patterns

def _patterns_from_metrics(
    activities: List[Dict[str, Any]], summaries: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    patterns = []
    low_hours = _hour_histogram_low_mood(activities)
    if low_hours:
        peak_h = max(low_hours.items(), key=lambda x: x[1])[0]
        patterns.append(
            {
                "icon": "🕐",
                "title": "Time-of-day distress signal",
                "description": (
                    f"More low mood scores recorded around hour {peak_h}:00 (local) "
                    f"from in-app activities — correlation only."
                ),
                "evidence_refs": ["metric:hour_histogram_low_mood"],
            }
        )
    type_counts = _activity_type_counts(activities)
    if type_counts:
        top = sorted(type_counts.items(), key=lambda x: -x[1])[:3]
        desc = "; ".join(f"{k} ({v} sessions)" for k, v in top)
        patterns.append(
            {
                "icon": "📊",
                "title": "Practice engagement",
                "description": f"Frequent activity types in the window: {desc}.",
                "evidence_refs": ["metric:activity_type_counts"],
            }
        )
    if summaries and len(summaries) >= 2:
        patterns.append(
            {
                "icon": "💬",
                "title": "Multiple companion sessions summarized",
                "description": f"{len(summaries)} recent session summaries available for themes (not raw chat).",
                "evidence_refs": ["metric:session_summary_count"],
            }
        )
    patterns.extend(_extract_mindgym_patterns(activities))
    return patterns


def _layer_facts(
    user_id: str,
    activities: List[Dict[str, Any]],
    crisis: List[Dict[str, Any]],
    summaries: List[Dict[str, Any]],
    screening: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "user_id_prefix": user_id[:8] if user_id else "",
        "window_days": 90,
        "activity_type_counts": _activity_type_counts(activities),
        "crisis_events_count": len(crisis),
        "session_summary_count": len(summaries),
        "screening_raw": screening,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _layer_metrics(
    activities: List[Dict[str, Any]],
    summaries: List[Dict[str, Any]],
    mood_trend: List[Dict[str, Any]],
) -> Dict[str, Any]:
    topics, topic_refs = _score_topics_from_summaries(summaries)
    return {
        "mood_trend": mood_trend,
        "hour_histogram_low_mood": _hour_histogram_low_mood(activities),
        "topics_lexicon": topics,
        "topic_evidence_refs": topic_refs,
        "patterns_seed": _patterns_from_metrics(activities, summaries),
    }


def build_profile_bundle(user_id: str) -> Dict[str, Any]:
    """Return dict with keys: facts, metrics, emotionalProfile, data_gaps, disclaimer."""
    data_gaps: List[str] = []
    screening = fetch_latest_screening_scores(user_id)
    if not screening:
        data_gaps.append("No PHQ-9/GAD-7 screening block in user_contexts yet.")

    activities = _fetch_activities_window(user_id, 90)
    crisis = _fetch_crisis_events(user_id, 365)
    summaries = _fetch_session_summaries(user_id, 20)

    mood_trend, mood_gaps = _build_mood_series(activities)
    data_gaps.extend(mood_gaps)

    facts = _layer_facts(user_id, activities, crisis, summaries, screening)
    metrics = _layer_metrics(activities, summaries, mood_trend)

    assessments = _screening_to_assessments(screening)
    if not assessments:
        data_gaps.append("Assessment scores not populated.")

    topics, _ = _score_topics_from_summaries(summaries)
    if not topics:
        data_gaps.append("No lexicon-matched themes from session summaries.")

    emotional = {
        "moodTrends": mood_trend[-30:],
        "patterns": metrics["patterns_seed"],
        "topics": topics,
        "assessments": assessments,
        "crisisEvents": _crisis_to_ui(crisis),
    }

    return {
        "facts": facts,
        "metrics": metrics,
        "emotionalProfile": emotional,
        "data_gaps": data_gaps,
        "disclaimer": DISCLAIMER,
    }
