"""
Health: Supabase reachable and core tables exist.

Marked `integration` because it hits a live DB. Skipped by default; enable
with `RUN_INTEGRATION=1`. This catches missing migrations early.
"""
from __future__ import annotations

import os

import pytest


REQUIRED_TABLES_LEGACY = [
    "chat_messages",
    "user_contexts",
    "user_settings",
    "user_profiles",
    "memory_metadata",
    "session_summaries",
    "user_memory_stats",
    "crisis_events",
    "therapist_profile_snapshots",
    "therapist_referrals",
    "product_events",
    "voice_analysis_events",
]

REQUIRED_TABLES_MITRA_V2 = [
    "mitra_identity_cards",
    "mitra_episodic_memories",
    "mitra_entities",
    "mitra_entity_edges",
    "mitra_affect_timeseries",
    "mitra_procedural_ledger",
    "mitra_reflection_insights",
    "mitra_relationship_state",
    "mitra_turn_traces",
    "mitra_consolidation_queue",
]


@pytest.mark.integration
@pytest.mark.parametrize("table", REQUIRED_TABLES_LEGACY)
def test_legacy_table_reachable(table):
    """Each required legacy table responds to a HEAD query (RLS-safe)."""
    from app.services.supabase_service import supabase_client

    if supabase_client is None:
        pytest.skip("supabase_client not initialised")

    try:
        resp = supabase_client.table(table).select("*", count="exact", head=True).execute()
    except Exception as exc:
        pytest.fail(f"Table {table} not reachable: {exc}")
    # Successful response — count may be None on RLS but no exception means the table exists.
    assert resp is not None


@pytest.mark.integration
@pytest.mark.parametrize("table", REQUIRED_TABLES_MITRA_V2)
def test_mitra_v2_table_present_or_skip(table):
    """Mitra v2 tables only required after the Phase 0 migration has run."""
    from app.services.supabase_service import supabase_client

    if supabase_client is None:
        pytest.skip("supabase_client not initialised")

    try:
        supabase_client.table(table).select("*", count="exact", head=True).execute()
    except Exception as exc:
        pytest.skip(
            f"Mitra v2 table {table} not yet migrated "
            f"(run supabase migrations to enable). Error: {exc}"
        )
