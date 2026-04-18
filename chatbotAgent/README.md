# MindMitra Backend (`chatbotAgent`)

> **FastAPI** service: authenticated chat (JSON + SSE), onboarding, therapist bridge, voice transcription. **COMPASS** (cognitive layer + v2 paths) drives response shaping; **MEMOIR** (structured extraction + scored retrieval) drives longitudinal memory. Crisis handling is template-first (**D-crisis-warm**) with deterministic keyword gating.
>
> **Canonical docs:** [`../docs/README.md`](../docs/README.md) — start there for architecture, memory, API contracts, logging, and ops.

**Python 3.12 · FastAPI · uvicorn**

---

## Architecture overview (current)

```
POST /chat | /chat/stream
  → JWT + rate limit (chat.py)
  → fetch_user_context (+ summaries, activities)
  → MindMitraWorkflow.process_chat
       → PipelineOrchestrator.route_and_execute
            → IntentRouter (Groq) + CrisisManager keyword/LLM gate
            → retrieve_memories ∥ get_emotional_trend (timeout from config.yaml)
            → CognitiveLayer (COMPASS) → cl_* fields on ctx
            → A-casual-v2 | B-emotional-v2 | C-therapeutic-v2 | D-crisis-warm
            → ResponseGenerator (v2 prompt) except D-crisis-warm
  → ChatResponse (text + avatar metadata only — no server-side audio)

Background (daemon, non-blocking):
  ├─ SessionLifecycle: registry bump; add_structured every 12 msgs; checkpoint every 36
  ├─ Session summaries / procedural / reflections / screening (see docs/backend/MEMORY_ARCHITECTURE.md)
  └─ Game → add_memories bridge (synthetic insights only)
```

TTS and lipsync run in the **browser**; the API returns text plus animation / facial-expression hints.

---

## Module reference

| Module | File | LLM / IO | Purpose |
|--------|------|-----------|---------|
| **Workflow** | `app/pipeline/workflow.py` | — | `process_chat`; singleton orchestration entry |
| **Orchestrator** | `app/pipeline/pipeline_orchestrator.py` | Groq + parallel memory | Router, crisis gate, retrieval, COMPASS, v2 paths |
| **UserContext** | `app/pipeline/context.py` | — | Envelope dict for the pipeline |
| **Intent router** | `app/agents/intent_router.py` | Groq | 4-class intent + hints |
| **Cognitive layer** | `app/core/cognitive_layer.py` | Groq | COMPASS structured output |
| **Response generator** | `app/agents/response_agent.py` | GLM / Azure | v2 system prompt + invoke |
| **Memory manager** | `app/agents/memory_manager.py` | Groq + embeddings | MEMOIR read / lifecycle facade |
| **Session lifecycle** | `app/core/session_lifecycle.py` | — | `add_structured` cadence, checkpoints |
| **Screening** | `app/agents/screening_agent.py` | Groq / GLM | PHQ-9/GAD-7 + EMA |
| **Groq NLP client** | `app/agents/analysis_agent.py` | Groq | Shared client for router + cognitive layer + crisis LLM check |
| **GLM controller** | `app/controllers/glm_controller.py` | Zhipu / fallback | Thread-safe generation |
| **Chat API** | `app/api/chat.py` | — | `/chat`, `/chat/stream`, triggers, post-stream hooks |
| **Supabase** | `app/services/supabase_service.py` | Postgres | Context, messages, hybrid counts |
| **Config** | `app/core/config.py` | — | `config.yaml` + env substitution |
| **Constants** | `app/utils/constants.py` | — | Memory limits, intervals, caps |
| **Boot** | `app/main.py` | — | App factory, CORS, health-first include order |

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
| `POST` | `/onboarding/mirror-response` | — | Mirror text + crisis screen (see `app/api/onboarding.py`) |
| `POST` | `/onboarding/crisis-check` | — | LLM crisis disambiguation for onboarding |
| * | `/therapist-bridge/*` | JWT | Clinician handoff (see `docs/therapist_bridge.md`) |

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
| `EMBEDDING_DIMS` / `EMBEDDING_MODEL` | env (default 1024 / BAAI/bge-m3) | Must match Qdrant collection size. Set in **`chatbotAgent/.env`** (that file loads first; repo-root `.env` only fills vars that are missing). Legacy collections: MiniLM + 384. |
| `REFLECTION_INTERVAL_SESSIONS` | 5 | Generate reflections every N sessions |

---

## Background Jobs

| Trigger | Interval | Job | Agent |
|---|---|---|---|
| Message count | Every 12 msgs | Structured memory extraction | `SessionLifecycle` → `MemoryStore.add_structured()` |
| Message count | Every 36 msgs | Session-end jobs (summary + synthesis + reflection + screening) | `_run_session_end_jobs()` |
| Game detected | On activity | Game→mem0 bridge (store game insights as memories) | `_extract_game_insights_for_memory()` |
| Coping keywords | Session-end | Procedural synthesis (extract coping strategies) | `memory_manager.synthesize_procedural_memory()` |
| Session milestone | Every 5 sessions | Reflection generation (cross-session insights) | `memory_manager.generate_reflections()` |

---

## Configuration

`config.yaml` defines model names, temperatures, max tokens, and sections such as `api_keys`, `nlp_module`, `glm_controller`, `screening_assessments`, `memory`, `response_generator`, `workflow`, `features`, `performance`, `debug`. Environment variables are substituted via `${VAR_NAME}` syntax.

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

## Deep references

| Document | Contents |
|----------|----------|
| [`../docs/README.md`](../docs/README.md) | Documentation hub (architecture, memory, API, logging, ops) |
| [`../docs/backend/ARCHITECTURE.md`](../docs/backend/ARCHITECTURE.md) | FastAPI request path, COMPASS, routes, screening, boot order |
| [`../docs/backend/MEMORY_ARCHITECTURE.md`](../docs/backend/MEMORY_ARCHITECTURE.md) | MEMOIR read/write, triggers, Qdrant, session lifecycle, game bridge |
| [`app/agents/README.md`](app/agents/README.md) | Memory stack overview for agents layer |

---

## License

Private repository. All rights reserved.
