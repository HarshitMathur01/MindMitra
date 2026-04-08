-- Therapist Bridge: immutable profile snapshots + referral records
-- Service role used for clinician magic-link reads via backend only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.therapist_profile_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version  TEXT NOT NULL DEFAULT '1',
  consent_mask    JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative_model_id TEXT,
  narrative_prompt_hash TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_profile_snapshots_user_created
  ON public.therapist_profile_snapshots (user_id, created_at DESC);

ALTER TABLE public.therapist_profile_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'therapist_profile_snapshots' AND policyname = 'therapist_snapshots_user_select')
  THEN
    CREATE POLICY therapist_snapshots_user_select ON public.therapist_profile_snapshots
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'therapist_profile_snapshots' AND policyname = 'therapist_snapshots_user_insert')
  THEN
    CREATE POLICY therapist_snapshots_user_insert ON public.therapist_profile_snapshots
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.therapist_referrals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  therapist_external_id TEXT NOT NULL,
  snapshot_id          UUID REFERENCES public.therapist_profile_snapshots(id) ON DELETE SET NULL,
  consent              JSONB NOT NULL DEFAULT '{}'::jsonb,
  status               TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'delivered', 'failed')),
  clinician_view_token TEXT UNIQUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_referrals_user ON public.therapist_referrals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapist_referrals_token ON public.therapist_referrals (clinician_view_token);

ALTER TABLE public.therapist_referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'therapist_referrals' AND policyname = 'therapist_referrals_user_all')
  THEN
    CREATE POLICY therapist_referrals_user_all ON public.therapist_referrals
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.therapist_profile_snapshots IS
  'Consent-scoped JSON snapshot for clinician handoff; built by FastAPI therapist bridge.';
COMMENT ON TABLE public.therapist_referrals IS
  'User-initiated referral row; clinician_view_token is opaque — verify only via backend.';

COMMIT;
