# MindMitra — Implementation Plan: Migrating to the MITRA Architecture

> Companion document to **`docs/MITRA_MEMORY_AND_GENERATION_PROPOSAL.md`** (the architecture).
> This document is the *how*: phased migration from the current (`COMPASS` + mem0/Qdrant + IntentRouter + Path A/B/C/D) backend to the MITRA Memory Stack with two-pass generation, while keeping the website fully working at every checkpoint.

---

## Guiding rules for the migration

1. **Never break the frontend contract.** The UI talks to the backend via three endpoints — `POST /chat/stream` (SSE-style), `GET /chat/greeting`, and `POST /transcribe`. These response shapes do **not change** during the migration. All swaps happen behind those contracts.
2. **Feature-flag everything.** A new `MITRA_STACK_ENABLED` env flag (default `false` until Phase 5) lets the new pipeline run side-by-side with the old one. Per-user opt-in via Supabase setting allows internal QA before rollout.
3. **One model registry, one place to change models.** All model names, base URLs, and provider clients move into `app/core/models.py`. Nothing else hard-codes `gpt-5-mini` or `llama-3.1-8b-instant`.
4. **Test gate per phase.** Every phase ends with a `make test-health` command that must pass before the next phase begins. The pytest health suite (Phase 0) is the contract.
5. **No data loss.** Old mem0/Qdrant memories are migrated, not dropped. A one-way migration script copies into new tables; old `companion_memories` collection is renamed `companion_memories_legacy` and read-only-archived.
6. **Reversible flag-flip rollback.** Every phase has a single env flag that, when flipped to `false`, restores the prior behaviour without code rollback.

---

## Current → Target mapping (high-level)

| Current component | Replacement | Action |
|---|---|---|
| `IntentRouter` (Groq, single classify call) | **Affect & Intent classifier v2** (Groq, joint VAD + intent + retrieval-need flag) | Refactor in place |
| `pipeline_orchestrator.py` Paths A/B/C/D | **Single pipeline** with parallel retrieval fan-out + Stage-aware assembly + Critic gate; Path D becomes the **Crisis Fast-Path** (kept, hardened) | Rewrite |
| `crisis_manager.py` (keyword + Groq confirmer + templated reply) | **Crisis Fast-Path v2**: C-SSRS taxonomy, Stanley-Brown safety planning flow, expanded Hinglish lexicon, India helpline registry | Extend |
| `analysis_engine.py` (Path B Groq combined; Path C Azure psych) | **Removed.** Affect goes into the unified classifier; "psych analysis" merges into the stance-templated generator prompt. | Delete |
| `response_agent.py` (single GLM/Azure call with stage prompts) | **Two-pass generator**: Draft (Azure gpt-5-mini, or Gemini Flash for speculative) → **Critic** (Groq Llama 3.1 8B with 5-rubric prompt) → optional refine | Rewrite |
| `memory_manager.py` (facade over mem0) | **MITRA Memory Stack** facade: routes to `IdentityCardService`, `EpisodicService`, `RelationalService`, `AffectiveService`, `ProceduralService` | Rewrite |
| `memory_store.py` / `memory_retriever.py` (mem0 + Qdrant + `all-MiniLM-L6-v2`) | `EpisodicService` on **Qdrant + BGE-M3** (dense+sparse hybrid); deterministic re-rank with importance×recency×relevance×affective-resonance | Rewrite |
| `memory_reflection.py` (Gemini summary + Groq trend) | `ConsolidationWorker` (Gemini Flash for extraction, linking, reflection; Ebbinghaus decay scheduler) | Rewrite |
| `greeting_service.py` + `greeting_pool.json` + `user_contexts/*.json` files on disk | **GreetingService v2** reading from `mitra_identity_cards` + `mitra_relationship_state` + Stage; the on-disk JSONs go away | Refactor |
| `core/prompts.py` + in-file prompts in `response_agent.py` | **Single `core/prompts/` package**: `stance.py`, `crisis.py`, `extraction.py`, `critic.py`, `classifier.py`. Stage-parameterised. | Refactor |
| `core/config.py` + `config.yaml` | Keep for ops knobs; **add `core/models.py`** as the single model registry | Augment |
| Embedder `sentence-transformers/all-MiniLM-L6-v2` (English-only, 384d) | **`BAAI/bge-m3`** (multilingual, 1024d dense + sparse) | Replace + reindex |
| `screening_agent.py` (PHQ-9 / GAD-7) | **Keep** — runs separately, low-frequency, useful clinical signal | No change Phase 0–5; integrate into Affective TS in Phase 6 |
| `therapist_bridge.py` + builders | **Keep** — already deterministic + bias-separated; just plug into new memory readers in Phase 5 | Light integration |

---

## Repository layout after migration (target)

