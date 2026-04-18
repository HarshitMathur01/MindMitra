-- Queue for merge review / contradiction tracking (structured memory pipeline).
BEGIN;

CREATE TABLE IF NOT EXISTS public.memory_contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  existing_memory_id TEXT,
  candidate_content TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_contradictions_user_id
  ON public.memory_contradictions (user_id);

ALTER TABLE public.memory_contradictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'memory_contradictions'
      AND policyname = 'memory_contradictions_user_all'
  ) THEN
    CREATE POLICY memory_contradictions_user_all ON public.memory_contradictions
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

COMMIT;
