# Memory architecture (mem0 + Qdrant + Supabase)

**TL;DR:** Conversation-memory only (not document RAG). **Writes:** mem0 every **12** msgs; session jobs every **36** msgs (summary, procedural keywords, reflections, screening). **Reads:** metadata fast-path → vector search → composite score → intent caps → `{memory_context}` in system prompt. **Trend:** Groq one-liner from recent summaries, cached **600s** in `MemoryReflection`.

**Pipeline context:** [`PIPELINE.md`](./PIPELINE.md) · **Qdrant ops:** [`QDRANT_SETUP.md`](./QDRANT_SETUP.md)

---

## Module map

| File | Responsibility |
|------|----------------|
| `memory_manager.py` | Facade singleton; delegates to store / retriever / reflection |
| `memory_store.py` | mem0 init thread, `add_memories`, importance batch, metadata upsert, crisis `mem0.add`, stats |
| `memory_retriever.py` | `retrieve_memories`: search, join metadata, composite score, format, `last_accessed_at` |
| `memory_reflection.py` | Session summaries (Gemini), procedural synthesis (GLM), reflections (Groq), emotional trend (Groq + LRU cache) |
| `pipeline_orchestrator.py` | Parallel `retrieve_memories` ∥ `get_emotional_trend` (7s each) |
| `workflow.py` | `eval_trace` memory fields when enabled |
| `response_agent.py` | `{memory_context}` injection |
| `chat.py` | `_maybe_trigger_memory`, `_run_session_end_jobs`, game→mem0 thread |
| `crisis_manager.py` | post–crisis `add_crisis_memory` thread |
| `constants.py` | All numeric knobs |
| `supabase_service.py` | Hybrid message count, `fetch_last_n_messages` (**must** pass `user_id`) |

---

## Data planes

| Plane | Holds |
|-------|--------|
| **Vector** | Qdrant collection `QDRANT_COLLECTION` (default `companion_memories`), 384-dim MiniLM |
| **Relational** | `memory_metadata`, `session_summaries`, `user_memory_stats` (+ RLS) |
| **Process** | `session_message_counters` (per `session_id`); `_has_memories_cache`; `_emotional_trend_cache` + LRU cap in reflection layer |

---

## Cold start (`MemoryStore`)

- Daemon thread **`mem0-init`** on import → uvicorn binds before mem0 + HF model load.
- Until `_ready`: `add_memories` / search may no-op or return empty.
- mem0 internal LLM: Groq **`llama-3.1-8b-instant`** for extraction; HF embedder; Qdrant host/port from env.
- No `GROQ_API_KEY` → mem0 disabled (logged).

---

## Taxonomy (`memory_type`)

| Kind | Typical type | How it enters |
|------|--------------|---------------|
| Semantic | `semantic` / general | `add_memories` → mem0 facts |
| Procedural | `procedural` | GLM synthesis at session job; importance floor **8** |
| Reflection | `reflection` | Groq insights every **N** sessions; importance **9** |
| Crisis | `crisis` | `add_crisis_memory` — **not** identical metadata path to normal `add_memories` (see §8) |

**Prompt sections:** semantic / procedural / reflection headings from `MemoryRetriever._format_structured_memory_context` → `ctx["memory_context"]` → `{memory_context}` in system prompt.

---

## Write path

### 4.1 Periodic extraction (`add_memories`)

**Trigger:** `chat.py` → `_maybe_trigger_memory` increments counter; `get_hybrid_message_count(session_id)`; when `count % MEMORY_TRIGGER_INTERVAL == 0` (default **12**):

1. `fetch_last_n_messages(session_id, n=12, user_id=…)`  
2. Thread `memory_manager.add_memories(…)`  
3. `MemoryStore`: `mem0.add`; for `ADD` events → thread `_score_and_save_metadata` (Groq 1–10, crisis→10, procedural→max(8,s)) → `memory_metadata` + `user_memory_stats`  
4. `invalidate_has_memories_cache(user_id)`

**Hybrid count:** in-memory counter wins when **> 0**; else DB count (see `supabase_service.py`).

### 4.2 Session-end batch (`count % 36 == 0`)

`_run_session_end_jobs`: last **30** msgs; if **≥ 5** messages:

