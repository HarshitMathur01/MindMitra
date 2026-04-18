-- ============================================================
-- Crisis dead-letter log (PDF failure-modes)
-- 20260415131000_crisis_dead_letter.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.crisis_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  session_id text,
  component text NOT NULL,
  action text NOT NULL,
  error text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crisis_dead_letter_created
  ON public.crisis_dead_letter (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crisis_dead_letter_user
  ON public.crisis_dead_letter (user_id, created_at DESC);

ALTER TABLE public.crisis_dead_letter ENABLE ROW LEVEL SECURITY;

-- Service role writes; users can read their own records if needed.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crisis_dead_letter'
      AND policyname = 'crisis_dead_letter_user_select'
  ) THEN
    CREATE POLICY crisis_dead_letter_user_select ON public.crisis_dead_letter
      FOR SELECT USING (auth.uid()::text = user_id);
  END IF;
END $$;

COMMIT;

