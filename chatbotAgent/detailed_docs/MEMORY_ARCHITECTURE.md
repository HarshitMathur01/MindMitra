# MindMitra Memory Architecture — Complete Reference

> **Purpose:** Single document so someone with **zero prior context** understands *what* is stored, *where*, *when* it is written, *when* it is read, and *how* scores and limits work.  
> **Scope:** Backend `chatbotAgent/` only — mem0, Qdrant, Supabase, and the chat pipeline.  
> **Source of truth:** Python modules listed below (April 2026).

---

## Quick map: which file does what?

| File | Role |
|------|------|
| `app/agents/memory_manager.py` | Facade: `memory_manager` singleton; delegates to store, retriever, reflection. |
| `app/agents/memory_store.py` | mem0 init, `add_memories`, Groq importance batch, Supabase `memory_metadata` / `user_memory_stats`, `add_crisis_memory`, `get_all_memories`. |
| `app/agents/memory_retriever.py` | `retrieve_memories`: Qdrant search via mem0, Supabase metadata join, composite scoring, formatting, `last_accessed_at` updates. |
| `app/agents/memory_reflection.py` | Session summaries (Gemini), procedural synthesis (GLM), reflections (Groq), emotional trend (Groq + cache). |
| `app/pipeline/pipeline_orchestrator.py` | **Read path:** calls `retrieve_memories` + `get_emotional_trend` in parallel (7s timeout each), sets `ctx["memory_context"]`. |
| `app/pipeline/workflow.py` | Builds final API result; if eval trace requested, exposes `memory_injected` / `memory_context_preview`. |
| `app/agents/response_agent.py` | Injects `memory_context` into **system** prompt placeholder `{memory_context}` (see `config`/YAML `response_generator.system_prompt`). |
| `app/api/chat.py` | **Write path triggers:** `_maybe_trigger_memory`, `_run_session_end_jobs`, game bridge, screening; loads `load_session_summary`. |
| `app/pipeline/crisis_manager.py` | **Crisis:** `add_crisis_memory` in background thread after crisis response. |
| `app/utils/constants.py` | All numeric knobs: `MEMORY_TRIGGER_INTERVAL`, limits, weights, thresholds. |
| `app/services/supabase_service.py` | `get_hybrid_message_count`, `session_message_counters` (in-process counters). |

---

## 1. Philosophy & data planes

MindMitra targets a **long-horizon therapeutic companion**: continuity across sessions, coping history, and safe handling of crisis signals. Memory is **not** “RAG over PDFs.” It is **conversational memory**: facts and synthesized notes stored **per user**, retrieved by **semantic similarity** to the current message, then **re-ranked** with importance and recency.

**Three storage planes:**

1. **Vector plane (Qdrant via mem0)**  
   - Collection name from env: `QDRANT_COLLECTION` (default `companion_memories`).  
   - Embeddings: local `sentence-transformers/all-MiniLM-L6-v2`, **384 dimensions**.  
   - mem0 handles upsert/dedup/search API; MindMitra calls `Memory.add`, `Memory.search`, `Memory.get_all`.

2. **Relational plane (Supabase PostgreSQL)**  
   - `memory_metadata`: one row per indexed memory (links `user_id` ↔ `mem0_id`), with `importance_score`, `last_accessed_at`, `memory_type`, etc.  
   - `session_summaries`: per-session summary text + `themes` + `emotional_arc` (JSON).  
   - `user_memory_stats`: rollup (`total_memories`, `last_extraction`, `session_count`) for reflection gating.  
   - RLS: migrations enable policy-based access per user.

3. **Process-local plane**  
   - `session_message_counters` in `supabase_service.py`: in-memory message counter **per `session_id`** in this server process.  
   - `MemoryRetriever._has_memories_cache`: short TTL cache for “does this user have any `memory_metadata` rows?”  
   - `MemoryReflection._emotional_trend_cache`: Groq emotional-trend result cached **per `user_id`** (TTL **600 s** in code —  minutes, not 1 hour).

---

## 2. Cold start & readiness (`MemoryStore`)

### 2.1 Deferred initialization thread

On import, `MemoryStore.__init__` starts a **daemon thread** `mem0-init` so **uvicorn can bind immediately**. Until the thread finishes:

- `self._ready` is `False`, `self._mem0` is `None`.  
- Any `add_memories` / `retrieve_memories` early in startup may no-op or return `""`.

