# MindMitra — AI Mental Health Companion for Indian Students

An AI-powered therapeutic companion that combines a multi-agent LLM pipeline with a 3D animated avatar to provide culturally-aware mental health support for Indian college students. Built with React + FastAPI + mem0 + Qdrant.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React 18 / Vite / TypeScript)                  Deployed: Vercel│
│                                                                             │
│  ┌───────────┐  ┌───────────────────┐  ┌──────────────────────────────────┐ │
│  │   Auth    │  │  ChatGPTInterface │  │  Games (6 therapeutic activities)│ │
│  │ (Supabase)│  │  (1609 lines)     │  │  Balloon · EmojiMatch · Mood    │ │
│  └─────┬─────┘  └────────┬──────────┘  │  ThoughtDetective · Memory     │ │
│        │                 │             │  WellnessCheckIn               │ │
│        │    ┌────────────┘             └────────────┬─────────────────────┘ │
│        │    │  POST /chat (Bearer JWT)              │ saves to Supabase     │
│        │    │  ← { text, audio, lipsync, emotion }  │ user_activities       │
│  ┌─────┴────┴───────────────────────────────────────┴──────────────────────┐│
│  │  3D Avatar (Three.js / TalkingHead) — lip-synced mouth animation       ││
│  └────────────────────────────────────────────────────────────────────────-┘│
└─────────────────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND  (FastAPI / Python 3.11)                        Deployed: Railway │
│                                                                             │
│  ┌─────────────────────────── Pipeline (workflow.py) ──────────────────────┐│
│  │                                                                         ││
│  │  1. Build UserContext ─► 2. Fetch mem0 memories ─► 3. Classify intent  ││
│  │                                                         │               ││
│  │                    ┌────────────────────┬────────────────┤               ││
│  │                    ▼                    ▼                ▼               ││
│  │              Path A (casual)    Path B (emotional) Path C (therapeutic) ││
│  │              GLM only (150t)    NLP + GLM (300t)   Psych + GLM (500t)  ││
│  │                    │                    │                │               ││
│  │                    └────────────────────┴────────────────┘               ││
│  │                                         │                               ││
│  │  4. TTS (ElevenLabs→GCP→gTTS) ─► 5. Lipsync (Rhubarb→text fallback)  ││
│  │                                         │                               ││
│  │  Path D (crisis) ────────────────► Hardcoded safety resources           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  NLP Agent  │  │ Intent Router│  │  Screening   │  │ Response Agent  │ │
│  │  (Groq      │  │ (Groq        │  │ (Groq        │  │ (ZhipuAI       │ │
│  │  qwen3-32b) │  │  qwen3-32b)  │  │  llama-3.3)  │  │  GLM-4-32b)    │ │
│  └──────┬──────┘  └──────────────┘  └──────────────┘  └────────────────-┘ │
│         │                                                                   │
│  ┌──────┴──────────────────────────────────────────────────────────────────┐│
│  │  Memory Manager (mem0 + Qdrant)                                         ││
│  │  Embeddings: all-MiniLM-L6-v2 (384-dim, LOCAL, no API)                 ││
│  │  Fact extraction: Groq llama-3.3-70b                                    ││
│  │  Session summaries: Gemini 2.5 flash lite                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌───────────┐  ┌────────────┐
      │   Supabase   │ │  Qdrant   │  │ LLM APIs   │
      │  PostgreSQL  │ │  Vector   │  │ Groq       │
      │  + Auth      │ │  (384-dim)│  │ ZhipuAI    │
      │  + RLS       │ │           │  │ Gemini     │
      └──────────────┘ └───────────┘  └────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript | SPA with hot-reload |
| **UI** | Radix UI, Tailwind CSS, shadcn/ui | Accessible components |
| **3D Avatar** | Three.js, @react-three/fiber, TalkingHead | Lip-synced animated companion |
| **Backend** | FastAPI, Python 3.11, uvicorn | Async API server |
| **LLM (response)** | ZhipuAI GLM-4-32b-0414 | Therapeutic response generation |
| **LLM (NLP/routing)** | Groq qwen3-32b | Emotion analysis, intent classification |
| **LLM (screening)** | Groq llama-3.3-70b | PHQ-9/GAD-7 clinical scoring |
| **LLM (summaries)** | Gemini 2.5 flash lite | End-of-session summaries |
| **Memory** | mem0 + Qdrant | Semantic long-term user memory |
| **Embeddings** | all-MiniLM-L6-v2 (local) | 384-dim sentence vectors, CPU, no API |
| **TTS** | ElevenLabs → Google Cloud TTS → gTTS | 3-tier fallback speech synthesis |
| **Lip-sync** | Rhubarb CLI → text-based fallback | Phoneme timing for mouth animation |
| **Database** | Supabase (PostgreSQL + Auth + RLS) | Chat history, profiles, analytics |
| **Auth** | Supabase Auth (JWT) | Email/password + Google OAuth |
| **Deploy (backend)** | Railway (Docker) | Multi-stage build, pre-baked ML model |
| **Deploy (frontend)** | Vercel | SPA with rewrite rules |

