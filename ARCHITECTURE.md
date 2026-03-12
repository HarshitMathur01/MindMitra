# MindMitra — System Architecture

A comprehensive architecture overview for developers and GitHub visitors. For setup instructions, see [README.md](README.md).

---

## High-Level Overview

```
    ┌──────────────┐       HTTPS        ┌──────────────┐
    │   Browser    │ ◄────────────────► │   Backend    │
    │              │   POST /chat       │   (Railway)  │
    │  React SPA   │   GET /greeting    │   FastAPI    │
    │  (Vercel)    │   POST /transcribe │   Python 3.12│
    └──────┬───────┘                    └──────┬───────┘
           │                                    │
     ┌─────┴──────┐                    ┌───────┴────────┐
     │ TalkingHead│                    │   External     │
     │  (iframe)  │                    │   Services     │
     │ + Bridge   │                    │                │
     │ + TTS      │                    │ • Supabase     │
     └────────────┘                    │ • Qdrant       │
                                       │ • Groq API     │
                                       │ • ZhipuAI API  │
                                       │ • Gemini API   │
                                       │ • OpenAI API   │
                                       └────────────────┘
```

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx (Router + Providers)
├── Auth.tsx ─────────── Supabase Auth (login/signup)
├── Index.tsx ────────── Landing page
│   ├── WelcomeHero
│   ├── FeaturesPreview
│   └── StatsSection
├── Chat.tsx ─────────── Main chat page
│   └── ChatGPTInterface.tsx (1609 lines)
│       ├── Message list + rendering
│       ├── Voice recording (useVoiceRecording)
│       ├── Session management (sessionManager)
│       ├── Personality selector
│       └── TalkingHeadAvatar.tsx ◄── Avatar iframe wrapper
│           └── <iframe src="talkinghead.html"> ◄── All avatar logic
│               ├── TalkingHead v1.7 (3D render + viseme engine)
│               ├── MindMitraBridge (therapeutic expression layer)
│               └── TTS pipeline (Google → Azure → Web Speech)
├── Games.tsx ────────── 7 therapeutic games hub
│   ├── BalloonPositivityGame
│   ├── EmojiMatch
│   ├── EmotionMatch
│   ├── MemoryChallenge
│   ├── MoodMountain
│   ├── ThoughtDetective
│   └── WellnessCheckIn
└── Chat-new.tsx ─────── Session-based chat variant
```

### Avatar Pipeline (In-Browser)

```
┌─────────────────────────────────────────────────────────────────────┐
│  talkinghead.html (iframe)                                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     TalkingHead v1.7                          │  │
│  │                                                               │  │
│  │  3D Scene (Three.js)                                          │  │
│  │  ├── Avatar mesh (GLTF model)                                │  │
│  │  ├── Morph targets (52 ARKit blendshapes)                    │  │
│  │  ├── Viseme engine (word → phoneme → mouth shape)            │  │
│  │  └── Animation loop (requestAnimationFrame)                  │  │
│  │                                                               │  │
│  │  speakAudio({audio, words, wtimes, wdurations})              │  │
│  │  └── Decodes audio → plays → drives visemes from timestamps  │  │
│  │                                                               │  │
│  │  speakText(text)                                              │  │
│  │  └── Text-based lipsync (estimated phoneme durations)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   MindMitraBridge (893 lines)                 │  │
│  │                                                               │  │
│  │  Therapeutic Moods (7):                                       │  │
│  │  ├── empathy      → soft brows, gentle eyes, slight lean     │  │
│  │  ├── concern      → furrowed brows, attentive gaze           │  │
│  │  ├── encouragement → warm smile, upright posture             │  │
│  │  ├── acknowledgment → slow nod, open expression              │  │
│  │  ├── calm         → relaxed face, steady breathing           │  │
│  │  ├── listening    → slight head tilt, focused eyes           │  │
│  │  └── neutral      → relaxed default                          │  │
│  │                                                               │  │
│  │  Gestures: slow_nod, lean_forward, thinking_tilt,            │  │
│  │            agreement_nod                                      │  │
│  │                                                               │  │
│  │  Per-frame hook: amplitude → jaw boost (additive to visemes) │  │
│  │  Emotion timeline: smooth mood transitions over N frames     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      TTS Pipeline                             │  │
│  │                                                               │  │
│  │  Priority 1: Google Cloud TTS v1beta1                        │  │
│  │  ├── SSML with <mark> timepoints                             │  │
│  │  ├── Returns audioContent + per-word timestamps              │  │
│  │  └── → head.speakAudio() = PERFECT word-level lipsync        │  │
│  │                                                               │  │
│  │  Priority 2: Azure Cognitive Services TTS                    │  │
│  │  ├── Neural voice (en-IN-NeerjaNeural)                       │  │
│  │  ├── REST API → audio blob                                   │  │
│  │  ├── Word timings estimated from audio duration              │  │
│  │  └── → head.speakAudio() = GOOD proportional lipsync         │  │
│  │                                                               │  │
│  │  Priority 3: Web Speech API (browser built-in)               │  │
│  │  ├── SpeechSynthesisUtterance for audio                      │  │
│  │  ├── head.speakText() for text-based lipsync                 │  │
│  │  └── → BASIC separate audio + estimated lipsync              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  PostMessage Bridge (React ↔ iframe):                               │
│  ├── speakText   → triggers TTS + lipsync                          │
│  ├── stopSpeaking → cancels speech                                 │
│  ├── setEmotion  → bridge.setEmotion(emotion, intensity)           │
│  ├── triggerGesture → bridge.triggerGesture(gesture)               │
│  ├── ready       → iframe loaded successfully                      │
│  ├── speakingStart → avatar began speaking                         │
│  └── speakingEnd → avatar finished speaking                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: User Message → Avatar Response

