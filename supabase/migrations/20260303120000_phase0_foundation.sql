-- Phase 0 Foundation: Onboarding & Crisis Tables
-- Migration: 20260303120000_phase0_foundation.sql

-- ─────────────────────────────────────────────
-- 1. user_onboarding
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  consent_given        BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step      INTEGER NOT NULL DEFAULT 0,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  steps_skipped        JSONB NOT NULL DEFAULT '[]'::JSONB,
  device_tier          TEXT CHECK (device_tier IN ('full', 'standard', 'lite')),
  personalization      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_onboarding_select" ON public.user_onboarding
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_onboarding_insert" ON public.user_onboarding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_onboarding_update" ON public.user_onboarding
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_onboarding_delete" ON public.user_onboarding
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. crisis_events (NO user text stored — privacy-first)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crisis_events (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level      TEXT NOT NULL CHECK (level IN ('critical', 'high', 'medium')),
  source     TEXT NOT NULL,          -- e.g. 'chat', 'checkin', 'journal'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crisis_events_select" ON public.crisis_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "crisis_events_insert" ON public.crisis_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. onboarding_analytics
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_analytics (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  step        INTEGER NOT NULL,
  device_tier TEXT CHECK (device_tier IN ('full', 'standard', 'lite')),
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.onboarding_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_analytics_select" ON public.onboarding_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "onboarding_analytics_insert" ON public.onboarding_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. platform_stats (public read, service-role write)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_stats (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  active_users_today       INTEGER NOT NULL DEFAULT 0,
  total_sessions_completed INTEGER NOT NULL DEFAULT 0,
  recorded_at              DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (recorded_at)
);

ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_stats_public_read" ON public.platform_stats
  FOR SELECT USING (TRUE);

-- ─────────────────────────────────────────────
-- 5. updated_at trigger (reuse existing function if present)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_onboarding_updated_at ON public.user_onboarding;
CREATE TRIGGER user_onboarding_updated_at
  BEFORE UPDATE ON public.user_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- 6. RPC: reset_onboarding
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_onboarding(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only allow a user to reset their own onboarding,
  -- or a service-role caller to reset any user.
  IF auth.uid() IS NOT NULL AND auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Not authorised to reset another user''s onboarding';
  END IF;

  UPDATE public.user_onboarding
  SET
    consent_given        = FALSE,
    onboarding_step      = 0,
    onboarding_completed = FALSE,
    steps_skipped        = '[]'::JSONB,
    personalization      = '{}'::JSONB,
    updated_at           = NOW()
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
