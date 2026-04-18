# Core System Architecture: MindMitra Backend (V2)

## 1. System Overview (Mental Model)

This flowchart represents the exact routing mapping within the `chatbotAgent` FastAPI backend, depicting a user message tracing from entry to generation, driven by the **COMPASS** cognitive layer and **MEMOIR** retrieval layer.

```mermaid
flowchart TD
    %% Entry & Validation
    Client[Client App] --> API[FastAPI: POST /chat or /chat/stream]
    API --> Auth[JWT Validation & Rate Limit]
    Auth --> CtxInit[create_empty_user_context<br/>Supabase Fetch]
    
    %% Base State
    CtxInit --> StageChk[Evaluate Conversation Stage<br/>trust_window, deepening, insight, companion]
    
    %% Routing & Intent
    StageChk --> Router[IntentRouter: classify<br/>Groq - Uses Voice/Screening Hints]
    Router --> CrisisGate{CrisisManager<br/>Keyword Scan + LLM Disambiguation}
    
    CrisisGate -- "Match" --> ForceCrisis[Set Intent = Crisis]
    CrisisGate -- "Safe" --> ThreadExecutor
    ForceCrisis --> ThreadExecutor

    %% MEMOIR Retrieval
    ThreadExecutor[ThreadPoolExecutor: 5.0s Timeout] --> MemWorker1[retrieve_memories<br/>Qdrant Vectors + ContextComposer]
    ThreadExecutor --> MemWorker2[get_emotional_trend<br/>Past Summaries LRU Cache]
    MemWorker1 -.-> MemMerge[Merge to {memory_context}]
    MemWorker2 -.-> MemMerge
    
    %% COMPASS Cognitive Layer
    MemMerge --> Compass[CognitiveLayer / COMPASS<br/>Groq Output: cl_* dict]
    Compass --> PathNode{PipelineOrchestrator<br/>Dispatch }
    
    %% Execution Paths
    PathNode -- "risk_level == crisis OR intent == crisis" --> PathD[Path D-crisis-warm<br/>Bypass LLM - Static Template]
    PathNode -- "cl_intent == casual" --> PathA[Path A-casual-v2<br/>_path_light: T=0.8, Tokens: 384]
    PathNode -- "cl_intent IN [venting, emotional, reflect, update]" --> PathB[Path B-emotional-v2<br/>_path_standard: T=0.6, Tokens: 720]
    PathNode -- "cl_intent == [advice/therapeutic/default]" --> PathC[Path C-therapeutic-v2<br/>_path_rich: T=0.55, Tokens: 1024]
    
    %% Response Generation
    PathA --> CtxAssm[ResponseGenerator<br/>SYSTEM_PROMPT_V2 Assembly]
    PathB --> CtxAssm
    PathC --> CtxAssm
    
    CtxAssm --> LLMGen[LLM Generation<br/>GLM / Azure]
    PathD --> RtnNode
    
    LLMGen --> RtnNode[Format Final Response<br/>SSE Chunks or JSON]
    RtnNode --> Client
    
    %% Async Hooks / Memory Writing 
    RtnNode -.-> Async[Post-Response Async Threads]
    Async --> ModuloCheck{message_count % 12 == 0}
    ModuloCheck -- "True" --> AddStruct[add_structured Pipeline<br/>SignalClassifier -> Groq Extractor -> QualityGate -> Qdrant/Supabase]
    Async --> Safety(OutputSafetyAuditor & EmotionalArcUpdater)
    Async --> Modulo36{message_count % 36 == 0}
    Modulo36 -- "True" --> Checkpoint[Session Checkpoint<br/>Reflection/Summary Jobs]
```

## 2. Request Lifecycle (The Pipeline Orchestrator)

- **Entry Point (`chatbotAgent/app/api/chat.py`)**
  - Endpoint receives payload via `POST /chat/stream` or `POST /chat`.
  - Asserts authentication against Supabase JWT bindings (`validate_user_token`).
  - Boots up `create_empty_user_context()` drawing past hybrid message lists, personality settings (`Mitra, Arjun, Diya, Riya, Zen`), voice analysis transcripts (Groq Whisper), and user activities.

- **Conversation Staging (`pipeline_orchestrator.py`)**
  - Messages are categorized by count:
    - `<= trust_window_max`: Forces the model to earn presence.
    - `<= deepening_max`: Forces layer-beneath observations.
    - `<= insight_max`: Gently explores meaning without deflection.
    - `> insight_max` (companion): Direct, conversational warmth.

