"""Layer 3 — State Orchestrator (pure Python).

Six deterministic decisions per turn. NO I/O — every input is either passed
in from the signal extraction layer or read from the session object that's
already cached in Redis.

Decisions:
  1. Mode selection (companion | active_listener | recovery_check |
     referral_bridge)
  2. Memory gate (open/closed) + strength (full/light)
  3. Tone params (8 floats, starts from procedural style_vector)
  4. Cultural frame confirm + frame_uncertainty flag
  5. max_response_tokens (mode + urgency lookup)
  6. dependency_flag (anti-dependency shaping in prompt)

All outputs flow into Memory Retrieval, Prompt Builder, and LLM Core.
"""
from __future__ import annotations

from typing import Dict, Iterable, List

from ..core.env import env
from ..core.logging import get_logger, log_context
from ..core.session import SessionObject
from ..models.signals import (
    Mode,
    MemoryGateStrength,
    OrchestratorOutput,
    Signals,
    ToneParams,
)

logger = get_logger(__name__)


# ── Constants (mirror spec) ──────────────────────────────────────────────
MAX_RESPONSE_TOKENS = {
    ("companion", 0): 150,
    ("companion", 1): 100,
    ("active_listener", 0): 80,
    ("active_listener", 1): 80,
    ("active_listener", 2): 80,
    ("recovery_check", 0): 120,
    ("recovery_check", 1): 120,
    ("referral_bridge", 0): 180,
    ("referral_bridge", 1): 180,
    ("referral_bridge", 2): 180,
}

TEMPERATURE_BY_MODE: Dict[str, float] = {
    "companion": 0.82,
    "active_listener": 0.65,
    "recovery_check": 0.72,
    "referral_bridge": 0.60,
    "psychoeducation": 0.50,
    "skill_coach": 0.50,
}

DEPENDENCY_COUNTER_THRESHOLD = 7
DEPENDENCY_SOCIAL_THRESHOLD = 3
REFERRAL_BRIDGE_DEPENDENCY_THRESHOLD = 15

ACTIVE_LISTENER_HOLD_TURNS = 3
MIN_TURNS_BEFORE_FIRST_SWITCH = 2


# ── public entry point ───────────────────────────────────────────────────
def run_orchestrator(signals: Signals, session: SessionObject, *, trace_id: str | None = None) -> OrchestratorOutput:
    e = env()
    procedural = session.procedural_profile or {}
    semantic = session.semantic_profile or {}
    urgency_history = session.urgency_history[-10:]
    affect_history = list(session.affect_history)
    recent_turns = session.recent_turns(8)
    topic_keywords = list(signals.topic_keywords or session.current_topic_keywords)

    # ── Decision 1: Mode ────────────────────────────────────────────────
    mode_decision, reason = _select_mode(
        signals,
        session,
        procedural,
        urgency_history=urgency_history,
        affect_history=affect_history,
        recent_turns=recent_turns,
    )

    # ── Decision 2: Memory gate ─────────────────────────────────────────
    memory_gate, gate_strength = _memory_gate(mode_decision, signals, session, semantic)

    # ── Decision 3: Tone params ─────────────────────────────────────────
    tone = _tone_params(signals, mode_decision, procedural)

    # ── Decision 4: Cultural frame confirm ──────────────────────────────
    cultural_frame = semantic.get("cultural_frame_id") or session.cultural_frame_id
    frame_uncertainty = _frame_uncertainty(signals, semantic)

    # ── Decision 5: Max response tokens ─────────────────────────────────
    max_tokens = MAX_RESPONSE_TOKENS.get(
        (mode_decision, signals.urgency_score),
        MAX_RESPONSE_TOKENS.get((mode_decision, 0), 140),
    )

    # ── Decision 6: Dependency flag ─────────────────────────────────────
    dep_counter = int(procedural.get("dependency_risk_counter", 0) or 0)
    social_mentions = int(procedural.get("social_mentions_count", 0) or 0)
    dependency_flag = (
        dep_counter >= DEPENDENCY_COUNTER_THRESHOLD
        and social_mentions < DEPENDENCY_SOCIAL_THRESHOLD
    )
    tone_summary = {
        "warmth": round(tone.warmth, 2),
        "direct": round(tone.directness, 2),
        "code_mix": round(tone.code_mix, 2),
        "humour": round(tone.humour_tolerance, 2),
    }
    mode_changed = mode_decision != session.current_mode
    log_method = logger.info if mode_changed else logger.debug
    log_method(
        f"mode: {session.current_mode}→{mode_decision} ({reason})",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            trace_id=trace_id,
            current_mode=session.current_mode,
            selected_mode=mode_decision,
            urgency=signals.urgency_score,
            gate=gate_strength if memory_gate else "closed",
            frame=cultural_frame,
            tokens=max_tokens,
            dependency=dependency_flag,
            changed=mode_changed,
        ),
    )
    logger.info(
        "decisions complete",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            trace_id=trace_id,
            mode=mode_decision,
            memory_gate=memory_gate,
            memory_gate_strength=gate_strength,
            tone=tone_summary,
            cultural_frame_id=cultural_frame,
            max_response_tokens=max_tokens,
            dependency_flag=dependency_flag,
            frame_uncertainty=frame_uncertainty,
            topic_keywords=",".join(topic_keywords[:6]) if topic_keywords else "none",
        ),
    )
    if signals.sarcasm_detected:
        logger.info(
            "sarcasm flag active — urgency confidence reduced",
            extra=log_context(session_id=session.session_id, user_id=session.user_id, trace_id=trace_id, urgency=signals.urgency_score),
        )
    if dependency_flag:
        logger.info(
            "dependency flag active — social normalisation enabled",
            extra=log_context(
                session_id=session.session_id,
                user_id=session.user_id,
                trace_id=trace_id,
                dependency_risk_counter=dep_counter,
                social_mentions_count=social_mentions,
            ),
        )

    return OrchestratorOutput(
        selected_mode=mode_decision,
        previous_mode=session.current_mode,
        mode_change_reason=reason,
        memory_gate=memory_gate,
        memory_gate_strength=gate_strength,
        tone_params=tone,
        cultural_frame_id=cultural_frame,
        frame_uncertainty=frame_uncertainty,
        max_response_tokens=int(max_tokens),
        dependency_flag=dependency_flag,
        affect_for_retrieval={
            "valence": signals.affect_vector.valence,
            "arousal": signals.affect_vector.arousal,
        },
        topic_keywords_for_retrieval=topic_keywords,
        temperature=TEMPERATURE_BY_MODE.get(mode_decision, 0.7),
    )