```
chatbotAgent/app/
├── api/
│   ├── chat.py              # SSE contract preserved
│   ├── greeting.py          # split out from chat.py
│   ├── transcribe.py        # split out from chat.py
│   ├── onboarding.py
│   ├── therapist_bridge.py
│   └── health.py
├── core/
│   ├── config.py
│   ├── models.py            # NEW: ModelRegistry — the only place model names live
│   ├── prompts/             # NEW package
│   │   ├── stance.py        # therapeutic stance template, stage-parameterised
│   │   ├── crisis.py        # C-SSRS playbooks + helpline registry
│   │   ├── extraction.py    # post-turn memory extraction prompt
│   │   ├── critic.py        # 5-rubric critic prompt
│   │   └── classifier.py    # affect+intent classifier prompt
│   ├── auth.py
│   ├── pii.py
│   ├── logging.py
│   └── rate_limit.py
├── pipeline/
│   ├── orchestrator.py      # NEW: unified turn pipeline
│   ├── crisis_fast_path.py  # NEW: pre-empts everything
│   ├── context_assembler.py # NEW: token-budgeted assembly with Stage gates
│   ├── classifier.py        # NEW: affect+intent+retrieval-need
│   ├── critic.py            # NEW: 5-rubric critic
│   └── generator.py         # NEW: two-pass generation, streaming
├── memory/                  # NEW package (replaces app/agents/memory_*.py)
│   ├── identity_card.py     # always-loaded structured user schema
│   ├── episodic.py          # Qdrant + BGE-M3 hybrid retrieval
│   ├── relational.py        # Postgres people/places graph
│   ├── affective.py         # mood time-series
│   ├── procedural.py        # interventions × user response ledger
│   ├── working.py           # session buffer + affect vector
│   ├── relationship_state.py# Stranger → Acquaintance → Familiar → Trusted
│   ├── importance.py        # write-time scorer
│   ├── consolidation.py     # nightly reflection worker
│   └── retriever.py         # parallel fan-out orchestrator
├── providers/               # NEW: thin wrappers per provider
│   ├── groq_client.py
│   ├── azure_openai_client.py
│   ├── gemini_client.py
│   ├── glm_client.py
│   └── embeddings_bge.py    # BGE-M3 (CPU/GPU)
├── services/
│   ├── greeting.py          # rewrites greeting_service.py
│   ├── supabase_service.py
│   ├── voice_prosody.py
│   ├── locale_service.py
│   └── helplines.py         # NEW: India helpline registry (mirrors src/lib/helplines.ts)
├── jobs/                    # NEW: background workers
│   ├── consolidation_worker.py
│   └── decay_scheduler.py
├── models/                  # Pydantic schemas (request/response)
└── main.py
```

The legacy `app/agents/`, `app/controllers/`, `app/pipeline/analysis_engine.py`, `app/pipeline/workflow.py`, and `app/pipeline/pipeline_orchestrator.py` are **kept on disk until Phase 6** behind feature flags, then removed.

---

## Database changes (additive, then deprecate)

### New Supabase migration (Phase 0)
File: `supabase/migrations/20260420120000_mitra_memory_v2.sql`

Tables (all RLS-protected on `auth.uid()::text = user_id`):

