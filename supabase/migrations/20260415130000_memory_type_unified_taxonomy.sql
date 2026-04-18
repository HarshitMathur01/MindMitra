-- ============================================================
-- Unified Memory Taxonomy Migration (PDF-aligned)
-- 20260415130000_memory_type_unified_taxonomy.sql
--
-- Makes memory_metadata.memory_type use the unified taxonomy:
--   identity | preference | behavioral | emotional | contextual
--
-- Notes:
-- - Keeps pipeline_memory_type as raw extractor output when present.
-- - Idempotent and safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) Drop legacy CHECK constraint if present.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'memory_metadata_memory_type_check'
      AND conrelid = 'public.memory_metadata'::regclass
  ) THEN
    ALTER TABLE public.memory_metadata
      DROP CONSTRAINT memory_metadata_memory_type_check;
  END IF;
END $$;

-- 2) Ensure memory_type column exists (older envs may not have run scoring migration yet).
ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS memory_type TEXT;

-- 3) Backfill: prefer pipeline_memory_type when it is already unified.
UPDATE public.memory_metadata
  SET memory_type = lower(pipeline_memory_type)
  WHERE pipeline_memory_type IS NOT NULL
    AND lower(pipeline_memory_type) IN ('identity','preference','behavioral','emotional','contextual')
    AND (memory_type IS NULL OR trim(memory_type) = '' OR lower(memory_type) IN ('semantic','episodic','affective','relational'));

-- 4) Backfill: map legacy types → unified where possible.
--    (Best-effort; maps everything into the unified taxonomy.)
UPDATE public.memory_metadata
  SET memory_type = 'emotional'
  WHERE lower(coalesce(memory_type, '')) IN ('affective')
    AND (pipeline_memory_type IS NULL OR lower(pipeline_memory_type) NOT IN ('identity','preference','behavioral','emotional','contextual'));

UPDATE public.memory_metadata
  SET memory_type = 'contextual'
  WHERE lower(coalesce(memory_type, '')) IN ('semantic','episodic','relational')
    AND (pipeline_memory_type IS NULL OR lower(pipeline_memory_type) NOT IN ('identity','preference','behavioral','emotional','contextual'));

-- 5) Map remaining operational/legacy categories into unified buckets.
-- Crisis stays represented via tags/category/importance, but memory_type remains unified.
UPDATE public.memory_metadata
  SET memory_type = 'emotional'
  WHERE (lower(coalesce(category,'')) = 'crisis' OR lower(coalesce(importance,'')) = 'critical')
    AND (memory_type IS NULL OR trim(memory_type) = '' OR lower(memory_type) NOT IN ('identity','preference','behavioral','emotional','contextual'));

UPDATE public.memory_metadata
  SET memory_type = 'behavioral'
  WHERE lower(coalesce(category,'')) = 'procedural'
    AND (memory_type IS NULL OR trim(memory_type) = '' OR lower(memory_type) NOT IN ('identity','preference','behavioral','emotional','contextual'));

UPDATE public.memory_metadata
  SET memory_type = 'contextual'
  WHERE lower(coalesce(category,'')) = 'reflection'
    AND (memory_type IS NULL OR trim(memory_type) = '' OR lower(memory_type) NOT IN ('identity','preference','behavioral','emotional','contextual'));

-- 6) Default anything remaining null/blank to contextual (PDF-friendly safe default).
UPDATE public.memory_metadata
  SET memory_type = 'contextual'
  WHERE memory_type IS NULL OR trim(memory_type) = '';

-- 7) Add the new unified CHECK constraint.
ALTER TABLE public.memory_metadata
  ADD CONSTRAINT memory_metadata_memory_type_check
  CHECK (
    lower(memory_type) IN (
      'identity','preference','behavioral','emotional','contextual'
    )
  );

-- 8) Normalize stored values to lowercase.
UPDATE public.memory_metadata
  SET memory_type = lower(memory_type)
  WHERE memory_type IS NOT NULL;

COMMIT;

