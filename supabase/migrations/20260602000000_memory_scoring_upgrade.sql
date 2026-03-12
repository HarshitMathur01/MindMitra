-- ============================================================
-- Memory Scoring Upgrade Migration
-- 20260602000000_memory_scoring_upgrade.sql
--
-- Adds importance scoring, access tracking, and memory type
-- columns to memory_metadata to support Generative-Agents-style
-- composite retrieval scoring (recency × importance × relevance).
--
-- Also adds:
--   - UNIQUE constraints required by upsert ON CONFLICT calls
--   - RLS policies for the 3 previously-unrestricted memory tables
--
-- All statements are idempotent (safe to run multiple times).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Add importance_score (1–10 integer scale)
-- ─────────────────────────────────────────────

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS importance_score INT DEFAULT 5
    CHECK (importance_score >= 1 AND importance_score <= 10);

COMMENT ON COLUMN public.memory_metadata.importance_score IS
  'LLM-scored importance 1-10: 1=trivial, 5=neutral, 8=significant life event, 10=crisis/trauma';

-- ─────────────────────────────────────────────
-- 2. Add last_accessed_at for recency tracking
-- ─────────────────────────────────────────────

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.memory_metadata.last_accessed_at IS
  'Updated on each retrieval — drives exponential recency decay in composite scoring';

-- ─────────────────────────────────────────────
-- 3. Add memory_type for structured retrieval
-- ─────────────────────────────────────────────

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'semantic'
    CHECK (memory_type IN ('semantic', 'procedural', 'reflection', 'crisis'));

COMMENT ON COLUMN public.memory_metadata.memory_type IS
  'semantic | procedural | reflection | crisis — controls prompt injection order';

-- ─────────────────────────────────────────────
-- 4. Backfill existing rows
--    NOTE: last_accessed_at uses IS NULL only — NOT "= now()"
--    because that condition would match every newly-added row
--    whose DEFAULT just fired in this same transaction.
-- ─────────────────────────────────────────────

UPDATE public.memory_metadata
  SET importance_score = 10,
      memory_type      = 'crisis',
      last_accessed_at = created_at
  WHERE importance = 'critical' OR category = 'crisis';

UPDATE public.memory_metadata
  SET importance_score = 8,
      memory_type      = 'procedural',
      last_accessed_at = created_at
  WHERE category = 'procedural'
    AND memory_type = 'semantic';

UPDATE public.memory_metadata
  SET importance_score = 7
  WHERE importance = 'high'
    AND memory_type = 'semantic';

UPDATE public.memory_metadata
  SET last_accessed_at = created_at
  WHERE last_accessed_at IS NULL;

-- ─────────────────────────────────────────────
-- 5. Indexes for the new columns
--    Plain index on mem0_id (NOT UNIQUE) — a UNIQUE index
--    would roll back the whole migration if any duplicates exist.
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_memory_metadata_user_id
  ON public.memory_metadata (user_id);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_mem0_id
  ON public.memory_metadata (mem0_id);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_user_type
  ON public.memory_metadata (user_id, memory_type);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_user_importance
  ON public.memory_metadata (user_id, importance_score DESC);

-- ─────────────────────────────────────────────
-- 6. UNIQUE constraints required by upsert ON CONFLICT
--
--    memory_manager.py line ~502:
--      .upsert({...}, on_conflict="session_id")
--    memory_manager.py line ~881:
--      .upsert({...}, on_conflict="user_id")
--
--    Without these Postgres raises an error on every upsert
--    and session summaries / memory stats are never saved.
-- ─────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'session_summaries_session_id_key'
       AND conrelid = 'public.session_summaries'::regclass
  ) THEN
    ALTER TABLE public.session_summaries
      ADD CONSTRAINT session_summaries_session_id_key UNIQUE (session_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_memory_stats_user_id_key'
       AND conrelid = 'public.user_memory_stats'::regclass
  ) THEN
    ALTER TABLE public.user_memory_stats
      ADD CONSTRAINT user_memory_stats_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 7. Enable RLS on the 3 UNRESTRICTED tables
--    user_id is TEXT in all three (confirmed via information_schema),
--    so auth.uid() must be cast to text.
-- ─────────────────────────────────────────────

ALTER TABLE public.memory_metadata   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'memory_metadata'
      AND policyname = 'memory_metadata_user_all')
  THEN
    CREATE POLICY memory_metadata_user_all ON public.memory_metadata
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'session_summaries'
      AND policyname = 'session_summaries_user_all')
  THEN
    CREATE POLICY session_summaries_user_all ON public.session_summaries
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'user_memory_stats'
      AND policyname = 'user_memory_stats_user_all')
  THEN
    CREATE POLICY user_memory_stats_user_all ON public.user_memory_stats
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

COMMIT;