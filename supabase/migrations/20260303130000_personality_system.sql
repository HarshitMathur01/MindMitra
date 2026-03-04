-- ============================================================
-- Personality System Migration
-- Adds companion personality selection to user_settings
-- and creates a companion_personalities reference table
-- ============================================================

-- 1. Add companion_personality column to user_settings (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings'
    AND column_name = 'companion_personality'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN companion_personality TEXT DEFAULT 'mitra'
        CHECK (companion_personality IN ('mitra', 'arjun', 'diya', 'riya', 'zen'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings'
    AND column_name = 'companion_personality_locked'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN companion_personality_locked BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Create companion_personalities reference table
CREATE TABLE IF NOT EXISTS companion_personalities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  tagline TEXT NOT NULL,
  best_for TEXT NOT NULL,
  color_accent TEXT NOT NULL,
  system_prompt_addition TEXT NOT NULL,
  voice_rate DECIMAL NOT NULL DEFAULT 1.0,
  avatar_animation_style TEXT NOT NULL DEFAULT 'calm'
);

-- Enable RLS
ALTER TABLE companion_personalities ENABLE ROW LEVEL SECURITY;

-- Public read access for personalities reference data
CREATE POLICY "Anyone can read companion personalities"
  ON companion_personalities FOR SELECT
  USING (true);

-- 3. Seed the 5 personalities
INSERT INTO companion_personalities (id, name, emoji, tagline, best_for, color_accent, system_prompt_addition, voice_rate, avatar_animation_style)
VALUES
  ('mitra', 'Mitra', '🧘', 'The Calm Companion', 'Anxiety & overwhelm', '#028090',
   'You are Mitra, a gentle and empathetic mental health companion for Indian students. Speak softly, validate emotions before offering perspective. Never rush. Use simple language. Occasionally use warm Hindi phrases like "Koi baat nahi" naturally. Always prioritize the user feeling heard over giving advice.',
   0.9, 'calm'),
  ('arjun', 'Arjun', '🎯', 'The Focused Coach', 'Academic stress & goals', '#F59E0B',
   'You are Arjun, a focused mental health coach for Indian students under academic pressure. Help identify specific problems and set small achievable goals. Be warm but practical. Use structured responses. Celebrate progress. Understand JEE/engineering pressure deeply.',
   1.0, 'focused'),
  ('diya', 'Diya', '💡', 'The Curious Explainer', 'Understanding emotions deeply', '#6C63FF',
   'You are Diya, an intellectually curious mental health companion. Explain psychological concepts simply using relatable analogies. Ask thoughtful Socratic questions. Make users feel like they are learning about themselves. Reference concepts like cognitive distortions, stress response, and emotional regulation in accessible language.',
   0.95, 'curious'),
  ('riya', 'Riya', '🌟', 'The Energetic Cheerleader', 'Low motivation & confidence', '#EC4899',
   'You are Riya, an energetic and uplifting mental health companion for students. Celebrate every small win. Be enthusiastic without dismissing real pain. Inject genuine positivity and belief in the user. Help them see their own strength. Use encouraging language naturally without being toxic positivity.',
   1.1, 'energetic'),
  ('zen', 'Zen', '🌙', 'The Mindful Guide', 'Stress relief & grounding', '#10B981',
   'You are Zen, a mindful and grounding mental health companion. Guide users through breathing exercises, body scans, and mindfulness moments naturally in conversation. Use nature metaphors and imagery. Speak slowly and create stillness. Gently redirect racing thoughts. Incorporate techniques from MBSR and DBT grounding.',
   0.85, 'zen')
ON CONFLICT (id) DO NOTHING;
