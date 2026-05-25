"""Layer 3.5 — deterministic activity suggestion (pure Python, no LLM, no I/O).

Reads signals + orchestrator output + session state and returns at most one
:class:`ActivitySuggestion`, or ``None``. Refusal is a first-class output —
for mental-health software an unfired suggestion is always safer than a
wrong one.

Decision flow (first-match wins):

    kill_switches()  → None on crisis / warmup / cooldown / shutdown / farewell
    earned_cadence_guard()  → require fresh distress, worsening affect, or mode change
    rules in precedence order (R1..R16)
    affinity_bias()  → final_conf = base * affinity_factor * recency_penalty
    refusal_floor()  → None if final_conf < 0.45

The rule table is intentionally small and auditable; every fired suggestion
maps to exactly one ``reason_code``.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..core.logging import get_logger, log_context
from ..core.session import SessionObject
from ..models.signals import (
    ActivityAffinity,
    ActivitySuggestion,
    EpisodicMemory,
    OrchestratorOutput,
    Signals,
)

logger = get_logger(__name__)

# ── tunables ─────────────────────────────────────────────────────────────
REFUSAL_FLOOR = 0.45
COOLDOWN_TURNS = 3
WARMUP_TURNS = 2
RECENCY_PENALTY_HOURS = 6
AFFINITY_HARD_SKIP_DISMISSALS = 3
AFFINITY_HARD_SKIP_EMA = 0.20

# Routes (non-MindGym destinations) are absolute paths and have no minutes/section.
_ROUTE_TITLES: Dict[str, str] = {
    "/therapist-bridge": "Therapist Bridge",
    "/safety-plan": "Safety Plan",
    "/peer-support": "Peer Support",
    "/journal": "Journal",
}

_ROUTE_VOICE_HINTS: Dict[str, str] = {
    "/therapist-bridge": "would it help to set up a quick call with a counsellor?",
    "/safety-plan": "want to walk through a small safety plan together?",
    "/peer-support": "want to peek at what others have written?",
    "/journal": "want to write a few lines about this in the journal?",
}

# MindGym tool catalogue (subset used by the rules). Mirrors src/lib/mindgym/catalog.ts.
# Kept here as the backend's source of truth for titles, durations, and sections so
# we never accidentally surface an ID the frontend doesn't render.
_MINDGYM: Dict[str, Dict[str, Any]] = {
    "breath-sphere":     {"title": "Breath Sphere",     "minutes": 3,  "section": "calm",     "voice": "want to try a slow breath together?"},
    "five-senses":       {"title": "5-4-3-2-1 Anchor",  "minutes": 4,  "section": "calm",     "voice": "want to ground for a moment with your senses?"},
    "thought-trap":      {"title": "Thought Trap",      "minutes": 5,  "section": "reflect",  "voice": "want to catch that thought and look at it together?"},
    "emotion-compass":   {"title": "Emotion Compass",   "minutes": 2,  "section": "reflect",  "voice": "want to map what you're feeling?"},
    "worry-vault":       {"title": "Worry Vault",       "minutes": 3,  "section": "reflect",  "voice": "want to park this worry for a few minutes?"},
    "mood-weather":      {"title": "Mood Weather",      "minutes": 1,  "section": "energize", "voice": "want to log a quick check-in?"},
    "inner-critic":      {"title": "Inner Critic Court","minutes": 5,  "section": "reflect",  "voice": "want to give that voice a fair hearing?"},
    "gratitude-garden":  {"title": "Gratitude Garden",  "minutes": 3,  "section": "energize", "voice": "want to name one good thing while we're here?"},
    "focus-flow":        {"title": "Focus Flow Timer",  "minutes": 25, "section": "focus",    "voice": "want to box this into one short focus block?"},
    "color-me-mindful":  {"title": "Color Me Mindful",  "minutes": 7,  "section": "calm",     "voice": "want to put hands on something quiet?"},
    "emotion-match":     {"title": "Emotion Detective", "minutes": 4,  "section": "reflect",  "voice": "want a tiny game that helps name feelings?"},
    "memory-challenge":  {"title": "Memory Challenge",  "minutes": 5,  "section": "focus",    "voice": "want a short brain reset?"},
    "campus-chess":      {"title": "Campus Chess",      "minutes": 15, "section": "fun",      "voice": "want to step away for a bit and play?"},
    "campus-ludo":       {"title": "Campus Ludo",       "minutes": 15, "section": "fun",      "voice": "want to roll a die and forget this for a few minutes?"},
}

# ── keyword catalogues (small, intentional) ──────────────────────────────
_RUMINATION_TOKENS = ("always", "never", "every time", "kabhi nahi", "har baar")
_FUTURE_WORRY_TOKENS = ("what if", "agar", "kya hoga", "maybe i'll", "i won't")
_SELF_CRITICISM_TOKENS = (
    "stupid", "useless", "worthless", "mera hi kasoor", "meri galti",
    "i'm an idiot", "i hate myself", "i'm a loser",
)
_OVERWHELM_TOKENS = ("overwhelmed", "too much", "can't focus", "cant focus", "sab kuch", "everything at once")
_ISOLATION_TOKENS = ("alone", "no one", "akela", "nobody cares", "nobody understands")
_REFLECTION_TOKENS = ("processing", "thinking about", "trying to figure out", "soch raha", "soch rahi")
_ALEXITHYMIA_TOKENS = ("don't know what i feel", "dont know what i feel", "samajh nahi", "samajh hi nahi", "can't describe")
_DISSOCIATION_TOKENS = ("numb", "floating", "not here", "out of body", "khaali", "shoonya")


# ── public entry point ───────────────────────────────────────────────────
def suggest_activity(
    *,
    signals: Signals,
    orchestrator: OrchestratorOutput,
    session: SessionObject,
    episodic_techniques_used: Optional[List[str]] = None,
    trace_id: Optional[str] = None,
) -> Optional[ActivitySuggestion]:
    """Pick zero-or-one activity to invite alongside the AI reply.

    Returns ``None`` if no rule fires above the refusal floor, or if any
    kill switch / earned-cadence guard refuses. Suggestions never fire on
    crisis turns.
    """
    procedural = session.procedural_profile or {}
    user_text = _latest_user_text(session)

    # ── kill switches (return None immediately) ─────────────────────────
    kill = _kill_switches(signals, session, orchestrator)
    if kill:
        logger.debug(
            f"activity suggestion: refused — {kill}",
            extra=log_context(
                session_id=session.session_id, user_id=session.user_id,
                trace_id=trace_id, refusal_reason=kill,
            ),
        )
        return None

    # ── earned cadence guard ────────────────────────────────────────────
    if not _earned_cadence(signals, session, orchestrator):
        logger.debug(
            "activity suggestion: refused — not earned",
            extra=log_context(
                session_id=session.session_id, user_id=session.user_id,
                trace_id=trace_id, refusal_reason="not_earned",
            ),
        )
        return None

    affinity = _affinity_map(procedural)

    # ── walk rules in precedence order ──────────────────────────────────
    for rule_id, candidate in _walk_rules(
        signals=signals,
        orchestrator=orchestrator,
        session=session,
        user_text=user_text,
        episodic_techniques_used=episodic_techniques_used or [],
    ):
        if candidate is None:
            continue
        affinity_for = affinity.get(candidate.activity_id)
        # hard skip: user has repeatedly dismissed this activity
        if _hard_skip(affinity_for):
            logger.debug(
                f"activity suggestion: hard-skip {candidate.activity_id} (rule {rule_id})",
                extra=log_context(
                    session_id=session.session_id, user_id=session.user_id, trace_id=trace_id,
                ),
            )
            continue
        final_conf = _apply_affinity(candidate.confidence, affinity_for)
        if final_conf < REFUSAL_FLOOR:
            logger.debug(
                f"activity suggestion: below floor {candidate.activity_id} (rule {rule_id}, conf={final_conf:.2f})",
                extra=log_context(
                    session_id=session.session_id, user_id=session.user_id, trace_id=trace_id,
                ),
            )
            continue
        # ── winner ──
        winner = candidate.model_copy(update={"confidence": round(final_conf, 3)})
        logger.info(
            f"activity suggestion: {winner.activity_id} (rule {rule_id}, conf={final_conf:.2f}, reason={winner.reason_code})",
            extra=log_context(
                session_id=session.session_id, user_id=session.user_id, trace_id=trace_id,
                rule_id=rule_id, activity_id=winner.activity_id, confidence=round(final_conf, 3),
                reason_code=winner.reason_code,
            ),
        )
        return winner

    return None


# ── kill switches ────────────────────────────────────────────────────────
def _kill_switches(signals: Signals, session: SessionObject, orchestrator: OrchestratorOutput) -> Optional[str]:
    if signals.urgency_score >= 3:
        return "crisis_urgency"
    if session.turn_count < WARMUP_TURNS:
        return "warmup_window"
    if session.turn_count - int(session.last_suggestion_turn or -10) < COOLDOWN_TURNS:
        return "cooldown_active"
    if (
        orchestrator.selected_mode == "active_listener"
        and orchestrator.mode_change_reason == "elevated_with_shutdown"
    ):
        return "user_shutting_down"
    if signals.passive_signals.farewell_detected:
        return "farewell_detected"
    return None


def _earned_cadence(signals: Signals, session: SessionObject, orchestrator: OrchestratorOutput) -> bool:
    """Don't suggest into pure-companion neutral banter."""
    if signals.implicit_distress_signals:
        return True
    if orchestrator.mode_change_reason and orchestrator.mode_change_reason not in (
        "no_change", "warmup_default", "warmup_hold", "hold_min_turns", "still_elevated",
    ):
        return True
    if _affect_worsening(session.affect_history):
        return True
    # urgency >= 1 on this turn is also "earned"
    if signals.urgency_score >= 1:
        return True
    # safety routes are allowed without distress if the mode itself is referral
    if orchestrator.selected_mode == "referral_bridge":
        return True
    return False


