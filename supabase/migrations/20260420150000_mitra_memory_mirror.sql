-- ============================================================================
-- Mitra Cognition Loop — Memory Mirror v1
--
-- 1. Adds `incognito_until` to mitra_user_preferences. While now() < this
--    timestamp, the pipeline suspends episodic memory writes for the user
--    ("pause writes" / DPDP control).
-- 2. Confirms the columns Memory Mirror needs on mitra_episodic_memories
--    (`archived_at`, `strength`, `recall_count`, `last_recalled_at`) exist —
--    they were added by migration 20260420120000_mitra_memory_v2.sql, this
--    block is idempotent and safe to re-run.
-- ============================================================================

ALTER TABLE public.mitra_user_preferences
    ADD COLUMN IF NOT EXISTS incognito_until timestamptz;

COMMENT ON COLUMN public.mitra_user_preferences.incognito_until IS
    'Memory Mirror — when set in the future, episodic writes are suspended for this user.';

-- Defensive: make sure the Memory Mirror controls exist on episodic rows.
ALTER TABLE public.mitra_episodic_memories
    ADD COLUMN IF NOT EXISTS archived_at      timestamptz,
    ADD COLUMN IF NOT EXISTS strength         float DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS recall_count     int   DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_recalled_at timestamptz;
