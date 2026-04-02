# MindMitra — AI Mental Health Companion for Indian Students

An AI-powered therapeutic companion combining a multi-agent LLM pipeline with a 3D animated avatar to deliver culturally-aware mental health support for Indian college students (ages 16–25). Built with React + FastAPI + mem0 + Qdrant.

> **Status**: Production (Railway + Vercel)
> **Backend lines**: ~6,000 across 24 Python files
> **Frontend lines**: ~15,000+ across React/TypeScript
> **LLM providers**: 5 (Groq, ZhipuAI, Google Gemini, OpenAI Whisper, HuggingFace local)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React 18 / Vite / TypeScript)                  Deployed: Vercel│
│                                                                             │
│  ┌───────────┐  ┌───────────────────┐  ┌──────────────────────────────────┐ │
│  │   Auth    │  │  ChatGPTInterface │  │  Games (7 therapeutic activities)│ │
│  │ (Supabase)│  │  (1609 lines)     │  │  Balloon · EmojiMatch · Mood    │ │
│  └─────┬─────┘  └────────┬──────────┘  │  ThoughtDetective · Memory     │ │
│        │                 │             │  WellnessCheckIn · EmotionMatch │ │
│        │    ┌────────────┘             └────────────┬─────────────────────┘ │
│        │    │  POST /chat (Bearer JWT)              │ saves to Supabase     │
│        │    │  ← { message, emotion, insights }     │ user_activities       │
│  ┌─────┴────┴───────────────────────────────────────┴──────────────────────┐│
│  │  3D Avatar (TalkingHead v1.7 — iframe-hosted)                          ││
│  │  ┌─────────────────┐  ┌──────────────────────────────────────────────┐ ││
│  │  │ TalkingHead     │  │ MindMitraBridge (893 lines)                  │ ││
│  │  │ • Viseme engine │  │ • 7 therapeutic moods (empathy, concern,     │ ││
│  │  │ • Audio lipsync │  │   encouragement, acknowledgment, calm,       │ ││
│  │  │ • speakAudio()  │  │   listening, neutral)                        │ ││
│  │  │ • Word timing   │  │ • Gesture control (nod, lean, tilt)          │ ││
│  │  └────────┬────────┘  │ • Amplitude-based jaw boost                  │ ││
│  │           │           └──────────────────────────────────────────────┘ ││
│  │  TTS Pipeline (runs in-browser, iframe):                               ││
│  │  Google Cloud TTS (word timestamps) → Azure TTS (neural) → Web Speech ││
│  └────────────────────────────────────────────────────────────────────────-┘│
└─────────────────────────────────────────────────────────────────────────────┘
                              │ HTTPS (POST /chat, GET /chat/greeting, etc.)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND  (FastAPI / Python 3.11)                        Deployed: Railway │
│                                                                             │
│  ┌─────────────────────────── Pipeline (workflow.py) ──────────────────────┐│
│  │                                                                         ││
│  │  1. Build UserContext ─► 2. Fetch mem0 memories ─► 3. Classify intent  ││
│  │     (context.py)           (memory_manager.py)       (intent_router.py) ││
│  │                                                         │               ││
│  │           ┌────────────────┬───────────┬────────────────┤               ││
│  │           ▼                ▼           ▼                ▼               ││
│  │       Path A           Path B      Path C           Path D             ││
│  │       casual           emotional   therapeutic      crisis             ││
│  │       1 GLM call       1 Groq      1-2 GLM          0 LLM             ││
│  │       2500 tokens       + 1 GLM     + opt. Groq      template           ││
│  │                        2500 tok     3000 tok          safety resp.        ││
│  │           │                │           │                │               ││
│  │           └────────────────┴─────┬─────┘                │               ││
│  │                                  │                      │               ││
│  │  4. Detect emotion (11 types) ───┤    Path D: hardcoded safety         ││
│  │     empathy, concern, encourage  │    resources + helpline numbers     ││
│  │     acknowledgment, calm,        │                                      ││
│  │     listening, + 5 standard      │                                      ││
│  │                                  │                                      ││
│  │  5. Background jobs:             │                                      ││
│  │     ├─ Memory extraction (12 msgs)                                      ││
│  │     ├─ Session summary (36 msgs, Gemini)                                ││
│  │     ├─ PHQ-9/GAD-7 screening (session-end)                              ││
│  │     ├─ Procedural synthesis (coping keyword trigger)                    ││
│  │     ├─ Reflections (every 5 sessions)                                   ││
│  │     └─ Game→mem0 bridge (activity insights)                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Intent      │  │  Screening   │  │  Response     │  │ Memory Manager │ │
│  │ Router      │  │  Agent       │  │  Generator    │  │ (mem0+Qdrant)  │ │
│  │ (Groq       │  │ (Groq        │  │ (ZhipuAI     │  │ (HuggingFace   │ │
│  │  qwen3-32b) │  │  llama-3.3)  │  │  GLM-4-32b)  │  │  384-dim local)│ │
│  └─────────────┘  └──────────────┘  └──────────────┘  └────────────────-┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌───────────┐  ┌────────────┐
      │   Supabase   │ │  Qdrant   │  │ LLM APIs   │
      │  PostgreSQL  │ │  Vector   │  │ Groq       │
      │  Auth + RLS  │ │  (384-dim)│  │ ZhipuAI    │
      │  12 tables   │ │  mem0 OSS │  │ Gemini     │
      └──────────────┘ └───────────┘  │ OpenAI     │
                                       └────────────┘
