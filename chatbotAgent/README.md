# MindMitra Backend — Multi-Agent Therapeutic Pipeline

FastAPI backend for MindMitra. Intent-routed multi-agent pipeline with mem0 long-term memory, 3-tier TTS, lip-sync generation, and PHQ-9/GAD-7 clinical screening.

## Architecture

```
POST /chat → auth.py (JWT) → workflow.py (orchestrator)
                                   │
                         ┌─────────┼─────────┐
                         │         │         │
                    Build UserContext   Fetch mem0 memories
                         │         │         │
                         └─────────┼─────────┘
                                   │
                          intent_router.py (Groq qwen3-32b)
                                   │
                  ┌────────┬───────┴───────┬────────┐
                  ▼        ▼               ▼        ▼
              Path A    Path B         Path C    Path D
              casual    emotional      therapeutic crisis
              GLM only  NLP+GLM       Psych+GLM  hardcoded
              150 tok   300 tok        500 tok    safety
                  │        │               │        │
                  └────────┴───────┬───────┘        │
                                   │                │
                          tts_service.py             │
                     (ElevenLabs→GCP→gTTS)          │
                                   │                │
                        lipsync_service.py           │
                     (Rhubarb→text fallback)         │
                                   │                │
                                   └────────────────┘
                                   │
                          ← JSON response (text + audio + lipsync + emotion)
```

## Module Reference

| Module | File | LLM Provider | Purpose |
|---|---|---|---|
| NLP Agent | `app/agents/nlp_agent.py` | Groq qwen3-32b | Emotion/sentiment extraction |
| Intent Router | `app/agents/intent_router.py` | Groq qwen3-32b | 4-way message classification |
| Screening | `app/agents/screening_agent.py` | Groq llama-3.3-70b | PHQ-9/GAD-7 with EMA smoothing |
| Response | `app/agents/response_agent.py` | ZhipuAI GLM-4-32b | Therapeutic response generation |
| Memory | `app/agents/memory_manager.py` | Groq llama-3.3-70b + local embeddings | mem0 + Qdrant (384-dim all-MiniLM-L6-v2) |
| GLM Controller | `app/controllers/glm_controller.py` | ZhipuAI (Groq fallback) | Thread-safe LLM wrapper |
| Workflow | `app/pipeline/workflow.py` | — | Orchestrator (1053 lines) |
| TTS | `app/services/tts_service.py` | — | ElevenLabs → Google Cloud TTS → gTTS |
| Lipsync | `app/services/lipsync_service.py` | — | Rhubarb CLI → text-based phoneme fallback |
| Supabase | `app/services/supabase_service.py` | — | All DB reads/writes |

## Quick Start

```bash
# 1. Python environment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Environment
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY, ZAI_API_KEY, GOOGLE_API_KEY

# 3. Qdrant (local)
docker run -d -p 6333:6333 qdrant/qdrant

# 4. Run
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

See `.env.example` for the complete list with descriptions.

**Required for core functionality:**
```
SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET
GROQ_API_KEY, ZAI_API_KEY, GOOGLE_API_KEY
QDRANT_HOST (localhost or qdrant.railway.internal)
```

**Optional (with fallbacks):**
```
ELEVENLABS_API_KEY          → falls back to Google TTS → gTTS
GOOGLE_CREDENTIALS_BASE64   → falls back to gTTS
OPENAI_API_KEY              → only for /transcribe endpoint
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/chat` | JWT | Main chat (returns text + audio + lipsync) |
| `POST` | `/chat/stream` | JWT | SSE streaming variant |
| `GET`  | `/chat/greeting` | JWT | Random session-start greeting |
| `GET`  | `/health` | None | Railway health check |
| `POST` | `/transcribe` | JWT | Whisper STT (requires OPENAI_API_KEY) |
| `POST` | `/api/onboarding/generate` | JWT | Dynamic onboarding questions |

## Background Jobs

| Trigger | What | How |
|---|---|---|
| Every 12 messages | mem0 memory extraction | Background thread, Groq extraction + Qdrant storage |
| Every 36 messages | PHQ-9/GAD-7 scoring | Background thread, EMA-smoothed, saved to Supabase |
| Game activity detected | Game→mem0 bridge | Stores game insights in long-term memory |
| Session start | Cross-session loading | Fetches previous session summary for continuity |

## Docker Build

```bash
docker build -t mindmitra-backend .
docker run -p 8080:8080 --env-file .env mindmitra-backend
```

The Dockerfile:
- Multi-stage build (builder + runtime)
- PyTorch CPU-only (200MB vs 2GB)
- `all-MiniLM-L6-v2` pre-baked at build time (~90MB, zero cold-start download)
- Runtime: `python:3.11-slim`

## Config

`config.yaml` defines model names, temperatures, max tokens, and the system prompt template. Environment variables are substituted via `${VAR_NAME}` syntax.

## Deployment (Railway)

1. Add **Qdrant** service (Docker image: `qdrant/qdrant`)
2. Add **Backend** service (root: `chatbotAgent`, auto-detects Dockerfile)
3. Set environment variables
4. Set `QDRANT_HOST=qdrant.railway.internal`
5. Railway builds and deploys automatically

`railway.toml` configures: health check path `/health`, 40s timeout, 60s start period, 1 replica.
