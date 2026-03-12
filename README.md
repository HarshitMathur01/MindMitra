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
│        │    │  ← { text, audio, lipsync, emotion }  │ user_activities       │
│  ┌─────┴────┴───────────────────────────────────────┴──────────────────────┐│
│  │  3D Avatar (Three.js / @react-three/fiber / TalkingHead)               ││
│  │  Lip-synced mouth animation · Emotion-mapped facial expressions        ││
│  │  5 companion personalities with unique voice + behavior                ││
│  └────────────────────────────────────────────────────────────────────────-┘│
└─────────────────────────────────────────────────────────────────────────────┘
                              │ HTTPS (POST /chat, GET /chat/greeting, etc.)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND  (FastAPI / Python 3.12)                        Deployed: Railway │
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
│  │       150 tokens       + 1 GLM     + opt. Groq      template           ││
│  │                        300 tok     500 tok          safety resp.        ││
│  │           │                │           │                │               ││
│  │           └────────────────┴─────┬─────┘                │               ││
│  │                                  │                      │               ││
│  │  4. TTS (ElevenLabs→GCP→gTTS) ──┤      Path D: hardcoded safety       ││
│  │  5. Lipsync (Rhubarb→text)      │      resources + helpline numbers    ││
│  │                                  │                                      ││
│  │  6. Background jobs:             │                                      ││
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

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 5, TypeScript 5 | SPA with hot-reload |
| **UI** | Radix UI, Tailwind CSS, shadcn/ui | Accessible, themed components |
| **3D Avatar** | Three.js, @react-three/fiber, TalkingHead | Lip-synced animated companion |
| **State** | React Context, TanStack Query | Auth, chat session, data fetching |
| **Backend** | FastAPI, Python 3.12, uvicorn | Async API server |
| **LLM (response)** | ZhipuAI GLM-4-32b-0414-128k | Therapeutic response generation |
| **LLM (NLP/routing)** | Groq qwen/qwen3-32b | Emotion analysis, intent classification, crisis check |
| **LLM (screening)** | Groq llama-3.3-70b-versatile | PHQ-9/GAD-7 clinical scoring, mem0 extraction, importance, reflections, emotional trend |
| **LLM (summaries)** | Google Gemini 2.5 flash lite | End-of-session summaries |
| **STT** | OpenAI Whisper-1 | Speech-to-text transcription |
| **Memory** | mem0 OSS + Qdrant | Semantic long-term user memory |
| **Embeddings** | all-MiniLM-L6-v2 (local HuggingFace) | 384-dim sentence vectors, CPU, zero API cost |
| **TTS** | ElevenLabs → Google Cloud TTS → gTTS | 3-tier fallback speech synthesis |
| **Lip-sync** | Rhubarb CLI → text-based phoneme fallback | Mouth animation timing |
| **Database** | Supabase (PostgreSQL + Auth + RLS) | 12 tables — chat, profiles, crisis, screening, memory |
| **Auth** | Supabase Auth (JWT) | Email/password + Google OAuth |
| **Deploy (backend)** | Railway (Docker) | Multi-stage build, pre-baked ML model |
| **Deploy (frontend)** | Vercel | SPA with rewrite rules |

---

## Repository Structure

