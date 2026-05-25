-- activity_feedback: append-only log of accept/dismiss/complete events for
-- chat-surfaced activity suggestions. The session-end worker rolls these
-- rows into user_procedural_profiles.activity_affinity (per-user EMA), so
-- the rule engine can dampen activities a user repeatedly dismisses and
-- re-surface those they accept.
--
-- One row per user action. Best-effort: a write failure must NOT block the
-- chat flow, so the API never raises on insert errors.
--
-- DPDP 2023 posture: user-owned rows under RLS; service role bypasses for
-- the session-end worker; deletion cascades from auth.users.
CREATE TABLE IF NOT EXISTS public.activity_feedback (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id  TEXT NOT NULL,
    action       TEXT NOT NULL CHECK (action IN ('accepted','dismissed','completed')),
    trace_id     TEXT,
    session_id   TEXT,
    reason_code  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot index for both the session-end EMA rollup ("give me this user's last
-- N days of feedback") and the rule engine's recency penalty.
CREATE INDEX IF NOT EXISTS activity_feedback_user_time_idx
    ON public.activity_feedback(user_id, created_at DESC);

ALTER TABLE public.activity_feedback ENABLE ROW LEVEL SECURITY;

-- Owner-only policy. Service-role (session-end worker) bypasses RLS.
DROP POLICY IF EXISTS activity_feedback_owner_all ON public.activity_feedback;
CREATE POLICY activity_feedback_owner_all ON public.activity_feedback
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Mirror the column on user_procedural_profiles so the EMA rollup has a
-- home. JSONB shape: { "<activity_id>": { accept_count, dismiss_count,
-- last_shown_at, ema_acceptance } }
ALTER TABLE public.user_procedural_profiles
    ADD COLUMN IF NOT EXISTS activity_affinity JSONB NOT NULL DEFAULT '{}'::jsonb;
