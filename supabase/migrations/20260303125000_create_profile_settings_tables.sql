-- Migration: Create user_profiles and user_settings tables
-- Run this in your Supabase SQL Editor

-- User Profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  full_name TEXT,
  age INTEGER,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say')),
  language TEXT DEFAULT 'english' CHECK (language IN ('hindi', 'english', 'hinglish')),
  college TEXT,
  course_year TEXT,
  city TEXT,
  avatar_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  streak_days INTEGER DEFAULT 0,
  privacy_full_name BOOLEAN DEFAULT TRUE,
  privacy_age BOOLEAN DEFAULT TRUE,
  privacy_gender BOOLEAN DEFAULT TRUE,
  privacy_college BOOLEAN DEFAULT TRUE,
  privacy_course_year BOOLEAN DEFAULT TRUE,
  privacy_city BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  companion_name TEXT DEFAULT 'Mitra',
  avatar_personality TEXT DEFAULT 'calm' CHECK (avatar_personality IN ('calm', 'energetic', 'analytical')),
  reminder_time TIME DEFAULT '09:00',
  language TEXT DEFAULT 'english' CHECK (language IN ('hindi', 'english', 'hinglish')),
  theme TEXT DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
  privacy_data_sharing BOOLEAN DEFAULT FALSE,
  privacy_therapist_share BOOLEAN DEFAULT FALSE,
  privacy_crisis_alert BOOLEAN DEFAULT TRUE,
  data_retention_days INTEGER DEFAULT 90,
  notif_daily BOOLEAN DEFAULT TRUE,
  notif_weekly BOOLEAN DEFAULT TRUE,
  notif_therapist BOOLEAN DEFAULT TRUE,
  notif_crisis BOOLEAN DEFAULT TRUE,
  notif_daily_time TIME DEFAULT '09:00',
  notif_channels JSONB DEFAULT '["push"]'::JSONB,
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  high_contrast BOOLEAN DEFAULT FALSE,
  reduce_animations BOOLEAN DEFAULT FALSE,
  screen_reader BOOLEAN DEFAULT FALSE,
  text_to_speech BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
