-- Create memories table for storing extracted memories
CREATE TABLE IF NOT EXISTS memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  data_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  
  -- Store all three memory types as JSONB
  procedural_memories jsonb DEFAULT '[]'::jsonb,
  semantic_memories jsonb DEFAULT '[]'::jsonb,
  episodic_memories jsonb DEFAULT '[]'::jsonb,
  
  -- Summary stats
  memory_summary jsonb DEFAULT '{}'::jsonb,
  source_message_ids jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_processed_at ON memories(processed_at);
CREATE INDEX IF NOT EXISTS idx_memories_data_type ON memories(data_type);

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own memories" ON memories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memories" ON memories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memories" ON memories
  FOR UPDATE USING (user_id = auth.uid());

-- Add column to track which messages have been processed into memories
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS processed_into_memory boolean DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS memory_processed_at timestamptz;

-- Create index for efficient querying of unprocessed messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_processed ON chat_messages(session_id, processed_into_memory);
