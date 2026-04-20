-- ============================================================================
-- Mitra Memory v2 — Phase 0 schema (additive, side-by-side with legacy tables)
-- ----------------------------------------------------------------------------
-- This migration is purely additive: legacy tables (memory_metadata,
-- session_summaries, user_memory_stats, crisis_events, etc.) keep working.
-- The new MITRA pipeline writes here; cutover happens in Phase 5 via the
-- MITRA_STACK_ENABLED env flag.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Identity Card (one row per user) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mitra_identity_cards (
    user_id            text PRIMARY KEY,
    preferred_name     text,
    pronouns           text,
    age_band           text,
    life_stage         text,
    languages          text[]      DEFAULT '{}',
    code_mix_register  text,
    cultural_context   jsonb       DEFAULT '{}'::jsonb,
    stated_identities  jsonb       DEFAULT '[]'::jsonb,
    values_facets      jsonb       DEFAULT '[]'::jsonb,
    clinical_flags     jsonb       DEFAULT '[]'::jsonb,
    boundaries         jsonb       DEFAULT '[]'::jsonb,
    field_provenance   jsonb       DEFAULT '{}'::jsonb,
    version            int         DEFAULT 1,
    created_at         timestamptz DEFAULT now(),
    updated_at         timestamptz DEFAULT now()
);