When `GROQ_API_KEY` is set, the thread builds mem0 config:

- **LLM (mem0 internal):** Groq `llama-3.1-8b-instant`, temperature `0.1`, `max_tokens` 2000 — used for **extraction/normalization inside mem0** when adding memories.  
- **Embedder:** HuggingFace `all-MiniLM-L6-v2`, `embedding_dims: 384`.  
- **Vector store:** Qdrant `host`/`port` from env (`QDRANT_HOST`, `QDRANT_PORT`), `embedding_model_dims: 384` set explicitly in config.

If `GROQ_API_KEY` is missing, mem0 is **not** initialized; memory features are disabled (logged).

Separately in the same thread:

- **Gemini** `gemini-2.5-flash-lite` for session summaries (if `GOOGLE_API_KEY` set).  
- **GLM** via `LLMController` for procedural synthesis.  
- **Groq** client for importance scoring (batch) and reflection/trend prompts.

### 2.2 Public readiness

- `memory_manager.is_ready` → `MemoryStore.is_ready` → `self._ready` after successful mem0 connect.

---

## 3. Memory taxonomy (`memory_type` / categories)

How rows are **classified** affects retrieval bucketing (semantic vs procedural vs reflection) and importance overrides.

| Kind | Typical `memory_type` | How it gets into the system |
|------|------------------------|------------------------------|
| **Semantic** | `semantic` (default), `crisis`, or general | `add_memories` after conversation chunks; mem0 extracts facts; metadata `memory_type` from incoming `metadata.category` (`procedural` / `crisis` / else semantic). |
| **Procedural** | `procedural` | (1) `synthesize_procedural_memory` stores GLM paragraph via `mem0.add` with `category: procedural`. (2) Batch importance forces procedural scores **≥ 8**. |
| **Reflection** | `reflection` | `generate_reflections`: Groq produces insights; each added via `mem0.add` + best-effort `memory_metadata` row with `importance_score` 9. |
| **Crisis** | `crisis` | `add_crisis_memory`: `mem0.add` user message with metadata `category: crisis`, `source: crisis_fast_path`. **Note:** this path does **not** run the same `_score_and_save_metadata` thread as `add_memories`; ensuring Supabase rows for crisis vectors may depend on other jobs or manual alignment. |

**Injection format** (from `MemoryRetriever._format_structured_memory_context`):

- **Semantic block:** `THINGS YOU REMEMBER ABOUT THEM ...` + bullet lines.  
- **Procedural:** `WHAT HAS HELPED THEM BEFORE ...`  
- **Reflection:** `PATTERNS YOU'VE NOTICED ...`  

