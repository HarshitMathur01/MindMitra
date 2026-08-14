"""
Deterministic therapist handoff profile builder (Layer A facts + Layer B metrics).

No LLM in this module — synthesis is separate.

Data sources are the ones the v3 pipeline actually writes:

  * ``user_activities``                      — MindGym, written by the frontend
  * Qdrant ``episodic_memories``             — session-end Task B
  * ``user_longitudinal_trajectory``         — session-end Tasks A2/E (phq2_scores,
                                               affect_series, recent_crisis_flag)
  * ``user_semantic_profiles``               — session-end Task C
  * ``sessions``                             — session-end Task A (peak_urgency)

The pre-v3 sources (``session_summaries``, ``user_contexts.screening_assessments``,
``crisis_events``) are NOT read here: nothing in the repo writes them any more, so
reading them produced an empty profile plus three data_gaps lines for every user.
Do not point this module back at them without adding a writer first.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..core.connections import get_qdrant
from ..core.env import env
from . import profile_service
from .supabase_service import supabase_client

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "This summary is generated from in-app usage signals. It is not a medical "
    "record, a diagnosis, or a completed clinical questionnaire. The PHQ-2 figure "
    "is INFERRED by a language model from conversation — the person never sat and "
    "answered it — and is banked at most once every three sessions. Treat every "
    "number here as a conversation starter, not a measurement. Clinical judgment "
    "is required."
)

#: PHQ-2 is a 2-item screener scored 0–3 per item. The validated cut-point for
#: "further evaluation warranted" is a total of 3. We never label above that.
PHQ2_CUTPOINT = 3


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


def _fetch_sessions_window(user_id: str, days: int = 365) -> List[Dict[str, Any]]:
    """Session records from Task A. ``peak_urgency`` is the live crisis signal."""
    if not supabase_client:
        return []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        resp = (
            supabase_client.table("sessions")
            .select("id, started_at, ended_at, turn_count, peak_urgency, mode_sequence, final_affect")
            .eq("user_id", user_id)
            .gte("started_at", cutoff)
            .order("started_at", desc=True)
            .limit(200)
            .execute()
        )
        return resp.data or []
    except Exception as exc:
        logger.error("❌ [THERAPIST-BRIDGE] sessions fetch: %s", exc)
        return []


async def _fetch_episodic_summaries(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Scroll this user's episodic memories out of Qdrant.

    Replaces the dead ``session_summaries`` table. Payload spec is written by
    ``app/memory/episodic_write.py``: summary_text, topic_keywords, affect_mean,
    peak_urgency, session_date, mode_sequence.

    Scroll rather than search — there is no query vector here, we want the most
    recent N unconditionally. The ``user_id`` filter is mandatory (invariant 3).
    """
    client = get_qdrant()
    if client is None:
        return []
    try:
        from qdrant_client.http import models as qmodels

        def _scroll() -> List[Dict[str, Any]]:
            points, _next = client.scroll(
                collection_name=env().qdrant_episodic_collection,
                scroll_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="user_id", match=qmodels.MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=limit,
                with_payload=True,
                with_vectors=False,
            )
            return [p.payload or {} for p in points]

        rows = await asyncio.wait_for(asyncio.to_thread(_scroll), timeout=6.0)
        rows.sort(key=lambda r: str(r.get("session_date") or ""), reverse=True)
        return rows
    except Exception as exc:  # noqa: BLE001
        logger.error("❌ [THERAPIST-BRIDGE] episodic scroll: %s", exc)
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


