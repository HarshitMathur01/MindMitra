# Backend — getting started

**TL;DR:** Python 3.12 FastAPI app in `chatbotAgent/`. JWT on chat routes. Memory = Qdrant + mem0 + Supabase metadata. **JSON responses do not include audio** — TTS/lipsync run in the browser. Full pipeline: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**Also read:** [`../MASTER_DOCUMENTATION.md`](../MASTER_DOCUMENTATION.md) · [`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md)

---

## Commands

```bash
cd chatbotAgent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
docker run -d -p 6333:6333 qdrant/qdrant
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI: `http://127.0.0.1:8000/docs`

---

## HTTP routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | No | Liveness |
| GET | `/health/ready` | No | Required env present (Groq + Supabase) |
| GET | `/` | No | Meta |
| GET | `/debug/memory` | No | mem0 probe; **off** in public prod unless env enables |
| POST | `/chat` | Bearer | Full pipeline → `ChatResponse` (text + avatar **metadata** only) |
| POST | `/chat/stream` | Bearer | SSE (`text_chunk` … `complete`) |
| GET | `/chat/greeting` | Bearer | Session greeting JSON |
| POST | `/transcribe` | Bearer | WAV base64 → Whisper transcript |
| POST | `/onboarding/mirror-response` | — | Mirror text + crisis screen |
| POST | `/onboarding/crisis-check` | — | LLM crisis disambiguation |
| * | `/therapist-bridge/*` | Bearer | Clinician handoff |

Routers: `app/main.py` includes `chat`, `onboarding`, `therapist_bridge`.

**Dev:** `SKIP_AUTH=true` → fixed `DEV_USER_ID`. **Public production:** startup refuses `SKIP_AUTH` + `is_public_production()` (`app/main.py`, `app/core/env_flags.py`).

---

## Code map

| Concern | Module |
|---------|--------|
| Entry, CORS, health order | `app/main.py` |
| Chat, stream, memory triggers | `app/api/chat.py` |
| Orchestration | `app/pipeline/workflow.py`, `pipeline_orchestrator.py` |
| Crisis | `app/pipeline/crisis_manager.py` |
| Generation | `app/agents/response_agent.py` |
| Intent | `app/agents/intent_router.py` |
| Memory facade | `app/agents/memory_manager.py` → store / retriever / reflection |
| DB | `app/services/supabase_service.py` |
| Limits | `app/utils/constants.py`, `config.yaml` |

---

## Env

Minimum: Supabase URL + key + JWT secret; `GROQ_API_KEY`; `ZAI_API_KEY` (GLM); `GOOGLE_API_KEY` (Gemini summaries); Qdrant (`QDRANT_URL` or `QDRANT_HOST`/`PORT`). Full list: **`chatbotAgent/.env.example`**.

---

## Docs & tests

| Need | Doc |
|------|-----|
| Contracts | [`../api_contracts.md`](../api_contracts.md) |
| Memory + RAG vocabulary | [`../MEMORY_AND_RAG.md`](../MEMORY_AND_RAG.md) |
| Pytest / eval + beta analytics | [`../EVALUATION.md`](../EVALUATION.md) |
| Qdrant ops | [`QDRANT_SETUP.md`](./QDRANT_SETUP.md) |

---

## Pipeline flow (one turn)

```
User message
  → create_empty_user_context (app/pipeline/context.py)
  → PipelineOrchestrator.route_and_execute
       • IntentRouter.classify (Groq) → casual | emotional | therapeutic | crisis
       • Crisis keyword gate (hard / ambiguous + LLM) → may force crisis
       • memory_manager.retrieve_memories + get_emotional_trend (parallel, timeout)
       • Path A / B / C / D
  → ResponseGenerator.generate (GLM / Azure per config)
  → return message + session_insights [+ optional eval_trace]
```

| Component | Path |
|-----------|------|
| Workflow singleton | `app/pipeline/workflow.py` — `MindMitraWorkflow`, `process_user_chat()` |
| Router + paths | `app/pipeline/pipeline_orchestrator.py` |
| Crisis | `app/pipeline/crisis_manager.py` |
| Analysis (Path B/C) | `app/pipeline/analysis_engine.py` |
| Final LLM | `app/agents/response_agent.py` |
| Intent | `app/agents/intent_router.py` |

---

## Evaluation trace (non-default)

When **`ALLOW_EVAL_TRACE=true`** and the client sends **`X-MindMitra-Eval-Trace: 1`**, JSON may include **`eval_trace`**: `pipeline_path`, `router_intent_raw` / `routed_intent`, memory injection flags and **preview** (sensitive), plus fields derived from psychological analysis.

**Production:** public-production hosts also require **`ALLOW_EVAL_TRACE_IN_PROD`** where applicable — see `app/core/env_flags.py`. Do not expose traces to untrusted clients.

---

## RAG in this codebase

Implemented “RAG” is **conversation-memory** retrieval (`MemoryRetriever` → `memory_context` in prompts), not a public document KB. Writes go through `memory_manager`. See [`../MEMORY_AND_RAG.md`](../MEMORY_AND_RAG.md).

---

## Safety, auth, debug

- **Crisis:** `CrisisManager.check_crisis_keywords` → `hard` \| `ambiguous` \| `safe`; ambiguous may call `crisis_llm_check`; Path D uses `crisis_fast_path` (templates, logging, optional `crisis_events`). Tests that mock only the LLM must not skip the keyword layer.
- **Auth:** `app/core/auth.py` — `validate_user_token`; **`SKIP_AUTH=true`** → `DEV_USER_ID` (local only).
- **Config:** `app/core/config.py`, `config.yaml`.
- **Pipeline debug:** **`MM_PIPELINE_DEBUG=true`** — truncated prompts / previews in logs; use only in controlled environments.
