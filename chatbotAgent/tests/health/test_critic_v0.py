"""Phase 1 — critic v0 unit tests (offline, deterministic)."""
from __future__ import annotations

import pytest


def test_clean_draft_accepted():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "That sounds heavy. I'm here — what's been weighing on you most today?",
        intent="vent",
        retrieved_memories=[],
        max_questions_per_turn=1,
    )
    assert rep.verdict == Verdict.ACCEPT
    assert not rep.issues


def test_false_emotion_blocked():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "I'm so sad to hear that, I really am. Tell me more.",
        intent="vent",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.REJECT
    assert any(i.rule_id == "false_emotion" for i in rep.issues)


def test_sycophancy_warns_and_softrewrites():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "Great question! That sounds heavy.",
        intent="reflection",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.SOFT_REWRITE
    assert any(i.rule_id == "sycophancy" for i in rep.issues)


def test_premature_advice_warns_in_vent():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "You should just try meditating before bed.",
        intent="vent",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.SOFT_REWRITE
    assert any(i.rule_id == "premature_advice" for i in rep.issues)


def test_advice_ok_in_advice_seeking():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "You could try a 4-7-8 breath cycle if it helps.",
        intent="advice_seek",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.ACCEPT


def test_memory_hallucination_blocked_when_no_memory_retrieved():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "I remember you said your dad is hard to talk to.",
        intent="reflection",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.REJECT
    assert any(i.rule_id == "memory_hallucination" for i in rep.issues)


def test_memory_callback_ok_when_memory_present():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "I remember you said exams have been heavy lately.",
        intent="reflection",
        retrieved_memories=["User mentioned semester finals were stressful (oct '25)."],
        max_questions_per_turn=2,
    )
    assert rep.verdict == Verdict.ACCEPT


def test_question_budget_warns():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "How are you? What's been on your mind? Want to share more?",
        intent="vent",
        retrieved_memories=[],
        max_questions_per_turn=1,
    )
    assert rep.verdict == Verdict.SOFT_REWRITE
    assert any(i.rule_id == "question_budget_per_turn" for i in rep.issues)


def test_rhetorical_questions_dont_count():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "That's tough, na? Tell me what's been the hardest part.",
        intent="vent",
        retrieved_memories=[],
        max_questions_per_turn=1,
    )
    # 'na?' is rhetorical → should still pass.
    assert rep.verdict == Verdict.ACCEPT


# ── v1 — false-quote verification ──────────────────────────────────────────

def test_quoted_phrase_must_appear_in_retrieved_memory():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        'You said "my mother is the reason I freeze" — that landed.',
        intent="reflection",
        retrieved_memories=[
            "User talked about feeling small around their father at dinner."
        ],
        max_questions_per_turn=1,
    )
    assert rep.verdict == Verdict.REJECT
    assert any(i.rule_id == "memory_quote_unverified" for i in rep.issues)


def test_quoted_phrase_grounded_in_memory_passes():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        'Earlier you mentioned "exams have been heavy" — has that lifted at all?',
        intent="reflection",
        retrieved_memories=[
            "User said exams have been heavy this semester."
        ],
        max_questions_per_turn=1,
    )
    assert rep.verdict == Verdict.ACCEPT


# ── v1 — diagnosis-claim guard ─────────────────────────────────────────────

def test_diagnosis_claim_blocked():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "From what you describe, you have depression and probably anxiety too.",
        intent="vent",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.REJECT
    assert any(i.rule_id == "diagnosis_claim" for i in rep.issues)


# ── v1 — empathy + length floors are advisory (INFO) ───────────────────────

def test_empathy_floor_is_advisory_only():
    """A vent reply with no empathy marker should still be ACCEPT (INFO only)."""
    from app.core.prompts.critic import critique, Verdict, Severity
    rep = critique(
        "What part felt the heaviest today, would you say?",
        intent="vent",
        retrieved_memories=[],
        max_questions_per_turn=1,
    )
    assert rep.verdict == Verdict.ACCEPT
    assert any(
        i.rule_id == "empathy_floor" and i.severity == Severity.INFO
        for i in rep.issues
    )


def test_length_floor_is_advisory_only():
    from app.core.prompts.critic import critique, Verdict, Severity
    rep = critique(
        "I hear you.",
        intent="reflection",
        retrieved_memories=[],
    )
    assert rep.verdict == Verdict.ACCEPT
    assert any(
        i.rule_id == "length_floor" and i.severity == Severity.INFO
        for i in rep.issues
    )
