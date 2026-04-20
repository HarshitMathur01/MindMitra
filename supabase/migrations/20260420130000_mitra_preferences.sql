-- ============================================================================
-- Mitra Cognition Loop — Procedural Preferences (how the user wants to be
-- talked to). One JSON-ish row per user. Tiny, always loaded into context.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mitra_user_preferences (
    user_id              text PRIMARY KEY,
    tone                 text DEFAULT 'warm',
    prefers_listening    boolean DEFAULT false,
    callback_comfort     float DEFAULT 0.6,
    language_register    text DEFAULT 'auto',
    response_length      text DEFAULT 'auto',
    notes                text DEFAULT '',
    updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.mitra_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pref_owner_all ON public.mitra_user_preferences;
CREATE POLICY pref_owner_all ON public.mitra_user_preferences
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

COMMENT ON TABLE public.mitra_user_preferences IS
  'MITRA Cognition Loop — Procedural preferences (tone, callback comfort, register).';
