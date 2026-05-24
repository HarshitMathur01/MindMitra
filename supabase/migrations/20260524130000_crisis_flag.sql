-- Crisis cool-down flag for the SanctuaryHome ambience engine.
--
-- Phase 2 of the ambient-personalization rollout: when a session ends with
-- peak_urgency >= 2 the session-end worker upserts `recent_crisis_flag=true`
-- + `crisis_flag_set_at=now()`. /me/snapshot reads both columns, and the
-- frontend quiets the landing page (hides WhisperWall, switches the
-- MicroPracticeCard to its sit-with-you variant, locks the orb whispers to
-- the 3-string safe-set) until the flag is cleared at session_startup().
--
-- The base table is created by scripts/migrations/v3_schema.sql; the
-- mirrored ADD COLUMN there keeps fresh environments consistent. This
-- supabase migration covers any database that already has the v3 schema
-- but not these two columns.
ALTER TABLE public.user_longitudinal_trajectory
    ADD COLUMN IF NOT EXISTS recent_crisis_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS crisis_flag_set_at TIMESTAMPTZ;
