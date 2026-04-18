CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_events_event_name_len CHECK (char_length(event_name) BETWEEN 1 AND 128)
);

CREATE INDEX IF NOT EXISTS product_events_user_created_idx
  ON public.product_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_name_created_idx
  ON public.product_events (event_name, created_at DESC);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_events_insert_own" ON public.product_events;
DROP POLICY IF EXISTS "product_events_select_own" ON public.product_events;

CREATE POLICY "product_events_insert_own"
  ON public.product_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "product_events_select_own"
  ON public.product_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.product_events IS 'Explicit client funnel events; no message bodies (see docs/PRODUCT_ANALYTICS_MIXPANEL_AND_SQL.md).';