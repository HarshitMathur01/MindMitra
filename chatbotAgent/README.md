# MindMitra Backend — Multi-Agent Therapeutic Pipeline

> FastAPI backend for MindMitra. Intent-routed multi-agent pipeline with mem0 long-term memory, 11 therapeutic emotion detection, PHQ-9/GAD-7 clinical screening, and Chain-of-Experts reasoning.
>
> **Python 3.12 · FastAPI 0.115 · uvicorn · ~6,000 lines across 24 files**

---

## Architecture Overview

```
POST /chat → auth.py (JWT verify) → chat.py (endpoint)
                                        │
                              workflow.py (MindMitraWorkflow.process_chat)
                                        │
                              ┌─────────┼──────────────┐
                              │         │              │
                        Build UserContext   Fetch memories   Fetch screening scores
                        (context.py)       (memory_manager)  (supabase_service)
                              │         │              │
                              └─────────┼──────────────┘
                                        │
                               IntentRouter.classify() (Groq qwen3-32b)
                               + screening_hint injection
                               + activity awareness
                                        │
                    ┌──────────────┬─────┴──────┬─────────────┐
                    ▼              ▼            ▼             ▼
              Path A           Path B       Path C        Path D
              casual           emotional    therapeutic   crisis
              ─────            ────────     ──────────    ──────
              1 GLM call       1 Groq      1-2 GLM       0 LLM
              150 tokens       + 1 GLM     + opt. Groq   template response
                               300 tok     500 tok       safety resources
                    │              │            │             │
                    └──────────────┴────────────┘             │
                                   │                          │
                    ┌──────────────┤                          │
                    ▼              ▼                          │
              Detect emotion  Build response                  │
              (11 types)      (text only)                     │
                    │              │                          │
                    └──────────────┴──────────────────────────┘
                                   │
                          ChatResponse JSON
                    (message + emotion + animation + insights)

Note: TTS and lip-sync run entirely in the browser (frontend iframe).
The backend sends only text + emotion metadata — no audio generation.

Background threads (daemon, non-blocking):
  ├─ Memory extraction (every 12 messages, Groq + Qdrant)
  ├─ Session summary (every 36 messages, Gemini)
  ├─ PHQ-9/GAD-7 scoring (session-end, EMA-smoothed)
  ├─ Procedural synthesis (coping keyword trigger)
  ├─ Reflection generation (every 5 sessions)
  └─ Game→mem0 bridge (activity therapeutic insights)
```

---

## Module Reference

| Module | File | Lines | LLM Provider | Purpose |
|---|---|---|---|---|
| **Pipeline Orchestrator** | `app/pipeline/workflow.py` | 1,092 | — | The brain: routing, paths, crisis |
| **UserContext Builder** | `app/pipeline/context.py` | 93 | — | JSON envelope for pipeline |
| **Intent Router** | `app/agents/intent_router.py` | 141 | Groq qwen3-32b | 4-class message classification |
| **Response Generator** | `app/agents/response_agent.py` | 442 | ZhipuAI GLM-4-32b | CoE reasoning + personality + response |
| **Memory Manager** | `app/agents/memory_manager.py` | 1,321 | Groq llama-3.3 + local embeddings | Composite-scored retrieval, reflections |
| **Screening Agent** | `app/agents/screening_agent.py` | 232 | Groq llama-3.3 | PHQ-9/GAD-7 with EMA |
| **NLP Agent** | `app/agents/nlp_agent.py` | 48 | Groq qwen3-32b | Client factory only |
| **GLM Controller** | `app/controllers/glm_controller.py` | 174 | ZhipuAI (Groq fallback) | Thread-safe LLM wrapper |
| **Chat Endpoints** | `app/api/chat.py` | 493 | — | POST /chat, /chat/stream, GET /greeting, _detect_emotion() |
| **Supabase Service** | `app/services/supabase_service.py` | 233 | — | All DB operations |
| **Greeting Service** | `app/services/greeting_service.py` | 228 | — | Time/personality/continuity greetings |
| **Config** | `app/core/config.py` | 226 | — | config.yaml + env-var loader |
| **JSON Utils** | `app/utils/json_utils.py` | 136 | — | 4-tier LLM output parser |
| **Constants** | `app/utils/constants.py` | 80 | — | All magic numbers (35+) |
| **Boot/CORS** | `app/main.py` | 134 | — | FastAPI factory, health-first boot |

---

## Quick Start

