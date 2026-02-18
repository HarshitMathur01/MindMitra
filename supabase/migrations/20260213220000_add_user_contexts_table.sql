-- Create user_contexts table for workflow context persistence
-- First ensure chat_sessions exists (defensive - should already exist from base migration)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_contexts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_contexts_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contexts_session_id ON user_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_updated_at ON user_contexts(updated_at DESC);

ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_contexts'
      AND policyname = 'Users can view own context'
  ) THEN
    CREATE POLICY "Users can view own context" ON user_contexts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_contexts'
      AND policyname = 'Users can insert own context'
  ) THEN
    CREATE POLICY "Users can insert own context" ON user_contexts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_contexts'
      AND policyname = 'Users can update own context'
  ) THEN
    CREATE POLICY "Users can update own context" ON user_contexts
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;