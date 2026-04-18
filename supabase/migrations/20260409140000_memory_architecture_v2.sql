-- Patch 4 — Memory architecture v2 (additive only; safe for live Supabase).
BEGIN;

-- ── memory_metadata: Patch 1 / structured pipeline columns ───────────────
ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS decay_score DOUBLE PRECISION DEFAULT 1.0;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS supersedes_id TEXT;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS supersedes_id_inverse TEXT;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS access_count INT NOT NULL DEFAULT 1;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS verbatim_anchor TEXT;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS pipeline_memory_type TEXT;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.memory_metadata.pipeline_memory_type IS
  'Structured extractor type: episodic|semantic|affective|procedural|relational (separate from memory_type for retrieval scoring).';

CREATE INDEX IF NOT EXISTS idx_memory_metadata_session_id
  ON public.memory_metadata (session_id);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_pipeline_type
  ON public.memory_metadata (pipeline_memory_type);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_is_active
  ON public.memory_metadata (is_active);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_decay_score
  ON public.memory_metadata (decay_score);

CREATE INDEX IF NOT EXISTS idx_memory_metadata_last_accessed_at
  ON public.memory_metadata (last_accessed_at DESC);

-- ── memory_contradictions: pair logging (extends 20260409120000) ─────────
ALTER TABLE public.memory_contradictions
  ADD COLUMN IF NOT EXISTS memory_id_a TEXT;

ALTER TABLE public.memory_contradictions
  ADD COLUMN IF NOT EXISTS memory_id_b TEXT;

ALTER TABLE public.memory_contradictions
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.memory_contradictions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Allow pair-only logs when user_id cannot be resolved (service role still works).
ALTER TABLE public.memory_contradictions
  ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memory_contradictions_pair
  ON public.memory_contradictions (memory_id_a, memory_id_b);

-- ── session_registry ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_registry (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  summary_written BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_session_registry_user_id
  ON public.session_registry (user_id);

ALTER TABLE public.session_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_registry'
      AND policyname = 'session_registry_user_all'
  ) THEN
    CREATE POLICY session_registry_user_all ON public.session_registry
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- ── user_memory_profile ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_memory_profile (
  user_id TEXT PRIMARY KEY,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_profile_updated
  ON public.user_memory_profile (updated_at DESC);

ALTER TABLE public.user_memory_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_memory_profile'
      AND policyname = 'user_memory_profile_user_all'
  ) THEN
    CREATE POLICY user_memory_profile_user_all ON public.user_memory_profile
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

COMMIT;