```

> **Note**: TTS and lip-sync run **entirely in the browser** (inside the avatar iframe). The backend sends only text + emotion metadata — no audio generation server-side. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full visual architecture breakdown.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 5, TypeScript 5 | SPA with hot-reload |
| **UI** | Radix UI, Tailwind CSS, shadcn/ui | Accessible, themed components |
| **3D Avatar** | TalkingHead v1.7 (iframe) + MindMitraBridge | Lip-synced animated companion with therapeutic expressions |
| **TTS** | Google Cloud TTS → Azure Cognitive Services → Web Speech API | 3-tier in-browser speech synthesis (frontend-only) |
| **State** | React Context, TanStack Query | Auth, chat session, data fetching |
| **Backend** | FastAPI, Python 3.11, uvicorn | Async API server |
| **LLM (response)** | ZhipuAI GLM-4-32b-0414-128k | Therapeutic response generation |
| **LLM (NLP/routing)** | Groq qwen/qwen3-32b | Emotion analysis, intent classification, crisis check |
| **LLM (screening)** | Groq llama-3.3-70b-versatile | PHQ-9/GAD-7 clinical scoring, mem0 extraction |
| **LLM (summaries)** | Google Gemini 2.5 flash lite | End-of-session summaries |
| **STT** | Azure Speech SDK + Groq Whisper fallback | Browser-first STT with noisy-audio fallback |
| **Memory** | mem0 OSS + Qdrant | Semantic long-term user memory |
| **Embeddings** | all-MiniLM-L6-v2 (local HuggingFace) | 384-dim sentence vectors, CPU, zero API cost |
| **Database** | Supabase (PostgreSQL + Auth + RLS) | 12 tables — chat, profiles, crisis, screening, memory |
| **Auth** | Supabase Auth (JWT) | Email/password + Google OAuth |
| **Deploy (backend)** | Railway (Docker) | Multi-stage build, pre-baked ML model |
| **Deploy (frontend)** | Vercel | SPA with rewrite rules |

---

## Repository Structure

```
MindMitra/
├── src/                              # ─── React Frontend ───
│   ├── App.tsx                       # Router (20+ routes) w/ AnimatePresence page transitions
│   ├── main.tsx                      # ReactDOM.createRoot, App mount point
│   ├── index.css                     # Tailwind base + custom variables
│   │
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatGPTInterface.tsx  # Main chat UI (1609 lines)
│   │   │   │   - Message rendering, voice recording, session management
│   │   │   │   - Avatar integration (postMessage bridge to iframe)
│   │   │   │   - Personality selection, language toggle, history
│   │   │   ├── TalkingHeadAvatar.tsx  # Avatar iframe wrapper (206 lines)
│   │   │   │   - Builds iframe URL with TTS keys as search params
│   │   │   │   - PostMessage bridge: speakText, setEmotion, triggerGesture
│   │   │   │   - Loading/error/speaking overlays
│   │   │   ├── ChatInterfaceWithSessions.tsx  # Session sidebar variant
│   │   │   └── GirlAvatar.tsx        # Female avatar component
│   │   ├── layout/
│   │   │   └── Header.tsx            # Navigation, auth status, mobile menu
│   │   ├── sections/
│   │   │   ├── WelcomeHero.tsx       # Landing page hero
│   │   │   ├── FeaturesPreview.tsx   # Feature cards
│   │   │   └── StatsSection.tsx      # Usage stats
│   │   └── ui/                       # 40+ shadcn/ui components
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx               # Supabase auth context
│   │   ├── useChat.tsx               # Avatar message queue, emotion state
│   │   ├── useVoiceRecording.tsx     # Azure STT + Whisper fallback + voice metric capture
│   │   ├── use-mobile.tsx            # Responsive breakpoint hook
│   │   ├── use-toast.ts             # Toast notifications
│   │   └── useScrollAnimations.tsx   # Intersection observer for scroll FX
│   │
│   ├── lib/
│   │   ├── sessionManager.ts        # Session ID generation + localStorage
│   │   ├── gameDataSaver.tsx         # Game results → Supabase user_activities
│   │   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
│   │
│   ├── pages/                        # 14 route pages (Auth, Chat, Games, etc.)
│   └── integrations/supabase/        # Supabase client + auto-generated types
│
├── public/
│   ├── talkinghead.html              # Avatar iframe host (TTS + bridge + TalkingHead init)
│   ├── talkinghead/
│   │   ├── modules/
│   │   │   ├── talkinghead.mjs       # TalkingHead v1.7 library
│   │   │   └── mindmitra-bridge.mjs  # MindMitraBridge (893 lines): therapeutic moods,
│   │   │                             #   gestures, amplitude analysis, emotion timeline
│   │   └── avatars/
│   │       └── Brunette.glb          # Default 3D avatar model
│   ├── models/                       # Additional GLTF avatar models
│   ├── sounds/                       # UI sound effects
│   └── animations/                   # Avatar animation clips
│
├── chatbotAgent/                     # ─── Python Backend ───
│   ├── app/
│   │   ├── main.py                   # FastAPI factory, CORS, boot sequence
│   │   ├── core/                     # config.py, auth.py, logging.py
│   │   ├── api/
│   │   │   ├── chat.py               # POST /chat, /chat/stream, GET /greeting
│   │   │   │                         #   _detect_emotion() → 11 therapeutic emotions
│   │   │   ├── health.py             # GET /health
│   │   │   └── onboarding.py         # POST /api/onboarding/*
│   │   │                             #   /transcribe lives in chat.py
│   │   ├── agents/
│   │   │   ├── memory_manager.py     # (1321 lines) mem0 + Qdrant
│   │   │   ├── response_agent.py     # (442 lines) GLM + CoE reasoning
│   │   │   ├── intent_router.py      # 4-class Groq classifier
│   │   │   ├── screening_agent.py    # PHQ-9/GAD-7 with EMA
│   │   │   └── analysis_agent.py          # Groq client factory
│   │   ├── controllers/
│   │   │   └── llm_controller.py     # Thread-safe ZhipuAI + Groq fallback
│   │   ├── pipeline/
│   │   │   ├── workflow.py           # (1092 lines) THE BRAIN — orchestrator
│   │   │   └── context.py            # UserContext JSON builder
│   │   ├── services/
│   │   │   ├── supabase_service.py   # All DB operations
│   │   │   └── greeting_service.py   # Time/personality/continuity greetings
│   │   ├── models/                   # Pydantic request/response schemas
│   │   └── utils/                    # constants.py, json_utils.py
│   ├── config.yaml                   # Runtime configuration
│   ├── docs/                         # ARCHITECTURE.md, MEMORY_ARCHITECTURE.md, etc.
│   ├── Dockerfile                    # Multi-stage (PyTorch CPU + pre-baked model)
│   └── requirements.txt             # Python deps with version pins
│
├── supabase/                         # Config, edge functions, migrations
├── ARCHITECTURE.md                   # Full-system architecture overview
├── package.json                      # Frontend dependencies
├── vite.config.ts                    # Vite build config
├── tailwind.config.ts                # Tailwind theme
├── vercel.json                       # Vercel SPA routing
└── tsconfig.json                     # TypeScript config
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 18 (frontend)
- **Python** >= 3.11 (backend)
- **Docker** (for local Qdrant, or use Railway-hosted)