```sql
-- 1. Identity Card (one row per user)
CREATE TABLE mitra_identity_cards (
  user_id          text PRIMARY KEY,
  preferred_name   text,
  pronouns         text,
  age_band         text,
  life_stage       text,
  languages        text[]      DEFAULT '{}',
  code_mix_register text,
  cultural_context jsonb       DEFAULT '{}',
  stated_identities jsonb      DEFAULT '[]',
  values_facets    jsonb       DEFAULT '[]',
  clinical_flags   jsonb       DEFAULT '[]',
  boundaries       jsonb       DEFAULT '[]',
  field_provenance jsonb       DEFAULT '{}',  -- {field: [episode_ids], confidence}
  version          int         DEFAULT 1,
  updated_at       timestamptz DEFAULT now()
);

-- 2. Episodic memories (the "moments") — vectors live in Qdrant; this is metadata
CREATE TABLE mitra_episodic_memories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  qdrant_id        text NOT NULL,           -- pointer into Qdrant collection
  summary          text NOT NULL,
  verbatim_quote   text,
  affect_vad       jsonb,                   -- {v: -0.7, a: 0.5, d: -0.2}
  affect_label     text,
  themes           text[] DEFAULT '{}',
  entity_ids       uuid[] DEFAULT '{}',
  importance       float  DEFAULT 0.5,
  strength         float  DEFAULT 1.0,      -- Ebbinghaus, decays over time
  recall_count     int    DEFAULT 0,
  source_session   text,
  source_turn_ids  text[] DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  last_recalled_at timestamptz,
  archived_at      timestamptz              -- soft delete
);
CREATE INDEX ON mitra_episodic_memories (user_id, importance DESC);
CREATE INDEX ON mitra_episodic_memories (user_id, last_recalled_at DESC);
CREATE INDEX ON mitra_episodic_memories USING GIN (themes);
CREATE INDEX ON mitra_episodic_memories USING GIN (entity_ids);

-- 3. Relational graph
CREATE TABLE mitra_entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  kind        text NOT NULL,        -- 'person'|'place'|'event'|'topic'
  display_name text NOT NULL,
  aliases     text[] DEFAULT '{}',
  attributes  jsonb DEFAULT '{}',   -- relation, sentiment_history, status
  created_at  timestamptz DEFAULT now(),
  last_mentioned_at timestamptz
);
CREATE INDEX ON mitra_entities (user_id, kind);

CREATE TABLE mitra_entity_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  src_id      uuid NOT NULL REFERENCES mitra_entities(id) ON DELETE CASCADE,
  dst_id      uuid NOT NULL REFERENCES mitra_entities(id) ON DELETE CASCADE,
  edge_type   text NOT NULL,        -- 'parent_of','friend','related_to',...
  weight      float DEFAULT 1.0,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX ON mitra_entity_edges (user_id, src_id);

-- 4. Affective time-series — three independent channels (lexical, acoustic, self-report)
CREATE TABLE mitra_affect_timeseries (
  user_id          text NOT NULL,
  bucket_date      date NOT NULL,
  bucket_kind      text NOT NULL DEFAULT 'daily', -- 'daily'|'session'
  channel          text NOT NULL DEFAULT 'lexical', -- 'lexical'|'acoustic'|'self_report'
  vad_mean         jsonb,
  vad_min          jsonb,
  affect_label_top text,
  acoustic_features jsonb,    -- {jitter, shimmer, f0_mean, f0_var, speaking_rate, pause_ratio} when channel='acoustic'
  self_report_scores jsonb,   -- {phq9: int, gad7: int, phq2: int, gad2: int} when channel='self_report'
  message_count    int DEFAULT 0,
  PRIMARY KEY (user_id, bucket_date, bucket_kind, channel)
);

-- 5. Procedural ledger (interventions × outcome)
CREATE TABLE mitra_procedural_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  intervention    text NOT NULL,    -- 'breathing_4_7_8'|'reflection_prompt'|...
  used_at         timestamptz DEFAULT now(),
  pre_affect_vad  jsonb,
  post_affect_vad jsonb,
  outcome_label   text,             -- 'opened_up'|'shut_down'|'no_change'|'humor_landed'
  user_feedback   text              -- optional explicit feedback
);
CREATE INDEX ON mitra_procedural_ledger (user_id, intervention);

-- 6. Reflection insights (second-order memories from nightly job)
CREATE TABLE mitra_reflection_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  insight_text    text NOT NULL,
  source_episode_ids uuid[] DEFAULT '{}',
  themes          text[] DEFAULT '{}',
  confidence      float DEFAULT 0.6,
  created_at      timestamptz DEFAULT now(),
  qdrant_id       text                       -- also indexed in Qdrant
);
CREATE INDEX ON mitra_reflection_insights (user_id, created_at DESC);

-- 7. Relationship state (per user)
CREATE TABLE mitra_relationship_state (
  user_id           text PRIMARY KEY,
  stage             text NOT NULL DEFAULT 'stranger',  -- stranger|acquaintance|familiar|trusted
  session_count     int  DEFAULT 0,
  total_minutes     int  DEFAULT 0,
  topic_breadth     int  DEFAULT 0,
  successful_repairs int DEFAULT 0,
  last_promoted_at  timestamptz,
  updated_at        timestamptz DEFAULT now()
);

-- 8. Per-turn observability
CREATE TABLE mitra_turn_traces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  session_id       text NOT NULL,
  turn_index       int  NOT NULL,
  classifier_out   jsonb,
  retrieval_candidates jsonb,
  selected_memories jsonb,
  stage            text,
  generator_model  text,
  critic_decisions jsonb,
  latencies_ms     jsonb,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX ON mitra_turn_traces (user_id, created_at DESC);

-- 9. Background consolidation queue
CREATE TABLE mitra_consolidation_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL,
  session_id   text,
  job_kind     text NOT NULL,   -- 'extract'|'link'|'reflect'|'decay'
  payload      jsonb DEFAULT '{}',
  status       text DEFAULT 'pending',  -- pending|running|done|failed
  attempts     int  DEFAULT 0,
  scheduled_at timestamptz DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text
);
CREATE INDEX ON mitra_consolidation_queue (status, scheduled_at);

-- RLS policies (one example shown; same pattern for all)
ALTER TABLE mitra_identity_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY mic_owner_all ON mitra_identity_cards
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
-- (repeat for all 8 user-data tables; turn_traces and queue use service-role only)
```

### Qdrant collections

- New: `mitra_episodic_v2` — vectors **1024-d** (BGE-M3), payload `{user_id, importance, themes, affect_label}`. Separate per-user filter via payload index.
- New: `mitra_reflections_v2` — same dimension, smaller volume.
- Existing `companion_memories` → renamed `companion_memories_legacy`, read-only.

### Legacy tables (don't touch in Phase 0–4)

`memory_metadata`, `user_memory_stats`, `session_summaries` keep working with the legacy stack until Phase 5 cuts over. They get a `DROP` migration in Phase 6.

---

## Phase 0 — Foundations & guardrails (3–4 days)

**Goal:** Add new infrastructure without changing any user-visible behaviour. Ship the pytest health suite as the gate.

### Tasks