```
MindMitra/
├── src/                              # ─── React Frontend ───
│   ├── App.tsx                       # Router (20+ routes), QueryClient, Toaster providers
│   ├── main.tsx                      # ReactDOM.createRoot, App mount point
│   ├── index.css                     # Tailwind base + custom variables
│   ├── App.css                       # SPA layout styles
│   │
│   ├── components/
│   │   ├── Avatar.jsx                # 3D avatar with Talk viseme targets
│   │   ├── Avatar2.jsx               # Alternate avatar model
│   │   ├── Experience.jsx            # Three.js scene (lights, orbit, avatar)
│   │   ├── chat/
│   │   │   ├── ChatGPTInterface.tsx  # Main chat UI (1609 lines)
│   │   │   │   - Message rendering, voice recording, session management
│   │   │   │   - Avatar integration (audio playback + lipsync)
│   │   │   │   - Personality selection, language toggle, history
│   │   │   ├── ChatInterfaceWithSessions.tsx  # Session sidebar variant
│   │   │   └── GirlAvatar.tsx        # Female avatar component
│   │   ├── layout/
│   │   │   └── Header.tsx            # Navigation, auth status, mobile menu
│   │   ├── sections/
│   │   │   ├── WelcomeHero.tsx       # Landing page hero
│   │   │   ├── FeaturesPreview.tsx   # Feature cards
│   │   │   └── StatsSection.tsx      # Usage stats
│   │   └── ui/                       # 40+ shadcn/ui components
│   │       ├── button.tsx, card.tsx, dialog.tsx, input.tsx, ...
│   │       └── sonner.tsx, toast.tsx, toaster.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx               # Supabase auth context (login, signup, signout, user)
│   │   ├── useChat.tsx               # Avatar message queue, lipsync state, audio playback
│   │   ├── useVoiceRecording.tsx     # MediaRecorder → FormData → POST /transcribe
│   │   ├── use-mobile.tsx            # Responsive breakpoint hook
│   │   ├── use-toast.ts             # Toast notifications
│   │   └── useScrollAnimations.tsx   # Intersection observer for scroll FX
│   │
│   ├── lib/
│   │   ├── sessionManager.ts        # Session ID generation + localStorage persistence
│   │   ├── gameDataSaver.tsx         # Game results → Supabase user_activities
│   │   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
│   │
│   ├── pages/
│   │   ├── Auth.tsx                  # Login / Signup page
│   │   ├── Chat.tsx                  # Main chat page (wraps ChatGPTInterface)
│   │   ├── Chat-new.tsx              # Session-based chat variant
│   │   ├── Games.tsx                 # Game selection hub
│   │   ├── BalloonPositivityGame.tsx # Pop negative thought balloons
│   │   ├── EmojiMatch.tsx            # Match emoji to emotion labels
│   │   ├── EmotionMatch.tsx          # Match facial expressions to emotions
│   │   ├── MemoryChallenge.tsx       # Cognitive memory card game
│   │   ├── MoodMountain.tsx          # Mood tracking mountain visual
│   │   ├── ThoughtDetective.tsx      # CBT distortion detective game
│   │   ├── WellnessCheckIn.tsx       # Daily wellness self-assessment
│   │   ├── QATests.tsx               # Internal testing page
│   │   ├── Index.tsx                 # Landing page
│   │   └── NotFound.tsx              # 404 page
│   │
│   └── integrations/supabase/
│       ├── client.ts                 # createClient(url, anonKey)
│       └── types.ts                  # Auto-generated TypeScript types
│
├── chatbotAgent/                     # ─── Python Backend ───
│   ├── app/
│   │   ├── main.py                   # (134 lines) FastAPI factory, CORS, boot sequence
│   │   ├── core/
│   │   │   ├── config.py             # (226 lines) Singleton config: config.yaml + ${ENV_VAR}
│   │   │   ├── auth.py               # JWT verification, SKIP_AUTH dev bypass
│   │   │   └── logging.py            # Compact HH:MM:SS format, 3rd-party suppression
│   │   ├── api/
│   │   │   ├── chat.py               # (487 lines) POST /chat, /chat/stream, GET /chat/greeting
│   │   │   ├── health.py             # GET /health, GET /debug/memory
│   │   │   ├── transcribe.py         # POST /transcribe (OpenAI Whisper STT)
│   │   │   └── onboarding.py         # POST /api/onboarding/* (Groq generation)
│   │   ├── agents/
│   │   │   ├── memory_manager.py     # (1321 lines) mem0 + Qdrant: composite-scored retrieval,
│   │   │   │                         #   reflections, procedural synthesis, emotional trend,
│   │   │   │                         #   session summaries (Gemini), crisis memory
│   │   │   ├── response_agent.py     # (442 lines) GLM response gen, 5 personalities,
│   │   │   │                         #   CoE reasoning (6 intervention <think> blocks),
│   │   │   │                         #   system prompt assembly, activity summarization
│   │   │   ├── intent_router.py      # (141 lines) 4-class Groq classifier, screening-aware
│   │   │   ├── screening_agent.py    # (232 lines) PHQ-9/GAD-7 with EMA smoothing
│   │   │   └── nlp_agent.py          # (48 lines)  Groq client factory
│   │   ├── controllers/
│   │   │   └── glm_controller.py     # (174 lines) Thread-safe ZhipuAI + semaphore + retry
│   │   │                             #   + Groq fallback (llama-4-scout-17b)
│   │   ├── pipeline/
│   │   │   ├── workflow.py           # (1092 lines) THE BRAIN — MindMitraWorkflow orchestrator
│   │   │   │                         #   process_chat → intent route → 4 paths → response
│   │   │   │                         #   Crisis 3-layer gate, screening hint injection,
│   │   │   │                         #   technique directives, activity context
│   │   │   └── context.py            # (93 lines)  UserContext JSON builder (15+ fields)
│   │   ├── services/
│   │   │   ├── supabase_service.py   # (233 lines) All DB ops: messages, activities, screening
│   │   │   ├── tts_service.py        # (207 lines) ElevenLabs → Google Cloud → gTTS
│   │   │   ├── lipsync_service.py    # (154 lines) Rhubarb CLI → text phoneme fallback
│   │   │   └── greeting_service.py   # (228 lines) Time/personality/continuity greetings
│   │   ├── models/
│   │   │   ├── request_models.py     # Pydantic ChatRequest schema
│   │   │   └── response_models.py    # Pydantic ChatResponse schema
│   │   └── utils/
│   │       ├── constants.py          # (80 lines)  All magic numbers (35+ constants)
│   │       └── json_utils.py         # (136 lines) 4-tier LLM JSON parser
│   ├── config.yaml                   # (193 lines) All runtime configuration
│   ├── docs/
│   ├── docs/
│   │   └── MEMORY_ARCHITECTURE.md    # Deep memory system reference
│   ├── ARCHITECTURE.md               # Complete backend architecture (1894 lines)
│   ├── Dockerfile                    # Multi-stage (PyTorch CPU + pre-baked HuggingFace model)
│   ├── Procfile                      # web: uvicorn app.main:app ...
│   ├── requirements.txt              # All Python deps with version pins
│   ├── railway.toml                  # Railway deployment config
│   └── .env.example                  # Complete env var documentation
│
├── supabase/
│   ├── config.toml                   # Supabase project config
│   ├── functions/
│   │   ├── enhanced-chat-context/    # Edge function (chat context enrichment)
│   │   └── speech-to-text/           # Edge function (STT)
│   └── migrations/                   # SQL migrations (applied via Supabase SQL Editor)
│       ├── 20250905_initial.sql
│       ├── 20250911_session_role.sql
│       ├── 20250913_voice_analytics.sql
│       └── 20251101_memories.sql
│
├── public/
│   ├── models/                       # TalkingHead 3D avatar GLTF models
│   ├── sounds/                       # UI sound effects
│   ├── animations/                   # Avatar animation clips
│   └── lovable-uploads/              # User-uploaded assets
│
├── package.json                      # Frontend dependencies
├── vite.config.ts                    # Vite build config (proxy in dev)
├── tailwind.config.ts                # Tailwind theme extensions
├── vercel.json                       # Vercel SPA routing (rewrites to index.html)
├── tsconfig.json                     # TypeScript config
└── components.json                   # shadcn/ui component config
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

# Set backend URL
echo 'VITE_BACKEND_URL=http://localhost:8000' > .env.local

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

Users choose their AI companion, which affects system prompt, voice settings, and greeting style:

| ID | Name | Style | TTS Rate | Best For |
|---|---|---|---|---|
| `mitra` | Mitra 🧘 | Gentle, empathetic | 0.9x | Anxiety, overwhelm |
| `arjun` | Arjun 🎯 | Focused coach | 1.0x | Academic stress, goals |
| `diya` | Diya 💡 | Curious explorer | 0.95x | Understanding emotions |
| `riya` | Riya 🌟 | Energetic cheerleader | 1.1x | Low motivation, confidence |
| `zen` | Zen 🌙 | Mindful guide | 0.85x | Stress relief, grounding |

### Chain-of-Experts (CoE) Reasoning

Responses are guided by intervention-specific `<think>` blocks injected into the system prompt. The intervention type is determined by the pipeline path (from user needs analysis or clinical assessment):

| Intervention | Framework | CoE Think Guidance |
|---|---|---|
| `validate` | Person-Centered | "What specific emotion? What's the unspoken need?" |
| `reframe` | CBT | "What cognitive distortion? What gentle alternative?" |
| `ground` | DBT | "Is user spiraling? What sensory anchor?" |
| `problem-solve` | Reality Therapy | "What specific stressor? What ONE small step?" |
| `refer` | Warm Handoff | "Why beyond my scope? Frame help as strength" |
| `psychoeducation` | Normalize | "What concept is relevant? What simple analogy?" |

`<think>` blocks are stripped from the final response by `_clean()`.

### Memory System

Long-term user memory powered by **mem0 OSS + Qdrant**:

- **Embeddings**: `all-MiniLM-L6-v2` (local, CPU, 384-dim, zero API cost)
- **Extraction**: Every 12 messages → Groq `llama-3.3-70b` extracts atomic facts → Qdrant
- **Retrieval**: Composite scoring: `0.50×relevance + 0.35×importance + 0.15×recency`
- **Memory types**: semantic (facts), procedural (coping strategies), reflections (cross-session insights), crisis
- **Retrieval limits**: casual=3, emotional=5, therapeutic=7, crisis=4 memories
- **Session summaries**: Gemini 2.5 flash lite generates end-of-session summaries
- **Game bridge**: Game results stored as memories for therapeutic reference

See [`chatbotAgent/docs/MEMORY_ARCHITECTURE.md`](chatbotAgent/docs/MEMORY_ARCHITECTURE.md) for complete memory system documentation.

### Clinical Screening (PHQ-9 / GAD-7)

Automated clinical screening estimated from conversation:

- **PHQ-9** (depression): 9 items, score 0–27, 5 severity levels
- **GAD-7** (anxiety): 7 items, score 0–21, 4 severity levels
- **When**: Session-end job (every 36 messages)
- **EMA smoothing**: `α=0.6` (60% new score + 40% historical average)
- **Screening-aware routing**: If PHQ-9 ≥ moderate or GAD-7 ≥ moderate → hint injected into IntentRouter to bias toward therapeutic path

### 7 Therapeutic Games

| Game | Therapeutic Focus | What Gets Stored |
|---|---|---|
| **Balloon Positivity** | Emotional discrimination, resilience | Pop negative balloons, keep positive |
| **Emoji Match** | Emotion recognition | Match emoji to emotion labels |
| **Emotion Match** | Facial expression reading | Match expressions to emotions |
| **Memory Challenge** | Cognitive function | Card matching + memory score |
| **Mood Mountain** | Mood tracking, emotional vocabulary | Self-reported emotions + exercises |
| **Thought Detective** | CBT distortion identification | Identified cognitive distortions |
| **Wellness Check-In** | Self-assessment | Wellness level + focus areas |

Game results are saved to `user_activities` (Supabase) and bridged to mem0 memory for companion reference.

---

## API Reference

### `POST /chat`

Main chat endpoint. Full pipeline execution.

**Headers**: `Authorization: Bearer <supabase-jwt>`

**Request**:
```json
{
  "user_message": "I've been feeling really stressed about exams",
  "session_id": "uuid-v4",
  "personality": "mitra",
  "companion_name": "Mitra",
  "language": "english",
  "avatar_visible": true,
  "voice_analysis": null,
  "recent_messages": []
}
```

**Response**:
```json
{
  "message": "I hear you — exam pressure can feel...",
  "audio": "<base64-wav-or-mp3>",
  "lipsync": {
    "mouthCues": [{"start": 0.0, "end": 0.3, "value": "B"}, ...]
  },
  "animation": "Talking_0",
  "facial_expression": "sad",
  "modality": "Validation",
  "confidence": 0.9,
  "session_insights": {
    "emotional_state": "anxious",
    "stress_categories": ["Academic"],
    "therapeutic_approach": "Validation",
    "cultural_pressures": "exam",
    "language_style": "english",
    "psychological_insights": ["..."],
    "performance_metrics": {
      "context_messages": 4,
      "context_activities": 2,
      "has_summary": false,
      "memory_count": 5
    }
  }
}
```

### `POST /chat/stream`

SSE streaming variant. Same auth/request format. Events: `text_chunk`, `audio_ready`, `lipsync_ready`, `complete`, `error`.

### `GET /chat/greeting`

Personalized session-start greeting. Query params: `session_id`, `user_id`, `personality`, `companion_name`.

### `GET /health`

Railway health check. Returns `{"status": "ok"}` with pipeline/model info.

### `POST /transcribe`

OpenAI Whisper STT. Upload audio file (max 25MB), returns transcript. Requires `OPENAI_API_KEY`.

### `POST /api/onboarding/generate`

Groq-based dynamic onboarding question generation.

---

## Environment Variables

### Backend (Railway / chatbotAgent/.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_KEY` | **Yes** | — | Supabase service role key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Alias (checked first, falls back to `SUPABASE_KEY`) |
| `SUPABASE_JWT_SECRET` | **Yes** | — | JWT verification secret for auth |
| `GROQ_API_KEY` | **Yes** | — | NLP, intent routing, screening, mem0, importance, reflections, trend |
| `ZAI_API_KEY` | **Yes** | — | ZhipuAI GLM-4 (response gen, psych analysis, procedural synthesis) |
| `GOOGLE_API_KEY` | **Yes** | — | Gemini (session summaries) |
| `QDRANT_HOST` | **Yes** | `localhost` | `qdrant.railway.internal` on Railway |
| `QDRANT_PORT` | No | `6333` | Qdrant port |
| `QDRANT_COLLECTION` | No | `companion_memories` | Qdrant collection name |
| `OPENAI_API_KEY` | No | — | Only for `/transcribe` (Whisper STT) |
| `ELEVENLABS_API_KEY` | No | — | Primary TTS (falls back to Google Cloud TTS → gTTS) |
| `ELEVENLABS_VOICE_ID` | No | `vT0wMbLG5dssaBsksrb6` | ElevenLabs voice ID |
| `ELEVENLABS_MODEL_ID` | No | `eleven_v3` | ElevenLabs model |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | — | GCP service account JSON path (local dev) |
| `GOOGLE_CREDENTIALS_BASE64` | No | — | Base64-encoded GCP JSON (Railway deploy) |
| `PORT` | No | `8080` | Railway sets this automatically |
| `LOG_LEVEL` | No | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `SKIP_AUTH` | No | `false` | **Must be false in production** |
| `CORS_ALLOW_ORIGINS` | No | — | Extra allowed origins (comma-separated) |