---

## Repository Structure

```
MindMitra/
├── src/                          # React frontend
│   ├── App.tsx                   # Router (20+ routes), providers
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatGPTInterface.tsx   # Main chat UI (1609 lines)
│   │   ├── layout/Header.tsx
│   │   └── sections/            # Landing page sections
│   ├── hooks/
│   │   ├── useAuth.tsx          # Supabase auth context
│   │   ├── useChat.tsx          # Avatar message queue + lipsync
│   │   └── useVoiceRecording.tsx
│   ├── lib/
│   │   ├── sessionManager.ts   # Chat session ID (localStorage)
│   │   └── gameDataSaver.tsx    # Game results → Supabase
│   ├── pages/                   # Route pages (Chat, Games, Auth, etc.)
│   └── integrations/supabase/   # Supabase client + types
│
├── chatbotAgent/                 # Python backend
│   ├── app/
│   │   ├── main.py              # FastAPI factory, CORS, startup
│   │   ├── core/
│   │   │   ├── config.py        # Singleton config (config.yaml + env vars)
│   │   │   ├── auth.py          # JWT validation, SKIP_AUTH bypass
│   │   │   └── logging.py
│   │   ├── api/
│   │   │   ├── chat.py          # POST /chat, /chat/stream, GET /chat/greeting
│   │   │   ├── health.py        # GET /health
│   │   │   ├── transcribe.py    # POST /transcribe (Whisper STT)
│   │   │   └── onboarding.py    # POST /api/onboarding/*
│   │   ├── agents/
│   │   │   ├── nlp_agent.py     # Groq emotion/sentiment analysis
│   │   │   ├── intent_router.py # 4-way intent classifier
│   │   │   ├── screening_agent.py # PHQ-9/GAD-7 with EMA smoothing
│   │   │   ├── response_agent.py  # System prompt + GLM response gen
│   │   │   └── memory_manager.py  # mem0 + Qdrant (666 lines, daemon init)
│   │   ├── controllers/
│   │   │   └── glm_controller.py  # Thread-safe ZhipuAI wrapper
│   │   ├── pipeline/
│   │   │   ├── workflow.py      # THE BRAIN — orchestrator (1053 lines)
│   │   │   └── context.py       # UserContext JSON builder
│   │   ├── services/
│   │   │   ├── supabase_service.py  # All DB operations
│   │   │   ├── tts_service.py   # TTS fallback chain
│   │   │   ├── lipsync_service.py   # Rhubarb + text fallback
│   │   │   └── greeting_service.py
│   │   ├── models/              # Pydantic request/response schemas
│   │   └── utils/               # Constants, JSON parsing
│   ├── config.yaml              # Model names, temps, prompts
│   ├── Dockerfile               # Multi-stage (PyTorch CPU + HuggingFace model)
│   ├── requirements.txt         # All Python deps with version pins
│   ├── railway.toml             # Railway deployment config
│   └── .env.example             # Complete env var documentation
│
├── supabase/
│   ├── config.toml
│   └── migrations/              # 11 SQL migration files
│
├── public/                      # Static assets
│   ├── models/                  # TalkingHead 3D avatar models
│   ├── sounds/                  # UI sound effects
│   └── animations/              # Avatar animations
│
├── vercel.json                  # Vercel SPA config
├── package.json                 # Frontend dependencies
├── vite.config.ts               # Vite build config
└── tailwind.config.ts           # Tailwind theme
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 18 (frontend)
- **Python** >= 3.11 (backend)
- **Docker** (for Qdrant, or use Railway-hosted Qdrant)

### 1. Frontend

```bash
# Install dependencies
npm install

# Set environment variable
echo 'VITE_BACKEND_URL=http://localhost:8000' > .env.local

# Start dev server
npm run dev
```

### 2. Backend

```bash
cd chatbotAgent