```
1. User types/speaks message
   │
2. ChatGPTInterface.tsx
   ├── POST /chat (Bearer JWT) → backend
   ├── OR POST /chat/stream (SSE) → backend
   │
3. Backend returns:
   │  {
   │    message: "I hear you...",
   │    facial_expression: "empathy",     ◄── 11 therapeutic emotions
   │    animation: "Talking_0",
   │    modality: "Validation",
   │    confidence: 0.9,
   │    session_insights: { ... }
   │  }
   │
4. useChat.tsx queues message for avatar
   │
5. TalkingHeadAvatar.tsx
   ├── postMessage({type: "setEmotion", emotion: "empathy"})
   └── postMessage({type: "speakText", text: "I hear you..."})
         │
6. talkinghead.html receives message
   ├── MindMitraBridge.setEmotion("empathy")  → upper face + gesture
   └── TTS pipeline:
       ├── Google TTS? → fetchGoogleTTS() → head.speakAudio(audio + timestamps)
       ├── Azure TTS?  → fetchAzureTTS()  → head.speakAudio(audio + est. times)
       └── Web Speech?  → speakWithWebSpeech() + head.speakText()
             │
7. Avatar speaks with synchronized lip-sync + therapeutic expression
   │
8. On finish: postMessage({type: "speakingEnd"}) → onMessagePlayed()
```

---

## Backend Architecture

### Pipeline Flow

```
POST /chat
  │
  ▼
auth.py ──► JWT verification (Supabase)
  │
  ▼
chat.py ──► Endpoint handler
  │
  ▼
workflow.py ──► MindMitraWorkflow.process_chat()
  │
  ├── 1. context.py ──► Build UserContext (15+ fields)
  ├── 2. memory_manager.py ──► Fetch relevant memories (composite score)
  ├── 3. supabase_service.py ──► Fetch screening scores
  │
  ▼
intent_router.py ──► Classify intent (Groq qwen3-32b)
  │                    + screening hint injection
  │                    + activity awareness
  │
  ├── casual ────────► response_agent.py (1 GLM, 150 tok)
  ├── emotional ─────► nlp_agent + response_agent (Groq + GLM, 300 tok)
  ├── therapeutic ───► clinical analysis + response_agent (1-2 GLM, 500 tok)
  └── crisis ────────► Template response (0 LLM calls, safety resources)
  │
  ▼
chat.py ──► _detect_emotion() → 11 therapeutic emotions
  │
  ▼
ChatResponse JSON ──► { message, facial_expression, animation,
                        modality, confidence, session_insights }
```

### 11 Therapeutic Emotions

The backend `_detect_emotion()` function in `chat.py` maps response content to therapeutic emotions that drive the avatar's upper-face expressions:

| Emotion | Detection Signal |
|---|---|
| `empathy` | Keywords: understand, hear you, must be, that sounds |
| `concern` | Keywords: worried, difficult, struggling, tough |
| `encouragement` | Keywords: proud, amazing, great job, well done |
| `acknowledgment` | Keywords: valid, makes sense, of course, naturally |
| `calm` | Keywords: breathe, relax, peaceful, gentle, ground |
| `listening` | Keywords: tell me more, go on, I'm here, share |
| `happy` | Keywords: wonderful, fantastic, celebrate, joy |
| `sad` | Keywords: sorry, loss, grief, miss |
| `angry` | Keywords: unfair, wrong, boundaries |
| `surprised` | Keywords: wow, incredible, didn't expect |
| `neutral` | Default fallback |

### Memory System

```
User messages (every 12)
  │
  ▼
Groq llama-3.3-70b ──► Extract atomic facts
  │
  ▼
all-MiniLM-L6-v2 ──► 384-dim embedding (CPU, local)
  │
  ▼
Qdrant ──► Store with metadata (importance, type, timestamp)

                    ┌────────────────────────────────┐
Retrieval:          │ score = 0.50 × relevance       │
(per-message)       │       + 0.35 × importance       │
                    │       + 0.15 × recency           │
                    └────────────────────────────────┘

Memory Types:
├── semantic     → facts about user (name, interests, family)
├── procedural   → coping strategies that worked
├── reflections  → cross-session insights (every 5 sessions)
└── crisis       → crisis event records (no user text)
```

