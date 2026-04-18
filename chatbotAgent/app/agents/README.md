# Agents layer — memory architecture (v2)

**Monorepo doc hub:** [`../../../docs/README.md`](../../../docs/README.md)

This document describes how **MindMitra’s memory system** works: structured writes, **MEMOIR** retrieval, session lifecycle, and decay. There is **no** env-based toggle between legacy and MEMOIR in runtime code anymore.

## Memory types (five)

| Type | What we store |
|------|----------------|
| **Semantic** | Stable facts about the user: role, preferences, long-running context. |
| **Episodic** | Time-bound events and situations: what happened, when it mattered. |
| **Affective** | Emotional patterns, tone-heavy disclosures, relationship warmth or strain. |
| **Relational** | How the user relates to others (friends, family, colleagues) when it affects support. |
| **Procedural** | What has helped before: coping steps, routines, therapist-style “what worked.” |

Reflection-style content is often folded toward **semantic** in composition for display grouping.

## Write path (structured pipeline)

On periodic boundaries (every **12** user-visible messages, plus checkpoints / session end), the store runs **`add_structured`**:

1. **SignalClassifier** — decides if the tail is *memory-worthy* and suggests candidate memory types.
2. **MemoryExtractor** — LLM-backed JSON extraction → `MemoryCandidate` list.
3. **QualityGate** — embedding similarity against recent vectors, injection checks, confidence / anchor rules, dedupe vs reinforce vs **contradiction** hints.
4. **MemoryCRUD** — inserts approved rows into **Qdrant** + **`memory_metadata`** in Supabase; logs **contradictions** into `memory_contradictions` when a new fact explicitly pairs against an existing memory id.

## Read path (MEMOIR)

Rough stages inside **`MemoryRetriever.fetch_memory_records`** (always MEMOIR; if **`memory_crud`** is missing on the store, the retriever falls back to a legacy-shaped record fetch for resilience only):

1. **Dense vector recall** — query embedding + Qdrant `query_points` filtered by `user_id`.
2. **Keyword / entity** — Supabase rows (e.g. procedural keyword matches) merged into the candidate pool.
3. **Recency** — recent structured rows merged.
4. **Merge + normalize** — single in-memory representation per memory id.
5. **MemorySuppressor** — filters low-confidence, decayed, or “too sensitive too early” items unless **crisis** intent overrides for sensitive memories.
6. **MEMOIRScorer** — weighted blend of similarity, affect match, momentum, reinforcement, intent–type fit, relationship safety.
7. **ContextComposer** — token-budgeted string with grouped headings (`About this person`, `Recent context`, etc.) and an intent-specific “session read” note (for **crisis**, includes **PRIORITY** safety language).

Crisis routing: sensitive memories can receive a **maximum score** so they stay near the top when the memoir intent is `crisis`.

## Session lifecycle

Implemented in **`SessionLifecycle`** (`app/core/session_lifecycle.py`):

- **`on_session_start(user_id, session_id)`** — ensures **`session_registry`** row; runs **profile load** and **proactive `retrieve_memories`** in parallel; caches a session memory snapshot when non-empty.
- **`on_message(messages, user_id, session_id, message_count, content_locale)`** — async registry message-count bump; every **12** messages triggers **`add_structured`** extraction; every **36** messages runs a checkpoint (`add_structured` + optional summary).
- **`on_session_end(messages, user_id, session_id)`** — final `add_structured`, **session summary** generation, registry end metadata, and occasional **narrative** refresh every 10 sessions.

## Decay

**`DecayEngine`** computes a **decay score** from type-specific decay constants, recency of access, reinforcement (access count), and confidence. A nightly / scheduled pass can **soft-delete** very low scores; fresh memories from a new session should **not** fall below the archival threshold immediately.

## Runtime configuration

**COMPASS** (response) and **MEMOIR** (memory) are **always** active in application code. Boot logs in **`app/main.py`** describe the stack; optional debug env vars include **`MM_MEMORY_TRACE`**, **`MM_MEMOIR_DEBUG`**, **`MM_PIPELINE_DEBUG`**.

## Known limitations & follow-ups

- **Crisis detection** in `SignalClassifier` is **phrase/rule-based**; it does not replace clinical risk assessment.
- **Structured extraction** depends on Groq + schema reliability; noisy chats produce fewer approved candidates.
- **Operational surface** — Qdrant + Supabase + extraction jobs must stay healthy for retrieval and writes.
- **Language** coverage is best-effort (`langdetect` + heuristics); low-resource languages may map to English pipelines.
- **Contradiction logging** records pairs for review; automated resolution policies are not implied.