### Frontend (Vercel / .env.local)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | **Yes** | Backend URL (e.g., `https://your-app.up.railway.app`) |

> **Note**: The Supabase URL and anon key in `src/integrations/supabase/client.ts` are the publishable anon key — designed to be public per Supabase's security model (RLS enforces access).

---

## Database Schema

12 active tables in Supabase PostgreSQL (all with Row Level Security):

| Table | Purpose | Key Columns |
|---|---|---|
| `chat_messages` | All user↔AI messages | user_id, session_id, role, content, metadata |
| `user_activities` | Game results + therapeutic data | activity_type, score, accuracy, insights, evaluation_data |
| `user_profiles` | User demographics | display_name, avatar_url, privacy_flags |
| `user_settings` | Companion personality, theme | companion_personality, avatar_model, theme |
| `user_onboarding` | Onboarding state tracking | onboarding_state, consent, device_tier |
| `crisis_events` | Crisis incident log | level, source (NO user text stored — privacy) |
| `user_contexts` | Full UserContext JSON persistence | context (jsonb), includes screening scores |
| `session_summaries` | AI-generated session summaries | summary_text, themes[], emotional_arc[] |
| `memory_metadata` | mem0 memory tracking | mem0_id, category, importance_score, memory_type |
| `user_memory_stats` | Per-user memory statistics | total_memories, session_count, last_extraction |
| `voice_analytics` | Speech analysis metrics | Per-session voice data |
| `onboarding_analytics` | Onboarding funnel tracking | Funnel conversion data |