1. **Add `app/core/models.py`** — single source of truth model registry (see §10.1 of the architecture doc). Provider clients are constructed here from env vars. All future code imports from this module.

2. **Add `app/providers/` package** — thin async wrappers around Groq, Azure OpenAI, Gemini, Z.AI/GLM, and BGE-M3 embeddings. Each exposes `complete(messages, **kwargs) -> str | AsyncIterator[str]` and `health() -> bool`.

3. **Add `MITRA_STACK_ENABLED` feature flag** to `core/config.py` (default `false`). Wire `_path_*` dispatch in `pipeline_orchestrator.py` to read it (no-op until Phase 5 actually swaps).

4. **Run new Supabase migration** (`20260420120000_mitra_memory_v2.sql`). All new tables exist but are empty. Legacy stack untouched.

5. **Create Qdrant collections** `mitra_episodic_v2` and `mitra_reflections_v2` via a one-shot script `scripts/qdrant_init_mitra.py`.

6. **Pytest health suite** — `tests/health/` (see Phase 0 §"Test scaffolding" below).

### Test gate

```bash
cd chatbotAgent && pytest tests/health -v
```

All green required: env-vars present, providers reachable (mocked), Supabase migration applied, Qdrant collection exists, FastAPI app boots, contract endpoints respond.

### Frontend impact

**Zero.** The frontend keeps hitting the legacy pipeline.

---

## Phase 1 — Crisis Fast-Path v2 + Stance prompts v2 (3–4 days)

**Goal:** Replace the *highest-stakes* parts first, behind a flag. Even if the rest of the migration paused, this phase alone improves the product.

### Tasks

1. **`app/pipeline/crisis_fast_path.py`** (new). Two-stage classifier:
   - **Lexical** trigger: regex over English + Devanagari Hindi + Romanised Hindi + common Hinglish patterns. Categories aligned with **C-SSRS**: `passive_ideation`, `active_ideation`, `intent`, `plan`, `behaviour`. Negation handling. Lyrics/idiom guards.
   - **LLM confirmer** (Groq Llama 3.1 8B Instant) with strict JSON output. Fail-closed: any model error → treat as elevated, not safe.

2. **`app/services/helplines.py`** (new). Mirror of `src/lib/helplines.ts` but on the backend, time-of-day aware (some helplines are not 24/7), language-prioritised. Used by the crisis playbook builder.

3. **`app/core/prompts/crisis.py`** (new). Per-level deterministic templates (Stanley-Brown safety planning embedded), with cultural register and helpline placeholders.

4. **`app/core/prompts/stance.py`** (new). Therapeutic stance template, parameterised by Relationship Stage (placeholder until Phase 5 — defaults to `acquaintance`), affect, language register, persona, time-of-day. Encodes Rogers core conditions + MI OARS + DBT validation moves + Indian cultural register guidance.

5. **Critic v0** (`app/pipeline/critic.py`, new). Two rules only at this phase: **safety** (re-checks for missed crisis cues) + **anti-sycophancy**. Runs on every drafted response, in parallel with TTS streaming so latency-free in the common case.

6. **Wire into existing pipeline behind flag**:
   - If `MITRA_CRISIS_V2_ENABLED=true`: route crisis decisions through new fast-path; otherwise old `crisis_manager.py`.
   - If `MITRA_CRITIC_V0_ENABLED=true`: every response from `ResponseGenerator.generate` runs through critic v0 *after* the stream completes (post-hoc patching: if critic fails, server emits a tiny `{"chunk": " "}` correction or `{"error": "regenerating"}` and re-streams the tail).

### Test gate

`pytest tests/health -v` — all green. Plus new tests:
- `tests/health/test_crisis_fast_path.py` — known-trigger phrases in EN/HI/Hinglish all classify correctly; benign look-alikes don't.
- `tests/health/test_stance_template_renders.py` — template fills with all four Stage values.
- `tests/health/test_critic_blocks_sycophancy.py` — feed a sycophantic draft, critic rewrites.

### Frontend impact

**Zero contract change.** Crisis responses get richer (Stanley-Brown-style step UI hints can be added later via a new `crisis_card` field in the SSE payload — *additive*, frontend ignores unknown fields).

### Rollback

Set `MITRA_CRISIS_V2_ENABLED=false` and `MITRA_CRITIC_V0_ENABLED=false`.

---

## Phase 2 — Memory Stack v2: Identity, Episodic, Affective (5–7 days)

**Goal:** New memory writes & reads work alongside legacy. Reads still come from legacy until cutover.

### Tasks

1. **`app/providers/embeddings_bge.py`** — BGE-M3 loader (sentence-transformers compatible). Cache the model in process. CPU fallback. Expose `embed_dense(texts) -> [[float]]` and `embed_sparse(texts) -> [(token_ids, weights)]`.

2. **`app/memory/identity_card.py`** (new):
   - `get(user_id) -> IdentityCard` (cached LRU 60 s).
   - `propose_update(user_id, deltas, source_episode_id)` — append to `field_provenance`, only commit on confidence threshold or explicit user confirmation.
   - `format_for_prompt(card) -> str` — compact <500-token rendering.