# ── Decision 1: mode ─────────────────────────────────────────────────────
def _select_mode(
    signals: Signals,
    session: SessionObject,
    procedural: Dict,
    *,
    urgency_history: List[int],
    affect_history: List[Dict],
    recent_turns: List[Dict],
) -> tuple[Mode, str]:
    current: Mode = _coerce_mode(session.current_mode)
    urgency = signals.urgency_score

    # Sarcasm dampens urgency by 1 for mode-decision purposes only.
    effective_urgency = max(0, urgency - (1 if signals.sarcasm_detected else 0))

    # Recovery_check fires only on a fresh session whose previous peaked >=2.
    if session.is_new_session and session.turn_count < 2 and session.previous_session_peak_urgency >= 2:
        return "recovery_check", "fresh_session_after_distress"

    # Referral bridge: 4+ consecutive high-urgency turns OR runaway dependency
    last4_urgencies = urgency_history[-4:] if urgency_history else []
    if len(last4_urgencies) >= 4 and all(u >= 2 for u in last4_urgencies):
        return "referral_bridge", "sustained_high_urgency"

    dep_counter = int(procedural.get("dependency_risk_counter", 0) or 0)
    high_urgency_sessions = int(procedural.get("consecutive_high_urgency_sessions", 0) or 0)
    if dep_counter >= REFERRAL_BRIDGE_DEPENDENCY_THRESHOLD and high_urgency_sessions >= 3:
        return "referral_bridge", "dependency_referral"

    # Mode CANNOT change on the very first turn pair of a session.
    if session.turn_count < MIN_TURNS_BEFORE_FIRST_SWITCH:
        if current in ("recovery_check", "referral_bridge"):
            return current, "warmup_hold"
        return "companion", "warmup_default"

    # Active_listener entry/exit rules
    if current == "active_listener":
        # Hold for at least 3 turns
        held_for = _turns_since_mode(session, "active_listener")
        if held_for < ACTIVE_LISTENER_HOLD_TURNS:
            return "active_listener", "hold_min_turns"
        # Exit requires 3 consecutive urgency==0 AND no sarcasm
        last3 = urgency_history[-3:] if len(urgency_history) >= 3 else []
        if last3 and all(u == 0 for u in last3) and not signals.sarcasm_detected:
            return "companion", "stable_recovery"
        return "active_listener", "still_elevated"

    # Entry into active_listener: current effective urgency >= 1 AND at least
    # one of the last 3 urgencies was also >= 1 (trajectory confirmation)
    last3 = urgency_history[-3:] if urgency_history else []
    if effective_urgency >= 1 and any(u >= 1 for u in last3):
        return "active_listener", "elevated_with_trajectory"

    if effective_urgency >= 1 and any(u >= 1 for u in last3) and _recent_shutdown(recent_turns):
        return "active_listener", "elevated_with_shutdown"

    if effective_urgency >= 1 and any(u >= 1 for u in last3) and _affect_worsening(affect_history):
        return "active_listener", "elevated_with_affect_trend"

    # Recovery → companion fallthrough once urgency settles
    if current == "recovery_check" and effective_urgency == 0:
        return "companion", "recovery_resolved"

    return current if current in ("companion", "recovery_check") else "companion", "no_change"


