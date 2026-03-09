-- Migration: Add avatar_model column to user_settings
-- Stores the user's chosen TalkingHead avatar model.
-- Values match the ids in src/lib/avatarOptions.ts

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS avatar_model TEXT DEFAULT 'brunette'
  CHECK (avatar_model IN ('brunette', 'valentina', 'avaturn'));
