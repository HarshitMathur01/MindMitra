# MindMitra — Architecture Overview

## What Is MindMitra?
A mental health companion platform with AI-powered conversational therapy, therapeutic games, crisis detection, and therapist referral. Users interact with one of 5 AI companion personalities through text/voice chat.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 5.4 |
| UI | shadcn/ui (Radix) + Tailwind CSS 3.4 + Framer Motion |
| State | TanStack React Query + React Context |
| Auth | Supabase Auth (JWT) |
| Backend | FastAPI (Python 3.11) + Uvicorn |
| Primary LLM | ZhipuAI GLM-4-32b-0414-128k (response generation, psych analysis) |
| Fast LLM | Groq qwen3-32b (intent routing, NLP analysis, context merging) |
| Screening LLM | Groq llama-3.3-70b-versatile (PHQ-9/GAD-7, onboarding) |
| Summaries | Google Gemini (session summaries) |
| Database | Supabase PostgreSQL (RLS-protected) |
| Vector DB | Qdrant (384-dim, MiniLM-L6-v2 embeddings, local) |
| Memory | mem0 abstraction layer over Qdrant |
| Voice | Azure Speech SDK (TTS), Groq Whisper (STT fallback), Praat/parselmouth (prosody) |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway (Docker) |

---

## Project Structure

```
MindMitra/
├── src/                          # Frontend (React + TypeScript)
│   ├── pages/                    # 26 route pages
│   │   ├── Chat.tsx              # Main chat interface
│   │   ├── Index.tsx             # Home/landing
│   │   ├── Auth.tsx              # Login/signup
│   │   ├── WellnessCheckIn.tsx   # Mood check-in
│   │   ├── Games.tsx             # Game hub
│   │   ├── TherapistBridge.tsx   # Therapist referral
│   │   ├── PeerSupport.tsx       # Peer support
│   │   └── ...                   # Games, articles, settings, profile
│   ├── components/
│   │   ├── chat/                 # ChatBubble, TalkingHeadAvatar, StreamingText
│   │   ├── onboarding/          # ConsentGate, CrisisInterrupt, FirstTimeExperience
│   │   ├── ui/                  # 50+ shadcn primitives
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.tsx          # Supabase auth context
│   │   ├── useChat.tsx          # Chat session management
│   │   ├── useVoiceRecording.tsx # Audio capture
│   │   ├── useAzureSpeech.tsx   # TTS via Azure
│   │   ├── useOnboardingFlow.ts # Onboarding state machine
│   │   ├── usePersonality.ts    # Companion personality
│   │   └── ...
│   ├── integrations/supabase/
│   │   ├── client.ts            # Supabase JS client
│   │   └── types.ts             # Manual Database type defs
│   ├── lib/
│   │   └── crisisDetection.ts   # Client-side crisis screening
│   └── context/ThemeContext.tsx
│
├── chatbotAgent/                 # Backend (FastAPI)
│   ├── config.yaml              # All tunable settings
│   ├── greeting_pool.json       # Time/language-aware greetings
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── api/
│   │   │   ├── chat.py          # POST /chat, /chat/stream, GET /chat/greeting, POST /transcribe
│   │   │   ├── onboarding.py    # POST /onboarding/mirror-response, /crisis-check
│   │   │   └── health.py        # GET /health
│   │   ├── agents/
│   │   │   ├── response_agent.py   # GLM response generation + system prompt
│   │   │   ├── memory_manager.py   # mem0 + Qdrant memory (singleton)
│   │   │   ├── intent_router.py    # Groq intent classification
│   │   │   ├── analysis_agent.py        # Groq NLP analysis
│   │   │   └── screening_agent.py  # PHQ-9 / GAD-7 scoring
│   │   ├── controllers/
│   │   │   └── llm_controller.py   # Thread-safe ZhipuAI wrapper + streaming
│   │   ├── pipeline/
│   │   │   ├── workflow.py         # Intent-routed orchestrator (Path A/B/C/D)
│   │   │   └── context.py         # UserContext data structures
│   │   ├── services/
│   │   │   ├── supabase_service.py # DB queries (messages, activities, context)
│   │   │   ├── greeting_service.py # Personality + time-aware greetings
│   │   │   └── voice_prosody.py    # Praat prosody analysis
│   │   ├── models/
│   │   │   ├── request_models.py   # ChatRequest, etc.
│   │   │   └── response_models.py  # ChatResponse, etc.
│   │   ├── core/
│   │   │   ├── config.py          # YAML config loader + env substitution
│   │   │   ├── auth.py            # JWT validation
│   │   │   └── logging.py         # Structured logging
│   │   └── utils/
│   │       ├── constants.py       # Thresholds, weights, intervals
│   │       └── json_utils.py      # Robust LLM JSON parsing
│   ├── Dockerfile
│   ├── railway.toml
│   ├── Procfile
│   └── requirements.txt
│
├── supabase/migrations/          # 10 migration files
├── app/                          # Next.js API routes (therapist-bridge)
├── public/                       # Static assets, avatars, animations
├── vercel.json
├── package.json
├── tsconfig.app.json
└── tailwind.config.ts
```