---

## LLM Provider Reference (17 Total Calls)

| # | Provider | Model | Purpose | Temperature | When |
|---|---|---|---|---|---|
| 1 | Groq | qwen/qwen3-32b | Intent classification | 0.0 | Every message |
| 2 | Groq | qwen/qwen3-32b | Combined emotion + cultural analysis | 0.0 | Path B |
| 3 | Groq | qwen/qwen3-32b | Crisis yes/no disambiguation | 0.0 | Ambiguous keywords |
| 4 | ZhipuAI | glm-4-32b-0414-128k | Clinical psych analysis | 0.3 | Path C |
| 5 | ZhipuAI | glm-4-32b-0414-128k | Final response generation | 0.3 | Every message |
| 6 | Groq | llama-3.3-70b | Per-message screening | 0.0 | Rarely used |
| 7 | Groq | llama-3.3-70b | Session-level PHQ-9/GAD-7 | 0.0 | Session-end |
| 8 | ZhipuAI | glm-4-32b-0414-128k | Screening fallback | 0.3 | Groq fails |
| 9 | Groq | llama-3.3-70b | mem0 fact extraction | 0.1 | Every 12 msgs |
| 10 | Groq | llama-3.3-70b | Memory importance scoring | 0.1 | After extraction |
| 11 | Google | gemini-2.5-flash-lite | Session summarization | 0.3 | Every 36 msgs |
| 12 | ZhipuAI | glm-4-32b-0414-128k | Procedural memory synthesis | 0.3 | Session-end |
| 13 | Groq | llama-3.3-70b | Cross-session reflections | 0.3 | Every 5 sessions |
| 14 | Groq | llama-3.3-70b | Emotional trend analysis | 0.2 | Every msg (1hr cache) |
| 15 | Groq | llama-4-scout-17b | GLM failure fallback | varies | GLM errors |
| 16 | Groq | qwen/qwen3-32b | Dynamic onboarding generation | varies | Onboarding |
| 17 | OpenAI | whisper-1 | Speech-to-text | — | /transcribe |

