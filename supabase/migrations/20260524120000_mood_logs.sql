-- mood_logs: persistent storage for the SanctuaryHome MoodPulse selector.
-- The constellation map, inner-weather strip, and ambience engine all read
-- from this table so that the landing page reflects real user state instead
-- of demo data. Append-only per the DPDP 2023 audit posture; users can
-- delete via the standard data-export flow.
CREATE TABLE IF NOT EXISTS public.mood_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mood_index  SMALLINT NOT NULL CHECK (mood_index BETWEEN 0 AND 4),
    mood_label  TEXT NOT NULL CHECK (mood_label IN ('heavy','low','okay','lifting','bright')),
    source      TEXT NOT NULL DEFAULT 'mood_pulse'
);

CREATE INDEX IF NOT EXISTS mood_logs_user_time_idx
    ON public.mood_logs(user_id, logged_at DESC);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

-- Owner-only policy: a user can read and write only their own rows.
-- Service-role bypasses RLS as usual.
DROP POLICY IF EXISTS mood_logs_owner_all ON public.mood_logs;
CREATE POLICY mood_logs_owner_all ON public.mood_logs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