### 1. Frontend

```bash
npm install

# Set backend URL + TTS keys
cat > .env.local << 'EOF'
VITE_BACKEND_URL=http://localhost:8000
VITE_GOOGLE_TTS_KEY=your-google-cloud-tts-key    # Primary TTS (word timestamps)
VITE_AZURE_TTS_KEY=your-azure-speech-key          # Fallback TTS (neural voice)
VITE_AZURE_TTS_REGION=eastasia                     # Azure region
EOF

# Start dev server (http://localhost:5173)
npm run dev
```

### 2. Backend

```bash
cd chatbotAgent

# Python environment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET,
#          GROQ_API_KEY, ZAI_API_KEY, GOOGLE_API_KEY

# Start Qdrant (local Docker)
docker run -d -p 6333:6333 qdrant/qdrant

# Start backend (http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

### 3. First Run

1. Open `http://localhost:5173`
2. Sign up (Supabase Auth — email/password or Google)
3. Complete onboarding (personality selection, intro)
4. Start chatting — the 3D avatar responds with text + voice + lip-sync

---

## Core Concepts

### Intent-Routed Pipeline

Every user message is classified by `IntentRouter` (Groq qwen3-32b) into one of four execution paths:

| Path | Intent | LLM Calls | Max Tokens | Use Case |
|---|---|---|---|---|
| **A** | `casual` | 1 × GLM | 150 | Small talk, greetings, playful chat |
| **B** | `emotional` | 1 × Groq + 1 × GLM | 300 | Sharing feelings, venting, validation |
| **C** | `therapeutic` | 1-2 × GLM + opt. Groq | 500 | Deep distress, trauma, mental health struggles |
| **D** | `crisis` | 0 (template) | — | Suicidal ideation, self-harm intent |