3. **`app/memory/episodic.py`** (new):
   - `write(user_id, candidate)` — runs `importance.score()` first; if pass, embeds via BGE-M3, upserts to Qdrant `mitra_episodic_v2`, writes metadata row in Postgres.
   - `search(user_id, query, *, intent, current_affect, k=8)` — hybrid retrieval: dense (BGE-M3) + sparse (BM25-ish from BGE-M3) → fetch payloads → re-rank by `importance × recency × relevance × affective_resonance`. Returns up to `k`.

4. **`app/memory/affective.py`** (new) — **three-channel** time series:
   - `record_lexical(user_id, vad, label, session_id)` — per-turn detected affect.
   - `record_acoustic(user_id, prosody_features, session_id)` — per-voice-turn Praat features (reuses existing `services/voice_prosody.py`).
   - `record_self_report(user_id, scores)` — PHQ-9 / GAD-7 / PHQ-2 / GAD-2 scores from existing `screening_agent.py` (which stays).
   - `recent_pattern(user_id, days=14) -> dict | None` — STL + z-score anomaly detection across all three channels; surfaces a pattern only when ≥2 channels agree (raises confidence, lowers spurious surfacing).
   - `cross_channel_confidence(user_id, pattern) -> float` — used by the assembler to decide whether to surface to the user (Stage-gated).

5. **`app/memory/working.py`** (new): pure in-memory dataclass for the active session — last 12 turns + running affect vector + active topic + active goal + Stage at session start. Built per-request, never persisted directly.

6. **`app/memory/importance.py`** (new): rule-based scorer (no LLM call): affect intensity + self-reference density + named-entity presence + declarative strength + explicit "remember this" signal − redundancy with nearest existing memory. Returns `(score, reasons)`.

7. **`app/jobs/consolidation_worker.py`** (new, **dual-write only** at this phase):
   - On `chat.end-session` and on `memory_trigger` intervals, push a `extract` job into `mitra_consolidation_queue`.
   - Worker process: dequeue, run Gemini Flash extractor with the structured-output prompt from `core/prompts/extraction.py`, call `episodic.write()`, `identity_card.propose_update()`, `affective.record()`.
   - **Dual-write**: in this phase, the legacy `memory_manager.add_memories` ALSO still runs (so legacy retrieval continues to work). New writes go to BOTH.

8. **Backfill script** `scripts/migrate_legacy_memories.py`:
   - Reads `companion_memories` (legacy Qdrant) + `memory_metadata` (Postgres) → re-embeds with BGE-M3 → writes to `mitra_episodic_v2` + `mitra_episodic_memories`.
   - Idempotent: tracks `legacy_qdrant_id → new_id` mapping in a `mitra_legacy_migration_map` table.
   - Run once per environment; takes ~5–15 minutes for typical user volumes.

### Test gate

```bash
pytest tests/health -v
pytest tests/memory_v2 -v   # new directory
```

New tests:
- `test_identity_card_roundtrip.py` — write → read → format.
- `test_episodic_write_read.py` — write 3 memories, search retrieves the relevant one with correct ranking.
- `test_importance_gate.py` — junk like `"hmm ok"` rejected; meaningful utterances pass.
- `test_affective_anomaly.py` — fed synthetic time-series, detects Sunday dips.
- `test_legacy_migration.py` — small fixture set migrates with no loss.

### Frontend impact

**Zero.**

### Rollback

Set `MITRA_MEMORY_V2_DUAL_WRITE=false`. New tables retain data but receive no new writes.

---

## Phase 3 — Relational graph + Procedural ledger + Relationship Stage (3–4 days)

### Tasks

1. **`app/memory/relational.py`** (new): Postgres-backed entity/edge CRUD + 1–2 hop traversal (recursive CTE). Helper `entities_mentioned_in(text)` uses a small Groq Llama 3.1 8B call to extract named entities + relations from the user's turn (or from a Gemini Flash extraction batch).

2. **`app/memory/procedural.py`** (new): record interventions used + post-turn outcome classifier. Outcome classifier is the *next user turn's* affect delta (computed automatically), not a separate LLM call.

3. **`app/memory/relationship_state.py`** (new): the **Stage advancer**. Uses the same hybrid counter pattern as the legacy `get_hybrid_message_count` (DB count + in-memory counter, in-memory wins for the active session) so a stage promotion mid-session takes effect on the very next turn. A nightly job + on-session-end hook recomputes:
   - `stranger → acquaintance`: ≥3 sessions OR ≥30 cumulative minutes.
   - `acquaintance → familiar`: ≥2 weeks elapsed AND topic_breadth ≥ 5 distinct themes AND no unresolved-rupture flag.
   - `familiar → trusted`: ≥6 weeks AND ≥1 successful repair AND user's depth_indicators (`"I've never told anyone…"`, requests sustained sessions) ≥ 1.
   - Always exposes `current_stage(user_id) -> Stage` (cached, in-memory LRU 60 s).
   - **Stage can only advance, never auto-regress** — manual ops command for downgrade only.

4. **Stage-aware extension to `core/prompts/stance.py`**: now actually parameterised by live Stage, not the placeholder constant.

