-- Migration: Replace legacy voice_analytics with schema-aligned voice_analysis_events
-- The old table stored inferred labels from a previous architecture.
-- The current pipeline stores raw speech timing/clarity metrics directly.

DROP TABLE IF EXISTS voice_analytics CASCADE;

CREATE TABLE voice_analysis_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,

  transcript TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('azure_speech_sdk', 'groq_whisper_fallback')),
  language TEXT NOT NULL DEFAULT 'en-IN',

  speech_rate_wpm INTEGER,
  speech_rate_category TEXT CHECK (speech_rate_category IN ('very_slow', 'slow', 'normal', 'fast', 'very_fast')),
  avg_pause_duration_ms INTEGER,
  max_pause_duration_ms INTEGER,
  long_pause_count INTEGER,
  pause_count INTEGER,
  pause_pattern TEXT CHECK (pause_pattern IN ('minimal', 'normal', 'frequent', 'excessive')),
  speech_to_silence_ratio NUMERIC(5,4),
  total_duration_sec NUMERIC(8,2),
  total_speech_duration_sec NUMERIC(8,2),

  avg_confidence NUMERIC(5,4),
  min_confidence NUMERIC(5,4),
  confidence_variance NUMERIC(8,6),
  speech_clarity TEXT CHECK (speech_clarity IN ('unclear', 'moderate', 'clear', 'very_clear')),
  word_count INTEGER NOT NULL DEFAULT 0,

  hindi_english_mixing BOOLEAN NOT NULL DEFAULT FALSE,
  detected_hindi_words TEXT[] NOT NULL DEFAULT '{}',
  prosody JSONB,

  processing_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_voice_analysis_events_user_id ON voice_analysis_events(user_id);
CREATE INDEX idx_voice_analysis_events_session_id ON voice_analysis_events(session_id);
CREATE INDEX idx_voice_analysis_events_message_id ON voice_analysis_events(message_id);
CREATE INDEX idx_voice_analysis_events_created_at ON voice_analysis_events(created_at);

ALTER TABLE voice_analysis_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice analysis events"
  ON voice_analysis_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice analysis events"
  ON voice_analysis_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice analysis events"
  ON voice_analysis_events FOR UPDATE
  USING (auth.uid() = user_id);