# ── rule walker (first match wins) ───────────────────────────────────────
def _walk_rules(
    *,
    signals: Signals,
    orchestrator: OrchestratorOutput,
    session: SessionObject,
    user_text: str,
    episodic_techniques_used: List[str],
) -> List[Tuple[str, Optional[ActivitySuggestion]]]:
    mode = orchestrator.selected_mode
    v = signals.affect_vector.valence
    a = signals.affect_vector.arousal
    procedural = session.procedural_profile or {}
    dep_counter = int(procedural.get("dependency_risk_counter", 0) or 0)
    distress = {s.lower() for s in signals.implicit_distress_signals}
    text_lower = user_text.lower()
    recent_user_msgs = session.recent_user_messages(3)
    avg_chars = sum(len(m) for m in recent_user_msgs) / max(1, len(recent_user_msgs))

    rules: List[Tuple[str, Optional[ActivitySuggestion]]] = []

    # R1: referral_bridge mode + dependency → real human
    rules.append(("R1", _route(
        active=(mode == "referral_bridge" and orchestrator.dependency_flag),
        path="/therapist-bridge",
        reason="referral_with_dependency",
        conf=0.95,
    )))

    # R2: referral_bridge mode (no dependency) → safety plan
    rules.append(("R2", _route(
        active=(mode == "referral_bridge" and not orchestrator.dependency_flag),
        path="/safety-plan",
        reason="referral_mode_safety",
        conf=0.85,
    )))

    # R3: elevated distress (urgency=2) without crisis → safety plan unless recently shown
    recent_techniques = {t.lower() for t in episodic_techniques_used}
    rules.append(("R3", _route(
        active=(signals.urgency_score == 2 and "safety_plan" not in recent_techniques),
        path="/safety-plan",
        reason="elevated_distress_no_crisis",
        conf=0.80,
    )))

    # R4: recovery_check + lifting valence → gratitude garden
    rules.append(("R4", _tool(
        active=(mode == "recovery_check" and v >= 0.2),
        tool_id="gratitude-garden",
        reason="recovery_lifting_valence",
        conf=0.75,
    )))

    # R5: high arousal + negative valence → breath sphere (physiology first)
    rules.append(("R5", _tool(
        active=(a >= 0.7 and v <= -0.3),
        tool_id="breath-sphere",
        reason="high_arousal_negative_valence",
        conf=0.85,
    )))

    # R6: dissociation cue OR (high arousal + slang + short msgs) → five-senses
    dissociation_signal = (
        bool(distress & {"dissociation", "numb", "shutdown"})
        or any(t in text_lower for t in _DISSOCIATION_TOKENS)
        or (a >= 0.65 and signals.language_register == "slang" and avg_chars < 25)
    )
    rules.append(("R6", _tool(
        active=dissociation_signal,
        tool_id="five-senses",
        reason="dissociation_grounding",
        conf=0.80,
    )))

    # R7: rumination across last 2 user turns
    last2_joined = " ".join(recent_user_msgs[-2:]).lower() if recent_user_msgs else ""
    rumination_hits = sum(1 for t in _RUMINATION_TOKENS if t in last2_joined)
    rules.append(("R7", _tool(
        active=(rumination_hits >= 2 or (rumination_hits >= 1 and v <= -0.2)),
        tool_id="thought-trap",
        reason="rumination_pattern",
        conf=0.75,
    )))

    # R8: future-worry + meaningful arousal
    future_hit = any(t in text_lower for t in _FUTURE_WORRY_TOKENS)
    rules.append(("R8", _tool(
        active=(future_hit and a >= 0.5),
        tool_id="worry-vault",
        reason="anticipatory_worry",
        conf=0.70,
    )))

    # R9: self-criticism keywords
    rules.append(("R9", _tool(
        active=any(t in text_lower for t in _SELF_CRITICISM_TOKENS),
        tool_id="inner-critic",
        reason="self_criticism_shame",
        conf=0.75,
    )))

    # R10: rapid valence swing + no clear emotion label → emotion-compass
    rules.append(("R10", _tool(
        active=(_valence_swing(session.affect_history) and not _has_emotion_label(text_lower)),
        tool_id="emotion-compass",
        reason="emotional_confusion",
        conf=0.65,
    )))

    # R11: alexithymia signal
    rules.append(("R11", _tool(
        active=any(t in text_lower for t in _ALEXITHYMIA_TOKENS),
        tool_id="emotion-match",
        reason="alexithymia_label_assist",
        conf=0.70,
    )))

    # R12: overwhelm + companion mode
    rules.append(("R12", _tool(
        active=(mode == "companion" and any(t in text_lower for t in _OVERWHELM_TOKENS)),
        tool_id="focus-flow",
        reason="overwhelm_focus",
        conf=0.60,
    )))

    # R13: isolation + low dependency risk → peer support
    rules.append(("R13", _route(
        active=(
            any(t in text_lower for t in _ISOLATION_TOKENS)
            and dep_counter < 5
        ),
        path="/peer-support",
        reason="isolation_low_dependency",
        conf=0.65,
    )))

    # R15: reflective cue → journal (precedes R14 — reflection beats distraction)
    rules.append(("R15", _route(
        active=any(t in text_lower for t in _REFLECTION_TOKENS),
        path="/journal",
        reason="reflection_invited",
        conf=0.70,
    )))

    # R14: low engagement + meaningfully negative valence (distraction fallback)
    rules.append(("R14", _tool(
        active=(avg_chars < 20 and v <= -0.2 and len(recent_user_msgs) >= 3),
        tool_id="campus-chess",
        reason="low_engagement_distraction",
        conf=0.55,
    )))

    # R16: soft default — daily check-in if low energy and nothing else fired
    rules.append(("R16", _tool(
        active=(a < 0.4 and v <= 0.2),
        tool_id="mood-weather",
        reason="daily_checkin",
        conf=0.50,
    )))

    return rules


