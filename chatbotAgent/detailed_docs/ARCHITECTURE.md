# MindMitra — Backend Architecture Deep Dive

> **Version**: v2 (Intent-Routed Pipeline with CoE Reasoning)
> **Runtime**: FastAPI 0.115 · Python 3.12 · uvicorn
> **Deploy**: Railway (backend) · Vercel (frontend)
> **Total backend**: ~6,000 lines across 24 Python files
> **Last updated**: March 2026

This document is the technical reference for the MindMitra chatbot backend. Every function, every LLM call, every constant, every database table is documented here. If you need memory-system specifics, see [`docs/MEMORY_ARCHITECTURE.md`](docs/MEMORY_ARCHITECTURE.md).

---

## Table of Contents

1.  [System Overview](#1-system-overview)
2.  [Boot Sequence](#2-boot-sequence)
3.  [Request Lifecycle](#3-request-lifecycle)
4.  [The Pipeline Orchestrator](#4-the-pipeline-orchestrator)
5.  [Intent Classification & Routing](#5-intent-classification--routing)
6.  [Crisis Safety System](#6-crisis-safety-system)
7.  [Execution Paths](#7-execution-paths)
    - [Path A — Casual](#71-path-a--casual)
    - [Path B — Emotional](#72-path-b--emotional)
    - [Path C — Therapeutic](#73-path-c--therapeutic)
    - [Path D — Crisis](#74-path-d--crisis)
8.  [Response Generation & CoE Reasoning](#8-response-generation--coe-reasoning)
9.  [Memory System](#9-memory-system)
10. [Background Jobs & Triggers](#10-background-jobs--triggers)
11. [Clinical Screening (PHQ-9 / GAD-7)](#11-clinical-screening-phq-9--gad-7)
12. [TTS Pipeline](#12-tts-pipeline)
13. [Lipsync Pipeline](#13-lipsync-pipeline)
14. [Greeting Service](#14-greeting-service)
15. [Services Layer](#15-services-layer)
16. [UserContext Schema](#16-usercontext-schema)
17. [API Endpoints](#17-api-endpoints)
18. [Database Schema](#18-database-schema)
19. [All LLM Calls Reference](#19-all-llm-calls-reference)
20. [Constants Reference](#20-constants-reference)
21. [Environment Variables](#21-environment-variables)
22. [Feature Flags](#22-feature-flags)
23. [File Structure](#23-file-structure)
24. [Module Dependency Graph](#24-module-dependency-graph)
25. [Deployment](#25-deployment)
26. [Logging & Observability](#26-logging--observability)

---

## 1. System Overview

MindMitra is a culturally-aware AI mental health companion for Indian youth (16–25). The backend is a FastAPI service that receives user messages from a React/Vite frontend, routes them through an intent-classified pipeline, generates therapeutic responses via multiple LLM providers, and returns text + audio + lipsync data for a 3D avatar.

```
  Vercel (React 18 / Vite / TypeScript / Three.js)
         │
         │  POST /chat  { user_message, session_id, personality, language, ... }
         │  Authorization: Bearer <supabase-jwt>
         ▼
  Railway (FastAPI)  ←──── chatbotAgent/
         │
         ├── IntentRouter (Groq qwen3-32b)    — classify message
         ├── Crisis safety gate                — keyword + LLM (always runs)
         ├── Memory retrieval (mem0 + Qdrant)  — fetch user memories
         ├── Emotional trend (Groq)            — cross-session continuity
         │
         ├── Path A: Casual       — 1 GLM call, max_tokens=150
         ├── Path B: Emotional    — 1 Groq + 1 GLM, max_tokens=300
         ├── Path C: Therapeutic  — 1–2 GLM + optional Groq, max_tokens=500
         └── Path D: Crisis       — 0 LLM (template response)
                │
                ├── TTS (ElevenLabs → Google Cloud → gTTS)
                ├── Lipsync (Rhubarb CLI → text fallback)
                │
                ▼
         Return { message, audio, lipsync, animation, facial_expression,
                  modality, confidence, session_insights }
                │
                └── Background threads:
                      ├── Save UserContext (file + Supabase)
                      ├── Memory extraction (every 12 msgs)
                      ├── Session summary (every 36 msgs, Gemini)
                      ├── Procedural synthesis (keyword-triggered)
                      ├── Reflection generation (every 5 sessions)
                      ├── PHQ-9/GAD-7 screening (session-end)
                      └── Game→mem0 bridge (activity insights)
```

### Design Principles

| Principle | Implementation |
|---|---|
| **No wasted LLM calls** | Casual = 1 call; emotional = 2; therapeutic = 2-3. Path D = 0 |
| **Crisis cannot be bypassed** | 3-layer safety gate runs BEFORE intent dispatch |
| **Memory-first** | Every response sees relevant memories + emotional trend |
| **CoE reasoning** | Chain-of-Experts `<think>` blocks mapped to 6 intervention types |
| **Screening-aware routing** | PHQ-9/GAD-7 scores hint IntentRouter toward therapeutic |
| **Zero API change** | `/chat` contract unchanged across all architecture versions |
| **Fail-safe everything** | Every agent/service wrapped in try/except; pipeline never crashes |

### LLM Provider Stack

| Provider | Model | Used For | Why |
|---|---|---|---|
| **Groq** | `qwen/qwen3-32b` | Intent routing, emotion analysis, crisis check | Fast (< 300ms), free tier |
| **Groq** | `llama-3.3-70b-versatile` | Screening, mem0 extraction, importance scoring, reflections, emotional trend, procedural synthesis | Best open-source reasoning |
| **ZhipuAI** | `glm-4-32b-0414-128k` | Response generation, psych analysis | 128k context, strong Chinese/multilingual |
| **Google** | `gemini-2.5-flash-lite` | Session summaries | Cheap, fast summarization |
| **Groq** | `whisper-large-v3-turbo` | Speech-to-text fallback (POST /transcribe) | Robust noisy-audio fallback |
| **HuggingFace** | `all-MiniLM-L6-v2` | Memory embeddings (LOCAL, no API) | 384-dim, CPU, zero cost |

---

## 2. Boot Sequence

Entry point: `app/main.py` (134 lines). The boot order is critical — `/health` must respond before heavy imports complete.

```
uvicorn app.main:app
    │
    ├─ 1. warnings.filterwarnings("ignore", FutureWarning)
    ├─ 2. load_dotenv()  (reads chatbotAgent/.env)
    ├─ 3. configure_logging()  → HH:MM:SS L <msg> format
    │       └─ Suppresses: httpx, groq, openai, zhipuai, qdrant_client, mem0, urllib3 → WARNING
    │
    ├─ 4. Create FastAPI app (title="MindMitra Chatbot Agent", version="2.0.0")
    │       └─ lifespan= logs all env var status (✅/❌) at startup
    │
    ├─ 5. Register /health router IMMEDIATELY (before heavy imports)
    │       └─ Railway health check hits /health during build — must work before agents init
    │
    ├─ 6. Google credentials decode (if GOOGLE_CREDENTIALS_BASE64):
    │       └─ base64 → temp .json file → sets GOOGLE_APPLICATION_CREDENTIALS
    │
    ├─ 7. CORS middleware:
    │       ├─ Hardcoded origins: mindmitra.co.in, vercel, localhost:8080/3000/8000/8001
    │       ├─ Extra from CORS_ALLOW_ORIGINS env var (comma-separated)
    │       └─ Regex: https?://(localhost|127\.0\.0\.1)(:\d+)?$
    │
    └─ 8. Include routers (triggers heavy imports):
            ├─ chat_router    → imports workflow.py → imports ALL agents
            ├─ transcribe_router
            └─ onboarding_router

Heavy import chain (triggered by step 8):
  chat.py → workflow.py → MindMitraWorkflow.__init__()
    ├─ GroqNLPModule()         → Groq client (qwen3-32b)
    ├─ GLMController()         → ZhipuAI client (glm-4-32b-0414-128k)
    ├─ ScreeningAssessmentAgent(groq_nlp, glm)
    ├─ ResponseGenerator(glm)
    ├─ IntentRouter(groq_nlp.client, groq_nlp.model)
    └─ Supabase client (create_client)

  memory_manager.py (module-level):
    └─ MemoryManager() singleton
        └─ Spawns background thread "mem0-init":
              ├─ Memory.from_config() → loads all-MiniLM-L6-v2 + connects Qdrant
              ├─ genai.configure() → Gemini (session summaries)
              ├─ GLMController() → for procedural synthesis
              └─ Groq() client → for importance scoring
```

**Why this order matters**: Railway's health check has a 40-second timeout. If `/health` is registered AFTER the heavy imports (which take 10-20s for model loading), the health check fails and Railway kills the container. By registering `/health` first, the service is "healthy" while agents initialize in the background.

---

## 3. Request Lifecycle

When `POST /chat` is called, here's the exact flow through `chat.py`:

```
POST /chat (ChatRequest)
    │
    ├─ 1. validate_user_token(authorization)  → user_id (or SKIP_AUTH dev bypass)
    │
    ├─ 2. fetch_user_context(user_id, session_id)   [Supabase]
    │       ├─ user_activities (last 24h, up to 50)
    │       ├─ recent_messages (last 10, chronological)
    │       └─ conversation_summary: {}
    │
    ├─ 3. memory_manager.load_session_summary(session_id)   [Supabase]
    │       └─ {summary, themes[], emotional_arc[]}
    │
    ├─ 4. fetch_previous_session_summary(user_id, session_id)   [Supabase]
    │       └─ For cross-session continuity (skips current session)
    │
    ├─ 5. process_user_chat(...)   ← THE MAIN PIPELINE
    │       └─ Returns: {message, modality, confidence, processing_time, session_insights}
    │
    ├─ 6. _build_avatar_package(ai_text, result, avatar_visible, personality)
    │       ├─ Skip TTS if avatar_visible=false (latency optimization)
    │       ├─ _detect_emotion(ai_text) → {emotion, facial_expression}
    │       ├─ generate_tts_audio_v2(text, emotion, lang, personality)
    │       ├─ generate_lipsync_from_audio(audio, text)  or  _from_text(text)
    │       └─ Returns: {audio, lipsync, animation, facial_expression}
    │
    ├─ 7. Background triggers:
    │       ├─ _maybe_trigger_memory(session_id, user_id)
    │       │     └─ Every 12 messages → fetch last 12 msgs → memory_manager.add_memories()
    │       ├─ Session-end jobs (every 36 messages):
    │       │     └─ _run_session_end_jobs() in background thread
    │       └─ Game→mem0 bridge:
    │             └─ _extract_game_insights_for_memory(activities, user_id)
    │
    └─ 8. Return ChatResponse
```

---

## 4. The Pipeline Orchestrator

**File**: `pipeline/workflow.py` (1,092 lines) — the largest and most important file.

### `MindMitraWorkflow` (singleton via `get_workflow_instance()`)

```python
class MindMitraWorkflow:
    def __init__(self):
        # Reads config sections
        self.workflow_config = config.get_section("workflow")     # max_workers, merge_strategy, etc.
        self.feature_flags = config.get_section("features")       # nlp_analysis, save_to_supabase, etc.
        self.max_workers = self.workflow_config.get("max_workers", 3)

        # Initialize all agents
        self.groq_nlp = GroqNLPModule()                          # Groq client factory
        self.glm = GLMController()                                # Thread-safe ZhipuAI wrapper
        self.screening_agent = ScreeningAssessmentAgent(groq_nlp, glm)
        self.response_gen = ResponseGenerator(glm)
        self.intent_router = IntentRouter(groq_nlp.client, groq_nlp.model)
        self.supabase = create_client(url, key)                   # Supabase client

        # Caches
        self._summarization_cache = {}
        self._last_summarization_count = {}
```

### `process_chat()` — Main Entry Point

**Signature**:
```python
def process_chat(
    self,
    user_message: str,
    recent_messages: Optional[List] = None,
    conversation_summary: Optional[Dict] = None,
    user_activities: Optional[List] = None,
    user_patterns: Optional[Dict] = None,
    voice_analysis: Optional[Dict] = None,
    user_id: str = "anonymous",
    session_id: Optional[str] = None,
    personality: Optional[str] = None,
    companion_name: Optional[str] = None,
    language: Optional[str] = None,
    previous_session_summary: Optional[Dict] = None,
) -> Dict[str, Any]:
```

**Flow**:
```
1. create_empty_user_context(user_id, session_id, user_message)   [context.py]
2. Populate ctx fields from arguments:
    ├─ voice_analysis
    ├─ session_context.recent_messages
    ├─ session_context.conversation_summary
    ├─ session_context.user_activities
    ├─ session_context.user_patterns
    ├─ previous_session_summary
    └─ personality_settings: {personality, companion_name, language}
         Personality resolution: mitra→"Mitra", arjun→"Arjun", diya→"Diya", riya→"Riya", zen→"Zen"
3. _route_and_execute(ctx, session_id)   ← where all the magic happens
4. Background: save_user_context_to_file(ctx, filename)   [daemon thread]
5. Build return dict:
    {message, modality, confidence, processing_time, voice_aware, session_insights}
```

### `_route_and_execute()` — The Router

This is the core decision-making function. Here's every step:

```
1. SCREENING HINT INJECTION:
   ├─ fetch_latest_screening_scores(user_id)   [Supabase]
   ├─ If PHQ-9 severity ∈ {moderate, moderately_severe, severe}
   │   OR GAD-7 severity ∈ {moderate, severe}:
   │   → screening_hint = "PHQ-9=moderate (score 14), GAD-7=mild (score 6)"
   └─ This hint is passed to IntentRouter.classify() to bias toward therapeutic

2. INTENT CLASSIFICATION:
   ├─ IntentRouter.classify(text, recent_messages, activities, screening_hint)
   │   → {intent: "emotional", confidence: 0.87}
   └─ If router unavailable → default to {intent: "emotional", confidence: 0.5}

3. CRISIS SAFETY GATE:
   (runs ONLY if intent ≠ crisis, otherwise Layer 3 already confirmed)
   ├─ _check_crisis_keywords(text) → "safe" | "hard" | "ambiguous"
   ├─ "hard" → override intent to "crisis" immediately
   ├─ "ambiguous" → _crisis_llm_check(text) via Groq yes/no
   │   └─ If yes → override intent to "crisis"
   └─ "safe" → pass through

4. MEMORY RETRIEVAL:
   ├─ memory_manager.retrieve_memories(text, user_id, intent)
   │   └─ Composite-scored memories injected into ctx["memory_context"]
   └─ memory_manager.get_emotional_trend(user_id)
       └─ Appended as "📈 EMOTIONAL TREND (recent sessions): ..."

5. DISPATCH:
   ├─ crisis     → _crisis_fast_path(ctx)        [Path D]
   ├─ casual     → _path_light(ctx)              [Path A]
   ├─ emotional  → _path_standard(ctx)           [Path B]
   └─ therapeutic → _path_rich(ctx)               [Path C]
```

---

## 5. Intent Classification & Routing

**File**: `agents/intent_router.py` (141 lines)

### `IntentRouter.classify()`

**LLM Call**: Groq `qwen/qwen3-32b`, temperature=0.0, max_tokens=60

```python
def classify(
    self,
    user_message: str,
    recent_messages: Optional[List[Dict]] = None,
    activities: Optional[List[Dict]] = None,
    screening_hint: Optional[str] = None,
) -> Dict[str, Any]:
```

**Prompt Template** (exact):
```
Classify the user message. Return ONLY JSON with keys "intent" and "confidence".
"intent" must be exactly one of: casual, emotional, therapeutic, crisis
Definitions:
  casual      — greetings, small talk, boredom, playful chat, simple curiosity
  emotional   — sharing feelings, mild stress, venting, seeking validation
  therapeutic — explicit distress, persistent low mood, trauma disclosure, mental health struggle
  crisis      — suicidal ideation, explicit self-harm statements, immediate safety risk
"confidence": float 0.0-1.0

Context: {last 2 messages, 80 chars each}
Recent activity: {latest game type + score + wellness level}
Clinical screening: {PHQ-9=moderate (score 14), GAD-7=mild (score 6)}
Message: "{user_message[:400]}"

JSON:
```

**Key details**:
- `_format_history()` takes the last 2 messages, truncated to 80 chars each
- `_format_activity_hint()` takes the latest activity's type, score, and wellness level
- `screening_hint` is injected only if PHQ-9 ≥ moderate or GAD-7 ≥ moderate
- On parse failure or invalid intent → returns `{"intent": "emotional", "confidence": 0.5}` (safe default)
- Valid intents: `frozenset(("casual", "emotional", "therapeutic", "crisis"))`

---

## 6. Crisis Safety System

Three independent layers. ALL must fail to miss a crisis.

### Layer 1: Hard Keyword Scan (pure Python, 0ms)

**Function**: `_check_crisis_keywords(text)` → `"hard"` | `"ambiguous"` | `"safe"`

**Hard keywords** (immediate Path D, no LLM needed):

English:
```
"kill myself", "killing myself", "end my life", "ending my life",
"take my life", "taking my life", "suicidal",
"want to die", "wanna die", "want to hurt myself", "i want to hurt myself",
"self harm", "self-harm", "cutting myself", "cut myself",
"no reason to live", "not worth living", "better off dead",
"don't want to live", "dont want to live", "shouldn't be alive"
```

Hindi/Hinglish:
```
"maar dunga", "maar lunga", "maar lungi", "khatam kar lunga",
"khatam kar lungi", "khatam ho jaana chahta", "khatam ho jaana chahti",
"zindagi khatam", "jeena nahi chahta", "jeena nahi chahti",
"marna chahta", "marna chahti", "khud ko maar"
```

**Ambiguous keywords** (require LLM disambiguation):
```
"suicide", "hurt myself", "hurt yourself", "hurting myself",
"end it all", "end it", "can't go on", "cant go on",
"nobody cares", "worthless", "hopeless", "disappear forever"
```

### Layer 2: LLM Disambiguation (Groq, ~200ms)

**Function**: `_crisis_llm_check(text)` → `bool`

**Prompt** (exact):
```
Does this message express intent to harm oneself or end one's life?
Answer only "yes" or "no".
Message: "{text[:300]}"
```
- Model: Groq `qwen/qwen3-32b`, temperature=0.0, max_tokens=5
- Returns `True` if response starts with "yes"
- On any exception → returns `False` (fail-safe: don't false-positive into crisis)

### Layer 3: Clinical Risk Assessment (GLM, Path C only)

Inside `_optimized_psych_analysis()`, the GLM returns `risk_level`. If `risk_level == "crisis"` → escalate to Path D mid-path.

### Crisis Response Templates

**Not LLM-generated** — template-based with language detection:

```python
_CRISIS_RESPONSE_TEMPLATES = {
    "english": "Hey, I'm really glad you reached out, and I want you to know "
               "you're not alone right now. What you're feeling is real, and it matters deeply. "
               "{known_support}"
               "Please talk to someone who can really be there for you — "
               "a doctor, counselor, or someone you trust:\n\n"
               "📞 iCall India: 9152987821\n"
               "📞 Vandrevala Foundation: 1860-2662-345\n\n"
               "You deserve real support. I'm here too — can you share a little more "
               "about what's been happening?",
    "hindi": "...(Hindi template)...",
    "hinglish": "...(Hinglish template)...",
}
```

**Memory-aware support reference**: If `memory_context` contains "coping", "helps", or "support" → `{known_support}` becomes: *"I remember some things that have helped you before — and I want you to know that strength is still in you."*

### Crisis Side Effects
- `crisis_events` table insert: `{user_id, level: "high", source: "intent_router_crisis_path"}`
- `memory_manager.add_crisis_memory()` in background thread → importance_score=10
- `ctx["psychological_analysis"]` set to crisis stubs
- `ctx["technique_selection"]` set to `{therapeutic_approach: "refer"}`

---

## 7. Execution Paths

### 7.1 Path A — Casual

**Function**: `_path_light(ctx)` in workflow.py
**LLM calls**: 1 × GLM response-gen
**max_tokens**: 150

```python
ctx["_response_max_tokens"] = 150
ctx["psychological_analysis"] = {
    "emotional_state": "casual",
    "stress_categories": [],
    "risk_assessment": "low",
    "intervention_priority": "long-term",
    ...
}
ctx["technique_selection"] = {
    "primary_technique": "Companion",
    "therapeutic_approach": "casual",
    ...
}
ctx["intervention_directive"] = (
    "This is casual conversation. Be a warm, friendly companion. "
    "Keep your response to 1-3 sentences. Ask one curious question at most. "
    "No clinical framing whatsoever."
)
self.response_gen.generate(ctx)  # → GLM call
```

No NLP analysis, no psych analysis — just a direct GLM call with a casual directive. The `_response_max_tokens=150` is passed to GLM, keeping responses short and fast.

---

### 7.2 Path B — Emotional

**Function**: `_path_standard(ctx)` in workflow.py
**LLM calls**: 1 × Groq combined-analysis + 1 × GLM response-gen
**max_tokens**: 300

**Step 1: Combined Emotion + Cultural Analysis**

`_combined_emotion_cultural_analyse(ctx)` makes a single Groq call that replaces the old separate NLP + cultural agents.

**Prompt** (exact structure):
```
Analyse this message for a mental-health chatbot. Return ONLY valid JSON:
{
  "primary_emotion": "<strongest emotion>",
  "intensity": <float 0-1>,
  "cultural_pressure": "<none|exam|family|social|identity|career|stigma>",
  "language_style": "<english|hinglish|hindi>",
  "user_needs": "<just_to_vent|validation|practical_help|information|company>",
  "tone_match": "<playful|warm|gentle|calm|energetic>"
}

Context: {last 3 messages, 100 chars each, max 400 total}
User history from memory: {memory_context[:300]}
Recent game/assessment activity (last 24h):
  - {activity_type}: score={score} acc={accuracy}% perf={perf} signals={patterns}
Message: "{text[:600]}"

JSON:
```

- Model: Groq `qwen/qwen3-32b`, temperature=0.0, max_tokens=180
- On failure → defaults: `{primary_emotion: "neutral", intensity: 0.5, user_needs: "validation"}`

**Step 2: Needs→Intervention Mapping** (pure Python, 0ms):
```python
needs_to_intervention = {
    "just_to_vent": "validate",
    "validation":   "validate",
    "practical_help": "problem-solve",
    "information":  "psychoeducation",
    "company":      "validate",
}
```

**Step 3: Technique Directive** (pure Python lookup):
```python
_TECHNIQUE_DIRECTIVES = {
    "validate":       "Focus entirely on making this person feel deeply understood...",
    "reframe":        "Gently offer one alternative way to look at this situation...",
    "ground":         "Naturally bring their attention to the present moment...",
    "problem-solve":  "Help identify one small, concrete next step...",
    "refer":          "Warmly acknowledge this is bigger than a chat can hold...",
    "psychoeducation": "Share one simple, relatable insight about what they're experiencing...",
}
```

**Step 4: GLM Response Generation** with populated ctx fields.

---

### 7.3 Path C — Therapeutic

**Function**: `_path_rich(ctx)` in workflow.py
**LLM calls**: 1 × GLM psych-analysis (+ optional Groq crisis-check in parallel) + 1 × GLM response-gen
**max_tokens**: 500

**Step 1: In-path crisis check**
```python
crisis_level = self._check_crisis_keywords(ctx["user_message"])
if crisis_level == "hard":
    self._crisis_fast_path(ctx)  # Escalate immediately
    return
```

**Step 2: Parallel execution** (ThreadPoolExecutor, max_workers=2)
```python
with ThreadPoolExecutor(max_workers=2) as executor:
    fut_psych = executor.submit(self._optimized_psych_analysis, deepcopy(ctx))
    fut_crisis = executor.submit(self._crisis_llm_check, text)  # only if ambiguous
    psych_result = fut_psych.result()
    is_crisis = fut_crisis.result() if fut_crisis else False
```

**`_optimized_psych_analysis(ctx)` prompt** (exact structure):
```
You are a clinical psychologist. Return ONLY valid JSON:
{
  "emotional_state": "<2-3 word description>",
  "primary_stressor": "<Academic|Family|Social|Identity|Career|Relationship|Health>",
  "risk_level": "<low|moderate|high|crisis>",
  "intervention": "<validate|reframe|ground|problem-solve|refer|psychoeducation>",
  "insight": "<single most important clinical observation, one sentence>",
  "cultural_factor": "<specific Indian pressure if relevant, else null>"
}

Message: "{user_message[:600]}"
Emotion: {emotion} (intensity {intensity})
User memories:
{memory_context[:800]}
Recent game/assessment activity (last 24h):
  - {activity_type}: score={score} acc={accuracy}% perf={perf} signals={patterns}
Previous session: {summary[:400]}
Recent:
U: {message[:80]}
A: {message[:80]}

JSON:
```

- Model: GLM `glm-4-32b-0414-128k`
- On failure → defaults: `{emotional_state: "distressed", risk_level: "moderate", intervention: "validate"}`

**Step 3: Mid-path crisis escalation**
```python
if is_crisis_llm or psych_result.get("risk_level") == "crisis":
    self._crisis_fast_path(ctx)
    return
```

**Step 4: Set technique directive + GLM response generation** (same as Path B Step 3-4)

---

### 7.4 Path D — Crisis

**Function**: `_crisis_fast_path(ctx)` in workflow.py
**LLM calls**: 0 (template-based response)

```python
def _crisis_fast_path(self, ctx):
    # 1. Log to crisis_events table
    self.supabase.table("crisis_events").insert({
        "user_id": ctx.get("user_id", "anonymous"),
        "level": "high",
        "source": "intent_router_crisis_path",
    }).execute()

    # 2. Build template response (language-aware, memory-aware)
    ctx["ai_response"] = self._build_crisis_response(ctx)
    ctx["response_generated"] = True

    # 3. Background: save crisis memory (importance=10)
    threading.Thread(
        target=memory_manager.add_crisis_memory,
        args=(user_id, user_message, session_id),
        daemon=True,
    ).start()

    # 4. Set crisis analysis stubs
    ctx["psychological_analysis"] = {
        "emotional_state": "crisis",
        "risk_assessment": "crisis",
        "intervention_priority": "immediate",
        ...
    }
    ctx["technique_selection"] = {
        "primary_technique": "Crisis-Protocol",
        "therapeutic_approach": "refer",
        ...
    }
```

---

## 8. Response Generation & CoE Reasoning

**File**: `agents/response_agent.py` (442 lines)

### `ResponseGenerator`

**Constructor**: Takes a `GLMController` instance. Loads system prompt template from `config.yaml`.

### System Prompt Template

The system prompt is assembled from 6 components via `_build_system_prompt()`:

```
┌──────────────────────────────────────────────────┐
│  CORE IDENTITY                                    │
│  "You are {companion_name} — not a chatbot..."    │
│                                                    │
│  RELATIONSHIP PHILOSOPHY                          │
│  "You HEAR before you help..."                    │
│                                                    │
│  HOW TO RESPOND                                    │
│  "Mirror their language style naturally..."        │
│                                                    │
│  ABSOLUTE RULES                                    │
│  "NEVER use technique labels..."                  │
│                                                    │
│  {personality_instruction}   ← per companion      │
│  {language_instruction}      ← en/hi/hinglish    │
│  {intervention_directive}    ← from pipeline path │
│  {coe_reasoning}            ← CoE think blocks    │
│  {memory_context}           ← from MemoryManager  │
└──────────────────────────────────────────────────┘
```

### Personality Instructions (5 companions + 3 legacy aliases)

| ID | Name | Prompt Focus | Voice Rate |
|---|---|---|---|
| `mitra` | Mitra 🧘 | Gentle, empathetic. "Koi baat nahi" naturally. Prioritize feeling heard. | 0.9x |
| `arjun` | Arjun 🎯 | Focused coach. Small achievable goals. JEE/engineering pressure. | 1.0x |
| `diya` | Diya 💡 | Intellectually curious. Socratic questions. Cognitive distortions in accessible language. | 0.95x |
| `riya` | Riya 🌟 | Energetic cheerleader. Celebrate small wins. No toxic positivity. | 1.1x |
| `zen` | Zen 🌙 | Mindful guide. Breathing exercises, body scans. MBSR/DBT grounding. | 0.85x |
| `calm` | — | Legacy alias: peaceful mentor | — |
| `energetic` | — | Legacy alias: supportive best friend | — |
| `analytical` | — | Legacy alias: logical guide | — |

### Language Instructions

```python
"english":  "LANGUAGE: Respond in English. Use simple, clear language."
"hindi":    "LANGUAGE: Respond primarily in Hindi (Devanagari script)..."
"hinglish": "LANGUAGE: Respond in Hinglish — a natural mix of Hindi and English, like urban Indian youth speak..."
```

### Chain-of-Experts (CoE) Reasoning

6 intervention-mapped `<think>` block templates. The IntentRouter or psych analysis determines the `therapeutic_approach`, which maps to a specific CoE block injected into the system prompt.

| Intervention | CoE Think Block | Therapeutic Framework |
|---|---|---|
| `validate` | "What specific emotion? What's the unspoken need? How to reflect their feeling?" | Person-Centered (unconditional positive regard) |
| `reframe` | "What cognitive distortion? What alternative perspective? How to offer gently?" | CBT (thoughts are not facts) |
| `ground` | "Is user in distress/spiraling? What sensory anchor? How to weave naturally?" | DBT distress tolerance |
| `problem-solve` | "What specific stressor? What ONE small step? How to build agency?" | Reality Therapy (focus on controllables) |
| `refer` | "Why beyond my scope? How to acknowledge courage? Frame help as strength?" | Warm handoff |
| `psychoeducation` | "What concept is relevant? What simple analogy? How to not be preachy?" | Normalize experience |

Each CoE block instructs the model to reason inside `<think></think>` tags (which are stripped from the final response by `_clean()`).

### `_build_context()` — User Message Assembly

This builds the **user-role message** sent alongside the system prompt to GLM:

```
PSYCHOLOGICAL ASSESSMENT:
  State: {emotional_state}
  Stress: {stress_categories}
  Priority: {intervention_priority}
  Insights: {psychological_insights}
  Cultural pressures: {cultural_pressures}

TECHNIQUE:
  Approach: {primary_technique} — {therapeutic_approach}
  Activities: {activity_recommendations}

EMOTION: {primary_emotion} (intensity {intensity}), sentiment={sentiment_label}
LANGUAGE STYLE: {language_style}, formality={formality_level}
CULTURAL FLAGS: {cultural_sensitivity_flags}

VOICE ANALYSIS:    (if voice data available)
  Emotional tone: {emotional_tone}
  Stress level: {stress_level}
  Speech pace: {speech_pace}

RECENT GAME & ASSESSMENT INSIGHTS (last 24h):    (if activities exist)
{_summarize_activities output}
Use these insights naturally — if relevant, reference their game performance...

PREVIOUS SESSION CONTEXT:    (if previous session summary exists)
  Summary: {summary}
  Key themes: {themes}
  Emotional journey: {arc}
  Reference this naturally if it connects...

CONVERSATION:
{last 5 messages, 200 chars each}

USER'S CURRENT MESSAGE: "{user_message}"

Respond naturally as MindMitra:
```

### `_summarize_activities()` — Game Data Formatting

Converts raw activity data into compact structured text for GLM. Handles 7 game types with unique fields:

| Game | Extracted Fields |
|---|---|
| `memory_challenge` | score, accuracy |
| `emoji_match` | score, accuracy, patterns |
| `emotion_match` | confusion_patterns (expected→chosen) |
| `mood_mountain` | emotional_vocabulary, exercises_done |
| `thought_detective` | identified_distortions, cbt_readiness |
| `balloon_positivity` | emotional_discrimination, resilience_indicator |
| `wellness_checkin` | wellness_level, focus_areas |

### `_clean()` — Response Post-Processing

```python
def _clean(self, text):
    text = text.strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()  # Remove CoE reasoning
    # Strip surrounding quotes
    # Attempt JSON parse (for {"content": "..."} responses)
    return text.strip()
```

---

## 9. Memory System

The memory system is documented in full in **[`docs/MEMORY_ARCHITECTURE.md`](docs/MEMORY_ARCHITECTURE.md)**. Key summary:

| Component | Technology | Purpose |
|---|---|---|
| **Vector store** | Qdrant (384-dim, `companion_memories` collection) | Semantic similarity search |
| **Embeddings** | `all-MiniLM-L6-v2` (local HuggingFace, no API) | Memory encoding |
| **Fact extraction** | Groq `llama-3.3-70b-versatile` via mem0 | Extract atomic facts from conversation |
| **Scoring** | Composite: `0.50×relevance + 0.35×importance + 0.15×recency` | Rank memories for retrieval |
| **Importance** | Groq `llama-3.3-70b-versatile` (1-10 scale) | Score memory significance |
| **Reflections** | Groq `llama-3.3-70b-versatile` (every 5 sessions) | Cross-session insight synthesis |
| **Emotional trend** | Groq `llama-3.3-70b-versatile` (1-hour cache) | Emotional trajectory tracking |
| **Session summaries** | Gemini `gemini-2.5-flash-lite` | End-of-session summarization |
| **Procedural synthesis** | GLM `glm-4-32b-0414-128k` | Extract coping strategies |
| **Metadata** | Supabase `memory_metadata` table | importance_score, memory_type, last_accessed_at |

### Memory Types & Importance

| Type | Min Importance | Created By |
|---|---|---|
| `semantic` | Varies (1-10, LLM-scored) | mem0 fact extraction |
| `procedural` | 8 (floor) | Procedural synthesis at session end |
| `reflection` | 9 (fixed) | Reflection generation every 5 sessions |
| `crisis` | 10 (fixed) | Crisis memory extraction |

### Intent-Based Retrieval Limits

| Intent | Max Semantic | Procedural | Reflections |
|---|---|---|---|
| `casual` | 3 | max 2 | max 5 |
| `emotional` | 5 | max 2 | max 5 |
| `therapeutic` | 7 | unlimited | max 5 |
| `crisis` | 4 | unlimited | max 5 |

---

## 10. Background Jobs & Triggers

All background jobs run in daemon threads — they cannot block the response.

### Memory Extraction (every 12 messages)

**Trigger**: `_maybe_trigger_memory()` in chat.py
**Interval**: `MEMORY_TRIGGER_INTERVAL = 12` messages (constant)

```
session_message_counters[session_id] += 1
count = get_hybrid_message_count(session_id)   # max(db_count, memory_count)
if count % 12 == 0:
    messages = fetch_last_n_messages(session_id, n=12)
    threading.Thread(target=memory_manager.add_memories, ...).start()
```

### Session-End Jobs (every 36 messages)

**Trigger**: `count % (MEMORY_TRIGGER_INTERVAL * 3) == 0` → every 36 messages
**Function**: `_run_session_end_jobs(session_id, user_id)` in chat.py

Jobs run (sequentially inside the background thread):

1. **Session summary** (Gemini): `memory_manager.save_session_summary(user_id, session_id, messages[-30:])`
2. **Procedural synthesis**: Scans last 15 messages for coping keywords
3. **Reflection generation**: If `session_count % 5 == 0` → `memory_manager.generate_reflections(user_id)`
4. **PHQ-9/GAD-7 screening**: Full session assessment with EMA smoothing

### Procedural Synthesis Keywords

Only synthesizes if ANY of these keywords appear in the last 15 messages:
```
"breathing", "breathe", "exercise", "journal", "meditat",
"technique", "strategy", "cope", "coping", "grounding",
"mindful", "relax", "calm", "practice", "routine", "habit",
"sleep", "self-care", "selfcare", "walk", "yoga"
```

Topic detection (first match wins):
```
"breathing" → "breathing exercises"
"journal"   → "journaling"
"meditat"   → "meditation"
"grounding" → "grounding techniques"
"sleep"     → "sleep hygiene"
"exercise"  → "physical exercise"
default     → "coping strategies"
```

### Game→mem0 Memory Bridge

**Function**: `_extract_game_insights_for_memory(activities, user_id)` in chat.py

Converts game results into mem0 memories so the companion can reference therapeutic progress:

| Game | What Gets Stored |
|---|---|
| `emotion_match` | Confusion patterns: "expected X mistaken for Y" |
| `thought_detective` | Identified distortions: "user identified [list]" |
| `wellness_checkin` | Wellness level + focus areas |
| `mood_mountain` | Mood self-report emotions |
| `balloon_positivity` | Emotional discrimination + resilience indicators |

Stored with metadata: `{source: "game_insights", category: "therapeutic"}`

---

## 11. Clinical Screening (PHQ-9 / GAD-7)

**File**: `agents/screening_agent.py` (232 lines)

### `ScreeningAssessmentAgent`

**Constructor**: Takes `groq_nlp` (GroqNLPModule) and `glm` (GLMController).
**Model**: Groq `llama-3.3-70b-versatile`, temperature=0.0, max_tokens=280

### Two Assessment Modes

**1. Per-message** (`generate(user_context)`): Quick estimate from current message + recent context. Used rarely.

**2. Session-level** (`generate_session_assessment(messages, previous_scores, ema_alpha)`): Full conversation assessment from last 30 messages. Used at session-end intervals.

### Session-Level Prompt (exact structure)

```
Based on the FULL conversation below, estimate screening scores for PHQ-9 and GAD-7.
This is a session-level assessment — consider the overall emotional tone, recurring themes,
and severity of distress across the entire conversation, not just a single message.

Return ONLY valid JSON with exactly this structure:
{
  "phq9": {"responses": [<9 integers 0-3>], "score": <0-27 integer>,
           "severity": "<minimal|mild|moderate|moderately_severe|severe>"},
  "gad7": {"responses": [<7 integers 0-3>], "score": <0-21 integer>,
           "severity": "<minimal|mild|moderate|severe>"}
}

Rules:
- Assess based on patterns across the FULL conversation, not individual messages.
- Infer cautiously from available data; do not exaggerate risk.
- If user seems generally well with minor stress, keep scores low.
- If user shows persistent sadness, hopelessness, or anxiety themes, score accordingly.
- No markdown, no extra keys.

Full conversation:
{transcript[:3000]}

JSON:
```

### EMA Smoothing

```python
ema_score = round(alpha * current_score + (1 - alpha) * previous_score)
# alpha = SCREENING_EMA_ALPHA = 0.6 (60% weight on new score)
```

Prevents score whiplash from single-session mood variations. New scores are blended with historical averages.

### Severity Thresholds

**PHQ-9** (depression, 0-27):
| Score | Severity |
|---|---|
| 0-4 | minimal |
| 5-9 | mild |
| 10-14 | moderate |
| 15-19 | moderately_severe |
| 20-27 | severe |

**GAD-7** (anxiety, 0-21):
| Score | Severity |
|---|---|
| 0-4 | minimal |
| 5-9 | mild |
| 10-14 | moderate |
| 15-21 | severe |

### Fallback Chain
Groq `llama-3.3-70b` → GLM `glm-4-32b-0414-128k` → return `{}`

### Score Persistence
- Stored in `user_contexts` table (merged into existing context JSON)
- Fetched by `fetch_latest_screening_scores()` for screening-aware routing

---

## 12. TTS Pipeline

**File**: `services/tts_service.py` (207 lines)

### 3-Tier Fallback Chain

```
ElevenLabs (primary, best quality)
    ↓ fails
Google Cloud TTS (secondary, good quality)
    ↓ fails
gTTS (tertiary, basic quality)
    ↓ fails
None (avatar speaks without audio)
```

### ElevenLabs

- **API**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- **Voice ID**: `vT0wMbLG5dssaBsksrb6` (default, configurable)
- **Model**: `eleven_v3`
- **Output**: MP3 44100Hz 128kbps → base64
- **Timeout**: 35 seconds
- **Emotion→Voice Settings**:

| Emotion | Stability | Similarity | Style | Speaker Boost |
|---|---|---|---|---|
| happy | 0.0 | 0.8 | 0.35 | Yes |
| sad | 1.0 | 0.85 | 0.1 | Yes |
| angry | 0.5 | 0.75 | 0.45 | Yes |
| surprised | 0.0 | 0.8 | 0.4 | Yes |
| neutral | 0.5 | 0.8 | 0.2 | Yes |

Credit exhaustion detection: checks HTTP 401/402/403/429 + keywords "insufficient", "credit", "quota", etc.

### Google Cloud TTS

- **Voice**: `en-US-Wavenet-F` (English) or `hi-IN-Neural2-A` (Hindi/Hinglish)
- **Output**: LINEAR16 WAV 16kHz (for Rhubarb compatibility)
- **Emotion→Speaking Rate/Pitch**:

| Emotion | Speaking Rate | Pitch |
|---|---|---|
| happy | 1.1 | +2.0 |
| sad | 0.9 | -2.0 |
| angry | 1.05 | -1.0 |
| surprised | 1.15 | +3.0 |
| neutral | 1.0 | 0.0 |

### Personality Voice Parameters

Multiplied on top of emotion settings:

| Personality | Rate Multiplier | Pitch Shift |
|---|---|---|
| mitra | 0.9 | 0.0 |
| arjun | 1.0 | 0.0 |
| diya | 0.95 | 0.0 |
| riya | 1.1 | +2.0 |
| zen | 0.85 | -2.0 |

### gTTS (Last Resort)
- `gTTS(text=text, lang="en", slow=False)` → MP3 → base64
- No emotion/personality modulation

---

## 13. Lipsync Pipeline

**File**: `services/lipsync_service.py` (154 lines)

### Primary: Rhubarb Lip-Sync CLI

```
audio_base64 → decode → detect format (WAV/MP3 by "RIFF" header)
    → write to temp file → run: bin/rhubarb -f json {file}
    → parse JSON → extract mouthCues[] → return
```

- **Binary path**: `chatbotAgent/bin/rhubarb`
- **Timeout**: 10 seconds
- **Output shapes**: A-H, X (directly compatible with Avatar.jsx viseme targets)

### Fallback: Text-Based Phoneme Generation

When Rhubarb is unavailable or fails:

```
text → split into words → map each character to a viseme
    → 150ms per phoneme, 100ms pause between words
    → optionally scale to audio duration
```

**Phoneme→Viseme Map** (24 mappings):
```
a→D, e→E, i→C, o→E, u→F
p→A, b→A, m→A
f→G, v→G
t→B, d→B, k→B, g→B
s→X, z→X, r→X, l→X, n→X, h→X
w→F, y→C
Digraph "th" → H
Unknown alpha → X (0.5× duration)
```

---

## 14. Greeting Service

**File**: `services/greeting_service.py` (228 lines)

### How Greetings Work

```
GET /chat/greeting?session_id=X&user_id=Y&personality=mitra&companion_name=Mitra
    │
    ├─ 1. Check session cache (prevents duplicate greetings)
    ├─ 2. Get time slot (5 slots by hour)
    ├─ 3. If personality set → use personality greeting template
    ├─ 4. Resolve language from user context file (best-effort)
    ├─ 5. Append cross-session continuity reference (if themes match)
    └─ 6. Return {greeting, show_greeting, language_used, time_slot}
```

### Time Slots

| Slot | Hours | Example |
|---|---|---|
| `morning` | 05:00–10:59 | "Good morning!" |
| `day` | 11:00–15:59 | "Hey!" |
| `evening` | 16:00–20:59 | "How was your day?" |
| `night` | 21:00–23:59 | "Still up?" |
| `late_night` | 00:00–04:59 | "Can't sleep?" |

### Personality Greeting Templates

Each companion has a unique first-session greeting with `{name}` placeholder:

| Personality | Opening Style |
|---|---|
| `mitra` | "Namaste. I'm {name}, and I'm really glad you're here. This is your safe space..." |
| `arjun` | "Hey! I'm {name}. Let's figure out what's weighing on you and tackle it together..." |
| `diya` | "Hi, I'm {name}! I love exploring the 'why' behind our feelings..." |
| `riya` | "Hey hey hey! I'm {name} and I'm SO glad you're here! Seriously, just showing up today?..." |
| `zen` | "Welcome... I'm {name}. Before anything else, let's just take one slow breath together..." |

### Cross-Session Continuity (12 Theme→Callback Mappings)

Zero LLM calls. Fetches previous session themes → matches against lookup table → appends natural callback:

```python
_THEME_CONTINUITY_HINTS = {
    "exam":         "Last time we talked about exams — how's that going?",
    "academic":     "You were dealing with some academic pressure before — any updates?",
    "family":       "I remember we talked about family stuff — how are things at home?",
    "relationship": "Last time we chatted about relationships — how's that been?",
    "anxiety":      "You mentioned feeling anxious last time — how are you feeling now?",
    "stress":       "I remember you were stressed about some things — has anything shifted?",
    "sleep":        "You mentioned sleep troubles before — getting any better?",
    "loneliness":   "Last time you shared about feeling lonely — how's it been since?",
    "career":       "You were thinking about career stuff — anything new?",
    "self-esteem":  "I remember you were working through some self-esteem stuff...",
    "anger":        "Last time there was some frustration — has that eased up?",
    "sadness":      "You were going through a tough time before — how are things now?",
}
```

**200ms timeout guard**: If `fetch_previous_session_summary()` takes > 200ms → skip continuity (don't delay greeting).

---

## 15. Services Layer

### 15.1 GLM Controller

**File**: `controllers/glm_controller.py` (174 lines)

Thread-safe wrapper around ZhipuAI's API with semaphore gating, retry logic, and Groq fallback.

```python
class GLMController:
    def __init__(self):
        self.model_name = "glm-4-32b-0414-128k"     # from config
        self.max_tokens = 1000                         # from config
        self.temperature = 0.3                         # from config
        self.top_p = 0.8                               # from config
        self._semaphore = Semaphore(max_concurrent=1)  # serialized access
        self._max_retries = 2
        self._base_backoff = 2.0                       # exponential: 2s, 4s

    def invoke(self, messages, **kwargs) -> GLMResponse:
        # Per-call overrides: max_tokens, temperature, top_p
        # Semaphore gating
        # Retry loop with exponential backoff on 429/timeout
        # Groq fallback (llama-4-scout-17b) on unrecoverable errors
```

**`GLMResponse`**: Simple wrapper with `.content` attribute. `bool(resp)` → `True` if content non-empty.

**Retry behavior**:
- HTTP 429 / "rate" / "quota" → wait `base_backoff × 2^attempt` seconds, retry
- Timeout → wait `base_backoff` seconds, retry
- Other errors → try Groq fallback → then raise

### 15.2 Supabase Service

**File**: `services/supabase_service.py` (233 lines)

Module-level singleton client. All functions are standalone (not methods on a class).

| Function | Purpose | Returns |
|---|---|---|
| `get_session_message_count(session_id)` | Count messages from DB | `int` |
| `get_hybrid_message_count(session_id)` | `max(db_count, memory_counter)` | `int` |
| `fetch_user_context(user_id, session_id)` | Activities (24h) + messages (last 10) | `Dict` |
| `fetch_last_n_messages(session_id, n)` | Last N messages, chronological | `List[Dict]` |
| `fetch_latest_screening_scores(user_id)` | PHQ-9/GAD-7 from user_contexts | `Dict` |
| `save_screening_scores(user_id, session_id, scores)` | Merge into user_contexts | `None` |
| `fetch_previous_session_summary(user_id, session_id)` | Cross-session continuity | `Dict` |

**`session_message_counters`**: `defaultdict(int)` — in-memory counter indexed by session_id. Incremented on every `/chat` call. Hybrid counting ensures accuracy even if DB writes are delayed.

### 15.3 Config System

**File**: `core/config.py` (226 lines)

**Singleton**: `Config._instance` pattern. Created once on first import.

**Loading**: `config.yaml` (at `chatbotAgent/config.yaml`) → YAML parse → `${ENV_VAR}` substitution via regex.

**Fallback encodings**: utf-8 → utf-8-sig → utf-16 → cp1252 → latin-1

**Public API**:
```python
config.get("nlp_module.model")              # dot-notation access
config.get_api_key("groq")                  # API key with env fallback
config.get_model("glm")                     # model name shortcut
config.get_temperature("nlp")               # temperature shortcut
config.get_max_tokens("screening")          # max_tokens shortcut
config.get_section("features")              # full section dict
config.is_enabled("features.nlp_analysis")  # bool check
config.reload()                             # hot-reload config.yaml
```

**Convenience module-level functions**:
```python
get_config(key, default)          # → config.get(key, default)
is_feature_enabled(feature)       # → config.is_enabled(f"features.{feature}")
get_rag_config()                  # → config.get_section("rag_memory")
get_logging_config()              # → config.get_section("logging")
```

### 15.4 JSON Utilities

**File**: `utils/json_utils.py` (136 lines)

**`parse_json_from_llm_output(raw)`** — 4-tier extraction strategy:

```
Tier 1: Direct json.loads(cleaned)
    ↓ fails
Tier 2: JSONDecoder.raw_decode — find first { in text
    ↓ fails
Tier 3: Balanced-brace extraction (handles braces inside quoted strings)
    ↓ fails
Tier 4: Substring between first '{' and last '}' + trailing comma cleanup
    ↓ fails
return None
```

Pre-processing: strip BOM (`\ufeff`), extract from fenced code blocks (` ```json ... ``` `).

**`compact_for_merge_prompt(value, max_depth, max_items, max_str)`**: Recursively truncates nested structures for fitting into LLM prompts. Limits: depth=4, items=10, string=280 chars.

---

## 16. UserContext Schema

**File**: `pipeline/context.py` (93 lines)

`create_empty_user_context()` produces the canonical JSON envelope that flows through the entire pipeline:

```json
{
  "user_id": "uuid",
  "session_id": "uuid",
  "timestamp": "2026-03-12T10:30:00Z",
  "user_message": "I've been feeling really anxious",

  "voice_analysis": {},

  "session_context": {
    "recent_messages": [{"role": "user", "content": "..."}],
    "conversation_summary": {},
    "session_memories": {
      "procedural": [],
      "semantic": [],
      "episodic": []
    },
    "user_activities": [],
    "user_patterns": {}
  },

  "nlp_analysis": {
    "emotions": {},
    "primary_emotion": "",
    "sentiment": {"score": 0.0, "label": "neutral"},
    "intensity": 0.0,
    "key_phrases": [],
    "language_detected": "en",
    "urgency_flag": false
  },

  "cultural_context": {
    "language_style": "casual",
    "hindi_english_ratio": 0.0,
    "code_switching_detected": false,
    "cultural_sensitivity_flags": [],
    "communication_pattern": "",
    "regional_context": "",
    "formality_level": "medium"
  },

  "psychological_analysis": {
    "emotional_state": "",
    "stress_categories": [],
    "risk_assessment": "low",
    "coping_assessment": "",
    "intervention_priority": "supportive",
    "psychological_insights": [],
    "cultural_pressures": ""
  },

  "screening_assessments": {
    "phq9": {"score": null, "severity": "", "responses": [], "last_updated": null},
    "gad7": {"score": null, "severity": "", "responses": [], "last_updated": null}
  },

  "technique_selection": {
    "primary_technique": "",
    "therapeutic_approach": "",
    "activity_recommendations": [],
    "rationale": ""
  },

  "memory_context": "",
  "ai_response": "",
  "response_generated": false
}
```

**Pipeline-injected fields** (not in the empty template):
- `personality_settings`: `{personality, companion_name, language}`
- `intervention_directive`: Text string from `_TECHNIQUE_DIRECTIVES`
- `previous_session_summary`: `{summary, themes[], emotional_arc[]}`
- `_pipeline_path`: Debug tag ("A-casual", "B-emotional", etc.)
- `_response_max_tokens`: Per-path token limit (150/300/500)
- `_crisis_mode`: Boolean flag for crisis fast-path

---

## 17. API Endpoints

### `POST /chat`

Main chat endpoint. Full pipeline execution.

**Headers**: `Authorization: Bearer <supabase-jwt>`

**Request** (`ChatRequest`):
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

**Response** (`ChatResponse`):
```json
{
  "message": "I hear you — exam pressure can feel...",
  "audio": "<base64-wav-or-mp3>",
  "lipsync": {"mouthCues": [{"start": 0.0, "end": 0.3, "value": "B"}]},
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
    "coping_assessment": "",
    "intervention_priority": "supportive",
    "activity_recommendations": [],
    "nlp_analysis": { ... },
    "cultural_context": { ... },
    "technique_rationale": "...",
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

SSE streaming variant. Same auth and request format.

**Events**:
- `text_chunk`: AI text response + modality + confidence
- `audio_ready`: base64 audio + animation + facial_expression
- `lipsync_ready`: mouthCues data
- `complete`: `{status: "success"}`
- `error`: `{error: "message"}`

### `GET /chat/greeting`

Personalized greeting for session start.

**Query params**: `session_id`, `user_id`, `personality`, `companion_name`

**Response**:
```json
{
  "greeting": "Namaste. I'm Mitra, and I'm really glad you're here...",
  "show_greeting": true,
  "language_used": "english",
  "time_slot": "morning"
}
```

### `GET /health`

Railway health check. Returns `{"status": "ok"}` with model availability and pipeline version.

### `POST /transcribe`

Groq Whisper fallback STT. Accepts base64-encoded WAV in JSON and returns transcript text.
- Requires `GROQ_API_KEY`
- Triggered only when Azure Speech SDK returns an empty transcript
- Model: `whisper-large-v3-turbo`
- Request body: `{ "audio_data": "<base64 wav>" }`

### `POST /api/onboarding/generate`

Groq-based dynamic onboarding question generation. Saves initial user data.

---

## 18. Database Schema

12 active tables in Supabase PostgreSQL (all with RLS):

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users) | |
| `session_id` | uuid | Groups messages into sessions |
| `role` | text | "user" or "assistant" |
| `content` | text | Message text |
| `metadata` | jsonb | Optional structured data |
| `created_at` | timestamptz | |

### `user_activities`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `activity_type` | text | Game type identifier |
| `score` | integer | Game score |
| `accuracy_percentage` | float | Accuracy metric |
| `insights_generated` | jsonb | `{performance_level, key_patterns, strengths, improvement_areas}` |
| `evaluation_data` | jsonb | `{wellness_level, focus_areas, cbt_readiness, ...}` |
| `user_response_data` | jsonb | `{confusion_patterns, identified_distortions, ...}` |
| `completed_at` | timestamptz | |

### `user_profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK, FK → auth.users) | |
| `display_name` | text | |
| `avatar_url` | text | |
| `privacy_flags` | jsonb | |

### `user_settings`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `companion_personality` | text | mitra/arjun/diya/riya/zen |
| `avatar_model` | text | 3D model selection |
| `theme` | text | UI theme |
| `notifications` | jsonb | |

### `user_onboarding`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `onboarding_state` | text | Step tracking |
| `consent` | boolean | |
| `device_tier` | text | |

### `crisis_events`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `level` | text | "high" (always) |
| `source` | text | "intent_router_crisis_path" |
| `created_at` | timestamptz | NO user text stored (privacy) |

### `user_contexts`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid (PK, FK) | |
| `context` | jsonb | Full UserContext JSON (including screening scores) |
| `updated_at` | timestamptz | |

### `session_summaries`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `session_id` | uuid (unique) | |
| `summary_text` | text | Gemini-generated summary |
| `themes` | jsonb | `["exam", "anxiety", "family"]` |
| `emotional_arc` | jsonb | `["anxious", "calming", "hopeful"]` |
| `updated_at` | timestamptz | |

### `memory_metadata`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `mem0_id` | text | Links to Qdrant vector |
| `category` | text | general/procedural/crisis/reflection |
| `importance` | text | low/medium/high/critical |
| `importance_score` | integer (1-10) | LLM-scored |
| `memory_type` | text | semantic/procedural/reflection/crisis |
| `last_accessed_at` | timestamptz | Updated on retrieval |
| `source` | text | conversation/glm_synthesis/reflection_synthesis |

### `user_memory_stats`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid (PK, FK) | |
| `total_memories` | integer | |
| `last_extraction` | timestamptz | |
| `session_count` | integer | |
| `updated_at` | timestamptz | |

### `voice_analysis_events`
Raw speech timing + clarity metrics per recording. Stores transcript source,
speech rate, pause structure, confidence, language-mixing flags, and optional
prosody JSON for future backend persistence.

### `onboarding_analytics`
Onboarding funnel tracking data.

---

## 19. All LLM Calls Reference

Complete list of every LLM call in the codebase:

| # | Location | Model | Provider | Purpose | Temp | Max Tokens | When |
|---|---|---|---|---|---|---|---|
| 1 | `IntentRouter.classify()` | qwen/qwen3-32b | Groq | Intent classification | 0.0 | 60 | Every message |
| 2 | `_combined_emotion_cultural_analyse()` | qwen/qwen3-32b | Groq | Emotion + cultural (Path B) | 0.0 | 180 | Path B only |
| 3 | `_crisis_llm_check()` | qwen/qwen3-32b | Groq | Crisis yes/no | 0.0 | 5 | Ambiguous keywords |
| 4 | `_optimized_psych_analysis()` | glm-4-32b-0414-128k | ZhipuAI | Clinical assessment (Path C) | 0.3 | config | Path C only |
| 5 | `ResponseGenerator.generate()` | glm-4-32b-0414-128k | ZhipuAI | Final response (all paths) | 0.3 | 150/300/500 | Every message |
| 6 | `ScreeningAgent.generate()` | llama-3.3-70b | Groq | Per-message screening | 0.0 | 280 | (rarely used) |
| 7 | `ScreeningAgent.generate_session_assessment()` | llama-3.3-70b | Groq | Session-level PHQ/GAD | 0.0 | 280 | Session-end |
| 8 | `ScreeningAgent._call_glm()` | glm-4-32b-0414-128k | ZhipuAI | Screening fallback | 0.3 | config | Groq fails |
| 9 | `mem0.add()` (internal) | llama-3.3-70b | Groq | Fact extraction | 0.1 | 2000 | Every 12 msgs |
| 10 | `_score_importance_batch()` | llama-3.3-70b | Groq | Importance scoring (1-10) | 0.1 | 200 | After extraction |
| 11 | `save_session_summary()` | gemini-2.5-flash-lite | Google | Session summarization | 0.3 | 500 | Every 36 msgs |
| 12 | `synthesize_procedural_memory()` | glm-4-32b-0414-128k | ZhipuAI | Procedural extraction | 0.3 | config | Session-end |
| 13 | `generate_reflections()` | llama-3.3-70b | Groq | Cross-session reflections | 0.3 | 600 | Every 5 sessions |
| 14 | `get_emotional_trend()` | llama-3.3-70b | Groq | Emotional trajectory | 0.2 | 100 | Every message (cached 1hr) |
| 15 | `GLMController` Groq fallback | llama-4-scout-17b | Groq | GLM failure fallback | varies | varies | GLM errors |
| 16 | Onboarding generation | qwen/qwen3-32b | Groq | Dynamic onboarding Qs | varies | varies | Onboarding |
| 17 | Whisper fallback STT | whisper-large-v3-turbo | Groq | Speech-to-text fallback | — | — | /transcribe |

**Per-request cost** (typical emotional message):
- Intent: 1 × Groq (fast, free tier)
- Analysis: 1 × Groq (fast, free tier)
- Response: 1 × ZhipuAI GLM (primary cost center)
- Emotional trend: 0 (cached) or 1 × Groq
- Total: 2-3 LLM calls

---

## 20. Constants Reference

**File**: `utils/constants.py` (80 lines)

All magic numbers are centralized here:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_ACTIVITIES_FETCH` | 50 | Max activities from Supabase |
| `MAX_MESSAGES_FETCH` | 10 | Max messages from Supabase |
| `MEMORY_TRIGGER_INTERVAL` | 12 | Messages between memory extraction |
| `STREAM_MEMORY_TRIGGER_INTERVAL` | 12 | Same for streaming endpoint |
| `MAX_ACTIVITIES_PER_AGENT` | 5 | Activities in agent context |
| `RECENT_MESSAGES_COUNT` | 5 | Messages in response context |
| `RESPONSE_RECENT_MESSAGES_COUNT` | 5 | Same (alias) |
| `SCREENING_MIN_MESSAGES` | 8 | Min messages before screening |
| `SCREENING_EMA_ALPHA` | 0.6 | EMA weight (60% new, 40% old) |
| `ELEVENLABS_TIMEOUT_S` | 35.0 | ElevenLabs API timeout |
| `GOOGLE_TTS_SAMPLE_RATE_HZ` | 16,000 | 16 kHz for Rhubarb |
| `RHUBARB_TIMEOUT_S` | 10 | Rhubarb CLI timeout |
| `PHONEME_DURATION_S` | 0.15 | Text fallback phoneme length |
| `WORD_PAUSE_S` | 0.10 | Text fallback word gap |
| `EMBEDDING_MODEL` | "all-MiniLM-L6-v2" | Memory embedding model |
| `EMBEDDING_DIMS` | 384 | Vector dimensions |
| `MEMORY_OVERFETCH_LIMIT` | 25 | Over-fetch before re-ranking |
| `RECENCY_DECAY_RATE` | 0.999 | Exponential decay/hour (~84% at 1 week) |
| `SCORE_WEIGHT_RECENCY` | 0.15 | α_r in composite score |
| `SCORE_WEIGHT_IMPORTANCE` | 0.35 | α_i in composite score |
| `SCORE_WEIGHT_RELEVANCE` | 0.50 | α_v in composite score |
| `MEMORY_RELEVANCE_THRESHOLD` | 0.25 | Min composite score to include |
| `MEMORY_LIMIT_CASUAL` | 3 | Max memories for casual intent |
| `MEMORY_LIMIT_EMOTIONAL` | 5 | Max memories for emotional intent |
| `MEMORY_LIMIT_THERAPEUTIC` | 7 | Max memories for therapeutic intent |
| `MEMORY_LIMIT_CRISIS` | 4 | Max memories for crisis intent |
| `REFLECTION_INTERVAL_SESSIONS` | 5 | Generate reflections every N sessions |
| `REFLECTION_MAX_INSIGHTS` | 5 | Max reflection insights per synthesis |
| `REFLECTION_MEMORY_FETCH_LIMIT` | 30 | Top-N memories for reflection |
| `EMOTIONAL_TREND_SESSIONS` | 5 | Past sessions for trend analysis |

---

## 21. Environment Variables

### Backend (Railway / chatbotAgent/.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | **Yes** | — | NLP, intent routing, screening, mem0 extraction, importance scoring |
| `ZAI_API_KEY` | **Yes** | — | ZhipuAI GLM-4 (response gen, psych analysis, procedural synthesis) |
| `GOOGLE_API_KEY` | **Yes** | — | Gemini (session summaries) |
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_KEY` | **Yes** | — | Supabase service role key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Alias (checked first, falls back to SUPABASE_KEY) |
| `SUPABASE_JWT_SECRET` | **Yes** | — | JWT verification secret |
| `QDRANT_HOST` | **Yes** | `localhost` | `qdrant.railway.internal` on Railway |
| `QDRANT_PORT` | No | `6333` | Qdrant port |
| `QDRANT_COLLECTION` | No | `companion_memories` | Qdrant collection name |
| `ELEVENLABS_API_KEY` | No | — | Primary TTS (falls back to GCP → gTTS) |
| `ELEVENLABS_VOICE_ID` | No | `vT0wMbLG5dssaBsksrb6` | ElevenLabs voice |
| `ELEVENLABS_MODEL_ID` | No | `eleven_v3` | ElevenLabs model |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | — | GCP service account JSON path (local dev) |
| `GOOGLE_CREDENTIALS_BASE64` | No | — | Base64-encoded GCP JSON (Railway) |
| `PORT` | No | `8080` | Railway sets this automatically |
| `LOG_LEVEL` | No | `INFO` | DEBUG/INFO/WARNING/ERROR |
| `SKIP_AUTH` | No | `false` | **Must be false in production** |
| `CORS_ALLOW_ORIGINS` | No | — | Extra origins (comma-separated) |

### Frontend (Vercel / .env.local)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | **Yes** | Backend URL (e.g., `https://your-app.up.railway.app`) |

---

## 22. Feature Flags

All flags in `config.yaml` → `features:` section → loaded into `self.feature_flags` dict.

| Flag | Default | Effect |
|---|---|---|
| `nlp_analysis` | `true` | Enable GroqNLPModule (affects all Groq-based analysis) |
| `cultural_context` | `true` | Instantiate CulturalContextModule (unused in v2) |
| `screening_assessments` | `true` | Enable background PHQ-9/GAD-7 scoring |
| `voice_analysis_support` | `true` | Accept voice analysis data |
| `save_to_supabase` | `true` | Persist session context to Supabase |
| `user_contexts_table` | `true` | Write to user_contexts table |
| `parallel_processing` | `true` | Use ThreadPoolExecutor in pipeline |
| `context_caching` | `true` | Cache session context in memory |

---

## 23. File Structure

```
chatbotAgent/                           # Python backend root
├── app/
│   ├── main.py                         (134 lines)  FastAPI factory, CORS, boot
│   ├── agents/
│   │   ├── intent_router.py            (141 lines)  4-class Groq intent classifier
│   │   ├── memory_manager.py          (1321 lines)  mem0 + Qdrant memory layer
│   │   ├── response_agent.py           (442 lines)  GLM response gen + CoE reasoning
│   │   ├── nlp_agent.py                 (48 lines)  Groq client factory
│   │   ├── screening_agent.py          (232 lines)  PHQ-9/GAD-7 with EMA
│   │   ├── cultural_agent.py                        instantiated, unused in v2
│   │   ├── psychologist_agent.py                    not wired (reference only)
│   │   └── technique_agent.py                       not wired (reference only)
│   ├── api/
│   │   ├── chat.py                     (487 lines)  POST /chat, /chat/stream, GET /chat/greeting
│   │   ├── health.py                                GET /health, GET /debug/memory
│   │   └── onboarding.py                            POST /api/onboarding/*
│   │                                                /transcribe lives in chat.py
│   ├── controllers/
│   │   └── glm_controller.py           (174 lines)  Thread-safe ZhipuAI + Groq fallback
│   ├── core/
│   │   ├── config.py                   (226 lines)  config.yaml + env-var loader
│   │   ├── auth.py                                  Supabase JWT verification
│   │   └── logging.py                               Compact format + third-party suppression
│   ├── models/
│   │   ├── request_models.py                        Pydantic ChatRequest
│   │   └── response_models.py                       Pydantic ChatResponse
│   ├── pipeline/
│   │   ├── workflow.py                (1092 lines)  THE BRAIN — MindMitraWorkflow orchestrator
│   │   └── context.py                   (93 lines)  create_empty_user_context()
│   ├── services/
│   │   ├── supabase_service.py         (233 lines)  All DB operations
│   │   ├── tts_service.py              (207 lines)  ElevenLabs→GCP→gTTS fallback
│   │   ├── lipsync_service.py          (154 lines)  Rhubarb CLI + text fallback
│   │   └── greeting_service.py         (228 lines)  Time/personality/continuity greetings
│   └── utils/
│       ├── json_utils.py               (136 lines)  4-tier LLM JSON parser
│       └── constants.py                 (80 lines)  All magic numbers
├── config.yaml                         (193 lines)  All runtime configuration
├── docs/
│   └── MEMORY_ARCHITECTURE.md                       Deep memory system reference
├── ARCHITECTURE.md                                  This file
├── CITATIONS.md                                     Research paper references
├── Dockerfile                                       Multi-stage (PyTorch CPU + HuggingFace)
├── Procfile                                         web: uvicorn app.main:app ...
├── requirements.txt                                 All Python deps with version pins
├── railway.toml                                     Railway deployment config
├── greeting_pool.json                               Time-of-day greeting texts
└── .env.example                                     Complete env var documentation
```

---

## 24. Module Dependency Graph

```
app/main.py
  ├── app/core/logging.py            (first import — configures all logging)
  ├── app/api/health.py              (registered first — Railway health check)
  ├── app/api/chat.py
  │     ├── app/pipeline/workflow.py
  │     │     ├── app/agents/intent_router.py
  │     │     │     └── app/utils/json_utils.py
  │     │     ├── app/agents/nlp_agent.py
  │     │     │     └── app/core/config.py
  │     │     ├── app/agents/response_agent.py
  │     │     │     └── app/core/config.py
  │     │     ├── app/agents/screening_agent.py
  │     │     │     ├── app/core/config.py
  │     │     │     └── app/utils/json_utils.py
  │     │     ├── app/controllers/glm_controller.py
  │     │     │     └── app/core/config.py
  │     │     ├── app/agents/memory_manager.py
  │     │     │     ├── app/controllers/glm_controller.py
  │     │     │     ├── app/services/supabase_service.py
  │     │     │     └── app/utils/constants.py
  │     │     └── app/pipeline/context.py
  │     ├── app/services/greeting_service.py
  │     │     └── app/services/supabase_service.py
  │     ├── app/services/tts_service.py
  │     ├── app/services/lipsync_service.py
  │     ├── app/services/supabase_service.py
  │     └── app/utils/constants.py
  └── app/api/onboarding.py
```

---

## 25. Deployment

### Railway (Backend)

```bash
# Required environment variables:
GROQ_API_KEY=...
ZAI_API_KEY=...
GOOGLE_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
QDRANT_HOST=qdrant.railway.internal
QDRANT_PORT=6333
QDRANT_COLLECTION=companion_memories
GOOGLE_CREDENTIALS_BASE64=...
```

**Procfile**: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Dockerfile** (multi-stage):
- Stage 1 (builder): Install all Python deps including PyTorch CPU-only
- Stage 2 (runtime): Copy deps + pre-download `all-MiniLM-L6-v2` (~90MB baked into image)
- Health check: `GET /health` with 40s timeout, 60s start period

**Why pre-bake the model**: Without it, Railway cold starts download the model on first request (~20s). Pre-baking eliminates this latency.

### Vercel (Frontend)

```bash
VITE_BACKEND_URL=https://your-app.up.railway.app
```

- Framework: Vite (auto-detected)
- Output: `dist/`
- `vercel.json` handles SPA routing (all paths → index.html)
- Supabase URL + anon key are in source code (publishable, RLS protects data)

### Qdrant

- Railway Docker service: `qdrant/qdrant`
- Internal networking: `qdrant.railway.internal:6333`
- Collection: `companion_memories` (384-dim, auto-created by mem0)

---

## 26. Logging & Observability

### Log Format

`HH:MM:SS L <message>` where L = single character: D(ebug), I(nfo), W(arning), E(rror)

Third-party loggers suppressed to WARNING: httpx, groq, openai, zhipuai, qdrant_client, mem0, urllib3, sentence_transformers, google.generativeai

### Sample Request Trace (Path B — Emotional)

```
══════════════════════════════════════════════════════════════
  🚀 MINDMITRA PIPELINE START
  user=abc12345    session=f3a9b2c1
  personality=mitra  lang=english
  msg_len=47  recent=4
══════════════════════════════════════════════════════════════
📋 [ROUTER] Screening hint injected: PHQ-9=moderate (score 14), GAD-7=mild (score 6)
🤖 [ROUTER] IntentRouter → intent='emotional' confidence=0.87 (Groq qwen/qwen3-32b)
🔍 [CRISIS-SCAN] keyword scan → 'safe'
✅ [CRISIS-GATE] No crisis signal detected
🧠 [MEMORY] Injected memory context (456 chars)
📈 [TREND] Injected emotional trend (87 chars)
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

### Log Tag Reference

| Tag | Level | Meaning |
|---|---|---|
| `[ROUTER]` | INFO | Intent classification + screening hint + dispatch |
| `[CRISIS-SCAN]` | DEBUG | Keyword scan result |
| `[CRISIS-GATE]` | INFO/WARN | Crisis gate decision |
| `[PATH-A/B/C/D]` | INFO | Path execution steps |
| `[COMBINED-ANALYSIS]` | INFO | Groq combined emotion/cultural call |
| `[PSYCH-OPT]` | INFO | GLM optimised psych analysis |
| `[CRISIS]` | CRITICAL | Crisis fast-path triggered |
| `[MEMORY]` | INFO | Memory retrieval/extraction |
| `[TREND]` | INFO | Emotional trend injection |
| `[RESPONSE-GEN]` | INFO | GLM response generation |
| `[SCREENING]` | INFO | PHQ-9/GAD-7 assessment |
| `[TTS]` / `[ElevenLabs]` / `[Google TTS]` / `[gTTS]` | INFO | TTS generation |
| `[RHUBARB]` / `[LIPSYNC]` | INFO | Lipsync generation |
| `[GREETING]` | INFO | Greeting generation |
| `[FILE]` | INFO | UserContext persistence |
| `[BACKGROUND]` | INFO | Background memory extraction |
| `[GAME→MEM0]` | INFO | Game insight memory bridge |
| `[PROCEDURAL]` | INFO | Procedural memory synthesis |
| `[REFLECTION]` | INFO | Reflection generation |

### Troubleshooting

**All requests route to B-emotional with confidence=0.50**: IntentRouter unavailable. Check:
1. `GROQ_API_KEY` is set and valid
2. `nlp_analysis: true` in config.yaml
3. GroqNLPModule constructor didn't throw during `__init__`

**Memory context is always empty**: MemoryManager not ready. Check:
1. `QDRANT_HOST` is accessible
2. `GROQ_API_KEY` is set (needed by mem0)
3. Background thread "mem0-init" completed without error

**TTS always falls back to gTTS**: Check:
1. `ELEVENLABS_API_KEY` set and has credits
2. `GOOGLE_CREDENTIALS_BASE64` or `GOOGLE_APPLICATION_CREDENTIALS` set
3. `google-cloud-texttospeech` package installed

**Screening scores not saving**: Check:
1. `user_contexts` table exists in Supabase
2. `screening_assessments: true` in config.yaml
3. At least `SCREENING_MIN_MESSAGES` (8) messages in session
