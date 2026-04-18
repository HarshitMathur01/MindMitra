# Unified Architecture Checklist (COMPASS × MEMOIR)

This checklist is the **runtime source-of-truth** derived from `chatbotAgent/detailedArchitecture/MindMitra_Unified_Architecture.pdf` (39 pages). Code, tests, and docs should align with the items below.

## COMPASS — Request lifecycle (8 stages)

- **Stage 0 (sequential, blocks stream)**: JWT validation, rate limit, session resolve.
  - **Target latency**: ~10ms
- **Stage 1 (parallel, blocks stream)**: run these concurrently:
  - **1A Crisis Sentinel**: `CrisisManager.check_crisis_keywords()` (deterministic regex/keyword).
    - **Target latency**: ~1ms
  - **1B MEMOIR retrieval**: returns **MEMOIR-scored top-7** memories for this turn.
    - **Target latency**: ~80ms
  - **1C EmotionalArcReader**: pure Python, VADER + Hinglish markers.
    - **Target latency**: ~3ms
- **Stage 2 (sequential, blocks stream)**: **Cognitive Layer** — one Groq call (`Qwen-32b`) producing structured JSON.
  - **Target latency**: ~150ms
- **Stage 3 (sequential, blocks stream)**: Context Assembler — `ContextComposer` output + `_build_system_prompt_v2`.
  - **Target latency**: ~10ms
- **Stage 4 (stream begins)**: `ResponseGenerator` (Azure/GLM) with `stream=True`.
  - **Target latency**: ~400ms to first token
