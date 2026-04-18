-- Lexical retrieval (tsvector), rich candidate field, audit / suppression / restricted stores.
BEGIN;

-- Rich taxonomy from structured extractor (optional).
ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS memory_category TEXT;

-- Combined searchable document for MEMOIR Stage-1 lexical pass.
ALTER TABLE public.memory_metadata
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(memory_content, '') || ' ' || coalesce(verbatim_anchor, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_memory_metadata_content_tsv
  ON public.memory_metadata USING GIN (content_tsv);

CREATE OR REPLACE FUNCTION public.memory_metadata_lexical_search(
  p_user_id text,
  p_query text,
  p_limit int DEFAULT 12
)
RETURNS SETOF public.memory_metadata
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.memory_metadata mm
  WHERE mm.user_id = p_user_id
    AND mm.is_active = true
    AND length(trim(coalesce(p_query, ''))) > 0
    AND (
      mm.content_tsv @@ websearch_to_tsquery('simple', p_query)
      OR mm.memory_content ILIKE ('%' || p_query || '%')
      OR mm.verbatim_anchor ILIKE ('%' || p_query || '%')
    )
  ORDER BY
    ts_rank(mm.content_tsv, websearch_to_tsquery('simple', p_query)) DESC NULLS LAST,
    mm.last_accessed_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 12), 50));
$$;

GRANT EXECUTE ON FUNCTION public.memory_metadata_lexical_search(text, text, int)
  TO anon, authenticated, service_role;

-- Append-only audit trail for memory pipeline events.
CREATE TABLE IF NOT EXISTS public.memory_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  memory_id text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_audit_log_user_created
  ON public.memory_audit_log (user_id, created_at DESC);

ALTER TABLE public.memory_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'memory_audit_log'
      AND policyname = 'memory_audit_log_user_select'
  ) THEN
    CREATE POLICY memory_audit_log_user_select ON public.memory_audit_log
      FOR SELECT USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- User-scoped suppression (IDs must not surface in retrieval).
CREATE TABLE IF NOT EXISTS public.memory_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  mem0_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mem0_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_suppression_user
  ON public.memory_suppression (user_id);

ALTER TABLE public.memory_suppression ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'memory_suppression'
      AND policyname = 'memory_suppression_user_all'
  ) THEN
    CREATE POLICY memory_suppression_user_all ON public.memory_suppression
      FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- Restricted verbatim safety store (service role / pipeline writes).
CREATE TABLE IF NOT EXISTS public.memory_restricted (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  session_id text,
  verbatim_text text NOT NULL,
  structured_type text,
  source text NOT NULL DEFAULT 'pipeline',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_restricted_user_created
  ON public.memory_restricted (user_id, created_at DESC);

ALTER TABLE public.memory_restricted ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'memory_restricted'
      AND policyname = 'memory_restricted_user_select'
  ) THEN
    CREATE POLICY memory_restricted_user_select ON public.memory_restricted
      FOR SELECT USING (auth.uid()::text = user_id);
  END IF;
END $$;

COMMIT;