# Create virtual environment
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill env vars (see table below)
cp .env.example .env

# Start Qdrant (local Docker)
docker run -d -p 6333:6333 qdrant/qdrant

# Start backend
uvicorn app.main:app --reload --port 8000
```

### 3. First run

1. Open `http://localhost:5173`
2. Sign up (Supabase Auth)
3. Complete onboarding
4. Start chatting — the 3D avatar will respond

---

## Environment Variables

### Backend (Railway / chatbotAgent/.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_KEY` | **Yes** | — | Supabase service role key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Alias (checked first, falls back to SUPABASE_KEY) |
| `SUPABASE_JWT_SECRET` | **Yes** | — | JWT verification secret |
| `GROQ_API_KEY` | **Yes** | — | NLP, intent routing, screening, mem0 extraction |
| `ZAI_API_KEY` | **Yes** | — | ZhipuAI GLM-4 (response gen, psych analysis) |
| `GOOGLE_API_KEY` | **Yes** | — | Gemini (session summaries) |
| `QDRANT_HOST` | **Yes** | `localhost` | `qdrant.railway.internal` on Railway |
| `QDRANT_PORT` | No | `6333` | Qdrant gRPC port |
| `QDRANT_COLLECTION` | No | `companion_memories` | Qdrant collection name |
| `OPENAI_API_KEY` | No | — | Only for /transcribe (Whisper STT) |
| `ELEVENLABS_API_KEY` | No | — | Primary TTS (falls back to GCP → gTTS) |
| `ELEVENLABS_VOICE_ID` | No | `vT0wMbLG5dssaBsksrb6` | ElevenLabs voice |
| `ELEVENLABS_MODEL_ID` | No | `eleven_v3` | ElevenLabs model |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | — | GCP service account JSON path (local) |
| `GOOGLE_CREDENTIALS_BASE64` | No | — | Base64-encoded GCP JSON (Railway) |
| `PORT` | No | `8080` | Railway sets this automatically |
| `LOG_LEVEL` | No | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `SKIP_AUTH` | No | `false` | **Must be false in production** |
| `CORS_ALLOW_ORIGINS` | No | — | Extra origins (comma-separated) |

### Frontend (Vercel / .env.local)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | **Yes** | Backend URL (e.g., `https://your-app.up.railway.app`) |

> **Note:** The Supabase URL and anon key in `src/integrations/supabase/client.ts` are the publishable anon key — designed to be public per Supabase's security model (RLS enforces access control).

---

## API Reference

### `POST /chat`

Main chat endpoint. Returns text + audio + lipsync + emotion data.

**Headers:** `Authorization: Bearer <jwt>`

**Request:**
```json
{
  "message": "I've been feeling really stressed about exams",
  "session_id": "uuid-session-id",
  "companion": "mitra"
}
```

**Response:**
```json
{
  "text": "I hear you — exam pressure can feel...",
  "audio": "<base64-encoded-wav>",
  "lipsync": { "mouthCues": [{ "start": 0.0, "end": 0.3, "value": "B" }] },
  "emotion": "empathetic",
  "facialExpression": "sad",
  "metadata": {
    "intent": "therapeutic",
    "confidence": 0.92,
    "path": "C",
    "screening": { "phq9_score": 12, "gad7_score": 8 }
  }
}
```

### `POST /chat/stream`

SSE streaming variant (same auth/request format).

### `GET /chat/greeting`

Returns a random greeting for session start.

### `GET /health`

Railway health check. Returns `{"status": "ok"}`.

### `POST /transcribe`

Whisper STT. Requires `OPENAI_API_KEY`. Accepts audio file upload.

### `POST /api/onboarding/generate`

Groq-based dynamic onboarding question generation.

---

## Database Schema

12 active tables after production cleanup migration:

| Table | Purpose |
|---|---|
| `chat_messages` | All user↔AI messages (user_id, session_id, role, content, metadata) |
| `user_activities` | Game results + therapeutic activity data |
| `user_profiles` | Demographics, display name, privacy flags |
| `user_settings` | Companion personality, avatar model, theme, notifications |
| `user_onboarding` | Onboarding state, consent, device tier |
| `crisis_events` | Crisis incident log (level, source — NO user text stored) |
| `user_contexts` | Workflow context persistence (full UserContext JSON) |
| `session_summaries` | AI-generated end-of-session summaries |
| `memory_metadata` | mem0 memory tracking (fact, category, source session) |
| `user_memory_stats` | Aggregate memory statistics per user |
| `voice_analytics` | Speech analysis metrics |
| `onboarding_analytics` | Onboarding funnel tracking |