5. **Question budget enforcement** (architecture §6.1):
   - Stance template includes per-Stage caps (`max_questions_per_turn`, `max_questions_per_5_window`).
   - Critic v1 rule **#6 "question budget"** (extends critic v0): counts `?` in draft (with light NLP for rhetorical-question filtering); if exceeded, emits `SOFT_REWRITE` to collapse trailing questions into reflective statements.
   - Per-window count comes from `mitra_turn_traces` (last 5 traces for this user × session).

### Test gate

- `test_relational_traversal.py` — write people graph, multi-hop query returns expected.
- `test_relationship_stage_progression.py` — simulated session counts move user through stages correctly; downgrades blocked by default.
- `test_procedural_ledger_outcome_classification.py` — given a pre/post affect, outcome label is right.

### Frontend impact

**Zero.**

---

## Phase 4 — Reflective Consolidation + Decay (3–4 days)

### Tasks

1. **Stage A (Extraction)** is already running from Phase 2. Audit + tune prompts.

2. **Stage B (Linking)**: in `consolidation_worker.py`, after each new episodic write, find top-3 nearest existing memories (themes + cosine), insert typed edges into `mitra_entity_edges` if entity-anchored, or theme-cluster tags if not.

3. **Stage C (Reflection)** — nightly job per active user:
   - Pull last 14 days of episodic memories + affect TS.
   - Single Gemini Flash call with the reflection prompt: "produce up to 3 high-level patterns, each with confidence and source episode ids, in strict JSON".
   - Insert into `mitra_reflection_insights`. Optional Qdrant index.
   - **Never** quoted directly to the user; only available to the assembler at `Familiar+` Stage as background context.

4. **Stage D (Forgetting)** — weekly job:
   - For each episodic memory: `strength_new = strength_old * exp(-elapsed_days / S)` where `S = base * (1 + recall_count * 0.5)`.
   - Below `archive_threshold` AND not pinned AND not linked to importance≥0.8 node → `archived_at = now()`.
   - Hard delete after 30 days unless user-pinned.

5. **Stage E (Drift check)** — on Identity Card update, compare to N-week-old snapshot; large divergence in `values` or `life_stage` lowers confidence priors but doesn't auto-overwrite.

6. **Cron / scheduler**: use Supabase `pg_cron` extension to enqueue jobs on schedule. Worker process is a `python -m app.jobs.run_worker` invoked separately (or a thread inside the main process for MVP).

### Test gate

- `test_consolidation_extracts_correctly.py` — fed a fake transcript, extraction produces expected episodic + identity deltas.
- `test_decay_archives_stale.py` — synthetic memories decay & archive on schedule.
- `test_reflection_does_not_quote_user.py` — generated insights never include verbatim user phrases.

### Frontend impact

**Zero**, but you start to see the "it noticed me" effect in real conversations during internal testing.

---

## Phase 5 — Two-Pass Generation + Pipeline cutover (5–7 days)

**This is the cutover.** After this phase, traffic flows through the new pipeline by default.

### Tasks

1. **`app/pipeline/classifier.py`** (new): single Groq Llama 3.1 8B Instant call producing `{vad, affect_label, intent, language_register, retrieval_need: bool}`. Replaces `IntentRouter.classify` + Path B's emotional analysis in one shot.

2. **`app/memory/retriever.py`** (new): the parallel fan-out orchestrator. Given the classifier output + user_id + current turn, kicks off 4 concurrent retrievals (episodic, relational graph 1-hop, procedural top-3, affective anomaly) with a hard deadline (`pipeline.retrieval_timeout_ms`, default 200 ms). Whatever's back at deadline, the rest is dropped.

