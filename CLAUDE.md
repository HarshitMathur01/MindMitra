# CLAUDE.md — MindMitra codebase context for AI assistants

Use this file **before** large edits. It compresses architecture, invariants, and foot-guns so reasoning matches how the system actually runs.

## Single source of narrative

1. **`docs/README.md`** — documentation hub: links, ADR summary, where to read next.  
2. **`docs/api_contracts.md`** — request/response shapes (must stay aligned with FastAPI models).  
3. **`docs/backend/ARCHITECTURE.md`** — backend deep dive (routes, COMPASS, screening, TTS notes).  
4. **`docs/backend/MEMORY_ARCHITECTURE.md`** — memory truth: MEMOIR, triggers, timeouts.

If `ai/claude.md` disagrees with this file, prefer **`CLAUDE.md`** + **`docs/README.md`**.

## What MindMitra is (one paragraph)

React/Vite SPA talks to **FastAPI** (`chatbotAgent`). Auth and relational data live in **Supabase**. Longitudinal “memory RAG” uses **Qdrant + mem0** with Groq/Gemini/GLM etc. for different stages. **Crisis handling** is layered: Python keyword gate → optional LLM disambiguation → template-first Path D. **Streaming** is SSE on `POST /chat/stream`.

## System invariants (do not break)

1. **Crisis path must remain bypass-resistant** — never skip `CrisisManager` keyword checks for convenience in tests without replacing them with equivalent assertions.
2. **Auth on chat** — `validate_user_token`; `SKIP_AUTH` is dev-only; production must refuse `SKIP_AUTH` when `MINDMITRA_ENV` / platform flags indicate public production (`app/main.py`).
3. **Memory scoped by `user_id`** — retrieval and Supabase message reads must not leak cross-tenant data; service-role code must filter `user_id` explicitly where RLS does not apply.
4. **Post-response work is non-blocking** — memory extraction, summaries, game bridge run in daemon threads; do not move heavy sync work into the SSE hot path without measuring p95.
5. **Conversation-memory RAG ≠ document KB** — “RAG” in evals means injected **user memory**, not citations to uploaded corpora (`docs/MEMORY.md`).
6. **eval_trace / pipeline debug** can include sensitive snippets — gated by env + headers; never assume safe for prod logging.
7. **COMPASS + MEMOIR** — The chatbot agent always uses the cognitive-layer response stack (COMPASS) and MEMOIR retrieval with structured extraction; legacy env toggles were removed.

## Mental model: one chat turn

```
HTTP → chat.py → rate limit → validate_user_token
     → fetch_user_context (Supabase)
     → parallel: retrieve_memories + emotional_trend
     → CrisisManager keyword/LLM gate (hard → warm template Path D, return)
     → CognitiveLayer (COMPASS) — intent/risk are prompt-shaping only
     → COMPASS-v2 → ResponseGenerator (GLM etc.) → stream / JSON
     → async: add_structured / session jobs / game bridge / post-stream hooks
```

## Key file map (where to edit)

| Concern | Primary files |
|---------|----------------|
| HTTP surface | `chatbotAgent/app/api/chat.py`, `health.py`, `onboarding.py`, `therapist_bridge.py` |
| Orchestration | `chatbotAgent/app/pipeline/workflow.py`, `pipeline_orchestrator.py` |
| Crisis copy / numbers | `chatbotAgent/app/pipeline/crisis_manager.py` |
| System prompts / caps | `chatbotAgent/app/core/prompts.py`, `response_agent.py` |
| Memory IO | `memory_manager.py`, `memory_retriever.py`, `memory_store.py`, `memory_reflection.py` |
| DB access | `chatbotAgent/app/services/supabase_service.py` |
| Response / memory | COMPASS + MEMOIR (no runtime flag switch; see `app/agents/README.md`, `COMPASS_CUTOVER.md`) |
| Frontend chat | `src/components/chat/ChatGPTInterface.tsx` |
| Product analytics | `src/lib/productAnalytics.ts`, `docs/EVALUATION.md` (Product metrics) |

## Common pitfalls

- **`memory_injected: false` in evals** — empty `memory_metadata` for `DEV_USER_ID`, or fewer than `MEMORY_TRIGGER_INTERVAL` turns so nothing is extracted yet (`docs/EVALUATION.md`).
- **Silent `buckets` vs `_buckets`** in rate limiter — must use the lock-guarded dict actually defined in module.
- **Duplicate crisis templates** — crisis bodies live in `crisis_manager.py`, not scattered in `prompts.py`.
- **Whisper / audio** — large payloads; mind request size limits and timeouts.
- **Type drift** — Supabase schema changes require `src/integrations/supabase/types.ts` + migration.

## How to extend safely

- **New API field:** Pydantic model + `docs/api_contracts.md` + contract test in `chatbotAgent/tests/test_api_chat_contract.py` (or sibling).
- **New pipeline path:** orchestrator + workflow + eval fixtures; update `docs/backend/PIPELINE.md`.
- **New memory type:** `docs/MEMORY.md` + `docs/backend/MEMORY_ARCHITECTURE.md` + retriever injection + scoring tests; watch prompt token budget.
- **New third-party SDK:** isolate in `services/` with timeouts and fallbacks.

## Testing commands (sanity)

```bash
cd chatbotAgent && pytest tests -q -m "not integration"
```

Integration tests need a live server and `RUN_INTEGRATION=1`.

## Tone for this repo

Mental-health adjacent: prefer **conservative** behavior on ambiguity, **explicit** logging for safety paths, and **small PRs** with doc updates in the same change set.

- Always run all the pytest after code completion or task completion to verify the system is working fine. If new things are added to the system, make sure to add one of its test in either of the tests or make a new test file.