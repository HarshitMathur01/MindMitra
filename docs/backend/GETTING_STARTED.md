# Backend — getting started

**TL;DR:** Python **3.12** FastAPI app in `chatbotAgent/`. JWT on protected routes. Memory stack = **MEMOIR** (structured extraction + scored retrieval) backed by **Qdrant** + **Supabase** metadata + **mem0** helpers. **JSON responses do not include audio** — TTS runs in the browser.

**Read next:** [`../README.md`](../README.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md) · [`../MEMORY.md`](../MEMORY.md)

---

## Commands

```bash
cd chatbotAgent
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
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
| GET | `/health/ready` | No | Required env sanity |
| GET | `/` | No | Meta links |
| GET | `/debug/memory` | No | mem0 probe — may be gated in production |
| POST | `/chat` | Bearer | Full pipeline → `ChatResponse` |
| POST | `/chat/stream` | Bearer | SSE streaming |
| GET | `/chat/greeting` | Bearer | Session greeting JSON |
| POST | `/transcribe` | Bearer | WAV base64 → Whisper |
| POST | `/onboarding/mirror-response` | — | Validation + mirror flow |
| POST | `/onboarding/crisis-check` | — | Crisis check body |
| * | `/therapist-bridge/*` | Bearer | Clinician handoff |

Routers: `app/main.py`.

**Dev:** `SKIP_AUTH=true` uses `DEV_USER_ID`. **Public production:** startup refuses unsafe `SKIP_AUTH` (`app/core/env_flags.py`).

---

## Code map

| Concern | Module |
|---------|--------|
| Entry, CORS, health order | `app/main.py` |
| Chat, stream, memory triggers | `app/api/chat.py` |
| Orchestration | `app/pipeline/workflow.py`, `pipeline_orchestrator.py` |
| Crisis detection + logging hooks | `app/pipeline/crisis_manager.py` |
| Warm crisis copy | `app/core/crisis_templates.py` |
| COMPASS | `app/core/cognitive_layer.py`, `cognitive_layer_types.py` |
| Generation | `app/agents/response_agent.py` |
| Intent | `app/agents/intent_router.py` |
| Memory facade | `app/agents/memory_manager.py` |
| Session memory cadence | `app/core/session_lifecycle.py` |
| DB | `app/services/supabase_service.py` |
| Limits | `app/utils/constants.py`, `config.yaml` |

---

## Environment

Minimum for local memory + chat: Supabase URL + key; `GROQ_API_KEY`; response provider key (`ZAI_API_KEY` or Azure settings); Qdrant reachable; optional `GOOGLE_API_KEY` for summaries.

**Authoritative list + comments:** `chatbotAgent/.env.example`.

---

## Docs & tests

| Need | Doc |
|------|-----|
| Doc hub | [`../README.md`](../README.md) |
| Contracts | [`../api_contracts.md`](../api_contracts.md) |
| Memory vocabulary | [`../MEMORY.md`](../MEMORY.md) |
| Pytest / eval | [`../EVALUATION.md`](../EVALUATION.md) |
| Qdrant bring-up | [`QDRANT_SETUP.md`](./QDRANT_SETUP.md) |
| Logs | [`../LOGGING.md`](../LOGGING.md) |

```bash
cd chatbotAgent && pytest tests -q -m "not integration"
```

---

## One-turn pipeline (summary)

```
User message
  → create_empty_user_context
  → PipelineOrchestrator.route_and_execute
       • IntentRouter.classify
       • CrisisManager keyword + optional LLM gate
       • memory_manager.retrieve_memories + get_emotional_trend (parallel, timeout)
       • CognitiveLayer.analyze → cl_* in ctx
       • Path A-casual-v2 / B-emotional-v2 / C-therapeutic-v2 / D-crisis-warm
  → ResponseGenerator.generate (except D-crisis-warm)
  → return message + session_insights [+ optional eval_trace]
```
