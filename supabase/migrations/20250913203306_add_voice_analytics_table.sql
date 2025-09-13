-- Migration: Add voice analytics table for MindMate voice features
CREATE TABLE voice_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  
  -- Voice transcript and analysis
  transcript TEXT NOT NULL,
  emotional_tone TEXT CHECK (emotional_tone IN ('calm', 'anxious', 'sad', 'excited', 'frustrated', 'neutral')),
  stress_level TEXT CHECK (stress_level IN ('low', 'medium', 'high')),
  speech_pace TEXT CHECK (speech_pace IN ('slow', 'normal', 'fast')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Structured insights as JSONB
  psychological_markers JSONB DEFAULT '{}'::jsonb,
  cultural_context JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  processing_duration_ms INTEGER,
  analysis_model TEXT DEFAULT 'basic_v1',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_voice_analytics_user_id ON voice_analytics(user_id);
CREATE INDEX idx_voice_analytics_session_id ON voice_analytics(session_id);
CREATE INDEX idx_voice_analytics_message_id ON voice_analytics(message_id);
CREATE INDEX idx_voice_analytics_created_at ON voice_analytics(created_at);

-- Enable Row Level Security
ALTER TABLE voice_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own voice analytics" 
  ON voice_analytics FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice analytics" 
  ON voice_analytics FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice analytics" 
  ON voice_analytics FOR UPDATE 
  USING (auth.uid() = user_id);

-- Optional: Add trigger for updated_at if needed later
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';