# ── small builders ──────────────────────────────────────────────────────
def _tool(*, active: bool, tool_id: str, reason: str, conf: float) -> Optional[ActivitySuggestion]:
    if not active:
        return None
    spec = _MINDGYM.get(tool_id)
    if spec is None:
        return None
    return ActivitySuggestion(
        activity_id=tool_id,
        activity_type="mindgym_tool",
        title=spec["title"],
        reason_code=reason,
        confidence=conf,
        voice_hint=spec["voice"],
        crisis_safe=True,
        minutes=spec.get("minutes"),
        section=spec.get("section"),
    )


def _route(*, active: bool, path: str, reason: str, conf: float) -> Optional[ActivitySuggestion]:
    if not active:
        return None
    return ActivitySuggestion(
        activity_id=path,
        activity_type="route",
        title=_ROUTE_TITLES.get(path, path),
        reason_code=reason,
        confidence=conf,
        voice_hint=_ROUTE_VOICE_HINTS.get(path, ""),
        crisis_safe=True,
        minutes=None,
        section=None,
    )


# ── affinity helpers ────────────────────────────────────────────────────
def _affinity_map(procedural: Dict[str, Any]) -> Dict[str, ActivityAffinity]:
    raw = procedural.get("activity_affinity") or {}
    out: Dict[str, ActivityAffinity] = {}
    for aid, payload in raw.items():
        try:
            out[aid] = ActivityAffinity(**payload) if isinstance(payload, dict) else ActivityAffinity()
        except Exception:  # noqa: BLE001
            out[aid] = ActivityAffinity()
    return out


