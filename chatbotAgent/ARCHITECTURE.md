# MindMitra Chatbot Agent — Architecture Reference

> **Version**: v2 (Intent-Routed Pipeline)  
> **Runtime**: FastAPI on Railway  
> **Language**: Python 3.12  
> **Last updated**: March 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Intent-Routed Pipeline (v2)](#3-intent-routed-pipeline-v2)
   - [Path A — Casual](#31-path-a--casual-1-llm-call)
   - [Path B — Emotional](#32-path-b--emotional-2-llm-calls)
   - [Path C — Therapeutic](#33-path-c--therapeutic-23-llm-calls)
   - [Path D — Crisis](#34-path-d--crisis-0-llm-calls)
4. [Crisis Safety System](#4-crisis-safety-system)
5. [Legacy Pipeline (v1)](#5-legacy-pipeline-v1)
6. [Feature Flags](#6-feature-flags)
7. [Memory Architecture](#7-memory-architecture)
8. [Agent Reference](#8-agent-reference)
9. [API Surface](#9-api-surface)
10. [Configuration Reference](#10-configuration-reference)
11. [File Structure](#11-file-structure)
12. [Deployment](#12-deployment)
13. [Logging & Observability](#13-logging--observability)

---

## 1. System Overview

MindMitra is a culturally-aware AI mental health companion for Indian youth (16–25). The backend is a FastAPI service that exposes a `/chat` endpoint consumed directly by the React/Vite frontend hosted on Vercel.

```
Vercel (React/Vite)
       │
       │  POST /chat  { user_message, session_id, personality, ... }
       ▼
Railway (FastAPI)  ←──── this repo
       │
       ├── IntentRouter (Groq)       — classify message intent
       ├── Crisis safety gate        — keyword + LLM check (always runs)
       │
       ├── Path A: Casual            — 1 GLM call
       ├── Path B: Emotional         — 1 Groq + 1 GLM
       ├── Path C: Therapeutic       — 1–2 GLM + optional Groq
       └── Path D: Crisis            — 0 LLM (hardcoded safe response)
               │
               ▼
        Supabase (postgres + pgvector)
        ├── chat_messages
        ├── sessions
        ├── memories (procedural / semantic / episodic)
        ├── user_contexts
        └── crisis_events
```

**Key design principles**:

- **No wasted LLM calls** — casual messages get 1 GLM call; only therapeutic messages pay the full 2–3 call cost.
- **Crisis cannot be bypassed** — the safety gate runs on every request regardless of intent classification.
- **Backward compatible** — the original 5-agent sequential pipeline is preserved behind a feature flag (`use_routed_pipeline: false`).
- **Zero API contract changes** — the `/chat` endpoint signature and response schema are identical to v1.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        process_chat()                               │
│  ┌─────────────┐                                                    │
│  │ Step 1      │  Build UserContext JSON envelope                   │
│  │ (sync)      │  Inject personality / language / session fields    │
│  └──────┬──────┘                                                    │
│         │                                                           │
│  ┌──────▼──────┐                                                    │
│  │ Step 2      │  Fetch session memories (Supabase)                 │
│  │ (sync)      │  procedural / semantic / episodic — top-k          │
│  └──────┬──────┘                                                    │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │ _route_and_execute()                                        │   │
│  │                                                             │   │
│  │  1. IntentRouter (Groq, temp=0, max_tokens=60)              │   │
│  │     → casual | emotional | therapeutic | crisis             │   │
│  │                                                             │   │
│  │  2. Crisis safety gate (keyword scan + optional LLM)        │   │
│  │     Hard keywords  → Path D immediately (no LLM)            │   │
│  │     Ambiguous kws  → lightweight Groq yes/no check          │   │
│  │     Safe           → pass through to intent-based path      │   │
│  │                                                             │   │
│  │  3. Dispatch                                                │   │
│  │     casual      → _path_light()   [A]                       │   │
│  │     emotional   → _path_standard() [B]                      │   │
│  │     therapeutic → _path_rich()    [C]                       │   │
│  │     crisis      → _crisis_fast_path() [D]                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│  ┌──────▼──────┐                                                    │
│  │ Step 8      │  Background: save UserContext to file + Supabase   │
│  │ (async)     │  Screening assessment (PHQ-9 / GAD-7 update)       │
│  │             │  Memory extraction trigger (≥12 unprocessed msgs)  │
│  └──────┬──────┘                                                    │
│         │                                                           │
│  ┌──────▼──────┐                                                    │
│  │ Return      │  { message, modality, confidence,                  │
│  │             │    processing_time, session_insights{...} }        │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Intent-Routed Pipeline (v2)

### 3.1 Path A — Casual (1 LLM call)

**Trigger**: `IntentRouter` returns `casual`.  
**Use case**: Greetings, jokes, idle chitchat, questions about the weather.  
**LLM calls**: 1 × GLM response-gen.

```
message ──► [intervention_directive: "casual companion, 1-3 sentences"]
                │
                ▼
         GLM response-gen
                │
                ▼
         ai_response (short, warm, no clinical framing)
```

`psychological_analysis` and `technique_selection` are set to minimal stubs (no LLM). The GLM system prompt receives the `intervention_directive` which forces short+casual output.

---

### 3.2 Path B — Emotional (2 LLM calls)

**Trigger**: `IntentRouter` returns `emotional`.  
**Use case**: "I'm so stressed", "My parents don't understand me", "Today was terrible".  
**LLM calls**: 1 × Groq combined-analysis, 1 × GLM response-gen.

```
message ──► _combined_emotion_cultural_analyse()   [Groq, max_tokens=180]
                │
                │  returns: {primary_emotion, intensity, cultural_pressure,
                │             language_style, user_needs, tone_match}
                ▼
         ctx fields populated (nlp_analysis, cultural_context,
                                psychological_analysis, technique_selection)
                │
                ▼
         _technique_directive(user_needs → intervention)   [pure Python]
                │
                ▼
         GLM response-gen  +  {intervention_directive}
                │
                ▼
         ai_response
```

**`_combined_emotion_cultural_analyse`** replaces the old separate NLP + cultural agents with a single Groq call that returns all needed fields in one JSON object.

---

### 3.3 Path C — Therapeutic (2–3 LLM calls)

**Trigger**: `IntentRouter` returns `therapeutic`.  
**Use case**: "I've been having panic attacks for months", "I can't stop overthinking every night".  
**LLM calls**: 1 × GLM psych-analysis (parallel with optional Groq crisis-check), 1 × GLM response-gen.

```
message ──► _check_crisis_keywords()   [pure Python, 0ms]
                │
                ├── "hard" ──► _crisis_fast_path()   [Path D, 0 LLM]
                │
                └── safe / ambiguous
                         │
                         ▼
              [ThreadPoolExecutor, max_workers=2]
                ├── _optimized_psych_analysis()     [GLM, ~40% lighter prompt]
                │     returns: {emotional_state, primary_stressor, risk_level,
                │                intervention, insight, cultural_factor}
                │
                └── _crisis_llm_check()             [Groq yes/no, only if ambiguous]
                         │
                         ▼
              risk_level == "crisis" or LLM says crisis
                ├── YES ──► _crisis_fast_path()   [Path D]
                │
                └── NO
                      │
                      ▼
               _technique_directive(intervention)   [pure Python]
                      │
                      ▼
               GLM response-gen  +  {intervention_directive}
                      │
                      ▼
               ai_response
```

**Parallelism**: psych analysis and crisis LLM check run in parallel via `ThreadPoolExecutor`. If no ambiguous keywords, the crisis LLM check is skipped (saving ~300ms).

---

### 3.4 Path D — Crisis (1 LLM call)

**Trigger**: Hard crisis keyword match OR crisis confirmed by LLM check OR `risk_level == "crisis"` from psych agent.  
**LLM calls**: 1 (GLM response gen in crisis mode)  
**Max latency**: ~600–900ms

```
message ──► _crisis_fast_path()
                │
                ├─ ctx["_crisis_mode"] = True
                ├─ set psychological_analysis / technique_selection stubs
                │    → {risk_assessment: "crisis", intervention_priority: "immediate"}
                └─ ResponseGenerator.generate() [GLM — crisis system prompt]
                     ├─ warm, non-alarmist acknowledgment
                     ├─ iCall India: 9152987821
                     └─ Vandrevala Foundation: 1860-2662-345
```

See [Section 4](#4-crisis-safety-system) for the full safety design.

---

## 4. Crisis Safety System

The crisis system has three independent layers that must **all** be bypassed to miss a crisis — making it extremely robust.

```
Layer 1: Hard keyword scan (pure Python, 0ms)
   ├── English: "kill myself", "want to die", "suicidal", "self harm", ...
   └── Hindi/Hinglish: "maar dunga", "khud ko maar", "marna chahta", ...
   ───────────────────────────────────────────
   If matched → Path D immediately.  IntentRouter result is IGNORED.

Layer 2: Ambiguous keyword → LLM disambiguation (Groq, ~200ms)
   ├── "suicide" (avoids false-positives on "suicide rates", "suicide prevention")
   ├── "hopeless", "worthless", "end it all", "can't go on", ...
   └── Ask model "yes/no: does this express self-harm intent?"
   ───────────────────────────────────────────
   If LLM says yes → Path D.  IntentRouter result is IGNORED.

Layer 3: Clinical risk assessment (GLM, Path C only)
   └── _optimized_psych_analysis returns risk_level = "crisis"
   ───────────────────────────────────────────
   If risk_level == "crisis" → escalate to Path D mid-path.
```

**The safety gate cannot be bypassed** because `_route_and_execute` is the only entry point to any execution path when `use_routed_pipeline=True`. All crisis checks happen before dispatch.

**Crisis events** are logged to `crisis_events` (Supabase) with `user_id`, `level`, and `source` fields for clinical review.

---

## 5. Legacy Pipeline (removed in v2)

The v1 5-agent sequential pipeline has been removed. Files `psychologist_agent.py` and `technique_agent.py` are kept for reference but are **not wired** into any pipeline path. `CulturalContextModule` is instantiated but its `.analyse()` method is not called (cultural analysis is done inline in Path B via Groq).

> To restore any part of the legacy pipeline, use the agent files as starting points and wire them into `workflow.py`.

---

## 6. Feature Flags

All flags live in `config.yaml` under the `features:` section and are loaded at startup into `self.feature_flags` (a plain dict).

| Flag | Default | Effect |
|------|---------|--------|
| `nlp_analysis` | `true` | Enable `GroqNLPModule` (Path B/C routing) |
| `cultural_context` | `true` | Instantiate `CulturalContextModule` |
| `screening_assessments` | `true` | Enable background PHQ-9 / GAD-7 scoring |
| `save_to_supabase` | `true` | Persist session context to Supabase |
| `user_contexts_table` | `true` | Write to `user_contexts` table |
| `parallel_processing` | `true` | Use ThreadPoolExecutor in pipeline |
| `context_caching` | `true` | Cache session context in memory |

---

## 7. Memory Architecture

MindMitra uses **mem0** (managed memory layer) backed by **Qdrant** (vector store) for long-term user memory, plus **Supabase** for session summaries and memory stats.

```
User message
    │
    ▼
memory_manager.retrieve_memories(query, user_id, intent)
    └─ mem0.search() → Qdrant ANN search
           └─ returns formatted string → ctx["memory_context"]

(after response sent — background thread)
memory_manager.add_memories(user_id, session_id, messages)
    └─ mem0.add() → OpenAI gpt-4o-mini extracts facts
           └─ text-embedding-3-small → Qdrant upsert
```

**Qdrant collection**: `companion_memories` (default)  
**Embedding model**: OpenAI `text-embedding-3-small`  
**Fact extraction**: OpenAI `gpt-4o-mini`  
**Session summaries**: Gemini → Supabase `sessions` table  
**Memory stats**: `user_memory_stats` table in Supabase

**Required env vars**: `QDRANT_HOST`, `QDRANT_PORT`, `QDRANT_COLLECTION`, `OPENAI_API_KEY`

**Debug endpoint**: `GET /debug/memory?user_id=<uid>` — shows mem0 readiness + user stats.

---

## 8. Agent Reference

### Active in v2 (Routed Pipeline)

| Agent / Module | File | Purpose | LLM |
|---|---|---|---|
| `IntentRouter` | `agents/intent_router.py` | Classify: casual/emotional/therapeutic/crisis | Groq |
| `GroqNLPModule` | `agents/nlp_agent.py` | Groq client reused by Path B analysis + crisis check | Groq |
| `ResponseGenerator` | `agents/response_agent.py` | Generate final response with personality + memory | GLM |
| `_combined_emotion_cultural_analyse` | `pipeline/workflow.py` | Path B: emotion + cultural analysis in one call | Groq |
| `_optimized_psych_analysis` | `pipeline/workflow.py` | Path C: clinical assessment + mem0 context | GLM |
| `_crisis_llm_check` | `pipeline/workflow.py` | Ambiguous crisis disambiguation (yes/no) | Groq |
| `MemoryManager` | `agents/memory_manager.py` | mem0 + Qdrant read/write | OpenAI + Gemini |

### Active in Background (after response sent)

| Agent / Module | File | Purpose | LLM |
|---|---|---|---|
| `ScreeningAssessmentAgent` | `agents/screening_agent.py` | PHQ-9 / GAD-7 background estimate | Groq + GLM |
| `MemoryManager.add_memories` | `agents/memory_manager.py` | Extract facts → Qdrant | OpenAI gpt-4o-mini |
| `MemoryManager.save_session_summary` | `agents/memory_manager.py` | Summarise session → Supabase | Gemini |

### Instantiated but Not Active in v2

| Agent | File | Status |
|---|---|---|
| `CulturalContextModule` | `agents/cultural_agent.py` | Instantiated; `.analyse()` unused (cultural analysis done inline via Groq) |
| `PsychologistAnalysisAgent` | `agents/psychologist_agent.py` | Not wired; kept for reference |
| `TechniqueSelectorAgent` | `agents/technique_agent.py` | Not wired; kept for reference |

---

## 9. API Surface

### `POST /chat`

Primary endpoint. Called by the React frontend with every user message.

**Request body** (`ChatRequest`):

```json
{
  "message": "I've been feeling really anxious lately",
  "session_id": "uuid-v4",
  "user_id": "uuid-v4",
  "recent_messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "personality": "mitra",
  "companion_name": "Mitra",
  "language": "english",
  "voice_analysis": null
}
```

**Response body**:

```json
{
  "message": "I hear you...",
  "modality": "Validation",
  "confidence": 0.9,
  "processing_time": 1.43,
  "voice_aware": false,
  "session_insights": {
    "emotional_state": "anxious",
    "stress_categories": ["Academic"],
    "therapeutic_approach": "Validation",
    "cultural_pressures": "exam",
    "language_style": "english",
    "psychological_insights": ["..."],
    "intervention_priority": "supportive",
    "activity_recommendations": [],
    "nlp_analysis": { ... },
    "cultural_context": { ... },
    "technique_rationale": "...",
    "performance_metrics": { ... }
  }
}
```

### `GET /health`

Returns service health, model availability, and pipeline version.

### `POST /transcribe`

Speech-to-text via Google Cloud STT. Accepts audio blob, returns transcript.

### `POST /onboarding`

Saves initial onboarding data for a new user session.

---

## 10. Configuration Reference

`config.yaml` is the single source of truth for all runtime configuration. Loaded at startup by `app/core/config.py`.

```yaml
# Key sections
features:
  use_routed_pipeline: true        # v2 routed vs v1 legacy
  parallel_processing: true
  use_routed_pipeline: true

glm_controller:
  model: glm-4-32b-0414-128k       # ZhipuAI GLM model
  temperature: 0.7
  max_tokens: 1024

nlp_module:
  model: qwen/qwen3-32b            # Groq model for NLP + IntentRouter
  temperature: 0.0

response_generator:
  recent_messages_count: 3         # How many prior turns fed to GLM
  max_memories_per_type: 3         # Memories per type in GLM context

rag_memory:
  enabled: true
  top_k: 5
  confidence_threshold: 0.6
```

---

## 11. File Structure

```
chatbotAgent/
├── app/
│   ├── agents/
│   │   ├── intent_router.py         ← v2: Groq-based 4-class intent classifier
│   │   ├── memory_manager.py        ← v2: mem0 + Qdrant long-term memory
│   │   ├── response_agent.py        ← v2: GLM final response (5 companions)
│   │   ├── nlp_agent.py             ← v2: GroqNLPModule (client reused by router)
│   │   ├── cultural_agent.py        ← instantiated, analyse() unused in v2
│   │   ├── screening_agent.py       ← background: PHQ-9/GAD-7 estimates
│   │   ├── psychologist_agent.py    ← not wired (kept for reference)
│   │   └── technique_agent.py       ← not wired (kept for reference)
│   ├── api/
│   │   ├── chat.py                  ← POST /chat
│   │   ├── health.py                ← GET /health, GET /debug/memory
│   │   ├── onboarding.py            ← POST /onboarding
│   │   └── transcribe.py            ← POST /transcribe
│   ├── controllers/
│   │   └── glm_controller.py        ← Thread-safe ZhipuAI wrapper + Groq fallback
│   ├── core/
│   │   ├── config.py                ← config.yaml + env-var loader
│   │   ├── auth.py                  ← Supabase JWT verification
│   │   └── logging.py               ← Compact log format + third-party suppression
│   ├── models/
│   │   ├── request_models.py
│   │   └── response_models.py
│   ├── pipeline/
│   │   ├── workflow.py              ← MindMitraWorkflow — main orchestrator
│   │   └── context.py               ← create_empty_user_context()
│   ├── services/
│   │   ├── tts_service.py
│   │   └── greeting_service.py
│   └── utils/
│       └── json_utils.py
├── config.yaml                      ← All runtime non-secret configuration
├── .env                             ← Secrets (never commit)
├── .env.example                     ← Template for all required vars
├── ARCHITECTURE.md                  ← This file
├── Procfile
└── requirements.txt
```

---

## 12. Deployment

### Railway (backend)

```bash
# Required environment variables on Railway:
GROQ_API_KEY=...
ZAI_API_KEY=...           # ZhipuAI / GLM key
OPENAI_API_KEY=...        # mem0 fact extraction
GOOGLE_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
QDRANT_HOST=qdrant.railway.internal   # private Railway networking
QDRANT_PORT=6333
QDRANT_COLLECTION=companion_memories
GOOGLE_CREDENTIALS_BASE64=...         # base64-encoded service account JSON
```

The `Procfile` defines: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Vercel (frontend)

```bash
# .env.local or Vercel dashboard:
VITE_BACKEND_URL=https://your-app.railway.app
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The frontend calls `VITE_BACKEND_URL/chat` directly — **not** through Supabase Edge Functions. Edge Function paths exist in the codebase but are effectively dead code.

---

## 13. Logging & Observability

The v2 pipeline emits structured logs at every decision point. Log format: `HH:MM:SS L <message>` (L = single char: D/I/W/E). Set `LOG_LEVEL=DEBUG` to see all API call timings.

Third-party loggers (httpx, groq, openai, zhipuai, qdrant_client, mem0, urllib3, etc.) are suppressed to WARNING so the terminal only shows application logs.

### Sample INFO-level trace for a single request

```
══════════════════════════════════════════════════════════════
  🚀 MINDMITRA PIPELINE START
  user=abc12345    session=f3a9b2c1
  personality=mitra  lang=english
  pipeline=ROUTED (v2)
  msg_len=47  recent=4
══════════════════════════════════════════════════════════════
🤖 [ROUTER] IntentRouter → intent='emotional' confidence=0.87 (Groq qwen/qwen3-32b)
🔍 [CRISIS-SCAN] keyword scan → 'safe'
✅ [CRISIS-GATE] No crisis signal detected
🗺️  [ROUTER] DISPATCH → path=B (emotional) [router_time=231ms]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️  [PATH-B] ▶  EXECUTING: emotional/standard path (1 Groq + 1 GLM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📞 [PATH-B] Calling Groq combined-analysis (model=qwen/qwen3-32b)...
✅ [COMBINED-ANALYSIS] Groq 312ms | emotion=anxious intensity=0.75 lang=english needs=validation
  ✅ [PATH-B] Groq combined-analysis done in 312ms
  🧩 [PATH-B] Analysis complete: emotion=anxious intensity=0.75 needs=validation lang=english directive='validate'
  📞 [PATH-B] Calling GLM response-gen (model=glm-4-32b-0414-128k)...
  ✅ [PATH-B] GLM response-gen done in 891ms | response=284 chars
══════════════════════════════════════════════════════════════
  ✅ MINDMITRA PIPELINE COMPLETE
  path=B-emotional  total_time=1.53s
  emotion=anxious  risk=low
  technique=Validation  intervention=validation
  response_len=284
══════════════════════════════════════════════════════════════
```

### Log tag reference

| Tag | Level | Meaning |
|-----|-------|---------|
| `[ROUTER]` | INFO | Intent classification + dispatch decision |
| `[CRISIS-SCAN]` | DEBUG | Keyword scan result |
| `[CRISIS-GATE]` | INFO/WARN | Crisis gate decision |
| `[PATH-A/B/C/D]` | INFO | Path execution steps |
| `[COMBINED-ANALYSIS]` | INFO | Groq combined emotion/cultural call |
| `[PSYCH-OPT]` | INFO | GLM optimised psych analysis |
| `[CRISIS]` | CRITICAL | Crisis fast-path triggered |
| `[LEGACY]` | INFO | Legacy pipeline steps |
| `[RAG]` | INFO | Memory retrieval |
| `[BACKGROUND]` | INFO | Background memory extraction |

### Verifying the system is not stuck on fallback

If every request logs `path=B-emotional confidence=0.50` with `⚠️ [ROUTER] IntentRouter unavailable`, the Groq client failed to initialize. Check:

1. `GROQ_API_KEY` is set and valid.
2. `nlp_analysis: true` in `config.yaml`.
3. The `GroqNLPModule` constructor didn't throw during `__init__`.

If every request routes to `path=B-emotional` with `confidence < 0.6`, the IntentRouter model may be returning malformed JSON — check `parse_json_from_llm_output` logs.
