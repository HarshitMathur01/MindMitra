-- Add session_id and role columns to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN session_id UUID,
ADD COLUMN role TEXT CHECK (role IN ('user', 'assistant'));

-- Update existing rows to have a default role
UPDATE chat_messages 
SET role = CASE 
    WHEN sender = 'user' THEN 'user'
    WHEN sender = 'ai' THEN 'assistant'
    ELSE 'user'
END;

-- Generate session_ids for existing messages based on user and timing
-- Group messages by user and 30-minute gaps to create artificial sessions
WITH session_groups AS (
    SELECT 
        id,
        user_id,
        created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_created_at,
        CASE 
            WHEN LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) IS NULL 
                OR created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) > INTERVAL '30 minutes'
            THEN gen_random_uuid()
            ELSE NULL
        END as new_session_id
    FROM chat_messages
    ORDER BY user_id, created_at
),
session_assignments AS (
    SELECT 
        id,
        user_id,
        created_at,
        COALESCE(
            new_session_id,
            LAG(new_session_id) OVER (PARTITION BY user_id ORDER BY created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        ) as assigned_session_id
    FROM (
        SELECT 
            id,
            user_id, 
            created_at,
            CASE 
                WHEN new_session_id IS NOT NULL THEN new_session_id
                ELSE LAG(new_session_id) IGNORE NULLS OVER (PARTITION BY user_id ORDER BY created_at)
            END as new_session_id
        FROM session_groups
    ) sub
)
UPDATE chat_messages 
SET session_id = sa.assigned_session_id
FROM session_assignments sa
WHERE chat_messages.id = sa.id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session ON chat_messages(user_id, session_id, created_at);