# ── Decision 2: memory gate ──────────────────────────────────────────────
def _memory_gate(
    mode: Mode,
    signals: Signals,
    session: SessionObject,
    semantic: Dict,
) -> tuple[bool, MemoryGateStrength]:
    open_modes: Iterable[Mode] = ("companion", "active_listener", "recovery_check")
    if mode not in open_modes:
        return False, "light"
    if session.turn_count < 2:
        return False, "light"
    if signals.urgency_score == 3:
        return False, "light"
    if int(semantic.get("total_sessions", 0) or 0) + int(session.total_sessions_at_start or 0) < 2:
        # Need at least 2 prior sessions for episodics to exist
        if int(session.total_sessions_at_start or 0) < 1:
            return False, "light"

    # Light gate for distressed states — surfacing memories can feel intrusive
    if signals.urgency_score == 2:
        return True, "light"
    return True, "full"


# ── Decision 3: tone params ──────────────────────────────────────────────
def _tone_params(
    signals: Signals,
    mode: Mode,
    procedural: Dict,
) -> ToneParams:
    base = dict(procedural.get("style_vector") or {})
    # Defaults if profile is empty
    defaults = {
        "formality": 0.4,
        "code_mix": 0.5,
        "sentence_length": 0.5,
        "warmth": 0.7,
        "emoji_use": 0.2,
        "directness": 0.5,
        "humour_tolerance": 0.4,
        "pace": 0.5,
    }
    for k, v in defaults.items():
        base.setdefault(k, v)

    # Affect-driven adjustments
    if signals.urgency_score >= 1:
        base["warmth"] = min(1.0, base["warmth"] + 0.15)
        base["sentence_length"] = max(0.0, base["sentence_length"] - 0.2)
        base["directness"] = max(0.0, base["directness"] - 0.1)
    if signals.sarcasm_detected:
        base["humour_tolerance"] = min(1.0, base["humour_tolerance"] + 0.1)

    # Match code-mix within ±0.1 of detected ratio when high
    if signals.code_mix_ratio > 0.6:
        base["code_mix"] = max(base["code_mix"], min(1.0, signals.code_mix_ratio - 0.1))

    # Mode overrides
    if mode == "active_listener":
        base["directness"] = min(0.3, base["directness"])
        base["humour_tolerance"] = 0.0
    elif mode == "recovery_check":
        base["warmth"] = max(0.8, base["warmth"])

    # Clamp + warmth floor enforced inside ToneParams validator
    base["warmth"] = max(0.45, min(1.0, base["warmth"]))

    return ToneParams(**{k: max(0.0, min(1.0, v)) for k, v in base.items()})


# ── Decision 4: frame uncertainty ───────────────────────────────────────
def _frame_uncertainty(signals: Signals, semantic: Dict) -> bool:
    baseline = semantic.get("language_baseline") or {}
    baseline_code_mix = float(baseline.get("code_mix_mean", 0.5) or 0.5)
    return abs(signals.code_mix_ratio - baseline_code_mix) > 0.45


# ── helpers ──────────────────────────────────────────────────────────────
def _coerce_mode(mode: str) -> Mode:
    if mode in ("companion", "active_listener", "recovery_check", "referral_bridge", "psychoeducation", "skill_coach"):
        return mode  # type: ignore[return-value]
    return "companion"


def _turns_since_mode(session: SessionObject, mode: str) -> int:
    for entry in reversed(session.mode_history):
        if entry.get("mode") == mode:
            return session.turn_count - int(entry.get("turn_number", 0))
    return session.turn_count


def _recent_shutdown(recent_turns: List[Dict]) -> bool:
    user_turns = [str(t.get("content", "")).strip() for t in recent_turns if t.get("role") == "user"]
    if len(user_turns) < 3:
        return False
    lengths = [len(t) for t in user_turns[-3:]]
    return lengths[-1] < 16 and lengths[-1] <= max(1, lengths[-2] // 2)


def _affect_worsening(affect_history: List[Dict]) -> bool:
    if len(affect_history) < 3:
        return False
    recent = [float(a.get("valence", 0.0)) for a in affect_history[-3:]]
    return recent[0] > recent[1] > recent[2]