- `save_session_summary` (Gemini) → `session_summaries`  
- Procedural: scan last **15** msgs for coping keywords → maybe `synthesize_procedural_memory`  
- Reflections: if `should_generate_reflections` (`session_count % REFLECTION_INTERVAL_SESSIONS == 0`, default **5**) → thread `generate_reflections`  
- Screening: if **≥** `SCREENING_MIN_MESSAGES` (**8**)

**Not** tied to browser tab close unless client calls **`/chat/end-session`** or similar.

### 4.3 Game bridge

`_extract_game_insights_for_memory` → synthetic assistant lines → `add_memories` with `source: game_insights`.

### 4.4 Crisis

`crisis_manager` → thread `add_crisis_memory` (mem0 + crisis metadata).

### 4.5 Emotional trend

Not a durable Qdrant “memory row” for the trend sentence itself — computed from summaries, cached **600 s**, appended:

`📈 EMOTIONAL TREND (recent sessions): …`

*(Note: `MemoryStore` defines a 3600s TTL field for another cache path; active trend cache is in `MemoryReflection`.)*

---

## Read path (`retrieve_memories`)

**Params:** `query` text, `user_id`, `intent` (semantic cap).

| Step | Behavior |
|------|----------|
| 0 | `_has_any_memories` (Supabase); if **false** → return `""` (**no Qdrant**) |
| 1 | Parallel: `mem0.search(limit=MEMORY_OVERFETCH_LIMIT)` + load all `memory_metadata` for user |
| 2 | Per hit: `composite = 0.50·rel + 0.35·imp_norm + 0.15·recency`; drop if `< MEMORY_RELEVANCE_THRESHOLD` (0.25) |
| 3 | Sort; bucket semantic / procedural / reflection per `MEMORY_LIMIT_*` and procedural cap for non-therapeutic intents |
| 4 | Thread: bump `last_accessed_at` for retrieved ids |
| 5 | Format multi-block string; sanitize for prompt (see retriever) |

**Sanitize / bound:** `sanitize_memory_text_for_prompt` (injection patterns, max length).

**Failure:** any exception → `""` (chat continues).

---

## Eval trace

When `eval_trace_enabled_for_request()` and client header allow: `memory_injected`, `memory_context_preview`, `memory_char_len` in API JSON. **Production:** requires `ALLOW_EVAL_TRACE_IN_PROD` if `is_public_production()` — see `app/core/env_flags.py`.

---

## Constants (defaults in `constants.py`)

| Constant | Default | Role |
|----------|---------|------|
| `MEMORY_TRIGGER_INTERVAL` | 12 | Extraction cadence |
| `MEMORY_OVERFETCH_LIMIT` | 25 | Raw vector hits |
| `MEMORY_RELEVANCE_THRESHOLD` | 0.25 | Drop floor |
| Weights | 0.50 / 0.35 / 0.15 | relevance / importance / recency |
| `RECENCY_DECAY_RATE` | 0.999 | Hourly exponent base |
| `MEMORY_LIMIT_*` | 3 / 5 / 7 / 4 | casual / emotional / therapeutic / crisis semantic caps |
| `REFLECTION_INTERVAL_SESSIONS` | 5 | Reflection cadence |
| `REFLECTION_MAX_INSIGHTS` | 5 | Injected reflection bullets |

---

## Security & pitfalls

- **Isolation:** every path must use authenticated `user_id`; service-role DB reads must still filter `user_id` (+ `session_id` where applicable).  
- **Injection:** retrieved text is user-originated; sanitizer + policy + crisis path.  
- **Multi-worker:** hybrid counter can drift — know ops implications.  
- **Eval / localhost:** `memory_injected` false often = empty `memory_metadata` for `DEV_USER_ID` or `< 12` turns — see [`../EVALUATION.md`](../EVALUATION.md) + `scripts/seed_eval_memory.py`.

---

## Roadmap (compressed)

- **A — Observability:** retrieval hit rate, p95, Qdrant counts, empty-metadata rate.  
- **B — Retrieval:** multilingual embedder option, hybrid BM25, session_id boost, pinned “prefs” bullets.  
- **C — Writes:** crisis metadata parity with `add_memories`, explicit session-close hook, dedupe game/chat mem0 dupes.  
- **D — Architecture:** hot store + profile JSON + vectors + summaries; tune threshold from evals.

---

## End-to-end sketch

```
message → auth → intent + crisis gate → retrieve ∥ trend → ctx.memory_context
       → GLM reply → background: +1 counter → maybe mem0 / session jobs
```

Tests: [`../EVALUATION.md`](../EVALUATION.md).