ALTER TABLE public.mitra_identity_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mic_owner_all ON public.mitra_identity_cards;
CREATE POLICY mic_owner_all ON public.mitra_identity_cards
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 2. Episodic memories (vectors live in Qdrant; metadata lives here) ─────
CREATE TABLE IF NOT EXISTS public.mitra_episodic_memories (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            text NOT NULL,
    qdrant_id          text NOT NULL,
    summary            text NOT NULL,
    verbatim_quote     text,
    affect_vad         jsonb,
    affect_label       text,
    themes             text[]      DEFAULT '{}',
    entity_ids         uuid[]      DEFAULT '{}',
    importance         float       DEFAULT 0.5,
    strength           float       DEFAULT 1.0,
    recall_count       int         DEFAULT 0,
    source_session     text,
    source_turn_ids    text[]      DEFAULT '{}',
    created_at         timestamptz DEFAULT now(),
    last_recalled_at   timestamptz,
    archived_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mem_user_importance
    ON public.mitra_episodic_memories (user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_mem_user_recalled
    ON public.mitra_episodic_memories (user_id, last_recalled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mem_themes
    ON public.mitra_episodic_memories USING GIN (themes);
CREATE INDEX IF NOT EXISTS idx_mem_entities
    ON public.mitra_episodic_memories USING GIN (entity_ids);

ALTER TABLE public.mitra_episodic_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mem_owner_all ON public.mitra_episodic_memories;
CREATE POLICY mem_owner_all ON public.mitra_episodic_memories
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 3. Relational graph ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mitra_entities (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            text NOT NULL,
    kind               text NOT NULL,
    display_name       text NOT NULL,
    aliases            text[] DEFAULT '{}',
    attributes         jsonb DEFAULT '{}'::jsonb,
    created_at         timestamptz DEFAULT now(),
    last_mentioned_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ent_user_kind ON public.mitra_entities (user_id, kind);

ALTER TABLE public.mitra_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ent_owner_all ON public.mitra_entities;
CREATE POLICY ent_owner_all ON public.mitra_entities
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS public.mitra_entity_edges (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      text NOT NULL,
    src_id       uuid NOT NULL REFERENCES public.mitra_entities(id) ON DELETE CASCADE,
    dst_id       uuid NOT NULL REFERENCES public.mitra_entities(id) ON DELETE CASCADE,
    edge_type    text NOT NULL,
    weight       float DEFAULT 1.0,
    created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_edge_user_src ON public.mitra_entity_edges (user_id, src_id);

ALTER TABLE public.mitra_entity_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS edge_owner_all ON public.mitra_entity_edges;
CREATE POLICY edge_owner_all ON public.mitra_entity_edges
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 4. Affective time-series (three channels: lexical / acoustic / self_report) ──
CREATE TABLE IF NOT EXISTS public.mitra_affect_timeseries (
    user_id             text NOT NULL,
    bucket_date         date NOT NULL,
    bucket_kind         text NOT NULL DEFAULT 'daily',
    channel             text NOT NULL DEFAULT 'lexical',
    vad_mean            jsonb,
    vad_min             jsonb,
    affect_label_top    text,
    acoustic_features   jsonb,
    self_report_scores  jsonb,
    message_count       int DEFAULT 0,
    PRIMARY KEY (user_id, bucket_date, bucket_kind, channel)
);

ALTER TABLE public.mitra_affect_timeseries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aff_owner_all ON public.mitra_affect_timeseries;
CREATE POLICY aff_owner_all ON public.mitra_affect_timeseries
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 5. Procedural ledger (intervention × outcome) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.mitra_procedural_ledger (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            text NOT NULL,
    intervention       text NOT NULL,
    used_at            timestamptz DEFAULT now(),
    pre_affect_vad     jsonb,
    post_affect_vad    jsonb,
    outcome_label      text,
    user_feedback      text
);
CREATE INDEX IF NOT EXISTS idx_proc_user_int ON public.mitra_procedural_ledger (user_id, intervention);

ALTER TABLE public.mitra_procedural_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proc_owner_all ON public.mitra_procedural_ledger;
CREATE POLICY proc_owner_all ON public.mitra_procedural_ledger
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 6. Reflection insights (second-order memories from nightly job) ────────
CREATE TABLE IF NOT EXISTS public.mitra_reflection_insights (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             text NOT NULL,
    insight_text        text NOT NULL,
    source_episode_ids  uuid[] DEFAULT '{}',
    themes              text[] DEFAULT '{}',
    confidence          float DEFAULT 0.6,
    created_at          timestamptz DEFAULT now(),
    qdrant_id           text
);
CREATE INDEX IF NOT EXISTS idx_refl_user_created ON public.mitra_reflection_insights (user_id, created_at DESC);

ALTER TABLE public.mitra_reflection_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refl_owner_all ON public.mitra_reflection_insights;
CREATE POLICY refl_owner_all ON public.mitra_reflection_insights
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 7. Relationship Stage state (per user) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mitra_relationship_state (
    user_id             text PRIMARY KEY,
    stage               text NOT NULL DEFAULT 'stranger',
    session_count       int  DEFAULT 0,
    total_minutes       int  DEFAULT 0,
    topic_breadth       int  DEFAULT 0,
    successful_repairs  int  DEFAULT 0,
    last_promoted_at    timestamptz,
    updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.mitra_relationship_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rel_owner_all ON public.mitra_relationship_state;
CREATE POLICY rel_owner_all ON public.mitra_relationship_state
    FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── 8. Per-turn observability traces (service-role only) ───────────────────
CREATE TABLE IF NOT EXISTS public.mitra_turn_traces (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               text NOT NULL,
    session_id            text NOT NULL,
    turn_index            int  NOT NULL DEFAULT 0,
    classifier_out        jsonb,
    retrieval_candidates  jsonb,
    selected_memories     jsonb,
    stage                 text,
    persona               text,
    generator_model       text,
    critic_decisions      jsonb,
    latencies_ms          jsonb,
    created_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trace_user_created
    ON public.mitra_turn_traces (user_id, created_at DESC);

ALTER TABLE public.mitra_turn_traces ENABLE ROW LEVEL SECURITY;
-- Idempotent: policy name is trace_user_read (trace_service_only was an older draft name).
DROP POLICY IF EXISTS trace_service_only ON public.mitra_turn_traces;
DROP POLICY IF EXISTS trace_user_read ON public.mitra_turn_traces;
-- Service role bypasses RLS automatically; clients can only read their own.
CREATE POLICY trace_user_read ON public.mitra_turn_traces
    FOR SELECT USING (auth.uid()::text = user_id);

-- ── 9. Background consolidation queue (service-role only) ──────────────────
CREATE TABLE IF NOT EXISTS public.mitra_consolidation_queue (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       text NOT NULL,
    session_id    text,
    job_kind      text NOT NULL,
    payload       jsonb DEFAULT '{}'::jsonb,
    status        text DEFAULT 'pending',
    attempts      int  DEFAULT 0,
    scheduled_at  timestamptz DEFAULT now(),
    started_at    timestamptz,
    finished_at   timestamptz,
    error         text
);
CREATE INDEX IF NOT EXISTS idx_consq_status_sched
    ON public.mitra_consolidation_queue (status, scheduled_at);

ALTER TABLE public.mitra_consolidation_queue ENABLE ROW LEVEL SECURITY;
-- No client-side policy → only service role can read/write the queue.

-- ── 10. Migration map: legacy mem0/Qdrant id → new episodic id ─────────────
CREATE TABLE IF NOT EXISTS public.mitra_legacy_migration_map (
    legacy_qdrant_id   text NOT NULL,
    legacy_mem0_id     text,
    new_episode_id     uuid NOT NULL REFERENCES public.mitra_episodic_memories(id) ON DELETE CASCADE,
    user_id            text NOT NULL,
    migrated_at        timestamptz DEFAULT now(),
    PRIMARY KEY (legacy_qdrant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_legmap_user ON public.mitra_legacy_migration_map (user_id);

ALTER TABLE public.mitra_legacy_migration_map ENABLE ROW LEVEL SECURITY;
-- Service role only.

COMMENT ON TABLE public.mitra_identity_cards IS 'MITRA v2 — slowly-evolving structured user schema (Identity Card).';
COMMENT ON TABLE public.mitra_episodic_memories IS 'MITRA v2 — episodic memories metadata; vectors live in Qdrant mitra_episodic_v2.';
COMMENT ON TABLE public.mitra_affect_timeseries IS 'MITRA v2 — three-channel affective time-series (lexical|acoustic|self_report).';
COMMENT ON TABLE public.mitra_relationship_state IS 'MITRA v2 — per-user Relationship Stage (Stranger|Acquaintance|Familiar|Trusted).';
COMMENT ON TABLE public.mitra_turn_traces IS 'MITRA v2 — per-turn observability for offline eval.';