def _hard_skip(affinity: Optional[ActivityAffinity]) -> bool:
    if affinity is None:
        return False
    return (
        affinity.dismiss_count >= AFFINITY_HARD_SKIP_DISMISSALS
        and affinity.ema_acceptance <= AFFINITY_HARD_SKIP_EMA
    )


def _apply_affinity(base_conf: float, affinity: Optional[ActivityAffinity]) -> float:
    ema = affinity.ema_acceptance if affinity else 0.5
    affinity_factor = 0.7 + 0.6 * ema  # range 0.7..1.3
    recency_penalty = _recency_penalty(affinity.last_shown_at if affinity else None)
    return base_conf * affinity_factor * recency_penalty


def _recency_penalty(last_shown_at: Optional[str]) -> float:
    if not last_shown_at:
        return 1.0
    try:
        ts = datetime.fromisoformat(last_shown_at.replace("Z", "+00:00"))
    except ValueError:
        return 1.0
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0
    return 0.5 if age_hours < RECENCY_PENALTY_HOURS else 1.0


# ── small utilities ─────────────────────────────────────────────────────
def _latest_user_text(session: SessionObject) -> str:
    msgs = session.recent_user_messages(1)
    return msgs[-1] if msgs else ""


def _affect_worsening(affect_history: List[Dict[str, Any]]) -> bool:
    if len(affect_history) < 3:
        return False
    recent = [float(a.get("valence", 0.0)) for a in affect_history[-3:]]
    return recent[0] > recent[1] > recent[2]


def _valence_swing(affect_history: List[Dict[str, Any]]) -> bool:
    if len(affect_history) < 3:
        return False
    vals = [float(a.get("valence", 0.0)) for a in affect_history[-3:]]
    deltas = [abs(vals[i + 1] - vals[i]) for i in range(len(vals) - 1)]
    return any(d >= 0.5 for d in deltas)


_EMOTION_LABELS = (
    "sad", "angry", "anxious", "scared", "lonely", "happy", "frustrated",
    "ashamed", "guilty", "tired", "udaas", "dukhi", "ghussa", "akela",
)


def _has_emotion_label(text_lower: str) -> bool:
    return any(label in text_lower for label in _EMOTION_LABELS)
