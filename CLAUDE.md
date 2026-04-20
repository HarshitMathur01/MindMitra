# CLAUDE.md — MindMitra codebase context for AI assistants

Use this file **before** large edits. It compresses architecture, invariants, and foot-guns so reasoning matches how the system actually runs.

## Single source of narrative

1. **`docs/README.md`** — documentation entry and reading order.
2. **`docs/MITRA.md`** — diagrams + file map + one turn (start here).
3. **`docs/platform.md`** — runbook, memory v2, Qdrant, pipeline, citations index.
4. **`docs/api_contracts.md`** — request/response shapes (must stay aligned with FastAPI models).
5. **`docs/product.md`** — MindGym, therapist bridge, analytics, security headers.

If another doc disagrees with **code**, prefer **code** and update docs in the same PR.

## What MindMitra is (one paragraph)

React/Vite SPA talks to **FastAPI** (`chatbotAgent`). Auth and relational data live in **Supabase**. Longitudinal memory uses **Qdrant episodic vectors + `mitra_*` Postgres tables** with salience-weighted retrieval. **MITRA v2** pipeline (`app/pipeline/mitra/`) runs classify → crisis → retrieve → assemble → generate. **Crisis** uses `crisis_fast_path` + optional LLM confirmer. **Streaming** is SSE on `POST /chat/stream`. Chat requires **`MITRA_STACK_ENABLED=1`** (legacy `workflow.py` / `process_user_chat` removed).

## System invariants (do not break)

1. **Crisis path must remain bypass-resistant** — never skip lexical / fast-path safety checks in production without equivalent tests.
2. **Auth on chat** — `validate_user_token`; `SKIP_AUTH` is dev-only; production must refuse unsafe `SKIP_AUTH` when public prod is detected (`app/main.py`, `app/core/env_flags.py`).
3. **Memory scoped by `user_id`** — retrieval and Supabase reads must not leak cross-tenant data; service-role code must filter `user_id` explicitly where RLS does not apply.
4. **Post-response work is non-blocking** — consolidation, extraction, game bridge run in workers/threads; do not move heavy sync work into the SSE hot path without measuring p95.
5. **Conversation-memory RAG ≠ document KB** — “RAG” in evals means injected **user memory**, not citations to uploaded corpora (`docs/platform.md`).
6. **`eval_trace` / pipeline debug** can include sensitive snippets — gated by env + headers; never assume safe for prod logging.

## Mental model: one chat turn

```
HTTP → chat.py → rate limit → validate_user_token
     → fetch_user_context (Supabase)
     → mitra_dispatch.run_mitra_turn (MitraPipeline)
           → classify → crisis_fast_path → RetrieverOrchestrator.fetch
           → ContextAssembler → TwoPassGenerator | DualTrackGenerator
     → stream / JSON
     → async: consolidation jobs, …
```

## Key file map (where to edit)

| Concern | Primary files |
|---------|----------------|
| HTTP surface | `app/api/chat.py`, `health.py`, `onboarding.py`, `me_memory.py`, `therapist_bridge.py` |
| Orchestration | `app/pipeline/mitra/orchestrator.py`, `dispatch.py`, `classifier.py`, `retriever.py`, `assembler.py`, `generator.py` |
| Crisis | `app/pipeline/crisis_fast_path.py` |
| Prompts | `app/core/prompts/` (stance, critic, crisis) |
| Memory | `app/memory/*.py`, `app/jobs/consolidation_worker.py`, `extractor.py` |
| DB access | `app/services/supabase_service.py` |
| Feature flags / prod safety | `app/core/env_flags.py`, `rate_limit.py` |
| Frontend chat | `src/components/chat/ChatGPTInterface.tsx` |
| Product analytics | `src/lib/productAnalytics.ts`, `docs/product.md` |

## Common pitfalls

- **`memory_injected: false` in evals** — empty episodic/metadata for dev user, or retriever channels not bound; see `docs/EVALUATION.md`.
- **`MITRA_STACK_ENABLED` unset** — chat returns **503**, not legacy fallback.
- **Duplicate crisis copy** — crisis templates live in crisis fast-path / prompts; keep one source of truth per product decision.
- **Whisper / audio** — large payloads; mind request size limits and timeouts.
- **Type drift** — Supabase schema changes require `src/integrations/supabase/types.ts` + migration.

## How to extend safely

- **New API field:** Pydantic model + `docs/api_contracts.md` + contract test in `chatbotAgent/tests/test_api_chat_contract.py` (or sibling).
- **New pipeline stage:** `app/pipeline/mitra/*` + eval fixtures; update `docs/platform.md` and `docs/MITRA.md` as needed.
- **New memory type:** `docs/platform.md` + retriever injection + `tests/health/test_memory_v2.py`.
- **New third-party SDK:** isolate in `providers/` with timeouts and fallbacks.

## Testing commands (sanity)

```bash
cd chatbotAgent && pytest tests -q -m "not integration"
```

Integration tests need live services and `RUN_INTEGRATION=1`.

## Tone for this repo

Mental-health adjacent: prefer **conservative** behavior on ambiguity, **explicit** logging for safety paths, and **small PRs** with doc updates in the same change set.
