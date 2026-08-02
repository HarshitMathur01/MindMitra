# AGENT.md — Instructions for AI coding agents (Cursor, Copilot, etc.)

> **`CLAUDE.md` is the single source of truth for repo facts** — file map,
> gates, invariants, ports, env vars. This file covers *behaviour*: conventions,
> anti-patterns, and what "done" means. If the two disagree on a fact,
> `CLAUDE.md` wins and this file should be corrected.

## Mission

Ship minimal, reviewable diffs for **MindMitra MHA v3** — a mental-health
conversational agent for Indian young adults (18–30) — without regressing
**safety**, **auth**, or **memory isolation**. The v3 stack under
`chatbotAgent/app/` is the source of truth.

## Read order (≤ 15 minutes before coding)

1. `CLAUDE.md` (repo root) — invariants, file map, gates
2. `html-to-markdown.md` — MHA Implementation Spec v3.0 (the contract). Tasks
   0–15 are the phased roadmap; Task 0 holds the decisions every other layer
   depends on. The TOC is at the top of the file.
3. The narrowest deep doc for your task (`docs/api_contracts.md`,
   `docs/platform.md`, `LOCAL_DEV.md`)

## Hard constraints

| Rule | Rationale |
|------|-----------|
| Never produce a Tier-3 (urgency=3) response through any LLM call | User safety — crisis path is template-only |
| Never bypass `crisis_bypass_check` or the urgency-history pre-check | Defense in depth |
| Never log raw chat content to a new public sink without explicit product sign-off | Privacy |
| PII (10-digit phone, Aadhaar, email) must be redacted in Layer 1 before any downstream call | Privacy |
| Service-role Supabase queries must filter `user_id` (and `session_id` where applicable) | Tenant isolation |
| Every Qdrant query must include a `user_id` payload filter | Tenant isolation |
| Every signal-extraction / orchestrator output field must have a declared consumer | No orphans — see "Task 1: Full input-output field audit" in `html-to-markdown.md` |
| Prompt assembly hard caps at 8000 tokens; never trim Block 1 or Block 6 | Cost + safety floor |
| API schema changes require `docs/api_contracts.md` update in the same PR | Contract truth |
| Crisis-template changes require two distinct admin approvals | Clinical governance |
| Heavy work (consolidation, episodic write, semantic extraction) stays off the streaming hot path | Latency budget |

## Coding conventions (match the repo)

- **Python:** follow imports in `chatbotAgent/app/`. Use `logger` with
  `extra={"metrics": ...}` for structured signals. Type hints where
  neighbouring code uses them. Pydantic v2 models. `asyncio`-first; no
  `threading` except for the embedding ThreadPoolExecutor.
- **TypeScript:** functional React components, `@/` imports, do not
  introduce a second state library. Chat uses the simple HTTP `POST /chat`
  path for now; keep the text send → response flow boring and reliable.
- **Docs:** clarity > length; link to `html-to-markdown.md` for spec details
  rather than restating them.
- **Comments:** explain **why** for non-obvious invariants; do not restate
  identifier names; do not narrate what the code does.

## What "done" means

- [ ] Backend: `make test-health-fast` green (raw:
      `cd chatbotAgent && python -m pytest -m "not integration and not live_env" --tb=short -x -q`).
- [ ] Frontend: `npm run build` green; no new ESLint errors, no new
      `tsc -p tsconfig.app.json` errors, and no new `lint:copy` hits in touched
      files. See the gates table in `CLAUDE.md` for the pre-existing baselines —
      several of these gates are already red on `main`.
- [ ] Docs updated if behaviour, routes, or memory semantics changed.
- [ ] No unrelated refactors mixed into the PR.
- [ ] If a signal field is added/removed: producer + consumer + audit-log
      entry all updated in the same change set.

## Anti-patterns

- "Helpful" redesign of the whole pipeline in one PR.
- Adding an LLM call to the Tier-3 crisis path.
- Skipping the safety gate "to reduce latency" — it runs after streaming and
  fires `replace` events when needed; do not remove it from the hot path.
- Moving session-end work onto the per-turn critical path.
- Adding autocapture analytics to chat surfaces without product sign-off.
- Removing fallbacks (Azure → Groq → GLM → static template) without an
  equivalent replacement and a doc entry.

## Git / scope

Prefer **one logical change** per branch. If you touch both `src/` and
`chatbotAgent/`, call out deployment order (backend first vs forward-
compatible API). For chat transport changes, deploy backend first with a
compatibility flag, then flip the frontend.

## When uncertain

Default to **preserving existing v3 behaviour**, add a test or structured
log line that proves intent, and ask the human for product direction on UX
or safety wording. Never silently weaken a safety check to ship a feature.
