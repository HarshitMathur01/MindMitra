-- ============================================================
-- Production Cleanup Migration
-- 20260601000000_production_cleanup.sql
--
-- Drops 9 dead tables + the phantom chat_sessions table,
-- removes orphaned FK constraints, dead PG functions,
-- and unused columns.  Result: 13 clean, actively-used tables.
-- ============================================================

-- ─────────────────────────────────────────────
-- 0. Safety: wrap in a transaction
-- ─────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Drop dead PG functions (from RAG migration)
-- ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS search_memories_hybrid(
    extensions.vector(384), TEXT, UUID, TEXT[], FLOAT, INT
);

DROP FUNCTION IF EXISTS find_similar_global_memories(
    extensions.vector(384), UUID, TEXT, FLOAT
);

-- ─────────────────────────────────────────────
-- 2. Drop FK constraints on KEPT tables
--    (must precede chat_sessions DROP)
-- ─────────────────────────────────────────────

-- chat_messages.session_id → chat_sessions(id)
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

-- user_activities.session_id → chat_sessions(id)
ALTER TABLE user_activities
  DROP CONSTRAINT IF EXISTS user_activities_session_id_fkey;

-- user_contexts.session_id → chat_sessions(id)
ALTER TABLE user_contexts
  DROP CONSTRAINT IF EXISTS user_contexts_session_id_fkey;

-- ─────────────────────────────────────────────
-- 3. Drop 9 dead tables (children first)
-- ─────────────────────────────────────────────

-- Children of global_memories
DROP TABLE IF EXISTS episodic_tracker CASCADE;

-- Children of chat_sessions (FK already dropped, CASCADE for safety)
DROP TABLE IF EXISTS session_chunk_summaries CASCADE;
DROP TABLE IF EXISTS session_memories CASCADE;

-- global_memories has self-referencing superseded_by
DROP TABLE IF EXISTS global_memories CASCADE;

-- Superseded by session_summaries (mem0), never written to
DROP TABLE IF EXISTS message_summaries CASCADE;

-- Legacy table — queried but never populated
DROP TABLE IF EXISTS memories CASCADE;

-- Seeded reference tables — never queried at runtime
DROP TABLE IF EXISTS companion_personalities CASCADE;
DROP TABLE IF EXISTS activity_templates CASCADE;

-- Read-only table with zero writer processes
DROP TABLE IF EXISTS platform_stats CASCADE;

-- ─────────────────────────────────────────────
-- 4. Drop the phantom chat_sessions table
--    (no code in the entire project writes to it)
-- ─────────────────────────────────────────────

-- Drop trigger first
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;

DROP TABLE IF EXISTS chat_sessions CASCADE;

-- ─────────────────────────────────────────────
-- 5. Clean dead columns from chat_messages
--    (added by 20251101 memories migration, never used)
-- ─────────────────────────────────────────────

ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS processed_into_memory;

ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS memory_processed_at;

-- Also drop is_summarized / summary_id — never used
ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS is_summarized;

ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS summary_id;

-- ─────────────────────────────────────────────
-- 6. Drop dead columns from memories migration
--    on chat_messages (already handled above)
--    and the set_message_sequence trigger/function
-- ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_message_sequence_trigger ON chat_messages;
DROP FUNCTION IF EXISTS set_message_sequence();

-- Also drop message_sequence column (never read by any code)
ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS message_sequence;

-- ─────────────────────────────────────────────
-- 7. Drop companion_personality columns that
--    reference the now-dropped companion_personalities
--    table (user_settings CHECK constraint is self-contained,
--    no FK — safe to keep the column)
-- ─────────────────────────────────────────────

-- Nothing to do — companion_personality column in user_settings
-- uses a CHECK constraint, not an FK. Keeping it.

-- ─────────────────────────────────────────────
-- 8. Drop the reset_onboarding function's dependency
--    on platform_stats is non-existent; keep function.
-- ─────────────────────────────────────────────

-- Nothing additional needed.

-- ─────────────────────────────────────────────
-- 9. Verify final table set (informational)
-- ─────────────────────────────────────────────
-- Expected remaining tables (13):
--   chat_messages
--   user_activities
--   user_settings
--   user_profiles
--   user_onboarding
--   crisis_events
--   user_contexts
--   session_summaries
--   memory_metadata
--   user_memory_stats
--   voice_analysis_events
--   onboarding_analytics
-- + any auth.* / storage.* system tables

COMMIT;