---

## Backend Pipeline Architecture

### Request Flow

```
Client POST /chat or /chat/stream
        │
        ▼
┌─── Pre-Pipeline (parallel) ───────────────────────┐
│  fetch_user_context()     ← Supabase              │
│  load_session_summary()   ← mem0                   │
│  fetch_prev_session()     ← Supabase              │
│  analyze_prosody()        ← Praat (if audio)       │
└────────────────────────────────────────────────────┘
        │
        ▼
┌─── Parallel Phase 1 ──────────────────────────────┐
│  Intent Router (Groq qwen3-32b)  → casual/emotional/therapeutic/crisis │
│  Memory Retrieval (Qdrant+Supabase) → composite-scored memories        │
│  Emotional Trend (mem0)            → cross-session continuity          │
└────────────────────────────────────────────────────┘
        │
        ▼
   Safety Gate: crisis keyword scan
   (hard match → crisis, ambiguous → LLM check)
        │
        ▼
   Conversation Stage Directive
   (msg 1-3: Trust Window, 4-7: Deepening, 8-12: Insight, 13+: Companion)
        │
        ▼
┌─── Path Dispatch ─────────────────────────────────┐
│                                                    │
│  Path A (casual)        Path B (emotional)         │
│  ├─ 1 GLM call          ├─ 1 Groq analysis        │
│  └─ max_tokens=150       ├─ Energy matching        │
│                          └─ 1 GLM response (300)   │
│                                                    │
│  Path C (therapeutic)   Path D (crisis)            │
│  ├─ 1 GLM psych analysis ├─ Hardcoded templates   │
│  ├─ (optional crisis LLM) ├─ Helpline info        │
│  └─ 1 GLM response (500)  └─ Zero LLM calls      │
└────────────────────────────────────────────────────┘
        │
        ▼
   Post-Processing: Question Budget Enforcer
   (strips banned phrases, enforces zero "?" in early stages)
        │
        ▼
   Response → Client (or streamed token-by-token via SSE)
```

### Streaming Flow (`/chat/stream`)

```
Pre-pipeline + analysis run synchronously
        │
        ▼
GLM invoke_stream(stream=True)
        │
        ├── text_chunk events (token-by-token, <think> blocks filtered)
        │
        ▼
   text_done event (cleaned full text after question budget enforcement)
   avatar_ready event (emotion detection)
   complete event
```

---

## API Endpoints

### Chat (`/api/chat.py`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chat` | Single-turn chat (full pipeline, returns complete response) |
| POST | `/chat/stream` | SSE streaming chat (token-by-token) |
| GET | `/chat/greeting` | Time/personality/language-aware greeting |
| POST | `/transcribe` | Groq Whisper STT fallback |

### Onboarding (`/api/onboarding.py`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/onboarding/mirror-response` | Empathy mirror for Act 2 (Groq llama-3.3) |
| POST | `/onboarding/crisis-check` | LLM crisis assessment for ambiguous cases |

### Health (`/api/health.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Railway health check |

---

## LLM Usage Map

