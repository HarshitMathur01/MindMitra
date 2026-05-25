"""Unit tests for :mod:`app.pipeline.activity_suggestion`.

The rule engine is pure-Python and deterministic, so these tests construct
``Signals`` / ``OrchestratorOutput`` / ``SessionObject`` directly without
spinning up FastAPI or Redis. Each test maps to one rule, one kill switch,
or one cross-cutting behaviour (cooldown, affinity, refusal floor).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import pytest

from app.core.session import SessionObject
from app.models.signals import (
    AffectVector,
    ActivityAffinity,
    OrchestratorOutput,
    PassiveSignals,
    Signals,
    ToneParams,
)
from app.pipeline.activity_suggestion import (
    REFUSAL_FLOOR,
    suggest_activity,
)


# ── builders ─────────────────────────────────────────────────────────────
def _signals(
    *,
    urgency: int = 1,
    valence: float = -0.4,
    arousal: float = 0.5,
    dominance: float = 0.4,
    register: str = "casual",
    code_mix: float = 0.4,
    sarcasm: bool = False,
    implicit: Optional[List[str]] = None,
    keywords: Optional[List[str]] = None,
    farewell: bool = False,
    sudden_shutdown: bool = False,
) -> Signals:
    return Signals(
        affect_vector=AffectVector(valence=valence, arousal=arousal, dominance=dominance),
        urgency_score=urgency,
        language_register=register,  # type: ignore[arg-type]
        code_mix_ratio=code_mix,
        sarcasm_detected=sarcasm,
        implicit_distress_signals=implicit or [],
        topic_keywords=keywords or [],
        passive_signals=PassiveSignals(
            farewell_detected=farewell,
            sudden_shutdown=sudden_shutdown,
        ),
    )


def _orchestrator(
    *,
    mode: str = "companion",
    previous_mode: str = "companion",
    reason: str = "no_change",
    dependency: bool = False,
    frame_uncertainty: bool = False,
) -> OrchestratorOutput:
    return OrchestratorOutput(
        selected_mode=mode,  # type: ignore[arg-type]
        previous_mode=previous_mode,  # type: ignore[arg-type]
        mode_change_reason=reason,
        memory_gate=True,
        memory_gate_strength="full",
        tone_params=ToneParams(),
        cultural_frame_id="metro_social",
        frame_uncertainty=frame_uncertainty,
        max_response_tokens=150,
        dependency_flag=dependency,
        affect_for_retrieval={"valence": -0.4, "arousal": 0.5},
        topic_keywords_for_retrieval=[],
        temperature=0.7,
    )


def _session(
    *,
    user_messages: Optional[List[str]] = None,
    turn_count: Optional[int] = None,
    last_suggestion_turn: int = -10,
    affect_history: Optional[List[Dict[str, Any]]] = None,
    urgency_history: Optional[List[int]] = None,
    procedural: Optional[Dict[str, Any]] = None,
) -> SessionObject:
    msgs = user_messages or [
        "i can't sleep these days",
        "everything feels heavy and i don't know why",
        "i just feel stuck",
    ]
    turns: List[Dict[str, Any]] = []
    for i, m in enumerate(msgs):
        turns.append({"role": "user", "content": m, "timestamp": f"2026-05-24T10:0{i}:00+00:00"})
        turns.append({"role": "assistant", "content": "...", "timestamp": f"2026-05-24T10:0{i}:30+00:00"})
    session = SessionObject(
        session_id="sess-1",
        user_id="u1",
        turns=turns,
        affect_history=affect_history or [
            {"turn": 1, "valence": -0.3, "arousal": 0.5, "urgency": 1},
            {"turn": 2, "valence": -0.4, "arousal": 0.55, "urgency": 1},
            {"turn": 3, "valence": -0.5, "arousal": 0.6, "urgency": 1},
        ],
        urgency_history=urgency_history or [1, 1, 1],
        procedural_profile=procedural or {},
        last_suggestion_turn=last_suggestion_turn,
    )
    session.turn_count = turn_count if turn_count is not None else len(msgs)
    return session


# ── kill switches ───────────────────────────────────────────────────────
def test_crisis_urgency_suppresses_all_suggestions():
    """Even a textbook R5 trigger must yield None when urgency==3."""
    signals = _signals(urgency=3, valence=-0.8, arousal=0.9, implicit=["hopelessness_x2"])
    out = suggest_activity(
        signals=signals,
        orchestrator=_orchestrator(),
        session=_session(),
    )
    assert out is None


def test_warmup_window_suppresses_first_two_turns():
    signals = _signals(valence=-0.6, arousal=0.85)
    out = suggest_activity(
        signals=signals,
        orchestrator=_orchestrator(),
        session=_session(user_messages=["hi", "i'm anxious"], turn_count=1),
    )
    assert out is None


def test_cooldown_blocks_within_three_turns():
    signals = _signals(valence=-0.6, arousal=0.85)
    session = _session(turn_count=4, last_suggestion_turn=3)
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is None  # only 1 turn since last; needs 3


def test_cooldown_allows_after_three_turns():
    signals = _signals(valence=-0.6, arousal=0.85)
    session = _session(turn_count=6, last_suggestion_turn=3)
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "breath-sphere"


def test_shutdown_mode_suppresses_suggestion():
    signals = _signals(valence=-0.6, arousal=0.7)
    orch = _orchestrator(mode="active_listener", reason="elevated_with_shutdown")
    out = suggest_activity(signals=signals, orchestrator=orch, session=_session())
    assert out is None


def test_farewell_suppresses_suggestion():
    signals = _signals(valence=-0.4, arousal=0.6, farewell=True)
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=_session())
    assert out is None


# ── earned-cadence guard ────────────────────────────────────────────────
def test_neutral_companion_chat_does_not_fire():
    """No distress signals, neutral affect, no mode change → no card."""
    signals = _signals(
        urgency=0, valence=0.1, arousal=0.3,
        implicit=[], keywords=["movies"],
    )
    session = _session(
        user_messages=["what's a good movie to watch?", "ok cool", "love that"],
        turn_count=3,
        affect_history=[
            {"turn": 1, "valence": 0.1, "arousal": 0.3, "urgency": 0},
            {"turn": 2, "valence": 0.1, "arousal": 0.3, "urgency": 0},
            {"turn": 3, "valence": 0.15, "arousal": 0.3, "urgency": 0},
        ],
        urgency_history=[0, 0, 0],
    )
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is None


# ── rule matrix (one assertion per rule) ────────────────────────────────
def test_r1_referral_with_dependency_routes_to_therapist():
    signals = _signals(urgency=2)
    orch = _orchestrator(mode="referral_bridge", reason="dependency_referral", dependency=True)
    out = suggest_activity(signals=signals, orchestrator=orch, session=_session())
    assert out is not None
    assert out.activity_id == "/therapist-bridge"
    assert out.reason_code == "referral_with_dependency"
    assert out.activity_type == "route"


def test_r2_referral_without_dependency_routes_to_safety_plan():
    signals = _signals(urgency=2)
    orch = _orchestrator(mode="referral_bridge", reason="sustained_high_urgency", dependency=False)
    out = suggest_activity(signals=signals, orchestrator=orch, session=_session())
    assert out is not None
    assert out.activity_id == "/safety-plan"
    assert out.reason_code == "referral_mode_safety"


def test_r3_elevated_urgency_two_routes_to_safety_plan():
    signals = _signals(urgency=2, valence=-0.5, arousal=0.5)
    out = suggest_activity(
        signals=signals,
        orchestrator=_orchestrator(mode="active_listener", reason="elevated_with_trajectory"),
        session=_session(),
    )
    assert out is not None
    assert out.activity_id == "/safety-plan"
    assert out.reason_code == "elevated_distress_no_crisis"


def test_r4_recovery_check_with_lifting_valence_offers_gratitude():
    signals = _signals(urgency=0, valence=0.4, arousal=0.4, implicit=["recovery"])
    out = suggest_activity(
        signals=signals,
        orchestrator=_orchestrator(mode="recovery_check", reason="fresh_session_after_distress"),
        session=_session(),
    )
    assert out is not None
    assert out.activity_id == "gratitude-garden"
    assert out.reason_code == "recovery_lifting_valence"


def test_r5_high_arousal_negative_valence_offers_breath_sphere():
    signals = _signals(urgency=1, valence=-0.5, arousal=0.8, implicit=["anxiety"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=_session())
    assert out is not None
    assert out.activity_id == "breath-sphere"
    assert out.reason_code == "high_arousal_negative_valence"
    assert out.activity_type == "mindgym_tool"


def test_r6_dissociation_signal_offers_five_senses():
    signals = _signals(urgency=1, valence=-0.2, arousal=0.55, implicit=["numb"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=_session())
    assert out is not None
    assert out.activity_id == "five-senses"


def test_r7_rumination_pattern_offers_thought_trap():
    signals = _signals(urgency=1, valence=-0.4, arousal=0.5)
    session = _session(
        user_messages=[
            "i feel okay",
            "i always mess things up, every time i try",
            "i never get it right, never",
        ]
    )
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "thought-trap"


def test_r8_anticipatory_worry_offers_worry_vault():
    signals = _signals(urgency=1, valence=-0.2, arousal=0.6)
    session = _session(user_messages=["what if i fail tomorrow", "what if everyone laughs", "what if"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "worry-vault"


def test_r9_self_criticism_offers_inner_critic():
    signals = _signals(urgency=1, valence=-0.3, arousal=0.4)
    session = _session(user_messages=["yeah", "i'm just stupid honestly", "i hate myself for this"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "inner-critic"


def test_r11_alexithymia_offers_emotion_match():
    signals = _signals(urgency=1, valence=-0.1, arousal=0.4)
    session = _session(user_messages=["hmm", "tbh i don't know what i feel", "samajh nahi aa raha"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "emotion-match"


def test_r12_overwhelm_in_companion_offers_focus_flow():
    signals = _signals(urgency=1, valence=-0.2, arousal=0.5)
    session = _session(user_messages=["okay", "everything at once, can't focus", "too much"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(mode="companion"), session=session)
    assert out is not None
    assert out.activity_id == "focus-flow"


def test_r13_isolation_low_dependency_routes_to_peer():
    signals = _signals(urgency=1, valence=-0.3, arousal=0.4)
    session = _session(
        user_messages=["nothing", "i feel so alone these days", "nobody understands"],
        procedural={"dependency_risk_counter": 2},
    )
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "/peer-support"


def test_r15_reflective_cue_routes_to_journal():
    signals = _signals(urgency=1, valence=-0.1, arousal=0.4)
    session = _session(user_messages=["mm", "just thinking about it a lot", "processing what happened"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "/journal"


# ── affinity behaviours ─────────────────────────────────────────────────
def test_affinity_dampens_repeatedly_dismissed_activity_below_floor():
    """R5 base 0.85 * affinity_factor(0.1)=0.76 → 0.646. Above floor.
    Hard-skip kicks in when dismiss_count>=3 AND ema<=0.2 — verify hard skip path."""
    signals = _signals(urgency=1, valence=-0.5, arousal=0.8)
    procedural = {
        "activity_affinity": {
            "breath-sphere": {
                "accept_count": 0, "dismiss_count": 4,
                "last_shown_at": None, "ema_acceptance": 0.1,
            }
        }
    }
    session = _session(procedural=procedural)
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    # Hard skip on breath-sphere; next applicable rule should win (R6 requires
    # dissociation cue not present here, so we should land on a later rule or None).
    assert out is None or out.activity_id != "breath-sphere"


def test_affinity_boost_keeps_low_base_rule_alive():
    """R16 base 0.50 * affinity_factor(0.9)=1.24 → 0.62. Above floor."""
    signals = _signals(urgency=0, valence=-0.1, arousal=0.3, implicit=["low_energy"])
    procedural = {
        "activity_affinity": {
            "mood-weather": {
                "accept_count": 5, "dismiss_count": 0,
                "last_shown_at": None, "ema_acceptance": 0.9,
            }
        }
    }
    session = _session(
        user_messages=["ok", "alright", "yeah"],
        affect_history=[
            {"turn": 1, "valence": -0.1, "arousal": 0.3, "urgency": 0},
            {"turn": 2, "valence": -0.1, "arousal": 0.3, "urgency": 0},
            {"turn": 3, "valence": -0.1, "arousal": 0.3, "urgency": 0},
        ],
        urgency_history=[0, 0, 0],
        procedural=procedural,
    )
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "mood-weather"
    assert out.confidence >= REFUSAL_FLOOR


def test_recency_penalty_halves_within_six_hours():
    """Activity shown 1 hour ago → confidence halved by recency penalty."""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    procedural = {
        "activity_affinity": {
            "breath-sphere": {
                "accept_count": 0, "dismiss_count": 0,
                "last_shown_at": one_hour_ago, "ema_acceptance": 0.5,
            }
        }
    }
    signals = _signals(urgency=1, valence=-0.5, arousal=0.8)
    session = _session(procedural=procedural)
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    # Base 0.85 * 1.0 * 0.5 = 0.425 → below floor (0.45). Should fall through.
    assert out is None or out.activity_id != "breath-sphere"


# ── refusal floor ───────────────────────────────────────────────────────
def test_refusal_floor_blocks_weak_rules_for_dismissive_users():
    """R16 base 0.50 * 0.7 (ema=0.0) = 0.35 → below floor → None."""
    signals = _signals(urgency=0, valence=-0.1, arousal=0.3, implicit=["low_energy"])
    procedural = {
        "activity_affinity": {
            "mood-weather": {
                "accept_count": 0, "dismiss_count": 2,
                "last_shown_at": None, "ema_acceptance": 0.0,
            }
        }
    }
    session = _session(
        user_messages=["ok", "alright", "yeah"],
        affect_history=[
            {"turn": 1, "valence": -0.1, "arousal": 0.3, "urgency": 0},
            {"turn": 2, "valence": -0.1, "arousal": 0.3, "urgency": 0},
            {"turn": 3, "valence": -0.1, "arousal": 0.3, "urgency": 0},
        ],
        urgency_history=[0, 0, 0],
        procedural=procedural,
    )
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is None


# ── precedence (multiple rules firing) ──────────────────────────────────
def test_precedence_safety_outranks_breath():
    """R3 (urgency==2) must beat R5 (high arousal + neg valence) when both fire."""
    signals = _signals(urgency=2, valence=-0.6, arousal=0.85, implicit=["distress"])
    out = suggest_activity(
        signals=signals,
        orchestrator=_orchestrator(mode="active_listener", reason="elevated_with_trajectory"),
        session=_session(),
    )
    assert out is not None
    assert out.activity_id == "/safety-plan"


def test_precedence_breath_outranks_thought_trap():
    """R5 must beat R7 when both fire on the same turn."""
    signals = _signals(urgency=1, valence=-0.5, arousal=0.8)
    session = _session(user_messages=["i always mess up", "i never get it right", "i always fail"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_id == "breath-sphere"


# ── output shape ────────────────────────────────────────────────────────
def test_suggestion_payload_has_voice_hint_and_minutes():
    signals = _signals(urgency=1, valence=-0.5, arousal=0.8)
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=_session())
    assert out is not None
    assert out.title == "Breath Sphere"
    assert out.minutes == 3
    assert out.section == "calm"
    assert "breath" in out.voice_hint.lower()
    assert out.crisis_safe is True


def test_route_suggestion_has_no_minutes():
    signals = _signals(urgency=1, valence=-0.1, arousal=0.4)
    session = _session(user_messages=["mm", "just thinking about it a lot", "processing what happened"])
    out = suggest_activity(signals=signals, orchestrator=_orchestrator(), session=session)
    assert out is not None
    assert out.activity_type == "route"
    assert out.minutes is None


# ── activity_affinity rollup (procedural_update.update_activity_affinity) ─
def test_update_activity_affinity_accept_then_dismiss_moves_ema():
    from app.memory.procedural_update import update_activity_affinity

    rows = [
        {"activity_id": "breath-sphere", "action": "accepted", "created_at": "2026-05-24T10:00:00+00:00"},
        {"activity_id": "breath-sphere", "action": "dismissed", "created_at": "2026-05-24T11:00:00+00:00"},
    ]
    out = update_activity_affinity({}, rows)
    bs = out["breath-sphere"]
    # ema starts 0.5 → +accept(1.0) → 0.65 → +dismiss(0.0) → 0.455
    assert 0.44 <= bs["ema_acceptance"] <= 0.47
    assert bs["accept_count"] == 1
    assert bs["dismiss_count"] == 1
    assert bs["last_shown_at"] == "2026-05-24T11:00:00+00:00"


def test_update_activity_affinity_preserves_unrelated_entries():
    from app.memory.procedural_update import update_activity_affinity

    stored = {
        "thought-trap": {"accept_count": 3, "dismiss_count": 0,
                          "last_shown_at": "2026-05-23T09:00:00+00:00", "ema_acceptance": 0.85},
    }
    rows = [{"activity_id": "breath-sphere", "action": "accepted", "created_at": "2026-05-24T10:00:00+00:00"}]
    out = update_activity_affinity(stored, rows)
    assert out["thought-trap"]["accept_count"] == 3
    assert out["thought-trap"]["ema_acceptance"] == 0.85
    assert out["breath-sphere"]["accept_count"] == 1


def test_update_activity_affinity_ignores_unknown_action():
    from app.memory.procedural_update import update_activity_affinity

    rows = [{"activity_id": "breath-sphere", "action": "lol", "created_at": "2026-05-24T10:00:00+00:00"}]
    out = update_activity_affinity({}, rows)
    assert out == {}