---

## Deployment

### Railway (Backend)

1. Create Railway project
2. Add **Qdrant** service (`qdrant/qdrant` Docker image)
3. Add **Backend** service (root: `chatbotAgent`, auto-detects Dockerfile)
4. Set all required environment variables
5. Set `QDRANT_HOST=qdrant.railway.internal`
6. Railway builds automatically from Dockerfile

**Dockerfile highlights**:
- Multi-stage build (builder + runtime)
- PyTorch CPU-only (~200MB vs ~2GB with CUDA)
- `all-MiniLM-L6-v2` pre-downloaded at build time (~90MB baked into image)
- Health check: `GET /health` with 40s timeout, 60s start period

**Procfile**: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Vercel (Frontend)

1. Import repo to Vercel
2. Set `VITE_BACKEND_URL` to Railway backend URL
3. Framework auto-detected (Vite), output: `dist/`
4. `vercel.json` handles SPA routing (all paths → index.html)

---

## Documentation

| Document | Location | Contents |
|---|---|---|
| **This README** | `/README.md` | Full-system overview, setup, deployment |
| **Architecture** | `/chatbotAgent/ARCHITECTURE.md` | Deep backend architecture (1894 lines): every function, flow, prompt, constant |
| **Memory Architecture** | `/chatbotAgent/docs/MEMORY_ARCHITECTURE.md` | Memory system internals: scoring, retrieval, reflections |
| **Backend README** | `/chatbotAgent/README.md` | Quick-start backend reference |

---

## Known Limitations

1. **No rate limiting** — backend has no request throttling
2. **No automated tests** — zero unit or integration tests
3. **No WebSocket support** — frontend uses request-response, SSE endpoint available but unused
4. **Memory extraction is fire-and-forget** — failures logged but not retried
5. **Client-side message saving** — messages saved from browser; tab close mid-save can lose data
6. **No migration runner** — SQL migrations applied manually via Supabase SQL Editor
7. **Single-region** — may cause latency if Railway/Qdrant are distant from target users (India)
8. **No conversation export** — users cannot download their chat history
9. **Single concurrent GLM call** — `Semaphore(1)` serialises ZhipuAI access

---

## License

Private repository. All rights reserved.