```bash
# 1. Python environment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Environment
cp .env.example .env
# Required: SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET,
#           GROQ_API_KEY, ZAI_API_KEY, GOOGLE_API_KEY.

# 3. Qdrant (local)
docker run -d -p 6333:6333 qdrant/qdrant

# 4. Run (http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

---

## Environment Variables

**Required for core functionality:**
```
SUPABASE_URL            → Supabase project URL
SUPABASE_KEY            → Supabase service role key
SUPABASE_JWT_SECRET     → JWT verification secret
GROQ_API_KEY            → NLP, routing, screening, mem0, importance, reflections, trend
ZAI_API_KEY             → ZhipuAI GLM-4 response gen + psych analysis + procedural
GOOGLE_API_KEY          → Gemini session summaries
QDRANT_HOST             → localhost (local) or qdrant.railway.internal (Railway)
```

**Optional (with fallbacks):**
```
QDRANT_PORT                 → Default: 6333
QDRANT_COLLECTION           → Default: companion_memories
LOG_LEVEL                   → Default: INFO
SKIP_AUTH                   → Default: false (MUST be false in production)
CORS_ALLOW_ORIGINS          → Extra allowed origins (comma-separated)
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/chat` | JWT | Main chat (text + emotion + insights) |
| `POST` | `/chat/stream` | JWT | SSE streaming (text_chunk, avatar_ready, complete) |
| `GET`  | `/chat/greeting` | JWT | Personalized session-start greeting |
| `GET`  | `/health` | None | Health check (registered before heavy imports) |
| `POST` | `/transcribe` | JWT | Groq Whisper fallback STT (base64 WAV, requires `GROQ_API_KEY`) |
| `POST` | `/api/onboarding/generate` | JWT | Dynamic onboarding question generation |

---

## Key Constants (`utils/constants.py`)

| Constant | Value | Purpose |
|---|---|---|
| `MEMORY_TRIGGER_INTERVAL` | 12 | Messages between memory extractions |
| `SCREENING_MIN_MESSAGES` | 8 | Min messages before screening |
| `SCREENING_EMA_ALPHA` | 0.6 | EMA weight (60% new + 40% historical) |
| `SCORE_WEIGHT_RELEVANCE` | 0.50 | Memory composite: relevance weight |
| `SCORE_WEIGHT_IMPORTANCE` | 0.35 | Memory composite: importance weight |
| `SCORE_WEIGHT_RECENCY` | 0.15 | Memory composite: recency weight |
| `MEMORY_LIMIT_CASUAL` | 3 | Max memories for casual intent |
| `MEMORY_LIMIT_EMOTIONAL` | 5 | Max memories for emotional intent |
| `MEMORY_LIMIT_THERAPEUTIC` | 7 | Max memories for therapeutic intent |
| `MEMORY_LIMIT_CRISIS` | 4 | Max memories for crisis intent |
| `EMBEDDING_DIMS` | 384 | all-MiniLM-L6-v2 vector dimensions |
| `REFLECTION_INTERVAL_SESSIONS` | 5 | Generate reflections every N sessions |

---

## Background Jobs

| Trigger | Interval | Job | Agent |
|---|---|---|---|
| Message count | Every 12 msgs | Memory extraction (fetch last 12 msgs → mem0) | `memory_manager.add_memories()` |
| Message count | Every 36 msgs | Session-end jobs (summary + synthesis + reflection + screening) | `_run_session_end_jobs()` |
| Game detected | On activity | Game→mem0 bridge (store game insights as memories) | `_extract_game_insights_for_memory()` |
| Coping keywords | Session-end | Procedural synthesis (extract coping strategies) | `memory_manager.synthesize_procedural_memory()` |
| Session milestone | Every 5 sessions | Reflection generation (cross-session insights) | `memory_manager.generate_reflections()` |

---

## Configuration

`config.yaml` (193 lines) defines model names, temperatures, max tokens, system prompts, and feature flags. Environment variables are substituted via `${VAR_NAME}` syntax.

Key sections: `api_keys`, `nlp_module`, `glm_controller`, `screening_assessments`, `memory`, `response_generator`, `workflow`, `features` (8 flags), `performance`, `debug`.

`Config` class (singleton): `config.get("nlp_module.model")` for dot-notation access, `config.get_api_key("groq")` for keys, `config.reload()` for hot-reload.

---

## Docker Build

```bash
docker build -t mindmitra-backend .
docker run -p 8080:8080 --env-file .env mindmitra-backend
```

**Dockerfile**:
- Multi-stage build (builder + runtime)
- PyTorch CPU-only (~200MB vs ~2GB)
- `all-MiniLM-L6-v2` pre-baked at build time (~90MB, zero cold-start download)
- Runtime: `python:3.12-slim`

---

## Deployment (Railway)

1. Add **Qdrant** service (Docker: `qdrant/qdrant`)
2. Add **Backend** service (root: `chatbotAgent`, auto-detects Dockerfile)
3. Set environment variables
4. Set `QDRANT_HOST=qdrant.railway.internal`
5. Railway builds and deploys automatically

**`railway.toml`**: health check path `/health`, 40s timeout, 60s start period, 1 replica.
**`Procfile`**: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## Deep References

| Document | What's In It |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Complete backend architecture (1894 lines): every function signature, every LLM call, every prompt template, every constant, every database table, boot sequence, module dependency graph |
| [`docs/MEMORY_ARCHITECTURE.md`](docs/MEMORY_ARCHITECTURE.md) | Memory system deep dive: composite scoring formula, retrieval pipeline, reflections, procedural synthesis, emotional trend, session summaries, game→mem0 bridge |

---

## License

Private repository. All rights reserved.