### Background Jobs (Non-Blocking)

```
Main request thread ──► Returns response immediately
  │
  └── Spawns daemon threads:
      ├── Memory extraction     (every 12 messages)
      ├── Session summary       (every 36 messages, Gemini)
      ├── PHQ-9/GAD-7 scoring   (session-end, EMA-smoothed)
      ├── Procedural synthesis   (coping keyword trigger)
      ├── Reflection generation  (every 5 sessions)
      └── Game→mem0 bridge      (on game activity)
```

### LLM Provider Map (17 Total Calls)

```
┌────────────────────────────────────────────────────────────┐
│                      LLM Providers                         │
│                                                            │
│  Groq (qwen3-32b)           ZhipuAI (GLM-4-32b)          │
│  ├── Intent classification   ├── Response generation       │
│  ├── Emotion analysis        ├── Clinical psych analysis   │
│  ├── Crisis disambiguation   ├── Procedural synthesis      │
│  └── Onboarding generation   └── Screening fallback        │
│                                                            │
│  Groq (llama-3.3-70b)       Google (Gemini 2.5 flash)     │
│  ├── PHQ-9/GAD-7 scoring     └── Session summarization     │
│  ├── mem0 fact extraction                                  │
│  ├── Memory importance        OpenAI (Whisper-1)           │
│  ├── Cross-session reflections└── Speech-to-text           │
│  └── Emotional trend analysis                              │
│                                                            │
│  Groq (llama-4-scout-17b)   HuggingFace (all-MiniLM-L6)  │
│  └── GLM failure fallback    └── Local embeddings (CPU)    │
└────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL                     │
│                  (Row Level Security)                    │
│                                                         │
│  Core:                                                  │
│  ├── chat_messages      (user_id, session_id, role)    │
│  ├── user_profiles      (display_name, avatar_url)     │
│  ├── user_settings      (personality, theme)           │
│  └── user_onboarding    (state, consent, device_tier)  │
│                                                         │
│  Clinical:                                              │
│  ├── crisis_events      (level, source — NO user text) │
│  ├── user_contexts      (full context JSONB)           │
│  └── session_summaries  (themes[], emotional_arc[])    │
│                                                         │
│  Memory:                                                │
│  ├── memory_metadata    (mem0_id, importance, type)    │
│  └── user_memory_stats  (total, session_count)         │
│                                                         │
│  Activities:                                            │
│  ├── user_activities    (game type, score, insights)   │
│  ├── voice_analytics    (speech metrics)               │
│  └── onboarding_analytics (funnel data)                │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
                    ┌─────────────┐
                    │   Vercel    │
                    │  Frontend   │
                    │  (React SPA)│
                    └──────┬──────┘
                           │ HTTPS
                           ▼
                    ┌─────────────┐         ┌─────────────┐
                    │   Railway   │────────►│   Qdrant    │
                    │   Backend   │  gRPC   │  (Railway)  │
                    │  (FastAPI)  │         │  384-dim    │
                    └──────┬──────┘         └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Supabase │ │ LLM APIs │ │ Browser  │
        │  (DB +   │ │ (Groq,   │ │ TTS APIs │
        │   Auth)  │ │  ZhipuAI,│ │ (Google, │
        │          │ │  Gemini, │ │  Azure)  │
        │          │ │  OpenAI) │ │          │
        └──────────┘ └──────────┘ └──────────┘
```

> **Key insight**: TTS APIs (Google Cloud, Azure) are called directly from the browser (iframe), not from the backend. This eliminates server-side audio processing, reduces backend complexity, and enables real-time word-level lip-sync.

---

## Security Model

- **Authentication**: Supabase JWT — verified server-side via `SUPABASE_JWT_SECRET`
- **Authorization**: PostgreSQL Row Level Security — users can only access their own data
- **Crisis data**: `crisis_events` stores severity level + source only — **never stores user text**
- **TTS keys**: Passed to avatar iframe as URL params (frontend env vars, not exposed to backend)
- **CORS**: Configured per-environment via `CORS_ALLOW_ORIGINS`
- **Rate limiting**: Not implemented (known limitation)

---

## Further Reading

| Document | Lines | What's Inside |
|---|---|---|
| [README.md](README.md) | ~450 | Setup guide, quick start, API reference |
| [chatbotAgent/docs/ARCHITECTURE.md](chatbotAgent/docs/ARCHITECTURE.md) | 1,894 | Every function signature, every LLM call, every prompt template |
| [chatbotAgent/docs/MEMORY_ARCHITECTURE.md](chatbotAgent/docs/MEMORY_ARCHITECTURE.md) | — | Memory scoring, retrieval, reflections, game bridge |
| [chatbotAgent/README.md](chatbotAgent/README.md) | ~230 | Backend quick-start, module reference, constants |
