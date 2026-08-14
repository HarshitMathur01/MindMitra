-- Therapist Bridge hardening: token lifetime, view stamping, atomic referral.
--
-- Three problems this fixes, all of which only became load-bearing once the
-- frontend started actually calling these endpoints:
--
--   1. clinician_view_token never expired. It is an unauthenticated magic link
--      carrying a clinical profile, and it lived forever.
--   2. status 'delivered' was in the CHECK constraint and nothing ever set it,
--      so there was no record of whether a brief had been opened.
--   3. The snapshot and the referral were two separate inserts from the API. If
--      the second failed, the first was left behind: a copy of someone's
--      clinical profile with no consent record pointing at it.

BEGIN;

ALTER TABLE public.therapist_referrals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.therapist_referrals.expires_at IS
  'After this, clinician-brief returns 404. Set by the API from THERAPIST_BRIDGE_TOKEN_TTL_DAYS.';
COMMENT ON COLUMN public.therapist_referrals.viewed_at IS
  'First clinician-brief read. Also flips status to delivered.';

-- Backfill: existing rows predate expiry and would otherwise be immortal.
UPDATE public.therapist_referrals
   SET expires_at = created_at + INTERVAL '14 days'
 WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_therapist_referrals_token_live
  ON public.therapist_referrals (clinician_view_token)
  WHERE clinician_view_token IS NOT NULL;

-- ── atomic referral creation ───────────────────────────────────────────────
-- SECURITY DEFINER because the API calls this with the service role on behalf
-- of an already-JWT-verified user; p_user_id is resolved from that JWT, never
-- from client input. Both inserts share one implicit transaction, so a failure
-- on either leaves nothing behind.
CREATE OR REPLACE FUNCTION public.create_therapist_referral(
  p_snapshot_id            UUID,
  p_referral_id            UUID,
  p_user_id                UUID,
  p_therapist_external_id  TEXT,
  p_consent                JSONB,
  p_payload                JSONB,
  p_narrative_model_id     TEXT,
  p_narrative_prompt_hash  TEXT,
  p_clinician_view_token   TEXT,
  p_expires_at             TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.therapist_profile_snapshots (
    id, user_id, schema_version, consent_mask, payload,
    narrative_model_id, narrative_prompt_hash
  ) VALUES (
    p_snapshot_id, p_user_id, '1', p_consent, p_payload,
    p_narrative_model_id, p_narrative_prompt_hash
  );

  INSERT INTO public.therapist_referrals (
    id, user_id, therapist_external_id, snapshot_id, consent,
    status, clinician_view_token, expires_at
  ) VALUES (
    p_referral_id, p_user_id, p_therapist_external_id, p_snapshot_id, p_consent,
    'created', p_clinician_view_token, p_expires_at
  );

  RETURN p_referral_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_therapist_referral(
  UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_therapist_referral(
  UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

COMMENT ON FUNCTION public.create_therapist_referral IS
  'Writes a profile snapshot and its referral in one transaction. Service role only — the API resolves p_user_id from a verified Supabase JWT.';

COMMIT;