All tables have **Row Level Security (RLS)** — users can only access their own rows.

---

## Memory System

MindMitra remembers users across sessions using **mem0 + Qdrant**:

1. **Extraction** (every 12 messages): Recent conversation → Groq `llama-3.3-70b` extracts atomic facts → `all-MiniLM-L6-v2` encodes to 384-dim vectors → stored in Qdrant
2. **Retrieval** (every request): User message → semantic search in Qdrant → top-K relevant memories injected into system prompt
3. **Session summaries**: Gemini 2.5 flash lite generates end-of-session summaries → loaded as cross-session continuity on next session start
4. **Game bridge**: Game results (scores, insights) are stored in mem0 so the companion can reference therapeutic progress

**Why local embeddings?** `all-MiniLM-L6-v2` runs on CPU with zero API calls. The Dockerfile pre-bakes the model (~90MB) to avoid cold-start downloads on Railway.

---

## Deployment

### Railway (Backend)

1. Create a new Railway project
2. Add a **Qdrant** service (from Docker image `qdrant/qdrant`)
3. Add a **Backend** service (from this repo, root directory: `chatbotAgent`)
4. Set all required environment variables (see table above)
5. Set `QDRANT_HOST=qdrant.railway.internal` (Railway internal networking)
6. Railway auto-detects the Dockerfile and builds

The Dockerfile:
- Uses multi-stage build (builder + runtime)
- Installs PyTorch CPU-only (~200MB vs ~2GB with CUDA)
- Pre-downloads `all-MiniLM-L6-v2` at build time (baked into image)
- Health check: `/health` with 40s timeout, 60s start period

### Vercel (Frontend)

1. Import repo to Vercel
2. Set `VITE_BACKEND_URL` environment variable to your Railway backend URL
3. Framework is auto-detected (Vite), output directory: `dist`
4. `vercel.json` handles SPA routing

---

## Intent Routing

Every user message is classified into one of four paths:

| Path | Intent | Pipeline | Max Tokens | Use Case |
|---|---|---|---|---|
| **A** | `casual` | GLM response only | 150 | Small talk, greetings |
| **B** | `emotional` | NLP analysis → GLM response | 300 | Sharing feelings, venting |
| **C** | `therapeutic` | GLM psych analysis → GLM response | 500 | Deep issues, seeking guidance |
| **D** | `crisis` | Hardcoded response | — | Suicidal ideation, self-harm |

Path D bypasses all LLM calls and returns hardcoded safety resources with crisis helpline numbers.

---

## Companion Personalities

Users choose from 5 AI companion personalities:

| ID | Name | Style | Voice Rate | Best For |
|---|---|---|---|---|
| `mitra` | Mitra 🧘 | Calm, empathetic | 0.9x | Anxiety & overwhelm |
| `arjun` | Arjun 🎯 | Focused coach | 1.0x | Academic stress & goals |
| `diya` | Diya 💡 | Curious explainer | 0.95x | Understanding emotions deeply |
| `riya` | Riya 🌟 | Energetic cheerleader | 1.1x | Low motivation & confidence |
| `zen` | Zen 🌙 | Mindful guide | 0.85x | Stress relief & grounding |

Each personality injects a unique system prompt addition and adjusts TTS voice parameters.

---

## Screening (PHQ-9 / GAD-7)

The system estimates clinical screening scores from conversation:

- **PHQ-9** (depression): 9 items, score 0-27
- **GAD-7** (anxiety): 7 items, score 0-21

Scoring runs as a **session-end job** (every 36 messages) using Groq `llama-3.3-70b`. **EMA smoothing** (alpha=0.3) blends new scores with historical averages to prevent score whiplash from single-session mood variations. Scores are saved to Supabase for longitudinal tracking.

---

## Known Limitations

1. **No rate limiting** — backend has no request throttling
2. **No automated tests** — zero unit or integration tests
3. **No WebSocket streaming** — frontend uses request-response, not the available SSE endpoint
4. **Memory extraction is fire-and-forget** — failures logged but not retried
5. **Client-side message saving** — messages saved from browser; tab close mid-save can lose data
6. **No migration runner** — SQL migrations applied manually via Supabase SQL Editor
7. **Single-region** — may cause latency if Railway/Qdrant are not deployed near target users (India)

---

## License

Private repository. All rights reserved.