For deployment sequencing, see **`MEMORY_CUTOVER.md`** in this directory.

---

## COMPASS response architecture (v2)

**COMPASS** is the internal name for the **response** stack (cognitive layer, `*-v2` paths, warm crisis templates, v2 system prompt) that works with **MEMOIR**. Operational notes live in **`docs/EVALUATION.md`** (COMPASS section) and repo **`CLAUDE.md`**.

### Overview

1. **CrisisManager** runs a **keyword sentinel** on every user turn (`safe` / `ambiguous` / `hard`). Hard matches can override the router to **crisis** before deeper work.
2. **Stage 1 (parallel):** **EmotionalArcReader** + cross-session trend run concurrently; arc is fed into **CognitiveLayer** (same `arc_reader` instance as the layer, for consistent scoring).
3. **CognitiveLayer** (Groq JSON + deterministic rules) merges **`cl_*`** into **`ctx`** (intent, risk, arc, interventions, **`cl_question_allowed`**, **`cl_memory_reference_allowed`**, language mirror, etc.).
4. **MEMOIR** `retrieve_memories` runs **after** cognitive so **E/I** scoring uses **`current_affect`** and cognitive intent; **ContextComposer** respects **`memory_reference_allowed`**.
5. **PipelineOrchestrator** dispatches **A / B / C / D** paths and fills **`intervention_directive`**, **`psychological_analysis`**, etc.
6. **ResponseGenerator** uses **`cl_*`** + **`RESPONSE_SYSTEM_PROMPT_V2`**. Intent is owned only by the cognitive layer (no separate IntentRouter in the pipeline).
7. **Post-stream:** **`OutputSafetyAuditor.run_async`** and **`EmotionalArcUpdater`** (daemon threads; must not block SSE).

### Cognitive layer — what it does / what it replaces

- **Does:** one structured Groq call (when not short-circuited by hard crisis), parses JSON, applies **ambiguous-sentinel** and **arc-based** risk adjustments, builds **intervention_sequence** and **MI move** hints, and writes **`cl_*`** into **`ctx`**.
- **Replaces:** legacy **AnalysisEngine** combined analysis on emotional/therapeutic paths. **Path dispatch** follows **cognitive intent** only.

### CrisisManager ↔ CognitiveLayer ↔ dispatch

- **`check_crisis_keywords`** runs in **`route_and_execute`**; the result is stored on **`ctx`** as **`_crisis_sentinel_for_cognitive`** (and **`_crisis_ambiguous_llm_cleared`** when the ambiguous LLM check cleared the hit). **`_run_cognitive_layer`** passes that into **`CognitiveLayer.analyze`** (no second keyword scan unless the sentinel was not pre-set).
- **Hard:** cognitive short-circuits without the Groq extractor; orchestrator sets **`D-crisis-warm`** + **`build_warm_crisis_response`** (**`app/core/crisis_templates.py`**, multi-variant).
- **Ambiguous:** gate may run **`crisis_llm_check`**; cognitive receives **`safe`** sentinel when cleared, with **`ambiguous_llm_cleared`** so **`risk_level`** can still bump **`low` → `moderate`** for attention.
### Emotional arc and MEMOIR

- **Within-session arc:** **`EmotionalArcReader`** (VADER + Hinglish markers) scores recent **user** turns and feeds **`arc_direction` / `arc_delta`** into the cognitive layer for **risk** and **question** policy (precomputed in parallel before the cognitive Groq call).
- **Cross-session trend:** **`memory_manager.get_emotional_trend`** is fetched in parallel with arc, then appended to **`memory_context`** after MEMOIR compose. **`EmotionalArcUpdater`** post-stream is the **write-side / logging** hook (see **`[ARC-UPDATE]`**).

### Post-stream hooks

- **`OutputSafetyAuditor`** and **`EmotionalArcUpdater`** run after both **`POST /chat`** and **`POST /chat/stream`** (non-blocking).

### Post-stream components and logging

| Component | Role | Log prefix / behaviour |
|-----------|------|-------------------------|
| **`OutputSafetyAuditor`** | Regex audit of the final model string; **non-blocking**. | **`[SAFETY-AUDIT]`** — **error** on critical patterns (e.g. self-harm method detail), **warning** on softer violations. |
| **`EmotionalArcUpdater`** | Persist / normalise arc metadata for analytics or future retrieval (implementation evolves). | **`[ARC-UPDATE]`** (or module logger) — should never raise into the request path. |

Regression coverage for the fixture set lives in **`tests/test_regression_existing_dataset.py`**; full in-process simulations in **`tests/test_integration_response_e2e.py`**.
