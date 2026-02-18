-- Supabase Migration: RAG Memory System with Tiered Storage

-- =========================================================
-- EXTENSIONS & SEARCH PATH
-- =========================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path = public, extensions;

-- =========================================================
-- 1. GLOBAL MEMORIES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS global_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('semantic', 'procedural')),
    content TEXT NOT NULL,
    embedding extensions.vector(384),
    confidence_score FLOAT NOT NULL DEFAULT 0.5
        CHECK (confidence_score >= 0.4 AND confidence_score <= 1.0),
    worth_saving BOOLEAN NOT NULL DEFAULT true,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_session_ids TEXT[] NOT NULL DEFAULT '{}',
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    superseded_by UUID REFERENCES global_memories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_global_memories_user_conf
    ON global_memories(user_id, confidence_score DESC)
    WHERE worth_saving = true;

CREATE INDEX IF NOT EXISTS idx_global_memories_type
    ON global_memories(memory_type);

ALTER TABLE global_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_own_global_memories ON global_memories;
CREATE POLICY user_own_global_memories
    ON global_memories
    FOR ALL
    USING (auth.uid() = user_id);

-- =========================================================
-- 2. SESSION MEMORIES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS session_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('semantic', 'procedural', 'episodic')),
    content TEXT NOT NULL,
    confidence_score FLOAT NOT NULL
        CHECK (confidence_score >= 0.4 AND confidence_score < 0.6),
    source_message_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_memories_session
    ON session_memories(session_id, created_at DESC);

ALTER TABLE session_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_own_session_memories ON session_memories;
CREATE POLICY user_own_session_memories
    ON session_memories
    FOR ALL
    USING (auth.uid() = user_id);

-- =========================================================
-- 3. SESSION CHUNK SUMMARIES
-- =========================================================
CREATE TABLE IF NOT EXISTS session_chunk_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_number INTEGER NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 12,
    summary_content TEXT NOT NULL,
    emotional_progression JSONB,
    key_themes TEXT[] NOT NULL DEFAULT '{}',
    source_message_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, chunk_number)
);

ALTER TABLE session_chunk_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_own_session_summaries ON session_chunk_summaries;
CREATE POLICY user_own_session_summaries
    ON session_chunk_summaries
    FOR ALL
    USING (auth.uid() = user_id);

-- =========================================================
-- 4. EPISODIC TRACKER
-- =========================================================
CREATE TABLE IF NOT EXISTS episodic_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_hash TEXT NOT NULL,
    occurrences JSONB[] NOT NULL DEFAULT '{}',
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    promoted_to_semantic_id UUID REFERENCES global_memories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, pattern_hash)
);

ALTER TABLE episodic_tracker ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_own_episodic_tracker ON episodic_tracker;
CREATE POLICY user_own_episodic_tracker
    ON episodic_tracker
    FOR ALL
    USING (auth.uid() = user_id);

-- =========================================================
-- 5. UPDATE EXISTING MEMORIES TABLE
-- =========================================================
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS promoted_to_global BOOLEAN DEFAULT false;

ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS extraction_attempted BOOLEAN DEFAULT false;

-- =========================================================
-- 6. HYBRID SEARCH FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION search_memories_hybrid(
    p_embedding extensions.vector(384),
    p_query_text TEXT,
    p_user_id UUID,
    p_memory_types TEXT[],
    p_confidence_threshold FLOAT,
    p_limit INT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    memory_type TEXT,
    confidence_score FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        gm.id,
        gm.content,
        gm.memory_type,
        gm.confidence_score,
        (
            0.7 * (1 - (gm.embedding <=> p_embedding)) +
            0.3 * ts_rank(
                to_tsvector('english', gm.content),
                plainto_tsquery(p_query_text)
            )
        )
    FROM global_memories gm
    WHERE gm.user_id = p_user_id
      AND gm.memory_type = ANY (p_memory_types)
      AND gm.confidence_score >= p_confidence_threshold
      AND gm.worth_saving = true
    ORDER BY 5 DESC
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION find_similar_global_memories(
    p_embedding extensions.vector(384),
    p_user_id UUID,
    p_memory_type TEXT,
    p_similarity_threshold FLOAT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    confidence_score FLOAT,
    source_session_ids TEXT[],
    occurrence_count INT,
    similarity FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        gm.id,
        gm.content,
        gm.confidence_score,
        gm.source_session_ids,
        gm.occurrence_count,
        (1 - (gm.embedding <=> p_embedding))
    FROM global_memories gm
    WHERE gm.user_id = p_user_id
      AND gm.memory_type = p_memory_type
      AND (gm.embedding <=> p_embedding) < (1 - p_similarity_threshold)
      AND gm.worth_saving = true
    ORDER BY 6 DESC
    LIMIT 3;
END;
$$;