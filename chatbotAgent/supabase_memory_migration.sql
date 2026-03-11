-- ══════════════════════════════════════════════════════════════
-- MindMitra — mem0 Memory System: Supabase Migration
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- ══════════════════════════════════════════════════════════════

-- ── 1. session_summaries ──────────────────────────────────────
-- Stores a single rolling summary per session, updated on session end.
CREATE TABLE IF NOT EXISTS session_summaries (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       TEXT NOT NULL,
    session_id    TEXT NOT NULL UNIQUE,     -- one summary per session
    summary_text  TEXT NOT NULL DEFAULT '',
    themes        JSONB DEFAULT '[]'::jsonb,
    emotional_arc JSONB DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups by user + recency
CREATE INDEX IF NOT EXISTS idx_session_summaries_user
    ON session_summaries (user_id, created_at DESC);

-- ── 2. memory_metadata ───────────────────────────────────────
-- Shadow table that tracks every mem0 vector ID with extra metadata
-- that Qdrant payloads alone cannot efficiently query.
CREATE TABLE IF NOT EXISTS memory_metadata (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       TEXT NOT NULL,
    mem0_id       TEXT NOT NULL,            -- the vector ID returned by mem0.add()
    category      TEXT DEFAULT 'general',
    importance    TEXT DEFAULT 'medium',    -- low / medium / high / critical
    source        TEXT DEFAULT 'conversation',
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_user
    ON memory_metadata (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_mem0id
    ON memory_metadata (mem0_id);

-- ── 3. user_memory_stats ─────────────────────────────────────
-- Aggregate counters per user — avoids COUNT(*) on large tables.
CREATE TABLE IF NOT EXISTS user_memory_stats (
    user_id          TEXT PRIMARY KEY,
    total_memories   INT DEFAULT 0,
    last_extraction  TIMESTAMPTZ,
    session_count    INT DEFAULT 0,
    updated_at       TIMESTAMPTZ DEFAULT now()
);
