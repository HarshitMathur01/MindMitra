# MindMitra — Current (v1) Architecture · Visual Reference

> Snapshot of the **production-active** stack as of `2026-04-19`.
> Every number, model id, and threshold below is sourced directly from
> `chatbotAgent/config.yaml`, `app/utils/constants.py`, and the live
> orchestrator code. This document describes the legacy path that runs
> **whenever `MITRA_STACK_ENABLED=0` (default)**.

---

## 0. Legend used in every diagram

```
🟦 = HTTP / SSE boundary           🟩 = LLM call (named model)
🟧 = External provider             🟨 = Background thread (fire-and-forget)
🟥 = Safety / Crisis               🟪 = Vector / Memory store
🟫 = Postgres (Supabase)           ⏱ = Timeout / deadline
```

Click any section header to jump straight to its diagram.

- [1. End-to-end request lifecycle](#1-end-to-end-request-lifecycle-pochat--postchatstream)
- [2. Pipeline orchestrator (router → A/B/C/D)](#2-pipeline-orchestrator--router--paths-abcd)
- [3. Path-by-path detail (LLMs, models, tokens, temperature)](#3-path-by-path-detail)
- [4. Memory subsystem (mem0 + Qdrant + Supabase)](#4-memory-subsystem)
- [5. Memory retrieval & composite scoring](#5-memory-retrieval--composite-scoring)
- [6. Background jobs (memory, summary, screening, reflection)](#6-background-jobs-fire-and-forget)
- [7. Voice prosody pipeline](#7-voice-prosody-pipeline-praat--parselmouth)
- [8. LLM model registry (single source of truth)](#8-llm-model-registry-single-source-of-truth)
- [9. Critical numbers & timeouts cheat sheet](#9-critical-numbers--timeouts-cheat-sheet)
- [10. Failure modes & fallbacks](#10-failure-modes--fallbacks)

---

## 1. End-to-end request lifecycle (`POST /chat` & `POST /chat/stream`)

```mermaid
flowchart TB
    classDef http fill:#1e3a8a,color:#fff,stroke:#0c1d4d,stroke-width:1px
    classDef llm fill:#166534,color:#fff,stroke:#052e16
    classDef ext fill:#9a3412,color:#fff,stroke:#431407
    classDef bg fill:#a16207,color:#fff,stroke:#422006
    classDef safety fill:#991b1b,color:#fff,stroke:#450a0a
    classDef vec fill:#6b21a8,color:#fff,stroke:#3b0764
    classDef pg fill:#78350f,color:#fff,stroke:#431407

    Client["Frontend<br/>(React + TalkingHead)"]:::http
    Auth["validate_user_token<br/>(Supabase JWT)"]:::pg
    Prewarm["🟨 Pre-warm thread<br/>memory_manager.get_emotional_trend()<br/><b>fires INSTANTLY</b>"]:::bg
    FetchCtx["asyncio.gather&nbsp;(parallel)<br/>• fetch_user_context (activities + last 10 msgs)<br/>• load_session_summary (Gemini, cached)<br/>• fetch_previous_session_summary"]:::pg
    Prosody["analyze_prosody(wav)<br/>Praat/parselmouth<br/>jitter • pitch • HNR • WPM"]:::ext
    Pipeline["process_user_chat()<br/>→ MindMitraWorkflow.process_chat()<br/>→ PipelineOrchestrator.route_and_execute()"]:::llm
    Resp["ChatResponse / SSE chunks<br/>+ avatar emotion mapping"]:::http
    PostChat["🟨 Post-turn background work<br/>• _maybe_trigger_memory (every 12 msgs)<br/>• _run_session_end_jobs (every 36 msgs)<br/>• _extract_game_insights_for_memory"]:::bg

    Client --> Auth --> Prewarm --> FetchCtx --> Prosody --> Pipeline --> Resp
    Pipeline --> PostChat
```

**Key facts**

| Item | Value | Source |
|---|---|---|
| Auth | Supabase JWT (`Bearer <token>`), service-role client bypasses RLS, IDOR enforced in code | `core/auth.py` |
| Recent messages fetched per turn | **10** | `MAX_MESSAGES_FETCH=10` |
| User activities fetched per turn | **50** | `MAX_ACTIVITIES_FETCH=50` |
| Memory-extraction trigger | every **12** messages | `MEMORY_TRIGGER_INTERVAL=12` |
| Session-end jobs trigger | every **36** messages (`12 × 3`) | `chat.py` |
| Streaming polling | **2 ms** (`asyncio.sleep(0.002)`) | `chat.py` |
| Streaming flush boundary | sentence boundary regex `[.!?]\s` | `chat.py` |

---

## 2. Pipeline orchestrator — router → paths A/B/C/D

```mermaid
flowchart TB
    classDef llm fill:#166534,color:#fff
    classDef safety fill:#991b1b,color:#fff
    classDef vec fill:#6b21a8,color:#fff
    classDef path fill:#1e40af,color:#fff

    Start(["user_message in"])
    Locale["resolve_locale()<br/>script ratio + Hinglish detector<br/>(en | hi | hinglish | te | kn | ta | ja)"]
    StageCalc["Conversation stage calc<br/>msg_count → trust_window | deepening | insight | companion<br/>(thresholds 3 / 7 / 12)"]
    Screening["fetch_latest_screening_scores()<br/>(only if msg_count ≥ 8)<br/>5-min in-process cache<br/>injects PHQ-9/GAD-7 hint"]:::vec
    Voice["_build_voice_hint()<br/>WPM • jitter • pitch_std • HNR"]
    Router["🟩 IntentRouter.classify()<br/><b>Groq · qwen/qwen3-32b</b><br/>temperature=0.0  max_tokens=100<br/>output: casual | emotional | therapeutic | crisis"]:::llm
    KW["check_crisis_keywords()<br/>0ms · pure regex · 60+ keywords (en/hi/te/kn/ta/ja)"]:::safety
    LLMCheck["🟩 crisis_llm_check()<br/>Groq · qwen/qwen3-32b<br/>max_tokens=5  temp=0.0<br/><b>fail-CLOSED</b> → 'yes' on error"]:::safety
    Mem["🟪 PARALLEL (ThreadPool, 2 workers, ⏱ 5.0s)<br/>• memory_manager.retrieve_memories(query, user_id, intent)<br/>• memory_manager.get_emotional_trend(user_id) ← cache hit from prewarm"]:::vec
    Dispatch{intent ?}
    PathA[Path A · casual]:::path
    PathB[Path B · emotional]:::path
    PathC[Path C · therapeutic]:::path
    PathD[Path D · crisis]:::safety

    Start --> Locale --> StageCalc --> Screening --> Voice --> Router --> KW
    KW -- "hard match" --> PathD
    KW -- "ambiguous" --> LLMCheck
    LLMCheck -- "yes" --> PathD
    LLMCheck -- "no" --> Mem
    KW -- "safe" --> Mem
    Router -. "intent=crisis" .-> PathD
    Mem --> Dispatch
    Dispatch -- casual --> PathA
    Dispatch -- emotional --> PathB
    Dispatch -- therapeutic --> PathC
    Dispatch -- crisis --> PathD
```

**Stage calculator (`STAGE_*` constants)**

| Session msg-count | Stage | Question cap per response |
|---:|---|---:|
| 1 – 3   | `trust_window` | **1** |
| 4 – 7   | `deepening`    | **1** |
| 8 – 12  | `insight`      | **1** |
| 13 +    | `companion`    | **1** |

(All four caps are intentionally `1` — see `QUESTION_CAP_*` in `constants.py`.)

---

## 3. Path-by-path detail

### Path A — Casual / small-talk

```mermaid
flowchart LR
    classDef llm fill:#166534,color:#fff
    A1["user_message"] --> A2["🟩 ResponseGenerator.generate()<br/><b>Azure OpenAI · gpt-5-mini</b><br/>temperature=0.75  max_tokens=384<br/>stream=true"]:::llm --> A3["ai_response"]
```

- **1 LLM call total.**
- Memory is **available but NOT forced** ("don't force callbacks on a casual turn").
- Sets `technique_selection.primary_technique = "Companion"`.

### Path B — Emotional / venting

```mermaid
flowchart LR
    classDef llm fill:#166534,color:#fff
    B1[user_message] --> B2["🟩 combined_emotion_cultural_analyse<br/><b>Groq · qwen/qwen3-32b</b><br/>temp=0.1  max_tokens=400<br/>(emotion + intensity + culture + needs)"]:::llm
    B2 --> B3["map user_needs → intervention<br/>vent/validation → validate<br/>practical_help → problem-solve<br/>information → psychoeducation"]
    B3 --> B4["🟩 ResponseGenerator.generate()<br/><b>Azure OpenAI · gpt-5-mini</b><br/>temperature=0.62  max_tokens=720"]:::llm
    B4 --> B5[ai_response]
```

- **2 LLM calls total** (1 Groq analysis + 1 Azure response).
- Pulls **5 memories** (`MEMORY_LIMIT_EMOTIONAL`).

### Path C — Therapeutic / rich

```mermaid
flowchart LR
    classDef llm fill:#166534,color:#fff
    classDef safety fill:#991b1b,color:#fff
    C1[user_message] --> C2["🟥 in-path crisis keyword scan"]:::safety
    C2 -- hard --> Cd["go to Path D"]
    C2 -- safe/ambiguous --> CP["ThreadPool(2):<br/>🟩 GLM optimized_psych_analysis<br/><b>GLM glm-4-32b-0414-128k</b> · temp=0.55<br/>(emotional_state, primary_stressor, risk_level, intervention)<br/>+ 🟩 (if ambiguous) crisis_llm_check Groq qwen/qwen3-32b"]:::llm
    CP --> CR{"risk_level==crisis<br/>OR llm_crisis?"}
    CR -- yes --> Cd
    CR -- no --> CG["🟩 ResponseGenerator.generate()<br/><b>Azure OpenAI · gpt-5-mini</b><br/>temperature=0.55  max_tokens=1024"]:::llm
    CG --> CO[ai_response]
```

- **2–3 LLM calls** (1 GLM psych + 1 Azure response, optionally + 1 Groq ambiguous-crisis check in parallel).
- Pulls **7 memories** (`MEMORY_LIMIT_THERAPEUTIC`) + always all procedural memories.

### Path D — Crisis (deterministic, no generation LLM)

```mermaid
flowchart LR
    classDef safety fill:#991b1b,color:#fff
    classDef pg fill:#78350f,color:#fff
    classDef vec fill:#6b21a8,color:#fff
    D1[user_message]:::safety
    D2["🟥 build_crisis_response(lang)<br/>localised template (en/hi/hinglish/te/kn/ta/ja)<br/>+ known_support phrase if memory mentions family/friend"]:::safety
    D3["🟫 INSERT crisis_events row<br/>(user_id, level=high, voice_indicators)"]:::pg
    D4["🟪 🟨 add_crisis_memory background"]:::vec
    D1 --> D2 --> D3 --> D4
```

- **0 generation LLM calls.** Deterministic localized template. Sub-second latency.
- Helpline numbers hard-coded inside `_CRISIS_RESPONSE_TEMPLATES` (iCall `9152987821`, Vandrevala `1860-2662-345`, plus Japanese-locale numbers).

### LLM-call count summary

| Path | LLMs invoked | Models | Temps | Max-tokens |
|---|---:|---|---|---:|
| **A — casual** | 1 | Azure `gpt-5-mini` | 0.75 | 384 |
| **B — emotional** | 2 | Groq `qwen/qwen3-32b` + Azure `gpt-5-mini` | 0.1 / 0.62 | 400 / 720 |
| **C — therapeutic** | 2–3 | GLM `glm-4-32b-0414-128k` + Azure `gpt-5-mini` (+ Groq if ambiguous-crisis) | 0.55 / 0.55 | n/a / 1024 |
| **D — crisis** | 0 (1 LLM upstream for ambiguous-keyword confirmation) | Template only | — | — |
| **+ Always upstream** | 1 router | Groq `qwen/qwen3-32b` | 0.0 | 100 |

So a typical **emotional** turn = 1 router + 1 analysis + 1 generator = **3 LLM calls**.
A typical **therapeutic** turn = 1 router + 1 psych + 1 generator = **3 LLM calls** (4 if ambiguous-crisis check fires).

---

## 4. Memory subsystem

```mermaid
flowchart TB
    classDef llm fill:#166534,color:#fff
    classDef vec fill:#6b21a8,color:#fff
    classDef pg fill:#78350f,color:#fff
    classDef ext fill:#9a3412,color:#fff

    subgraph mem0["mem0 Memory framework (deferred init in daemon thread)"]
        E["🟩 mem0 LLM<br/><b>Groq · llama-3.1-8b-instant</b><br/>temp=0.1  max_tokens=2000<br/>(fact extraction + dedup)"]:::llm
        EM["🟩 Embedder<br/><b>HuggingFace · all-MiniLM-L6-v2</b><br/>local · 384-dim · no API"]:::ext
        Q["🟪 Vector store<br/><b>Qdrant collection: companion_memories</b><br/>port 6333 · 384-dim cosine"]:::vec
    end

    subgraph supa["Supabase Postgres (memory metadata)"]
        MM["🟫 memory_metadata<br/>(mem0_id, importance_score, memory_type,<br/>last_accessed_at, summary)"]:::pg
        SS["🟫 session_summaries<br/>(user_id, session_id, summary_json)"]:::pg
        UC["🟫 user_contexts<br/>(user_id, full ctx blob, screening_assessments)"]:::pg
        UMS["🟫 user_memory_stats<br/>(user_id, last_reflection_at, session_count)"]:::pg
        CE["🟫 crisis_events"]:::pg
    end

    AddMem["add_memories(messages, user_id)"] --> E --> EM --> Q
    E --> MM
    Reflect["generate_reflections() · every 5 sessions"] --> Q
    Reflect --> MM
    SessionEnd["save_session_summary()<br/>🟩 <b>Gemini gemini-2.5-flash-lite</b>"]:::llm --> SS
    Procedural["synthesize_procedural_memory()<br/>🟩 <b>GLM glm-4-32b-0414-128k</b>"] --> MM
    Procedural --> Q
```

**Three memory **types** stored in `memory_metadata.memory_type`:**

- `semantic`   — facts about the user (mem0 default extraction)
- `procedural` — coping strategies that helped (synthesized by GLM, only when keywords like "breathe", "journal", "ground" appear)
- `reflection` — higher-order patterns (synthesized every 5 sessions)
- `crisis`     — full message snapshot at crisis moment (immediate write)

---

## 5. Memory retrieval & composite scoring

```mermaid
flowchart TB
    classDef vec fill:#6b21a8,color:#fff
    classDef pg fill:#78350f,color:#fff
    classDef calc fill:#0f766e,color:#fff

    Q1["query, user_id, intent"]
    FP["Fast-path: SELECT count(*) FROM memory_metadata WHERE user_id=…<br/>cached 10 min (true) / 2 min (false)<br/><b>skip Qdrant if 0 rows</b>"]:::pg
    PAR["ThreadPool(2) parallel<br/>• 🟪 mem0.search(query, user_id, limit=25)<br/>• 🟫 _fetch_metadata_for_scoring(user_id)"]:::vec
    SC["Composite score for each hit:<br/><b>0.50·relevance + 0.35·importance + 0.15·recency</b><br/>recency = 0.999^hours_since_last_access"]:::calc
    TH["filter: composite ≥ 0.25"]
    SPLIT["Split by memory_type<br/>semantic ≤ intent_limit<br/>procedural ≤ 2 (casual/emotional)<br/>procedural ALL (therapeutic/crisis)<br/>reflection ≤ 5"]
    FMT["Format → 3 sections in system prompt:<br/>ABOUT THEM:<br/>WHAT HAS HELPED:<br/>PATTERNS NOTICED:"]
    UP["🟨 Background: UPDATE memory_metadata.last_accessed_at"]:::pg

    Q1 --> FP -- has rows --> PAR --> SC --> TH --> SPLIT --> FMT --> UP
    FP -- no rows --> Z["return empty string<br/>(no memory injected)"]
```

### Per-intent retrieval limits (`MEMORY_LIMIT_*`)

| Intent | Semantic memories returned | Procedural cap | Reflections cap |
|---|---:|---:|---:|
| `casual`      | **3** | 2 | 5 |
| `emotional`   | **5** | 2 | 5 |
| `therapeutic` | **7** | ∞ (all kept) | 5 |
| `crisis`      | **4** | ∞ (all kept) | 5 |

Constants: `MEMORY_OVERFETCH_LIMIT=25` (over-fetched then re-ranked), `MEMORY_RELEVANCE_THRESHOLD=0.25`.

### Score formula (Generative-Agents inspired)

\[
\text{score} = 0.50 \cdot \text{relevance}_{\text{cosine}} + 0.35 \cdot \frac{\text{importance}_{1..10}}{10} + 0.15 \cdot 0.999^{\,\text{hours\_since\_access}}
\]

(`SCORE_WEIGHT_RELEVANCE=0.50`, `SCORE_WEIGHT_IMPORTANCE=0.35`, `SCORE_WEIGHT_RECENCY=0.15`, `RECENCY_DECAY_RATE=0.999` per hour ≈ 84 % at one week.)

---

## 6. Background jobs (fire-and-forget)

```mermaid
sequenceDiagram
    autonumber
    participant Chat as POST /chat (returning to user)
    participant Mem as 🟨 Memory thread
    participant SE  as 🟨 Session-end thread
    participant Game as 🟨 Game-insights thread

    Chat->>Mem: every msg → counter += 1
    Note over Mem: every 12th msg<br/>fetch_last_n_messages(12)<br/>memory_manager.add_memories()<br/>(Groq llama-3.1-8b-instant<br/>extracts facts → Qdrant)
    Chat->>SE: every 36th msg
    Note over SE: 1. save_session_summary(Gemini-2.5-flash-lite)<br/>2. _trigger_procedural_synthesis (if therapeutic kws)<br/>3. screening: PHQ-9/GAD-7 EMA (Groq openai/gpt-oss-120b)<br/>4. should_generate_reflections? → reflection thread
    Chat->>Game: if user_activities > 0
    Note over Game: extract therapeutic insights<br/>from Emotion-Match / Thought-Detective /<br/>Wellness-Checkin / Mood-Mountain / Balloon-Positivity<br/>→ memory_manager.add_memories(metadata=game_insights)
```

Reflection trigger: `REFLECTION_INTERVAL_SESSIONS=5`, fetches top **30** memories by importance, emits up to **5** insights.

Screening EMA: `SCREENING_EMA_ALPHA=0.6` (60 % weight to new score), gated at `SCREENING_MIN_MESSAGES=8`.

---

## 7. Voice prosody pipeline (Praat / parselmouth)

```mermaid
flowchart LR
    classDef ext fill:#9a3412,color:#fff
    A["audio_data (base64 WAV)"] --> B["decode_audio_data()"] --> C["analyze_prosody()<br/>parselmouth.Sound"]:::ext
    C --> D["features:<br/>• speech_rate_wpm<br/>• pitch_mean_hz / pitch_std_hz<br/>• jitter_local_percent (voice shakiness)<br/>• HNR (harmonic-to-noise ratio dB)<br/>• pause_pattern"]
    D --> E["_build_voice_hint() → IntentRouter (extra signal)"]
    D --> F["voice_indicators → crisis_events row<br/>(if Path D fires)"]
```

**Heuristics that bias the router:**
- `jitter > 2.0%` → "voice shakiness"
- `pitch_std < 15 Hz` → "monotone voice"
- `pitch_std > 60 Hz` → "highly variable pitch"
- `HNR < 8 dB` → "breathy/unclear voice"

A separate STT fallback exists at `POST /transcribe` using **Groq Whisper `whisper-large-v3-turbo`** (called by frontend only when the Azure Speech SDK returns empty).

---

## 8. LLM model registry (single source of truth)

| Job | Provider | Model | Temp | Max-tok | File |
|---|---|---|---:|---:|---|
| Intent routing | Groq | `qwen/qwen3-32b` | 0.0 | 100 | `intent_router.py` |
| Crisis LLM check | Groq | `qwen/qwen3-32b` | 0.0 | 5 | `crisis_manager.py` |
| Combined emotion+culture (Path B) | Groq | `qwen/qwen3-32b` | 0.1 | 400 | `analysis_engine.py` |
| Psych analysis (Path C) | GLM (ZhipuAI) | `glm-4-32b-0414-128k` | 0.55 | model-decided | `analysis_engine.py` |
| Response generation (all paths) | **Azure OpenAI** | **`gpt-5-mini`** (low reasoning effort) | 0.55–0.75 | 384 / 720 / 1024 | `azure_controller.py` |
| Response fallback (if `llm_provider="glm"`) | GLM | `glm-4-32b-0414-128k` | same | same | `llm_controller.py` |
| Mem0 fact extraction | Groq | `llama-3.1-8b-instant` | 0.1 | 2000 | `memory_store.py` |
| Embeddings (memory) | HuggingFace local | `all-MiniLM-L6-v2` (384-dim) | — | — | `memory_store.py` |
| Session summaries | Google | `gemini-2.5-flash-lite` | default | default | `memory_store.py` |
| Procedural synthesis | GLM | `glm-4-32b-0414-128k` | default | default | `memory_reflection.py` |
| Reflection generation | Groq | configured `nlp_module.model` | default | default | `memory_reflection.py` |
| PHQ-9 / GAD-7 screening | Groq | `openai/gpt-oss-120b` | 0.0 | 280 | `screening_agent.py` |
| Speech-to-text fallback | Groq | `whisper-large-v3-turbo` | — | — | `chat.py /transcribe` |

The **active** generator is selected by `response_generator.llm_provider` in `config.yaml`. Currently `"azure"`. Toggle to `"glm"` to fall back to GLM with the same per-path token budgets.

---

## 9. Critical numbers & timeouts cheat-sheet

| Knob | Value | Where it lives |
|---|---:|---|
| `MAX_MESSAGES_FETCH` (recent context) | 10 | `constants.py` |
| `MAX_ACTIVITIES_FETCH` | 50 | `constants.py` |
| `MEMORY_TRIGGER_INTERVAL` | 12 | `constants.py` |
| Session-end jobs trigger | every 36 msgs (`12×3`) | `chat.py` |
| `MEMORY_OVERFETCH_LIMIT` | 25 | `constants.py` |
| `MEMORY_RELEVANCE_THRESHOLD` | 0.25 | `constants.py` |
| `MEMORY_LIMIT_CASUAL / EMOTIONAL / THERAPEUTIC / CRISIS` | 3 / 5 / 7 / 4 | `constants.py` |
| Memory pipeline parallel timeout | **5.0 s** (then continue without memory) | `config.yaml → performance.pipeline_memory_parallel_timeout_seconds` |
| `glm_timeout` / `groq_timeout` | 60 s / 30 s | `config.yaml` |
| `memory_retrieval_timeout` | 10 s | `config.yaml` |
| Stage thresholds | 3 / 7 / 12 | `STAGE_*` constants |
| Question caps per stage | all = **1** | `QUESTION_CAP_*` |
| Greeting cache TTL | 600 s | `GREETING_CACHE_TTL_S` |
| Screening cache TTL | 300 s | `_SCREENING_CACHE_TTL_S` |
| Has-memories cache TTL | 600 s (true) / 120 s (false) | `memory_retriever.py` |
| Emotional-trend cache TTL | 3600 s | `memory_store.py` |
| Reflection trigger | every 5 sessions | `REFLECTION_INTERVAL_SESSIONS` |
| Reflection top-N | 30 memories | `REFLECTION_MEMORY_FETCH_LIMIT` |
| Screening EMA α | 0.6 | `SCREENING_EMA_ALPHA` |
| Stream polling interval | 2 ms | `chat.py` |
| Avatar emotion buckets | 7 (empathy, concern, encouragement, acknowledgment, calm, listening, default) | `chat.py::_detect_emotion` |

---

## 10. Failure modes & fallbacks

```mermaid
flowchart LR
    classDef safety fill:#991b1b,color:#fff
    classDef warn fill:#a16207,color:#fff
    classDef ok fill:#166534,color:#fff

    F1["Memory retrieval timeout (>5 s)"]:::warn --> A1["Continue WITHOUT memory_context<br/>(orchestrator catches TimeoutError)"]:::ok
    F2["Qdrant cold start / unreachable"]:::warn --> A2["Tenacity retry w/ backoff<br/>then fail-open: skip memory"]:::ok
    F3["mem0 not yet ready (<5 s after boot)"]:::warn --> A3["retrieve_memories returns ''"]:::ok
    F4["IntentRouter Groq failure"]:::warn --> A4["Default {intent:'emotional', conf:0.5}"]:::ok
    F5["Crisis LLM check failure"]:::safety --> A5["Treat as crisis (fail-CLOSED)<br/>route to Path D"]:::safety
    F6["Azure OpenAI failure"]:::warn --> A6["if llm_provider=glm AND groq_fallback_enabled<br/>fallback Groq llama-4-scout-17b<br/>else 500 to client"]:::warn
    F7["Supabase user_contexts 404"]:::warn --> A7["disable upserts for rest of process"]:::ok
    F8["Voice prosody parselmouth import fail"]:::warn --> A8["voice_hint = None, pipeline still runs"]:::ok
    F9["Greeting pool JSON missing"]:::warn --> A9["minimal in-memory English fallback dict"]:::ok
```

### Hard safety guarantees

1. **Crisis-keyword scan cannot be bypassed.** Even if the router says `casual`, the orchestrator re-runs `check_crisis_keywords()` and overrides to `crisis` on hard match.
2. **`crisis_llm_check` fails CLOSED.** Empty output, network error, or all-retry-fail → treat the user as in crisis.
3. **IDOR-protected reads.** Every Postgres query includes `eq("user_id", authenticated_uid)` despite the service-role key bypassing RLS.
4. **No raw user transcripts in logs.** `redact_text()` runs before any user-message logging in `chat.py` and `intent_router.py`.

---

## Appendix — request → response timing budget (typical Path B turn)

```mermaid
gantt
    title One emotional turn — wall-clock target ~1.6 s
    dateFormat  X
    axisFormat  %s
    section Network
    SSE handshake & auth        :a1, 0, 50
    section Pre-fetch
    fetch_user_context (parallel) : 50, 250
    Voice prosody (Praat)         : 50, 180
    Pre-warm trend cache (bg)     :crit, 0, 10
    section Routing
    IntentRouter (Groq)           :a2, 250, 500
    Crisis keyword scan           : 500, 502
    section Memory
    retrieve_memories + trend (parallel, ⏱5s) : 502, 800
    section Generation
    Path-B combined analysis (Groq) : 800, 1100
    Azure gpt-5-mini stream start   :crit, 1100, 1600
    section Post
    Sentence-flush SSE chunks       : 1100, 1600
    fire-and-forget memory thread   : 1600, 1610
```

Targets are illustrative; actual numbers depend on Groq/Azure cold-state. The pre-warm thread on line 1 is what makes the *trend* fetch effectively free by the time the orchestrator needs it.
