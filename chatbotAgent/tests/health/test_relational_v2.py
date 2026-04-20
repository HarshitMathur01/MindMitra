"""Phase 3 — relational graph + procedural ledger + relationship state (offline)."""
from __future__ import annotations

import pytest


# ── Relational graph ────────────────────────────────────────────────────────

def test_entity_upsert_idempotent_by_alias():
    from app.memory.repositories import InMemorySupabase
    from app.memory.relational import RelationalGraphService

    sb = InMemorySupabase()
    g = RelationalGraphService(sb)
    e1 = g.upsert_entity(user_id="u1", kind="person", display_name="Mom",
                         aliases=["Mummy"], attributes={"closeness": "high"})
    e2 = g.upsert_entity(user_id="u1", kind="person", display_name="Mummy")
    assert e1.id == e2.id
    assert "Mummy" in e2.aliases

    found = g.find("u1", "Mummy")
    assert found is not None and found.display_name == "Mom"


def test_link_and_neighbours():
    from app.memory.repositories import InMemorySupabase
    from app.memory.relational import RelationalGraphService

    sb = InMemorySupabase()
    g = RelationalGraphService(sb)
    a = g.upsert_entity(user_id="u1", kind="person", display_name="Aarav")
    b = g.upsert_entity(user_id="u1", kind="event", display_name="Diwali")
    g.link(user_id="u1", src_id=a.id, dst_id=b.id, edge_type="mentioned_with", weight=0.8)

    nbrs = g.neighbours("u1", a.id)
    assert len(nbrs) == 1
    assert nbrs[0].edge_type == "mentioned_with"


def test_entity_isolated_per_user():
    from app.memory.repositories import InMemorySupabase
    from app.memory.relational import RelationalGraphService

    sb = InMemorySupabase()
    g = RelationalGraphService(sb)
    g.upsert_entity(user_id="u1", kind="person", display_name="Mom")
    assert g.find("u2", "Mom") is None


# ── Procedural ledger ───────────────────────────────────────────────────────

def test_procedural_summary_no_data():
    from app.memory.repositories import InMemorySupabase
    from app.memory.procedural import ProceduralLedgerService

    s = ProceduralLedgerService(InMemorySupabase())
    summary = s.summary("u1", "478_breath")
    assert summary.n == 0
    assert summary.helpful is None


def test_procedural_summary_aggregates_deltas():
    from app.memory.repositories import InMemorySupabase
    from app.memory.procedural import ProceduralLedgerService

    s = ProceduralLedgerService(InMemorySupabase())
    s.log(user_id="u1", intervention="478_breath",
          pre_affect_vad={"v": -0.4, "a": 0.7, "d": 0.0},
          post_affect_vad={"v": -0.1, "a": 0.4, "d": 0.0})
    s.log(user_id="u1", intervention="478_breath",
          pre_affect_vad={"v": -0.5, "a": 0.6, "d": 0.0},
          post_affect_vad={"v": -0.2, "a": 0.3, "d": 0.0})

    summary = s.summary("u1", "478_breath")
    assert summary.n == 2
    assert summary.helpful is True
    assert summary.avg_valence_delta is not None and summary.avg_valence_delta > 0


def test_procedural_best_for_picks_highest_delta():
    from app.memory.repositories import InMemorySupabase
    from app.memory.procedural import ProceduralLedgerService

    s = ProceduralLedgerService(InMemorySupabase())
    s.log(user_id="u1", intervention="478_breath",
          pre_affect_vad={"v": -0.4}, post_affect_vad={"v": 0.0})  # +0.4
    s.log(user_id="u1", intervention="short_walk",
          pre_affect_vad={"v": -0.4}, post_affect_vad={"v": -0.3})  # +0.1
    best = s.best_for("u1")
    assert best == "478_breath"


# ── Relationship state advancer ─────────────────────────────────────────────

def test_stranger_starts_as_stranger():
    from app.memory.repositories import InMemorySupabase
    from app.memory.relationship_state import RelationshipStateService
    from app.core.prompts.stance import Stage

    rs = RelationshipStateService(InMemorySupabase())
    assert rs.current_stage("u1") == Stage.STRANGER