| LLM | Provider | Used For |
|-----|----------|----------|
| GLM-4-32b-0414-128k | ZhipuAI | Response generation, psychological analysis (Path C) |
| qwen3-32b | Groq | Intent routing, combined emotion/cultural analysis, context merging |
| llama-3.3-70b-versatile | Groq | PHQ-9/GAD-7 screening, onboarding mirror, crisis LLM check |
| Gemini | Google | Session summaries, memory importance scoring |
| all-MiniLM-L6-v2 | Local | Memory embeddings (384-dim, zero API cost) |

---

## 5 Companion Personalities

| ID | Name | Style | Temperature |
|----|------|-------|-------------|
| mitra | Mitra | Warm, gentle, Hindi/Hinglish touches | 0.45 |
| arjun | Arjun | Direct coach, clarity-focused | 0.45 |
| diya | Diya | Intellectually curious, psychology insights | 0.45 |
| riya | Riya | Energetic, celebratory, emoji-friendly | 0.45 |
| zen | Zen | Calm, mindful, grounding-focused | 0.45 |

System prompt in `response_agent.py` includes:
- 7 Magnetic Companion Rules (statements-first, no questions, energy matching, etc.)
- Forbidden phrases list (clinical/interrogative patterns)
- Chain of Empathy (CoE) reasoning blocks per therapeutic approach
- Conversation stage awareness injected dynamically

---

## Memory System

### Architecture
```
User message → mem0.search() (Qdrant vector similarity)
                    │
                    ▼
            Composite Scoring:
            0.50 × relevance (cosine similarity)
            0.35 × importance (Supabase metadata / 10)
            0.15 × recency (0.999^hours exponential decay)
                    │
                    ▼
            Top-K memories by type:
            ├── Semantic (facts, preferences)
            ├── Procedural (coping strategies)
            └── Reflection (synthesized insights)
```

### Memory Operations
- **Retrieval**: Parallel with intent routing (~200ms)
- **Extraction**: Background thread after response (fire-and-forget)
- **Importance scoring**: Groq LLM rates 1-10
- **Synthesis**: Periodic procedural memory + reflection generation
- **Emotional trend**: Cross-session emotional tracking

---

## Database Schema (Supabase)

### Core Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| chat_messages | Message history (user + assistant) | auth.uid() |
| memories | Semantic/episodic/procedural memory blobs | auth.uid() |
| user_activities | Game scores, insights, evaluations | auth.uid() |
| user_onboarding | Consent, steps, device tier | auth.uid() |
| crisis_events | Crisis detections (no user text stored) | auth.uid() |
| user_settings | Personality, language, theme, avatar | auth.uid() |
| user_profile | Name, bio, avatar URL | auth.uid() |
| user_contexts | Full pipeline context (JSONB) | auth.uid() |
| companion_personalities | 5 personality definitions | public read |
| platform_stats | Aggregate stats | public read |
| voice_analysis_events | Prosody features | auth.uid() |
| onboarding_analytics | Step-level analytics | auth.uid() |

### RPC Functions
- `reset_onboarding(target_user_id)` — SECURITY DEFINER

---

## Conversation Design (Magnetic Companion Framework)

### 7 Rules
1. **Statements first** — Every response starts with a reflective statement
2. **No questions** — Never end a sentence with "?"; use "I wonder..." instead
3. **Match their energy** — Short msg → short reply; long emotional → deeper
4. **Go one layer deeper** — Reflect what they *meant* but didn't say
5. **Open loops** — Leave thoughts incomplete to create pull
6. **Silence is a tool** — End with periods, not question marks
7. **Invisible techniques** — CBT/DBT/grounding without naming them

### Conversation Stages
| Stage | Messages | Behavior |
|-------|----------|----------|
| Trust Window | 1-3 | Zero questions. Pure reflective statements. |
| Deepening | 4-7 | "I wonder..." statements. Pattern reveals. |
| Insight | 8-12 | Therapeutic insights. Curiosity gaps. |
| Companion | 13+ | Casual, short. Earned familiarity. |

### Question Budget Enforcer (post-processing)
- Bans forbidden phrases via regex (replaces with soft statements)
- Trust Window + Deepening stages: ALL "?" → "."
- Later stages: strips trailing questions, caps at 1 "?" per response