Path D bypasses ALL LLM calls and returns template-based safety responses with crisis helpline numbers (iCall, Vandrevala Foundation). Crisis detection uses a 3-layer gate: hard keyword scan → LLM disambiguation → clinical risk assessment.

### 5 Companion Personalities

| ID | Name | Style | TTS Rate | Best For |
|---|---|---|---|---|
| `mitra` | Mitra 🧘 | Gentle, empathetic | 0.9x | Anxiety, overwhelm |
| `arjun` | Arjun 🎯 | Focused coach | 1.0x | Academic stress, goals |
| `diya` | Diya 💡 | Curious explorer | 0.95x | Understanding emotions |
| `riya` | Riya 🌟 | Energetic cheerleader | 1.1x | Low motivation, confidence |
| `zen` | Zen 🌙 | Mindful guide | 0.85x | Stress relief, grounding |

### Chain-of-Experts (CoE) Reasoning

Responses are guided by intervention-specific `<think>` blocks injected into the system prompt:

| Intervention | Framework | CoE Think Guidance |
|---|---|---|
| `validate` | Person-Centered | "What specific emotion? What's the unspoken need?" |
| `reframe` | CBT | "What cognitive distortion? What gentle alternative?" |
| `ground` | DBT | "Is user spiraling? What sensory anchor?" |
| `problem-solve` | Reality Therapy | "What specific stressor? What ONE small step?" |
| `refer` | Warm Handoff | "Why beyond my scope? Frame help as strength" |
| `psychoeducation` | Normalize | "What concept is relevant? What simple analogy?" |

### Memory System

Long-term user memory powered by **mem0 OSS + Qdrant**:

- **Embeddings**: `all-MiniLM-L6-v2` (local, CPU, 384-dim, zero API cost)
- **Extraction**: Every 12 messages → Groq `llama-3.3-70b` extracts atomic facts → Qdrant
- **Retrieval**: Composite scoring: `0.50×relevance + 0.35×importance + 0.15×recency`
- **Memory types**: semantic (facts), procedural (coping strategies), reflections (cross-session insights), crisis
- **Session summaries**: Gemini 2.5 flash lite generates end-of-session summaries
- **Game bridge**: Game results stored as memories for therapeutic reference

See [`chatbotAgent/docs/MEMORY_ARCHITECTURE.md`](chatbotAgent/docs/MEMORY_ARCHITECTURE.md) for details.

### Clinical Screening (PHQ-9 / GAD-7)

- **PHQ-9** (depression): 9 items, score 0–27, 5 severity levels
- **GAD-7** (anxiety): 7 items, score 0–21, 4 severity levels
- **EMA smoothing**: α=0.6 (60% new + 40% historical)
- **Screening-aware routing**: PHQ-9 ≥ moderate → IntentRouter biased toward therapeutic path

### 7 Therapeutic Games

| Game | Therapeutic Focus |
|---|---|
| **Balloon Positivity** | Emotional discrimination, resilience |
| **Emoji Match** | Emotion recognition |
| **Emotion Match** | Facial expression reading |
| **Memory Challenge** | Cognitive function |
| **Mood Mountain** | Mood tracking, emotional vocabulary |
| **Thought Detective** | CBT distortion identification |
| **Wellness Check-In** | Self-assessment |

---

## API Reference

### `POST /chat`

**Headers**: `Authorization: Bearer <supabase-jwt>`

**Request**:
```json
{
  "user_message": "I've been feeling really stressed about exams",
  "session_id": "uuid-v4",
  "personality": "mitra",
  "companion_name": "Mitra",
  "language": "english",
  "avatar_visible": true
}
```

