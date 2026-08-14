-- ============================================================================
-- MHA v3 schema migration.
--
-- Run order:
--   1. enable extensions if not already on (pgcrypto for gen_random_uuid)
--   2. create tables (idempotent: IF NOT EXISTS)
--   3. enable RLS + policies
--   4. seed static_fallback_templates and at least one crisis_templates row
--      per language variant (via supplementary scripts).
--
-- Every table is scoped by user_id where applicable. Service-role queries
-- MUST also filter user_id explicitly because they bypass RLS.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auth_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    age_group       VARCHAR(10),
    occupation      VARCHAR(50),
    city            VARCHAR(100),
    region          VARCHAR(50),
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── user_semantic_profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_semantic_profiles (
    user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    display_name     VARCHAR(100),
    occupation_detail VARCHAR(200),
    city             VARCHAR(100),
    recurring_themes JSONB NOT NULL DEFAULT '{}'::jsonb,
    relationship_map JSONB NOT NULL DEFAULT '[]'::jsonb,
    comfort_topics   JSONB NOT NULL DEFAULT '[]'::jsonb,
    discomfort_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    language_baseline JSONB NOT NULL DEFAULT '{}'::jsonb,
    cultural_frame_id VARCHAR(50),
    total_sessions   INT NOT NULL DEFAULT 0,
    first_session_at TIMESTAMPTZ
);

-- ── user_procedural_profiles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_procedural_profiles (
    user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    style_vector     JSONB NOT NULL DEFAULT '{"formality":0.4,"code_mix":0.5,"sentence_length":0.5,"warmth":0.7,"emoji_use":0.2,"directness":0.5,"humour_tolerance":0.4,"pace":0.5}'::jsonb,
    deflection_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    engagement_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    response_length_pref REAL NOT NULL DEFAULT 0.5,
    dependency_risk_counter INT NOT NULL DEFAULT 0,
    social_mentions_count INT NOT NULL DEFAULT 0,
    sessions_this_week INT NOT NULL DEFAULT 0,
    last_session_date DATE,
    consecutive_high_urgency_sessions INT NOT NULL DEFAULT 0,
    preferred_time_slots JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- ── user_longitudinal_trajectory ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_longitudinal_trajectory (
    user_id              UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    affect_series        JSONB NOT NULL DEFAULT '[]'::jsonb,
    phq2_scores          JSONB NOT NULL DEFAULT '[]'::jsonb,
    longitudinal_risk_flag BOOLEAN NOT NULL DEFAULT FALSE,
    last_slope           REAL,
    last_computed_at     TIMESTAMPTZ,
    risk_flag_set_at     TIMESTAMPTZ,
    -- Sanctuary ambient personalization (Phase 2): set true at session-end
    -- when peak_urgency >= 2 so /me/snapshot can quiet the landing page.
    -- Cleared at session_startup() once the user has stabilised.
    recent_crisis_flag   BOOLEAN NOT NULL DEFAULT FALSE,
    crisis_flag_set_at   TIMESTAMPTZ
);

-- ── sessions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
    id                       UUID PRIMARY KEY,
    user_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at               TIMESTAMPTZ NOT NULL,
    ended_at                 TIMESTAMPTZ,
    turn_count               INT NOT NULL DEFAULT 0,
    peak_urgency             INT NOT NULL DEFAULT 0,
    mode_sequence            JSONB NOT NULL DEFAULT '[]'::jsonb,
    final_affect             JSONB,
    episodic_memory_written  BOOLEAN NOT NULL DEFAULT FALSE,
    tokens_used              INT NOT NULL DEFAULT 0,
    llm_primary_used         VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_started_at_idx ON public.sessions(started_at DESC);

-- ── audit_logs ─────────────────────────────────────────────────────────────
-- No content stored. Metadata only. ``user_id`` is not a FK so we can keep
-- audit history if a user is deleted.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id    UUID,
    user_id       UUID,
    event_type    VARCHAR(50) NOT NULL,
    urgency_score INT,
    mode          VARCHAR(50),
    memory_used   BOOLEAN,
    tokens_used   INT,
    llm_used      VARCHAR(50),
    safety_flags  JSONB,
    extra         JSONB
);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);

-- ── failed async write-back queues ─────────────────────────────────────────
-- Raw transcripts are stored only when the normal summarisation/extraction
-- path has already failed, so an operator can replay them later instead of
-- silently losing memory-write data.
CREATE TABLE IF NOT EXISTS public.failed_summaries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    session_id  UUID NOT NULL,
    transcript  TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS failed_summaries_status_idx ON public.failed_summaries(status, created_at);
CREATE INDEX IF NOT EXISTS failed_summaries_user_id_idx ON public.failed_summaries(user_id);

CREATE TABLE IF NOT EXISTS public.failed_extractions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    session_id  UUID NOT NULL,
    transcript  TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS failed_extractions_status_idx ON public.failed_extractions(status, created_at);
CREATE INDEX IF NOT EXISTS failed_extractions_user_id_idx ON public.failed_extractions(user_id);