3. **`app/pipeline/context_assembler.py`** (new): deterministic, token-budgeted, Stage-aware. Builds the final messages list. Memory-naming gate is computed here (memory passed as `[BACKGROUND, do not reference directly]` if Stage doesn't permit naming).

4. **`app/pipeline/generator.py`** (new): two-pass.
   - **Speculative pre-fetch** (architecture §7.0): the FastAPI handler fires three coroutines on request entry — BGE-M3 embedding of the user message, Identity Card load, affective-pattern lookup. By the time the classifier returns ~80 ms later, all three are warm cache reads.
   - **Speculative draft**: kick off Gemini Flash streaming immediately on `assembler.ready()`. First 1–2 sentences may stream to the client.
   - **Authoritative refine**: in parallel, kick off Azure GPT-5-mini with the same context; if its output diverges materially from the draft after the first sentence, switch the stream to the authoritative output (with a smooth "…" bridge if needed). For most empathetic short replies, the draft IS the final.
   - For low-stakes turns (intent in `{casual, logistics}`), use Gemini Flash only.
   - **Cross-provider single-turn fallback**: each provider client wraps another via `with_fallback(...)` — if Azure times out mid-turn, Groq Llama 3.3 70B gets the same prompt without the user noticing a failure.

5. **`app/pipeline/critic.py`** v1: full 5 rubrics (safety, sycophancy, stance, memory-naming-appropriateness, cultural register). Runs against the **completed** draft *while* the user is still hearing/reading the early tokens. If `SOFT_REWRITE`, server appends a corrective continuation with a soft transition; if `HARD_REWRITE`, server emits a brief `[regenerating]` UI affordance and restarts.

6. **`app/pipeline/orchestrator.py`** (new): the unified entry replacing `pipeline_orchestrator.py`. Implements the diagram in §7 of the architecture doc. The legacy orchestrator stays in the codebase but is only invoked when `MITRA_STACK_ENABLED=false`.

7. **`app/api/chat.py`** routing: when `MITRA_STACK_ENABLED=true`, calls new `orchestrator.handle_turn(...)`; otherwise legacy `process_user_chat(...)`. **Same SSE response shape** in both cases.

8. **`app/services/greeting.py`** (rewrites old greeting service): on `GET /chat/greeting`, reads Identity Card + Stage + last reflection → builds greeting from a small template set + persona. Old `greeting_pool.json` retained as fallback when Identity Card is empty (new users).

9. **Stage-gated rollout**:
   - Internal users only first (env-set allowlist).
   - 5% canary on real users.
   - 50% / 100% over 1 week with on-call monitoring of `mitra_turn_traces` for spikes in critic `HARD_REWRITE` rate, latency P95, crisis precision, user retention.

### Test gate

- All Phase 0–4 health tests green.
- Full SSE contract test: streaming chunks parse, final message contains required fields, `eval_trace` populated when env+header set.
- `test_two_pass_generator_streams.py` — mock providers, verify draft starts within 350 ms simulated, refine completes within budget.
- `test_critic_v1_rubrics.py` — table-driven test for each rubric.

### Frontend impact

**Zero contract change.** New optional fields in SSE payload are ignored by the frontend gracefully.

### Rollback

`MITRA_STACK_ENABLED=false` reverts to the legacy pipeline immediately. Memory writes continue dual-writing.

---

## Phase 6 — Eval, polish, legacy removal (1 week)

### Tasks

1. **Replace `analysis_engine.py` and old `pipeline_orchestrator.py`** with shims that just call into the new orchestrator (so any external imports keep working).
2. **Delete** `app/agents/intent_router.py`, `app/agents/analysis_agent.py`, `app/agents/response_agent.py`, `app/agents/memory_*.py` (after a sanity grep for callers).
3. **Migration**: `20260601000001_drop_legacy_memory_tables.sql` — drops `memory_metadata`, `user_memory_stats` (only after dual-write has been off for ≥2 weeks).
4. **Drop legacy Qdrant collection** `companion_memories_legacy` (after backup snapshot).
5. **Eval suite** (per architecture §12): retrieval-precision, sycophancy probe, crisis recall, stance adherence, run weekly. Add `make eval-weekly` target.
6. **Clinical advisor review**: schedule a review of 50–100 sampled sessions against the rubric.
7. **Doc updates**: README, `docs/backend/ARCHITECTURE.md`, runbook for incident response.
8. **Load test**: 50 concurrent users, sustained 30 min. Verify P95 first-token < 1.5 s, P95 full response < 3 s.

### Frontend impact

Optional new affordances:
- A small "what do you remember about me?" page (calls a new `GET /me/memory-summary` endpoint that returns the Identity Card + recent episodic summaries + reflections). **High user-trust value, low engineering cost**, ship it.
- "Forget that" button on AI messages (calls `POST /me/memory/forget`). Implements the right-to-forget the architecture promises.

---

## Latency budget enforcement (added to CI)

Every PR runs a synthetic latency test against a mocked provider stack:

| Stage | Budget (ms) | Test asserts |
|---|---|---|
| Classifier | 100 | `assert latencies['classifier'] < 100` |
| Retrieval (parallel) | 200 | `assert latencies['retrieval'] < 200` |
| Assembly | 50 | `assert latencies['assembly'] < 50` |
| TTFT (mocked LLM with 0 ms latency) | 50 | overhead only |
| Critic | 350 | `assert latencies['critic'] < 350` |

These don't catch real provider slowness, but they catch *us* introducing CPU-bound regressions.

---

## Cost & rate-limit posture

- Groq has generous free tier and ultra-cheap paid tier. The high-volume calls (classifier, critic, importance scoring) all live there. Budget impact: ~negligible.
- Gemini 2.5 Flash has a free tier (15 RPM, 1M TPM). Sufficient for extraction + reflection at MVP DAU. When DAU > ~5k, move to paid tier (~$0.30 / 1M input tokens, ~$2.50 / 1M output) — still cheap because reflection is per-user-per-day, not per-turn.
- Azure GPT-5-mini is the most expensive call. Used only for the authoritative refine on **emotional / therapeutic** turns. Budget per active user per day with current pricing: a few cents.
- BGE-M3 self-hosted on the FastAPI process: model is ~2.3 GB; CPU inference ~50 ms/query on a modern server. Acceptable for MVP. Move to a dedicated embeddings service when QPS justifies it.

---

## Test scaffolding (Phase 0 deliverable — files in this PR)

The following test files are scaffolded immediately as part of Phase 0 so the user can run `make test-health` from day one to verify the website is working. Each test is **fast** (<5 s total suite) and **does not hit external APIs** by default.

```
chatbotAgent/tests/health/
├── __init__.py
├── conftest.py                      # extends root conftest with mocking
├── test_app_boots.py                # FastAPI app instantiates + key routes registered
├── test_env_present.py              # required env vars exist (per-provider)
├── test_providers_constructible.py  # ModelRegistry can build each provider client
├── test_supabase_schema.py          # required tables exist (skipped if no SUPABASE_URL)
├── test_qdrant_reachable.py         # mitra collections exist (skipped if no QDRANT_HOST)
├── test_chat_sse_contract.py        # /chat/stream returns SSE-shaped chunks (mocked)
├── test_greeting_contract.py        # /chat/greeting returns expected shape (mocked)
├── test_transcribe_contract.py      # /transcribe returns text shape (mocked)
└── test_crisis_lexical_v2.py        # crisis lexical triggers fire on EN/HI/Hinglish
```

A frontend smoke test using **Vitest** ships in the same PR:

```
src/__tests__/
├── App.smoke.test.tsx               # App renders without crashing
├── chat-flow.smoke.test.tsx         # ChatGPTInterface mounts; mocked supabase + fetch
└── env.smoke.test.ts                # required VITE_* envs present
```

`package.json` gets:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:health": "vitest run src/__tests__"
}
```

A top-level `Makefile` (or `scripts/test-health.sh`) ties it together:

```makefile
test-health:
	cd chatbotAgent && pytest tests/health -v
	npm run test:health
	cd chatbotAgent && python -c "from app.main import app; print('backend OK')"
	npm run build --silent