**Response**:
```json
{
  "message": "I hear you — exam pressure can feel...",
  "animation": "Talking_0",
  "facial_expression": "empathy",
  "modality": "Validation",
  "confidence": 0.9,
  "session_insights": {
    "emotional_state": "anxious",
    "stress_categories": ["Academic"],
    "therapeutic_approach": "Validation",
    "performance_metrics": {
      "context_messages": 4,
      "memory_count": 5
    }
  }
}
```

### `POST /chat/stream`

SSE streaming variant. Events: `text_chunk`, `avatar_ready`, `complete`, `error`.

### Other Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/chat/greeting` | Personalized session-start greeting |
| `GET` | `/health` | Railway health check |
| `POST` | `/transcribe` | Groq Whisper fallback STT (base64 WAV) |

---

## Environment Variables

### Backend (Railway / chatbotAgent/.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_KEY` | **Yes** | — | Supabase service role key |
| `SUPABASE_JWT_SECRET` | **Yes** | — | JWT verification secret |
| `GROQ_API_KEY` | **Yes** | — | NLP, routing, screening, mem0 |
| `ZAI_API_KEY` | **Yes** | — | ZhipuAI GLM-4 response gen |
| `GOOGLE_API_KEY` | **Yes** | — | Gemini session summaries |
| `QDRANT_HOST` | **Yes** | `localhost` | Qdrant host |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `SKIP_AUTH` | No | `false` | **Must be false in production** |

### Frontend (Vercel / .env.local)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | **Yes** | Backend URL |
| `VITE_GOOGLE_TTS_KEY` | No | Google Cloud TTS — primary, word-level timestamps for perfect lip-sync |
| `VITE_AZURE_TTS_KEY` | No | Azure Cognitive Services Speech — fallback neural TTS |
| `VITE_AZURE_TTS_REGION` | No | Azure region (default: `eastasia`) |

> TTS keys are optional. Without any key, the avatar uses Web Speech API (browser-built-in) as final fallback.

---

## Database Schema

12 tables in Supabase PostgreSQL (all with Row Level Security):

| Table | Purpose |
|---|---|
| `chat_messages` | All user↔AI messages |
| `user_activities` | Game results + therapeutic data |
| `user_profiles` | User demographics |
| `user_settings` | Companion personality, theme |
| `user_onboarding` | Onboarding state tracking |
| `crisis_events` | Crisis incident log (no user text — privacy) |
| `user_contexts` | Full UserContext JSON persistence |
| `session_summaries` | AI-generated session summaries |
| `memory_metadata` | mem0 memory tracking |
| `user_memory_stats` | Per-user memory statistics |
| `voice_analysis_events` | Raw speech timing + clarity metrics per recording |
| `onboarding_analytics` | Onboarding funnel tracking |

---

## Deployment

### Railway (Backend)

1. Add **Qdrant** service (`qdrant/qdrant` Docker image)
2. Add **Backend** service (root: `chatbotAgent`, auto-detects Dockerfile)
3. Set environment variables, `QDRANT_HOST=qdrant.railway.internal`

### Vercel (Frontend)

1. Import repo, set `VITE_BACKEND_URL` + optional TTS keys
2. Framework auto-detected (Vite), `vercel.json` handles SPA routing

---

## Documentation

| Document | Location | Contents |
|---|---|---|
| **This README** | `/README.md` | Full-system overview, setup, deployment |
| **Architecture Overview** | `/ARCHITECTURE.md` | Visual system architecture for GitHub visitors |
| **Backend Architecture** | `/chatbotAgent/docs/ARCHITECTURE.md` | Deep backend architecture (1894 lines) |
| **Memory Architecture** | `/chatbotAgent/docs/MEMORY_ARCHITECTURE.md` | Memory system internals |
| **Backend README** | `/chatbotAgent/README.md` | Quick-start backend reference |

---

## Known Limitations

1. **No rate limiting** — backend has no request throttling
2. **No automated tests** — zero unit or integration tests
3. **No WebSocket support** — SSE endpoint available but unused
4. **Memory extraction is fire-and-forget** — failures logged but not retried
5. **Client-side message saving** — tab close mid-save can lose data
6. **No migration runner** — SQL migrations applied manually via Supabase SQL Editor
7. **Single-region** — may cause latency if distant from target users (India)
8. **No conversation export** — users cannot download chat history
9. **Single concurrent GLM call** — `Semaphore(1)` serialises ZhipuAI access

---

## License

Private repository. All rights reserved.
