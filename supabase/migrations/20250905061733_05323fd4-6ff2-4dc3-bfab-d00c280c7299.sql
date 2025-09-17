-- Complete MindMate schema - fixes all chat and activity tables

-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop and recreate chat_sessions with all required columns
DROP TABLE IF EXISTS chat_sessions CASCADE;
CREATE TABLE chat_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop and recreate chat_messages with all required columns  
DROP TABLE IF EXISTS chat_messages CASCADE;
CREATE TABLE chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message_sequence INTEGER,
  is_summarized BOOLEAN DEFAULT FALSE,
  summary_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_activities table for game data
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  score INTEGER,
  game_duration INTEGER,
  difficulty_level TEXT,
  activity_metadata JSONB DEFAULT '{}',
  user_response_data JSONB DEFAULT '{}',
  evaluation_data JSONB DEFAULT '{}',
  accuracy_percentage FLOAT,
  insights_generated JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_summaries table for context management
CREATE TABLE IF NOT EXISTS message_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_content TEXT NOT NULL,
  message_range_start INTEGER,
  message_range_end INTEGER,
  key_insights JSONB DEFAULT '{}',
  therapeutic_themes JSONB DEFAULT '{}',
  emotional_progression TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_templates table for game definitions
CREATE TABLE IF NOT EXISTS activity_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  activity_type TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  description TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  evaluation_criteria JSONB DEFAULT '{}',
  therapeutic_focus TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add essential indexes for performance
CREATE INDEX idx_chat_sessions_user_active ON chat_sessions(user_id, is_active, updated_at DESC);
CREATE INDEX idx_chat_messages_session_time ON chat_messages(session_id, created_at ASC);
CREATE INDEX idx_user_activities_user_time ON user_activities(user_id, completed_at DESC);
CREATE INDEX idx_message_summaries_session ON message_summaries(session_id, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own chat messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own activities" ON user_activities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access their own summaries" ON message_summaries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "All users can read activity templates" ON activity_templates
  FOR SELECT USING (true);

-- Function for auto-incrementing message sequence
CREATE OR REPLACE FUNCTION set_message_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_sequence IS NULL THEN
    SELECT COALESCE(MAX(message_sequence), 0) + 1
    INTO NEW.message_sequence
    FROM chat_messages
    WHERE session_id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for message sequencing
CREATE TRIGGER set_message_sequence_trigger
  BEFORE INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION set_message_sequence();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updating chat_sessions.updated_at
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample activity templates
INSERT INTO activity_templates (activity_type, template_name, description, configuration, therapeutic_focus) 
VALUES
('emotion_match', 'Emotion Recognition', 'Classify emotions in facial expressions', '{"images": 5, "time_limit": 300}', ARRAY['emotional_intelligence', 'self_awareness']),
('memory_challenge', 'Memory Enhancement', 'Simon-says style memory game', '{"max_sequence": 12, "difficulty": "progressive"}', ARRAY['cognitive_enhancement', 'focus']),
('mood_mountain', 'Mood Exploration', 'Navigate emotional landscapes', '{"levels": 10, "exercises": ["breathing", "grounding"]}', ARRAY['mood_tracking', 'emotional_regulation']),
('thought_detective', 'Thought Pattern Analysis', 'CBT-based cognitive pattern identification', '{"scenarios": 8, "distortions": ["catastrophizing", "black_white_thinking"]}', ARRAY['CBT', 'cognitive_restructuring']),
('emoji_match', 'Emoji Matching', 'Match emojis to improve emotional processing', '{"pairs": 10, "time_limit": 180}', ARRAY['emotional_processing', 'pattern_recognition'])
ON CONFLICT (activity_type) DO NOTHING;