These strings are concatenated with double newlines and placed in `ctx["memory_context"]`, then appended into the **system prompt** as the `{memory_context}` placeholder in `ResponseGenerator` (see `response_generator.system_prompt` in config — e.g. “Reference what they've shared before”).

---

## 4. Write path — when data is stored

All heavy writes are designed **asynchronous** (threads) so `/chat` latency is not blocked by extraction.

### 4.1 Periodic fact extraction (`add_memories`)

**Trigger:** `app/api/chat.py` → `_maybe_trigger_memory(session_id, user_id, content_locale)`.

**Mechanism:**

1. `session_message_counters[session_id]` is incremented **each** `/chat` completion path.  
2. `count = get_hybrid_message_count(session_id)`:
   - If in-memory counter for this session **> 0**, returns that value (**DB COUNT skipped**).  
   - Else cold-start: counts rows in `chat_messages` for `session_id`.  
3. When `count > 0` and `count % MEMORY_TRIGGER_INTERVAL == 0` (**default `12`** from `constants.py`):
   - Fetches last `MEMORY_TRIGGER_INTERVAL` messages from DB via `fetch_last_n_messages`.  
   - Starts daemon thread: `memory_manager.add_memories(messages, user_id, session_id, meta)` where `meta` may include `content_locale`.

**Inside `MemoryStore.add_memories`:**

1. Requires `_ready` and `_mem0`.  
2. Calls **`self._mem0.add(messages=..., user_id=..., metadata=...)`** — mem0 uses Groq internally to extract/consolidate facts and write vectors to Qdrant.  
3. For each result with `event == "ADD"` and an `id`:
   - Spawns **another** daemon thread `_score_and_save_metadata` which:
     - Batches memory texts → **Groq** `_score_importance_batch` → integers 1–10.  
     - **Overrides:** if `memory_type == "crisis"` → all scores `10`; if `procedural` → `max(8, s)`.  
     - **Inserts** rows into `memory_metadata` (`mem0_id`, `importance_score`, `memory_type`, `last_accessed_at`, etc.).  
     - **Upserts** `user_memory_stats` (total memories from mem0 count, session_count from count of `session_summaries` rows).  
4. **`MemoryManager.add_memories`** invalidates `MemoryRetriever.invalidate_has_memories_cache(user_id)` so the next read sees new rows.

### 4.2 Session-end batch (`MEMORY_TRIGGER_INTERVAL * 3` → default 36)

**Trigger:** After `_maybe_trigger_memory`, if `count > 0` and `count % (MEMORY_TRIGGER_INTERVAL * 3) == 0`:

- Starts `_run_session_end_jobs(session_id, user_id)` in a daemon thread.

**Inside `_run_session_end_jobs`:**

1. Loads up to **30** recent messages.  
2. If `len(messages) >= 5`:
   - **`save_session_summary`** (Gemini): last 30 turns formatted; JSON with `summary`, `themes`, `emotional_arc`; **upsert** `session_summaries` on `session_id`.  
   - **`_trigger_procedural_synthesis`**: scans last 15 messages for coping keywords (breathing, journal, grounding, etc.); if hit, **`synthesize_procedural_memory`** (GLM) → `mem0.add` with `category: procedural`.  
   - **`should_generate_reflections(user_id)`**: true if `user_memory_stats.session_count > 0` and `session_count % REFLECTION_INTERVAL_SESSIONS == 0` (**`REFLECTION_INTERVAL_SESSIONS` = 5**). If true, starts **`generate_reflections(user_id)`** in a thread.  
3. If `len(messages) >= SCREENING_MIN_MESSAGES` (8): optional PHQ-9/GAD-7 screening (separate from vector memory).

**Important:** Session summaries only run when this **36-message** milestone is hit **and** ≥ 5 messages — not automatically on browser close.

### 4.3 Game / activity bridge

When `user_activities` is non-empty on `/chat`, a thread runs `_extract_game_insights_for_memory`: builds synthetic assistant messages from game types (`emotion_match`, `thought_detective`, `wellness_checkin`, `mood_mountain`, `balloon_positivity`, etc.) and calls `add_memories` with `metadata={"source": "game_insights", "category": "therapeutic"}` when insights exist.

### 4.4 Crisis path

`crisis_manager.crisis_fast_path` ends with a thread calling **`memory_manager.add_crisis_memory(user_id, user_message, session_id)`** → `mem0.add` with crisis metadata only (no automatic `_score_and_save_metadata` in current code).

### 4.5 Emotional trend (not stored as permanent “memory row” in Qdrant)

`get_emotional_trend` **reads** `session_summaries`, calls Groq for one sentence, caches in memory **600 s**. Output is **concatenated** onto `memory_context` in the orchestrator:

```text
📈 EMOTIONAL TREND (recent sessions): <sentence>
```

---

## 5. Read path — when data is retrieved & how it is scored

### 5.1 Call site & timeout

`PipelineOrchestrator.route_and_execute`:

1. After intent is finalized (`casual` / `emotional` / `therapeutic` / `crisis`), starts **two** futures in a `ThreadPoolExecutor(max_workers=2)`:
   - `memory_manager.retrieve_memories(text, user_id, intent)`  
   - `memory_manager.get_emotional_trend(user_id)`  
2. Each is collected with **`fut.result(timeout=7.0)`** (`_MEMORY_TIMEOUT`). On timeout or exception, memory/trend for that turn is skipped (empty string).

### 5.2 `retrieve_memories` — step by step

**Parameters:** `query` = current user message text, `user_id`, `intent` (drives **semantic** cap).

**Step 0 — Short-circuit if no Supabase metadata:**

- `_has_any_memories(user_id)` queries `memory_metadata` count (cached 10 min if had memories, 2 min if none).  
- If **false**, returns `""` **without** calling Qdrant (saves seconds for brand-new users).  
- On Supabase error, **fails open** (returns `True`) so retrieval still runs.

**Step 1 — Parallel IO (same `ThreadPoolExecutor` block inside retriever):**

- **A:** `self._mem0.search(query=query, user_id=user_id, limit=MEMORY_OVERFETCH_LIMIT)` — default **25** hits from Qdrant/mem0.  
- **B:** `_fetch_metadata_for_scoring`: loads **all** `memory_metadata` rows for user (`mem0_id`, `importance_score`, `last_accessed_at`, `memory_type`).

**Step 2 — Composite score (per hit)**

For each raw memory `m`:

- `relevance = m.get("score", 0.0)` — mem0/Qdrant similarity, **0–1**.  
- `importance = importance_score / 10` from Supabase (default **5** if row missing).  
- `recency = RECENCY_DECAY_RATE ** hours_elapsed` with `RECENCY_DECAY_RATE = 0.999`, `hours_elapsed` from `last_accessed_at` to now (0 if no timestamp).  

**Formula (linear blend, not multiplication):**

```text
composite = 0.50 * relevance + 0.35 * importance + 0.15 * recency
```

Constants from `SCORE_WEIGHT_RELEVANCE`, `SCORE_WEIGHT_IMPORTANCE`, `SCORE_WEIGHT_RECENCY`.

**Filter:** if `composite < MEMORY_RELEVANCE_THRESHOLD` (**0.25**), drop.

**Step 3 — Sort & bucket**

- Sort all remaining by `composite` descending.  
- **Semantic bucket:** take up to intent limit **only for types not `procedural` or `reflection`**:  
  - `casual` → 3, `emotional` → 5, `therapeutic` → 7, `crisis` → 4 (`MEMORY_LIMIT_*`).  
- **Procedural:** all matches passing threshold; if intent **not** `therapeutic` or `crisis`, **cap at 2**.  
- **Reflection:** up to `REFLECTION_MAX_INSIGHTS` (**5**).

**Step 4 — Side effect**

- Spawn thread `_update_access_timestamps` for retrieved `mem0_id`s (updates `last_accessed_at` in Supabase) — **strengthens recency** on future turns.

**Step 5 — Format**

- Returns the multi-section string or `""` if no buckets survived.

**Failure:** any exception → log error, return `""` (chat continues without memory).

### 5.3 Injection into generation

- `ctx["memory_context"]` may include trend suffix from trend call.  
- `ResponseGenerator._build_system_prompt` inserts this into **`{memory_context}`** at end of configured system template (with stage/personality/language/intervention blocks).

### 5.4 Eval trace (debug only)

If client sends eval trace header and server allows it, `workflow` sets:

- `memory_injected`: non-empty `memory_context` string.  
- `memory_context_preview`: first 8000 chars.  
- `memory_char_len`: full length.

---

## 6. Constants cheat sheet (`app/utils/constants.py`)

| Constant | Default | Meaning |
|----------|---------|--------|
| `MEMORY_TRIGGER_INTERVAL` | 12 | Messages between `mem0.add` extractions. |
| `MEMORY_OVERFETCH_LIMIT` | 25 | Vector hits before composite filter. |
| `MEMORY_RELEVANCE_THRESHOLD` | 0.25 | Min composite to include. |
| `SCORE_WEIGHT_RELEVANCE` / `IMPORTANCE` / `RECENCY` | 0.50 / 0.35 / 0.15 | Blend weights. |
| `RECENCY_DECAY_RATE` | 0.999 | Per-hour decay base. |
| `MEMORY_LIMIT_CASUAL` | 3 | Max semantic bullets (path A). |
| `MEMORY_LIMIT_EMOTIONAL` | 5 | Path B. |
| `MEMORY_LIMIT_THERAPEUTIC` | 7 | Path C. |
| `MEMORY_LIMIT_CRISIS` | 4 | Path D. |
| `REFLECTION_INTERVAL_SESSIONS` | 5 | Reflection job when `session_count % 5 == 0`. |
| `REFLECTION_MAX_INSIGHTS` | 5 | Max reflection lines injected. |
| `REFLECTION_MEMORY_FETCH_LIMIT` | 30 | Top memories by importance feeding reflection prompt. |
| `EMOTIONAL_TREND_SESSIONS` | 5 | Last N summaries for trend. |

---

## 7. Security & privacy notes

- **User isolation** depends on **correct `user_id`** from auth on every `/chat`. mem0 search is scoped by `user_id`; Supabase queries filter `user_id`.  
- **RLS** on `memory_metadata` and `session_summaries` (see migrations under `supabase/migrations/`).  
- **Prompt injection:** user-controlled *content* can appear inside retrieved bullets; response agent uses safe formatting for placeholders, but therapeutic products still need **output policy** + crisis path.  
- **Eval trace** exposes memory previews — **never** enable `ALLOW_EVAL_TRACE` on public production without strict auth.

---

## 8. Known limitations & operational pitfalls

1. **Hybrid message count** is per **process**; multi-worker deployments can desynchronize until DB cold path runs.  
2. **No automatic session summary** on abrupt disconnect unless you add a client `beforeunload` / explicit end-session API.  
3. **Reflections** require enough memories and session summaries; cold users get none.  
4. **Crisis `add_crisis_memory`** does not duplicate the full metadata pipeline used by `add_memories`; monitor whether `memory_metadata` stays aligned with crisis vectors.  
5. **Embeddings are English-centric MiniLM**; Hinglish/name-heavy content may retrieve weaker matches than a multilingual embedder.  
6. **Qdrant client/server version mismatch** in logs → fix versions to avoid subtle SDK issues.  
7. **Emotional trend TTL** in `MemoryReflection` is **600 s**; comment in `memory_store` mentions 1 hour for a different cache field (`MemoryStore`’s own `_EMOTIONAL_TREND_CACHE_TTL_S` is 3600 but appears unused vs reflection’s dict).

---

## 9. Upgrade plan (roadmap for your use case)

Goals: richer **semantic** availability (“how to talk to this user”), fewer **false recalls**, safer **crisis** handling, and measurable quality.

### Phase A — Observability (1–2 weeks)

- Structured logs/metrics: **hit rate** of `retrieve_memories` (non-empty %), latency p95, **Qdrant result count** before/after threshold, **empty-metadata** id rate.  
- Dashboard: memories added per day per user, extraction failures.

### Phase B — Retrieval quality

- **Dual embedder or upgrade:** keep MiniLM for cost-sensitive bulk; optional **small multilingual** model for user text + memories, or re-embed hot users.  
- **Hybrid search:** BM25/keyword on `memory_metadata` text mirror for names and specific entities MiniLM misses.  
- **Session boost:** multiply composite score for memories whose `session_id` matches current session.  
- **“Communications prefs” type:** extend mem0 extraction prompt / post-filter to always create **compact** bullets: tone, language preference, boundaries, taboo topics — mark `memory_type = semantic` but **force min importance** or a **pinning** flag always injected (1–2 slots).

### Phase C — Write path & consistency

- **Unify crisis metadata:** after `add_crisis_memory`, enqueue `_score_and_save_metadata` or insert fixed metadata row so crisis entries participate cleanly in scoring.  
- **Session end hook:** API `POST /sessions/{id}/close` or client beacon to run `_run_session_end_jobs` when count < 36.  
- **Game + chat merge:** deduplicate near-duplicate mem0 entries when game and chat say the same fact.

### Phase D — Architecture evolution (optional “SOTA-shaped” target)

- **Tiered store:** (1) **Hot** = last K turns Redis/Postgres; (2) **Structured profile** = JSON column (preferences, risk flags — **not** free recall); (3) **Vector** = episodic facts; (4) **Summaries** = session rollups you already have.  
- **Evaluator-driven tuning:** weekly job compares **memory_injected** rate vs user satisfaction proxies; adjust `MEMORY_RELEVANCE_THRESHOLD` / weights with guardrails.

---

## 10. One-page mental model

```text
[ User message ]
       ↓
[ Auth → user_id, session_id ]
       ↓
[ Pipeline: intent A/B/C/D ]
       ↓
[ Parallel: retrieve_memories(query) + get_emotional_trend() ]  ← 7s budget each
       ↓
[ memory_context string in SYSTEM prompt ]
       ↓
[ GLM generates reply ]
       ↓
[ Background: maybe mem0.add every 12 msgs; every 36 msgs summaries + maybe reflections ]
```

**Bottom line:** Storage is **mem0 + Qdrant + Supabase metadata**; retrieval is **semantic search + your composite score + intent caps**; the companion “feels” memory because **formatted bullets** sit in the **system** prompt every turn when the pipeline stays within timeout and the user has metadata-backed memories.

---

*Document generated from codebase audit. For test/eval behavior see `docs/EVALUATION.md`.*