def test_stranger_to_acquaintance_requires_all_gates():
    """Stage v2: needs sessions ∧ minutes ∧ user-initiated disclosure ∧ no rupture."""
    from app.memory.repositories import InMemorySupabase
    from app.memory.relationship_state import RelationshipStateService
    from app.core.prompts.stance import Stage

    rs = RelationshipStateService(InMemorySupabase())
    rs.record_session_end("u1", duration_minutes=15)
    rs.record_session_end("u1", duration_minutes=15)
    # Three sessions, ample minutes — but no disclosure yet → still STRANGER.
    rs.record_session_end("u1", duration_minutes=15)
    assert rs.current_stage("u1") == Stage.STRANGER
    # Add the missing disclosure → next session_end promotes.
    rs.record_session_end("u1", duration_minutes=5, user_initiated_disclosure=True)
    assert rs.current_stage("u1") == Stage.ACQUAINTANCE


def test_minutes_alone_do_not_promote():
    """Engagement minutes are necessary but not sufficient — disclosure is required."""
    from app.memory.repositories import InMemorySupabase
    from app.memory.relationship_state import RelationshipStateService
    from app.core.prompts.stance import Stage

    rs = RelationshipStateService(InMemorySupabase())
    rs.record_session_end("u1", duration_minutes=35)
    assert rs.current_stage("u1") == Stage.STRANGER  # no disclosure → blocked


def test_unresolved_rupture_blocks_promotion():
    from app.memory.repositories import InMemorySupabase
    from app.memory.relationship_state import RelationshipStateService
    from app.core.prompts.stance import Stage

    rs = RelationshipStateService(InMemorySupabase())
    for _ in range(3):
        rs.record_session_end("u1", duration_minutes=15,
                              user_initiated_disclosure=True,
                              rupture_detected=True)
    # Three disclosures + plenty of minutes, but unresolved ruptures block.
    assert rs.current_stage("u1") == Stage.STRANGER
    # Repair → next session_end can promote.
    rs.record_session_end("u1", duration_minutes=5,
                          user_initiated_disclosure=True,
                          successful_repair=True)
    rs.record_session_end("u1", duration_minutes=5,
                          user_initiated_disclosure=True,
                          successful_repair=True)
    rs.record_session_end("u1", duration_minutes=5,
                          user_initiated_disclosure=True,
                          successful_repair=True)
    assert rs.current_stage("u1") == Stage.ACQUAINTANCE


def test_stage_only_advances_never_regresses():
    from app.memory.repositories import InMemorySupabase
    from app.memory.relationship_state import RelationshipStateService
    from app.core.prompts.stance import Stage

    rs = RelationshipStateService(InMemorySupabase())
    rs.force_set_stage("u1", Stage.FAMILIAR)
    rs.record_session_end("u1", duration_minutes=2)
    assert rs.current_stage("u1") == Stage.FAMILIAR


def test_stage_promotion_persists_across_service_restart():
    """Hybrid-counter contract: DB write survives an in-memory cache wipe."""
    from app.memory.repositories import InMemorySupabase
    from app.memory.relationship_state import RelationshipStateService
    from app.core.prompts.stance import Stage

    sb = InMemorySupabase()
    rs1 = RelationshipStateService(sb)
    for _ in range(3):
        rs1.record_session_end("u1", duration_minutes=10,
                               user_initiated_disclosure=True)
    assert rs1.current_stage("u1") == Stage.ACQUAINTANCE

    rs2 = RelationshipStateService(sb)  # fresh process
    assert rs2.current_stage("u1") == Stage.ACQUAINTANCE


# ── Windowed question budget (critic v0.1) ─────────────────────────────────

def test_windowed_question_budget_warns_when_window_exhausted():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "Tell me more — what's been the hardest part?",
        intent="vent",
        retrieved_memories=[],
        max_questions_per_turn=1,
        max_questions_per_window=3,
        prior_questions_in_window=3,   # bot already asked 3 in the last 5 turns
    )
    assert rep.verdict == Verdict.SOFT_REWRITE
    assert any(i.rule_id == "question_budget_per_window" for i in rep.issues)


def test_windowed_question_budget_passes_when_under_cap():
    from app.core.prompts.critic import critique, Verdict
    rep = critique(
        "What's been on your mind today?",
        intent="vent",
        retrieved_memories=[],
        max_questions_per_turn=1,
        max_questions_per_window=5,
        prior_questions_in_window=2,
    )
    assert rep.verdict == Verdict.ACCEPT
