-- Denormalized fields for MEMOIR retrieval (keyword + suppressor).
BEGIN;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS memory_content TEXT;

CREATE INDEX IF NOT EXISTS idx_memory_metadata_tags_gin
  ON public.memory_metadata USING GIN (tags);

COMMIT;