- **Stage 5**: SSE stream to client (live; does not block).
- **Stage 6 (post-stream, daemon threads)**: never block response:
  - **6A Memory write pipeline**: `SignalClassifier → MemoryExtractor → QualityGate → CRUD`
  - **6B OutputSafetyAuditor.run_async()**: regex harm scan of generated text
  - **6C EmotionalArcUpdater**: logs arc delta post-stream
  - **6D SessionLifecycle.on_message()`**: message_count++, checkpoints

## Cognitive Layer (Stage 2) — Spec

- **One call per message**: Groq model **Qwen-32b** (same client instance; no new connections).
- **LLM parameters**: temperature **0.1**, max_tokens **256**, timeout **8.0s**.
- **Hard crisis skip**: if crisis sentinel is `hard`, skip LLM call and treat as confirmed crisis.
- **LLM output schema**:
  - `intent`: `venting | advice | casual | reflect | update | crisis`
  - `primary_emotion`: one word (e.g. anxious, sad, overwhelmed, hopeful)
  - `emotional_valence`: float in [-1.0, 1.0]
  - `emotional_intensity`: float in [0.0, 1.0]
  - `risk_level`: `low | moderate | elevated | crisis`
  - `language_mirror`: `en | hi | hinglish`
  - `cultural_context`: short note or empty
  - `confidence`: float in [0.0, 1.0]
- **Deterministic overrides (post-LLM)**:
  - hard sentinel → force `intent=crisis`, `risk_level=crisis`
  - ambiguous sentinel + `risk_level=low` → escalate to `moderate`
  - arc_delta < -0.4 → escalate risk by one tier
  - failure/parse error → fallback `intent=emotional`, `risk_level=moderate`, set `fallback_used=True`
- **Downstream derivations** (pure Python maps; no additional LLM calls):
  - `intervention_sequence` from `(risk_level, intent)`
  - `mi_move` from `intent`
  - `response_length` from `intent`
  - `question_allowed` from compound rule (false on venting/crisis, or falling arc + high intensity)
- **ctx keys injected**: 14 `cl_*` fields
  - `cl_intent`, `cl_primary_emotion`, `cl_emotional_valence`, `cl_emotional_intensity`, `cl_arc_trajectory`,
    `cl_arc_delta`, `cl_risk_level`, `cl_intervention_sequence`, `cl_response_length`, `cl_question_allowed`,
    `cl_language_mirror`, `cl_mi_move`, `cl_cultural_context`, `cl_fallback_used`

## Path dispatch (A/B/C/D)

- **D-crisis-warm**: `cl_risk_level='crisis'` OR `cl_intent='crisis'`
  - Static warm templates by **language × severity**; ResponseGenerator must **not** be called.
  - `ctx['response_generated']=True`.
- **A-casual**: `cl_intent='casual'` (uses real `cl_risk_level`, no dummy low injections).
- **B-emotional**: `cl_intent in ('venting','emotional','reflect','update')`.
- **C-therapeutic**: `cl_intent='advice'` or other.
- **No IntentRouter. No AnalysisEngine.** They are removed.

## Response prompt v2

- `RESPONSE_SYSTEM_PROMPT_V2` is the **sole active template**.
- Total prompt budget ~880 tokens, with **memory_context hard cap 550 tokens** (ContextComposer enforces).
- `intervention_directive` is built from `cl_intervention_sequence` and must include:
  - step formatting
  - “Do NOT ask any question this turn” when `cl_question_allowed=False`
  - Hinglish mirroring note when `cl_language_mirror='hinglish'`
  - falling arc note prefers warmth over advice

## MEMOIR — memory system (taxonomy, storage, retrieval)

### Taxonomy (5 types)
- `identity`: stable personal facts (2y retention, λ=0.001)
- `preference`: how they like to be treated (1y, λ=0.002)
- `behavioral`: observed patterns (180d, λ=0.005)
- `emotional`: cross-session emotional history (1y acute; grief longer; crisis permanent; λ=0.004)
- `contextual`: ongoing situations (90d, λ=0.008)

### Storage layers
- **Layer 1 Qdrant**:
  - embedding model: **BAAI/bge-m3**, **1024 dim**
  - query embeddings use **is_query=True** and prepend BGE retrieval prefix
  - collection: `companion_memories`; isolation via `user_id` payload filter
- **Layer 2 Supabase (Postgres)**: source of truth for metadata + governance
  - tables: `memory_metadata`, `memory_contradictions`, `session_registry`, `user_memory_profile`, `session_summaries`
  - append-only + soft delete (`is_active=false`); no hard deletes unless explicit user request
- **Layer 3 Redis** (required for multi-worker):
  - `user:{id}:memory_context` TTL 600s
  - `user:{id}:has_memories` TTL 120s
  - `user:{id}:session_buffer` TTL session duration + 30m
  - **Known bug** if counters are in-memory; must use Redis INCR before multi-worker scaling.

### Retrieval pipeline (5 stages)
- **Stage 0**: short-circuit via `has_memories` key; cache miss → COUNT on `memory_metadata`.
- **Stage 1**: query understanding
  - embed user message with BGE-M3 (`is_query=True`)
  - expand emotional vocab; prepend intent label; named entities; Hinglish normalization
- **Stage 2 (parallel, 3 threads)**:
  - A dense Qdrant top-25 (filter user_id + is_active)
  - B keyword/structured Supabase (tags/entities + behavioral), limit ~15
  - C recency Supabase: last_accessed desc, limit 5
- **Stage 3**: MemorySuppressor hard filters
  - suppress inactive, decay_score<0.08, confidence<0.35
  - suppress sensitive memories early in relationship unless intent=crisis
  - suppress resolved emotional memories unless explicitly referenced
- **Stage 4**: MEMOIR composite scoring (6 dimensions): \(S = 0.25M + 0.20E + 0.15Mm + 0.15O + 0.15I + 0.10R\)
  - hard floor: **drop if S < 0.25**
  - resolved emotional memories: intensity halved in scoring
  - crisis override: sensitive crisis memories pin to top
- **Stage 5**: select **top-7**, with diversity max 3/type; reinforce selected async.

### Memory injection (ContextComposer)
- Output format is a warm internal briefing:
  - “WHAT YOU KNOW ABOUT THIS PERSON”
  - About them (identity + preferences) **never truncated**
  - Active contextual memories; behavioral coping that worked; emotional/identity; patterns (only after session_count thresholds)
  - One-line recent emotional trend
- Token budget: hard cap **550** tokens; truncate lowest-score up.
- Narrative mode (session >= 15): use `user_memory_profile.narrative_paragraph` instead of bullet list.
- Injection gate: when `cl_question_allowed=False`, suppress episodic/affective sections (only procedural + relational context).
- Sanitization: strip HTML/XML tags, injection patterns, control chars; truncate bullets >200 chars; strip URLs/paths.

## Memory creation (post-stream)

- **SignalClassifier** (pure Python, <5ms) triggers on:
  - first-person statements, named entities, emotional intensity markers, explicit disclosures, resolution statements
  - any message with intensity > 0.7 triggers immediate extraction
  - crisis language always triggers
- **MemoryExtractor**: single LLM call model `claude-haiku-4-5`, structured candidates, verbatim_anchor mandatory, max 6.
- **QualityGate**:
  - reject confidence <0.45 or missing anchor
  - injection sanitizer
  - dedupe: cosine>0.91 reinforce; 0.75–0.91 possible_duplicate
  - contradictions: log to `memory_contradictions`
  - sensitive + intensity>0.8: confidence floor 1.0
- **Triggers**:
  - intensity>0.7: immediate extraction
  - every 12 messages: extract last 12
  - every 36: extract + Gemini session summary
  - `/chat/end-session`: final extraction + summary + end session_registry
  - every 10 sessions: narrative synthesis into `user_memory_profile.narrative_paragraph`
  - nightly: DecayEngine recompute, archive <0.10, soft-delete <0.05; crisis never auto-archived