- **Intent Routing & Safety Gating**
  - **`IntentRouter.classify`**: Fed recent strings, Activities, `screening_hint` (EMA-based PHQ-9/GAD-7 history), and `voice_hint`. Returns primary category.
  - **`CrisisManager`**: Uses strict Python word sets. If triggered: it executes a hard override (`crisis`). If ambiguous: queries LLM (`CRISIS_LLM_CHECK_PROMPT`) to confirm. Cannot be disabled.

- **COMPASS Execution (`core/cognitive_layer.py`)**
  - Invokes a single structural Groq operation.
  - Resolves conversation dynamics: `risk_level`, `arc_trajectory` (rising, falling, volatile), `primary_emotion`, `mi_move` (Motivational Interviewing move like open_question vs affirmation), `question_allowed`, and `intervention_sequence`.
  - Attached to session context dict via `cl_*` prefixes.

## 3. Tiered MEMOIR Architecture (Memory)

The system relies strictly on **Conversation-memory RAG** bounded to user scopes, completely omitting generalized external document RAG.

- **Read Path (`retrieve_memories`)**
  - Triggered concurrently with `get_emotional_trend` behind a **`5.0s` Timeout** (`performance.pipeline_memory_parallel_timeout_seconds` config). On timeout, pipeline proceeds with an empty context (fail-soft).
  - Fetches candidate vectors filtered by `user_id` from the Qdrant `companion_memories` collection.
  - **MEMOIR Scorer**: Filters candidates via `memoir_scorer`, applying relevance floors (e.g., `0.25 threshold`), `memory_suppressor`, and recency biases (`decay_engine`).
  - **Composer (`ContextComposer`)**: Appends the returned facts to the contextual emotion trend, assembling `{memory_context}` within hard token constraints.

- **Write Path (`SessionLifecycle.on_message`)**
  - Ticked incrementally upon every successful response generation via hybrid counter `_maybe_trigger_memory`.
  - **Extraction Cadence (12 messages)**: Spawns off-thread `MemoryStore.add_structured` execution:
    1. **SignalClassifier**: Assesses if the block holds semantic/procedural importance.
    2. **MemoryExtractor** (Groq): Extracts concise facts natively.
    3. **QualityGate**: Measures cosine similarity against existing Qdrant embeddings to reject contradictions/duplicates.
    4. **MemoryCRUD**: Writes successful data simultaneously to Qdrant (vectors) and Supabase (`memory_metadata`).
  - **Checkpoint / EoS (36 messages)**: Triggers session summaries and broad reflection evaluations in `MemoryReflection`.
  - **Game Bridge**: Specific synthetics (`source: game_insights`) are synced out-of-band via `add_memories()`.
  - **Crisis Writing**: Evaluated directly through `add_crisis_memory()` alongside DB `crisis_events` inserts without raw body retention for pure safety logging.

## 4. Response Generator Pipeline

Driven by `agents/response_agent.py` acting strictly on instructions set by the Orchestrator paths.

- **Context Assembly (`RESPONSE_SYSTEM_PROMPT_V2`)**
  - **Personality Profiles:** Bootstraps hard-coded identities (e.g., `mitra` (warm counselor), `arjun` (direct senior), `diya` (philosophical guide), `riya` (enthusiast), `zen` (grounding space)).
  - **Variable Injection:** Translates COMPASS layers into plain English directives (`{primary_emotion}`, `{mi_guidance}`, `{length_guidance}`, `{arc_note}`, `{safety_note}`).
  - Strictly polices constraints per the user's `stage_directive` (e.g., "MAX ONE question").

- **Execution & Generation Options**
  - **`Path A-casual-v2`**: Uses 384 token limits, high creativity (temp `0.8`).
  - **`Path B-emotional-v2`**: Support emphasis, 720 tokens, moderate safety (temp `0.6`).
  - **`Path C-therapeutic-v2`**: Deep-dive advice scaffolding, 1024 tokens, stable limits (temp `0.55`).
  - **`Path D-crisis-warm`**: Instantly breaks away. Relies strictly upon Python templates (`build_warm_crisis_response`).

- **Final Clean Returns**
  - Transmits via Server-Sent Events (SSE) `text_chunk_delta` mappings (`/chat/stream`) or native JSON objects (`/chat`).
  - Passes animation and facial_expression triggers up for the frontend Client/Azure TTS.
  - Initiates daemon updates for `OutputSafetyAuditor` tracking and `EmotionalArcUpdater`.
