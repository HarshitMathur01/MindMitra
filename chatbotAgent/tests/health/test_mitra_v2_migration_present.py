"""Phase 0 — verify the Mitra v2 migration file exists and lists every v2 table."""
from __future__ import annotations

from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_FILE = REPO_ROOT / "supabase" / "migrations" / "20260420120000_mitra_memory_v2.sql"

REQUIRED_TABLES = [
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
    "mitra_legacy_migration_map",
]


def test_migration_file_exists():
    assert MIGRATION_FILE.exists(), f"missing {MIGRATION_FILE}"


@pytest.mark.parametrize("table", REQUIRED_TABLES)
def test_migration_creates_table(table):
    text = MIGRATION_FILE.read_text(encoding="utf-8")
    assert f"CREATE TABLE IF NOT EXISTS public.{table}" in text, (
        f"migration must create public.{table}"
    )


def test_migration_enables_rls_on_user_tables():
    text = MIGRATION_FILE.read_text(encoding="utf-8")
    for t in [
        "mitra_identity_cards",
        "mitra_episodic_memories",
        "mitra_entities",
        "mitra_affect_timeseries",
    ]:
        assert f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY" in text


def test_affect_table_has_three_channel_columns():
    text = MIGRATION_FILE.read_text(encoding="utf-8")
    for col in ("channel", "acoustic_features", "self_report_scores"):
        assert col in text, f"affective table missing {col}"