.PHONY: test-health
```

`make test-health` is the **single command** the user runs after any change to confirm the site is still healthy.

---

## Acceptance criteria per phase (the "is it done?" checklist)

| Phase | Done means |
|---|---|
| 0 | `make test-health` green; new tables exist; Qdrant collections exist; nothing visibly changed for users; legacy pipeline still default. |
| 1 | Crisis lexical+confirmer in EN/HI/Hinglish has ≥99% recall on test set; critic v0 catches 100% of synthetic sycophancy probes; flag-flip works. |
| 2 | New episodic store accepts writes; backfill from legacy migrates ≥99% of memories without error; dual-write verified by row counts. |
| 3 | Stage advances correctly across simulated user histories; relational graph supports 2-hop queries; procedural ledger updates auto on next-turn affect. |
| 4 | Reflection insights generated nightly for active users; decay archives stale entries; no insight contains a verbatim user quote. |
| 5 | New pipeline serves traffic for ≥7 days at 100% with no regression in user retention, no spike in `HARD_REWRITE` rate >2%, P95 first-token <1.2 s, crisis precision/recall maintained. |
| 6 | Legacy code removed; `make test-health` still green; load test passes; clinical review signed off; eval suite running weekly. |

---

## Risk register & mitigations (migration-specific, on top of architecture risks)

| Risk | Mitigation |
|---|---|
| Dual-write doubles cost / latency for memory writes | Memory writes are async / off the critical path; cost is dominated by reads. Verified in load test before Phase 5 cutover. |
| Backfill loses data due to embedding-dim mismatch | Backfill writes to NEW collections only; legacy stays intact and read-only. Migration map table allows re-runs. Spot-check 50 random rows manually. |
| BGE-M3 too slow on the API server | Phase 0 includes a microbenchmark; if >100 ms/query on target hardware, fall back to `multilingual-e5-base` (smaller, ~30 ms) without architectural change. |
| Critic over-rewrites and chops empathy mid-stream | Critic only triggers `HARD_REWRITE` on safety/sycophancy violations; everything else is `SOFT_REWRITE` (appended continuation). Dashboard alarm if `HARD_REWRITE` rate >2%. |
| Gemini free tier rate limits in nightly job | Batch users (e.g., 5 users per call where context fits in 1M); paid tier cutover trigger at threshold. |
| Azure GPT-5-mini outage | `glm_client.py` is the registered failover (already in the registry); circuit-breaker in `providers/`. |
| Qdrant local dev env diverges from prod | `scripts/qdrant_init_mitra.py` is idempotent and runs in CI on every PR against a Qdrant testcontainer. |
| Stage progression bugs (creepy regression) | Stage can only *advance*, never auto-regress. Manual ops command to demote on user complaint. Stage default is conservative. |

---

## TL;DR (for the team standup)

- **Phase 0 (this week)**: scaffolding + health tests + DB migration. Nothing visible changes.
- **Phases 1–4 (next 3 weeks)**: build the new memory + crisis + critic stack behind flags, keep legacy serving traffic.
- **Phase 5 (week 5)**: cutover via flag with canary rollout. SSE contract preserved, frontend untouched.
- **Phase 6 (week 6)**: cleanup + eval + clinical review.

At any point, flipping `MITRA_STACK_ENABLED=false` restores the prior system. The website is verifiable with one command — `make test-health` — at every phase boundary.