-- ── crisis_templates ───────────────────────────────────────────────────────
-- 2-approver flow: rows go active=TRUE only after two distinct admin IDs
-- have approved (enforced by the admin API in app/api/admin.py).
CREATE TABLE IF NOT EXISTS public.crisis_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_variant  VARCHAR(20) NOT NULL,
    content           TEXT NOT NULL,
    pending_content   TEXT,
    version           INT NOT NULL DEFAULT 1,
    approval_1_by     UUID,
    approval_1_at     TIMESTAMPTZ,
    approval_2_by     UUID,
    approval_2_at     TIMESTAMPTZ,
    active            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crisis_templates_variant_active_idx
    ON public.crisis_templates(language_variant) WHERE active = TRUE;

-- ── static_fallback_templates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.static_fallback_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode              VARCHAR(50) NOT NULL,
    language_variant  VARCHAR(20) NOT NULL,
    content           TEXT NOT NULL,
    template_index    INT NOT NULL,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (mode, language_variant, template_index)
);

-- ── anam_usage_daily ──────────────────────────────────────────────────────
-- Durable mirror of the Redis-held per-user, per-day Anam avatar video quota
-- (10 min/24h default; see app/services/anam_quota.py). Redis is the hot
-- enforcement path; this table exists so a Redis eviction is not a free
-- quota reset and so usage has an audit trail (DPDP).
-- user_id here is the Supabase auth UUID (JWT `sub`), matching what
-- app/api/anam.py::_resolve_user_id() already uses as user_id for this
-- surface — NOT public.users.id. Intentionally not an FK, same reasoning as
-- audit_logs: usage history should survive account deletion race conditions
-- during the same day. This also means user_id is directly comparable to
-- auth.uid() below, unlike the profile tables which need a users-table join.
CREATE TABLE IF NOT EXISTS public.anam_usage_daily (
    user_id       UUID NOT NULL,
    usage_date    DATE NOT NULL,
    seconds_spent INT NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS anam_usage_daily_user_id_idx ON public.anam_usage_daily(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.users                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_semantic_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_procedural_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_longitudinal_trajectory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_summaries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_extractions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_templates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.static_fallback_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anam_usage_daily               ENABLE ROW LEVEL SECURITY;

-- users: owner can read + update their own row; insert via service role only.
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
    FOR SELECT USING (auth.uid() = auth_id);
DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
    FOR UPDATE USING (auth.uid() = auth_id);

-- Profile tables: owner can SELECT/UPDATE through their user_id lineage.
DO $$ BEGIN
    EXECUTE 'DROP POLICY IF EXISTS user_semantic_self ON public.user_semantic_profiles';
    EXECUTE $POLICY$
        CREATE POLICY user_semantic_self ON public.user_semantic_profiles
        FOR ALL USING (
            user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    $POLICY$;
END $$;

DO $$ BEGIN
    EXECUTE 'DROP POLICY IF EXISTS user_procedural_self ON public.user_procedural_profiles';
    EXECUTE $POLICY$
        CREATE POLICY user_procedural_self ON public.user_procedural_profiles
        FOR ALL USING (
            user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    $POLICY$;
END $$;

DO $$ BEGIN
    EXECUTE 'DROP POLICY IF EXISTS user_longitudinal_self ON public.user_longitudinal_trajectory';
    EXECUTE $POLICY$
        CREATE POLICY user_longitudinal_self ON public.user_longitudinal_trajectory
        FOR ALL USING (
            user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    $POLICY$;
END $$;

-- sessions: owner can SELECT; INSERT/UPDATE via service role only.
DROP POLICY IF EXISTS sessions_self_select ON public.sessions;
CREATE POLICY sessions_self_select ON public.sessions
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    );

-- audit_logs: service role only. No user-facing policies.
-- (Default behaviour with RLS on + no policies = no rows visible to clients.)

-- crisis_templates: read for any authenticated session (the backend looks up
-- variants); write only via service role + admin endpoint.
DROP POLICY IF EXISTS crisis_templates_read ON public.crisis_templates;
CREATE POLICY crisis_templates_read ON public.crisis_templates
    FOR SELECT TO authenticated USING (TRUE);

-- static_fallback_templates: same as crisis_templates.
DROP POLICY IF EXISTS static_fallback_read ON public.static_fallback_templates;
CREATE POLICY static_fallback_read ON public.static_fallback_templates
    FOR SELECT TO authenticated USING (TRUE);

-- anam_usage_daily: owner can SELECT their own quota usage; INSERT/UPDATE via
-- service role only (anam_quota.py always writes with the service key).
DROP POLICY IF EXISTS anam_usage_daily_self_select ON public.anam_usage_daily;
CREATE POLICY anam_usage_daily_self_select ON public.anam_usage_daily
    FOR SELECT USING (user_id = auth.uid());

-- ============================================================================
-- helper RPC: increment_session_count (called by session-end pipeline)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_session_count(p_user_id UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
    UPDATE public.user_semantic_profiles
       SET total_sessions   = total_sessions + 1,
           first_session_at = COALESCE(first_session_at, NOW()),
           updated_at       = NOW()
     WHERE user_id = p_user_id;
$$;
