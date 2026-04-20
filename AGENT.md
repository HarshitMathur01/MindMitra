# AGENT.md — Instructions for AI coding agents (Cursor, Copilot, etc.)

## Mission

Ship minimal, reviewable diffs for **MindMitra** — a mental-health-adjacent chat product — without regressing **safety**, **auth**, or **memory isolation**.

## Read order (≤ 15 minutes before coding)

1. `CLAUDE.md` (repo root) — invariants + file map  
2. `docs/MITRA.md` — lifecycle + safety + memory narrative  
3. The narrowest deep doc for your task (e.g. `docs/platform.md`, `docs/api_contracts.md`)

## Hard constraints

| Rule | Rationale |
|------|-----------|
| Never bypass crisis keyword detection in production code paths | User safety |
| Never log raw chat content to new public sinks without explicit product decision | Privacy |
| Do not widen `eval_trace` exposure in production | Prevents leaking memory snippets |
| Service-role Supabase queries must filter **`user_id` + `session_id`** where applicable | Tenant isolation |
| API schema changes require **`docs/api_contracts.md`** update in the same PR | Contract truth |
| Memory retrieval / trigger interval changes require **`docs/platform.md`** (and **`docs/EVALUATION.md`** if eval expectations change) | Ops and eval alignment |

## Coding conventions (match the repo)

- **Python:** follow existing imports in `chatbotAgent/app/`; use `logger` with `extra={"metrics": ...}` for structured signals; type hints where neighboring code uses them.
- **TypeScript:** functional React components, `@/` imports, do not introduce a second state library.
- **Docs:** clarity > length; link to `docs/README.md` / `docs/MITRA.md` instead of duplicating architecture prose.
- **Comments:** explain **why** for non-obvious invariants; do not restate identifier names.

## What “done” means

- [ ] Code runs: `pytest` (at least non-integration) for backend changes.  
- [ ] Frontend: no new ESLint errors in touched files.  
- [ ] Docs updated if behavior, routes, or memory semantics changed.  
- [ ] No unrelated refactors mixed into the PR.

## Anti-patterns

- Giant copy-paste from LLM output into `docs/MITRA.md` without updating `docs/README.md` links and code references.  
- “Helpful” redesign of the whole pipeline in one PR.  
- Adding autocapture analytics to chat surfaces without product sign-off.  
- Removing fallbacks (TTS, LLM, Qdrant) without replacement + doc.

## Git / scope

Prefer **one logical change** per branch. If you touch both `src/` and `chatbotAgent/`, call out deployment order (backend first vs forward-compatible API).

## When uncertain

Default to **preserving existing behavior** and add a test or log line that proves intent — then ask the human for product direction on UX or safety wording.