### Technique Directives (pure Python, zero LLM)
- `validate` — Reflective statements, unconditional positive regard
- `reframe` — Alternative perspective as gift, not question
- `ground` — Guided sensory statements (DBT distress tolerance)
- `problem-solve` — One concrete next step (Reality Therapy)
- `refer` — Warm professional referral
- `psychoeducation` — Psychology insight as discovery

---

## Performance & Concurrency

### Parallelization
- **Pre-pipeline**: User context + session summary + prev session + prosody → `asyncio.gather()`
- **Routing phase**: Intent classification + memory retrieval + emotional trend → `ThreadPoolExecutor(3)`
- **GLM concurrency**: Semaphore with `max_concurrent: 3`

### Streaming
- GLM `invoke_stream()` with `stream=True` via ZhipuAI SDK
- `<think>` blocks filtered in-flight before yielding to client
- SSE events: `text_chunk` (per token) → `text_done` (cleaned) → `avatar_ready` → `complete`
- Queue-based async/sync bridge for true token streaming

### Typical Latency
| Path | Before Optimization | After |
|------|-------------------|-------|
| A (casual) | ~500-800ms | ~400-600ms |
| B (emotional) | ~1200-1500ms | ~800-1000ms |
| C (therapeutic) | ~1000-1300ms | ~800-1100ms |
| D (crisis) | <100ms | <100ms |
| Time to first token (stream) | ~1200ms | ~600-800ms |

---

## Crisis Detection (Multi-Layer)

```
Layer 1: Client-side keyword scan (crisisDetection.ts)
    → English + Hindi (Devanagari + Roman)
    → Levels: critical / high / medium / none

Layer 2: Backend keyword scan (_check_crisis_keywords)
    → Hard match → immediate crisis path (no LLM)
    → Ambiguous → Groq LLM check

Layer 3: Intent router classification
    → Can independently classify as "crisis"

Safety gate: crisis keyword check CANNOT be bypassed
    → Overrides any non-crisis intent classification
```

---

## Greeting System

### Layers
1. **Personality greetings** — Statement-based, no questions (5 personalities × first-time + returning)
2. **Time-of-day pool** — 5 time slots × 3 languages × 8 variations = ~120 greetings
3. **Cross-session continuity** — Theme-based callbacks from previous sessions (12 themes)
4. **Returning user detection** — Supabase previous session summary → memory-powered greeting

### Languages
- English, Hinglish (Hindi+English mix), Hindi-mixed (more Hindi)

---

## Deployment

### Frontend (Vercel)
- `vercel.json`: Build `npm run build`, output `dist/`, framework vite
- Auto-deploy from git

### Backend (Railway)
- `railway.toml`: Dockerfile builder, health check `/health`, 40s check timeout
- `Dockerfile`: Multi-stage (builder + runtime), CPU-only PyTorch, pre-cached MiniLM model
- `Procfile`: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}`

### Environment Variables
- `GROQ_API_KEY`, `ZAI_API_KEY`, `GOOGLE_API_KEY`
- `SUPABASE_URL`, `SUPABASE_KEY`
- `QDRANT_HOST`, `QDRANT_PORT`
- `GOOGLE_APPLICATION_CREDENTIALS_BASE64` (Cloud TTS)
- `PORT`, `LOG_LEVEL`, `SKIP_AUTH`

---

## Key Commands

```bash
# Frontend
npm run dev              # Vite dev server (localhost:8080)
npm run build            # Production build → dist/
tsc --noEmit -p tsconfig.app.json  # Type check

# Backend
cd chatbotAgent
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000  # Dev server
python -c "from app.main import app"       # Import check
```

---

## Key Dependencies

### Python (`requirements.txt`)
- fastapi, uvicorn, pydantic
- groq (Groq SDK), zai-sdk (ZhipuAI), google-generativeai (Gemini)
- supabase, postgrest
- mem0ai, qdrant-client, sentence-transformers
- praat-parselmouth (voice prosody)
- pyyaml, python-dotenv, httpx, tenacity

### JavaScript (`package.json`)
- react, react-dom, react-router-dom, vite, typescript
- @supabase/supabase-js, @tanstack/react-query
- @radix-ui/*, tailwindcss, framer-motion, lucide-react
- microsoft-cognitiveservices-speech-sdk (Azure TTS)
- zod, react-hook-form, recharts, jspdf