def _score_topics(
    episodic: List[Dict[str, Any]], semantic: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Lexicon buckets over episodic summaries, unioned with semantic themes.

    Episodic ``summary_text`` is model-written prose about the session, never the
    user's raw words — the same privacy posture the old session_summaries path had.
    """
    text_blob = " ".join(str(e.get("summary_text") or "") for e in episodic).lower()
    for e in episodic:
        for kw in e.get("topic_keywords") or []:
            text_blob += " " + str(kw).lower()

    recurring = semantic.get("recurring_themes") or {}
    if isinstance(recurring, dict):
        for theme, weight in recurring.items():
            # A recurring theme counts once per recorded occurrence.
            try:
                repeats = max(1, int(weight))
            except (TypeError, ValueError):
                repeats = 1
            text_blob += (" " + str(theme).lower()) * min(repeats, 10)
    elif isinstance(recurring, list):
        for theme in recurring:
            text_blob += " " + str(theme).lower()

    for key in ("discomfort_topics", "comfort_topics"):
        for topic in semantic.get(key) or []:
            text_blob += " " + str(topic).lower()

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
    refs = [f"episodic_lexicon:{label}" for label, f in bucket_scores.items() if f > 0]
    return topics[:8], refs


def _phq2_band(total: int) -> str:
    """PHQ-2 has one validated threshold. Do not invent severity tiers above it."""
    if total >= PHQ2_CUTPOINT:
        return "at or above the PHQ-2 cut-point — further evaluation indicated"
    return "below the PHQ-2 cut-point"


def _phq2_to_assessments(longitudinal: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Most recent PHQ-2 entry from ``user_longitudinal_trajectory.phq2_scores``.

    Written by ``memory/semantic_write._append_phq2`` — an LLM inferring 0–3 for
    sleep and 0–3 for mood from what was said, banked once every third session.
    That provenance is stated on every row; it is not a self-administered PHQ-9.
    """
    entries = longitudinal.get("phq2_scores") or []
    if not isinstance(entries, list) or not entries:
        return []
    latest = entries[-1]
    if not isinstance(latest, dict):
        return []

    sleep = latest.get("sleep")
    mood = latest.get("mood")
    parts = [v for v in (sleep, mood) if v is not None]
    if not parts:
        return []
    try:
        total = sum(int(v) for v in parts)
    except (TypeError, ValueError):
        return []

    partial = " (mood item only)" if sleep is None else " (sleep item only)" if mood is None else ""
    return [
        {
            "type": "PHQ-2",
            "score": total,
            "severity": _phq2_band(total) + partial,
            "date": str(latest.get("date") or datetime.now(timezone.utc).date().isoformat()),
            "note": (
                "Inferred by a language model from conversation — NOT self-administered "
                "and not a completed questionnaire. Scored 0–3 per item over sleep and "
                "mood; cut-point 3. Re-administer properly before relying on it."
            ),
        }
    ]


def _crisis_to_ui(
    sessions: List[Dict[str, Any]], longitudinal: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Derive crisis history from session peak_urgency + the cooldown flag.

    The old ``crisis_events`` table has no writer in v3. ``sessions.peak_urgency``
    is written by session-end Task A and carries the same information: 3 is the
    crisis-bypass short-circuit, 2 is sustained high urgency.
    """
    mapped: List[Dict[str, Any]] = []
    for s in sessions:
        try:
            urgency = int(s.get("peak_urgency") or 0)
        except (TypeError, ValueError):
            continue
        if urgency < 2:
            continue
        ts = _parse_ts(s.get("started_at"))
        mapped.append(
            {
                "date": (ts or datetime.now(timezone.utc)).date().isoformat(),
                "severity": "high" if urgency >= 3 else "moderate",
                "actionTaken": (
                    "Crisis template shown in app (clinician-reviewed, not model-written). "
                    "No message content stored."
                    if urgency >= 3
                    else "Sustained high-urgency session; app quieted its ambience afterwards."
                ),
                "source": "sessions.peak_urgency",
            }
        )

    if longitudinal.get("recent_crisis_flag"):
        ts = _parse_ts(longitudinal.get("crisis_flag_set_at"))
        mapped.append(
            {
                "date": (ts or datetime.now(timezone.utc)).date().isoformat(),
                "severity": "active-cooldown",
                "actionTaken": "Crisis cooldown currently active — the app is in its quieted state.",
                "source": "user_longitudinal_trajectory.recent_crisis_flag",
            }
        )

    mapped.sort(key=lambda m: m["date"], reverse=True)
    return mapped[:50]


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
    activities: List[Dict[str, Any]],
    episodic: List[Dict[str, Any]],
    sessions: List[Dict[str, Any]],
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
    if episodic and len(episodic) >= 2:
        patterns.append(
            {
                "icon": "💬",
                "title": "Multiple companion sessions summarised",
                "description": (
                    f"{len(episodic)} model-written session summaries available for themes "
                    f"(never raw chat)."
                ),
                "evidence_refs": ["metric:episodic_count"],
            }
        )

    referral_sessions = sum(
        1 for s in sessions if "referral_bridge" in (s.get("mode_sequence") or [])
    )
    if referral_sessions:
        patterns.append(
            {
                "icon": "🌉",
                "title": "App already steered toward human support",
                "description": (
                    f"The companion selected its referral mode in {referral_sessions} "
                    f"session(s) — triggered by sustained high urgency or dependency "
                    f"signals, not by anything the person asked for."
                ),
                "evidence_refs": ["metric:referral_mode_count"],
            }
        )

    patterns.extend(_extract_mindgym_patterns(activities))
    return patterns


def _layer_facts(
    user_id: str,
    activities: List[Dict[str, Any]],
    crisis: List[Dict[str, Any]],
    episodic: List[Dict[str, Any]],
    sessions: List[Dict[str, Any]],
    longitudinal: Dict[str, Any],
    semantic: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "user_id_prefix": user_id[:8] if user_id else "",
        "window_days": 90,
        "activity_type_counts": _activity_type_counts(activities),
        "crisis_events_count": len(crisis),
        "episodic_summary_count": len(episodic),
        "session_count": len(sessions),
        "total_sessions": semantic.get("total_sessions"),
        "first_session_at": semantic.get("first_session_at"),
        "phq2_entry_count": len(longitudinal.get("phq2_scores") or []),
        "longitudinal_risk_flag": bool(longitudinal.get("longitudinal_risk_flag")),
        "last_slope": longitudinal.get("last_slope"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _layer_metrics(
    activities: List[Dict[str, Any]],
    episodic: List[Dict[str, Any]],
    sessions: List[Dict[str, Any]],
    semantic: Dict[str, Any],
    mood_trend: List[Dict[str, Any]],
) -> Dict[str, Any]:
    topics, topic_refs = _score_topics(episodic, semantic)
    return {
        "mood_trend": mood_trend,
        "hour_histogram_low_mood": _hour_histogram_low_mood(activities),
        "topics_lexicon": topics,
        "topic_evidence_refs": topic_refs,
        "patterns_seed": _patterns_from_metrics(activities, episodic, sessions),
    }


def _affect_series_to_mood(series: Any) -> List[Dict[str, Any]]:
    """Map longitudinal affect valence (-1..1) onto the 1–10 mood scale the UI uses."""
    if not isinstance(series, list):
        return []
    out: List[Dict[str, Any]] = []
    for entry in series:
        if not isinstance(entry, dict):
            continue
        ts = _parse_ts(entry.get("date") or entry.get("timestamp") or entry.get("at"))
        valence = entry.get("valence")
        if ts is None or valence is None:
            continue
        try:
            v = float(valence)
        except (TypeError, ValueError):
            continue
        mood = int(min(10, max(1, round(1 + ((v + 1.0) / 2.0) * 9))))
        out.append({"date": f"{ts.date().isoformat()}T12:00:00.000Z", "mood": mood})
    out.sort(key=lambda r: r["date"])
    return out


async def build_profile_bundle(user_id: str) -> Dict[str, Any]:
    """Return dict with keys: facts, metrics, emotionalProfile, data_gaps, disclaimer.

    Async because the semantic/longitudinal loaders and the Qdrant scroll are async.
    Every read is independent, so they run concurrently.
    """
    data_gaps: List[str] = []

    activities, sessions, episodic, longitudinal, semantic = await asyncio.gather(
        asyncio.to_thread(_fetch_activities_window, user_id, 90),
        asyncio.to_thread(_fetch_sessions_window, user_id, 365),
        _fetch_episodic_summaries(user_id, 20),
        profile_service.load_longitudinal(user_id),
        profile_service.load_semantic_profile(user_id),
    )

    mood_trend, mood_gaps = _build_mood_series(activities)
    data_gaps.extend(mood_gaps)

    # Activity mood scores are sparse (they only exist where MindGym recorded one).
    # The longitudinal affect series covers every chat session, so it backfills.
    if len(mood_trend) < 3:
        affect_trend = _affect_series_to_mood(longitudinal.get("affect_series"))
        if affect_trend:
            by_day = {p["date"]: p for p in affect_trend}
            by_day.update({p["date"]: p for p in mood_trend})
            mood_trend = [by_day[k] for k in sorted(by_day)]

    crisis = _crisis_to_ui(sessions, longitudinal)
    facts = _layer_facts(user_id, activities, crisis, episodic, sessions, longitudinal, semantic)
    metrics = _layer_metrics(activities, episodic, sessions, semantic, mood_trend)

    assessments = _phq2_to_assessments(longitudinal)
    if not assessments:
        data_gaps.append(
            "No PHQ-2 recorded yet. It is banked at most once every three sessions, "
            "so a newer account will not have one."
        )

    topics = metrics["topics_lexicon"]
    if not topics:
        data_gaps.append("No lexicon-matched themes from session summaries yet.")
    if not episodic:
        data_gaps.append(
            "No episodic session summaries found — either the account is new or the "
            "memory pipeline has not run."
        )
    if not mood_trend:
        data_gaps.append("No mood trend: neither MindGym scores nor an affect series exist yet.")

    emotional = {
        "moodTrends": mood_trend[-30:],
        "patterns": metrics["patterns_seed"],
        "topics": topics,
        "assessments": assessments,
        "crisisEvents": crisis,
    }

    return {
        "facts": facts,
        "metrics": metrics,
        "emotionalProfile": emotional,
        "data_gaps": data_gaps,
        "disclaimer": DISCLAIMER,
    }
