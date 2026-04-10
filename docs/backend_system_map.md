# MindMitra Backend — System Map (for testing & evaluation)

This document maps the **FastAPI chatbotAgent** service: routes, orchestration, memory/RAG, and safety. Use it with `docs/api_contracts.md`, `docs/rag.md`, `docs/memory.md`, and `docs/architecture.md`.

## Service entry

| Module | Role |
|--------|------|
| `app/main.py` | FastAPI app, CORS, `/health` first, routers: `chat`, `onboarding`, `therapist_bridge` |
| `app/api/health.py` | `GET /health`, `GET /`, `GET /debug/memory` |

## HTTP routes (chat agent)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/health` | No | Liveness |
| GET | `/` | No | Meta + `/docs` |
| GET | `/debug/memory` | No | mem0/Qdrant probe; `user_id` query |
| POST | `/chat` | Bearer (or `SKIP_AUTH`) | Full pipeline; optional eval trace (see below) |
| POST | `/chat/stream` | Bearer | SSE streaming |
| GET | `/chat/greeting` | Bearer | Session greeting |
| POST | `/transcribe` | Bearer | Groq Whisper WAV |
| POST | `/onboarding/mirror-response` | — | Mirror + crisis screening |
| POST | `/onboarding/crisis-check` | — | LLM crisis disambiguation |
| * | `/therapist-bridge/*` | Bearer | Profile preview, referral, clinician brief |

## Request / response — `/chat`

- **Request:** `ChatRequest` (`app/models/request_models.py`): `user_message`, `session_id`, `voice_analysis`, `audio_data`, `avatar_visible`, `personality`, `companion_name`, `language`.
- **Response:** `ChatResponse` (`app/models/response_models.py`): `message`, `animation`, `facial_expression`, `modality`, `confidence`, `session_insights`, optional **`eval_trace`** (evaluation only).

### Evaluation trace (non-default)

When **`ALLOW_EVAL_TRACE=true`** (env) **and** header **`X-MindMitra-Eval-Trace: 1`**, the JSON includes `eval_trace`:

- `pipeline_path` — e.g. `A-casual`, `B-emotional`, `C-therapeutic`, `D-crisis`
- `router_intent_raw`, `routed_intent` — intent before/after crisis gate
- `memory_injected`, `memory_context_preview`, `memory_char_len` — **conversation-memory RAG** injection (not external KB)
- `risk_assessment`, `emotional_state` — from `psychological_analysis`

**Do not enable in production** without access controls; previews can contain sensitive memory text.

## Orchestration pipeline

```
User message
  → create_empty_user_context (app/pipeline/context.py)
  → PipelineOrchestrator.route_and_execute
       • IntentRouter.classify (Groq) → casual | emotional | therapeutic | crisis
       • Crisis keyword gate (hard / ambiguous + LLM) → may force crisis
       • memory_manager.retrieve_memories + get_emotional_trend (parallel, timeout)
       • Path A / B / C / D
  → ResponseGenerator.generate (GLM / Azure per config)
  → return message + session_insights [+ eval_trace]
```

Key modules:

| Component | Path |
|-----------|------|
| Workflow singleton | `app/pipeline/workflow.py` — `MindMitraWorkflow`, `process_user_chat()` |
| Router + paths | `app/pipeline/pipeline_orchestrator.py` |
| Crisis | `app/pipeline/crisis_manager.py` — keywords, templates, `crisis_fast_path`, `crisis_llm_check` |
| Analysis (Path B/C) | `app/pipeline/analysis_engine.py` |
| Final LLM turn | `app/agents/response_agent.py` |
| Intent | `app/agents/intent_router.py` |

## “RAG” in this codebase

Per `docs/rag.md`, implemented RAG is **conversation-memory RAG** (mem0 + Qdrant + embeddings), not a general document KB.

- **Retrieval:** `MemoryRetriever.retrieve_memories` (`app/agents/memory_retriever.py`) → formatted string → `ctx["memory_context"]`.
- **Injection:** Used in analysis prompts and `ResponseGenerator` system prompt (`{memory_context}`).
- **Writes:** `memory_manager` (`app/agents/memory_manager.py`) — extraction, summaries, crisis memory, procedural synthesis.

Tests that expect “KB-style” citations should be framed as **memory continuity** or **grounding in injected context**, not Wikipedia-style sources.

## Safety / crisis

1. **Keyword scan:** `CrisisManager.check_crisis_keywords` — `hard` | `ambiguous` | `safe`.
2. **LLM check:** `crisis_llm_check` for ambiguous phrases.
3. **Path D:** `crisis_fast_path` — template response with helplines, logging, optional `crisis_events` insert.

**Critical:** Crisis path must not be bypassed by tests that mock only the LLM; keyword layer is deterministic Python.

## Auth

- `app/core/auth.py` — `validate_user_token`; **`SKIP_AUTH=true`** → `DEV_USER_ID` (local/dev).

## Config & logging

- `app/core/config.py` + `config.yaml` — models, feature flags.
- **Pipeline debug logs:** set **`MM_PIPELINE_DEBUG=true`** for truncated system/user prompts and AI preview in `response_agent`; memory preview after injection in `pipeline_orchestrator`.

## Related docs

- `docs/api_contracts.md` — HTTP schemas
- `docs/memory.md` — memory types and lifecycle
- `docs/rag.md` — RAG scope
- `docs/EVALUATION.md` — how to run pytest + `run_full_evaluation.py`
