# AGENT.md — Instructions for AI coding agents (Cursor, Copilot, etc.)

## Mission

Ship minimal, reviewable diffs for **MindMitra MHA v3** — a mental-health
conversational agent for Indian young adults (18–30) — without regressing
**safety**, **auth**, or **memory isolation**. The v3 stack under
`chatbotAgent/app/` is the source of truth.

## Read order (≤ 15 minutes before coding)

1. `CLAUDE.md` (repo root) — invariants + file map
2. `html-to-markdown.md` — MHA Implementation Spec v3.0 (the contract)
3. `.cursor/plans/mha_v3_implementation_plan_01cdca63.plan.md` — phased
   roadmap with task IDs
4. The narrowest deep doc for your task (`docs/api_contracts.md`, etc.)

## Hard constraints

| Rule | Rationale |
|------|-----------|
| Never produce a Tier-3 (urgency=3) response through any LLM call | User safety — crisis path is template-only |
| Never bypass `crisis_bypass_check` or the urgency-history pre-check | Defense in depth |
| Never log raw chat content to a new public sink without explicit product sign-off | Privacy |
| PII (10-digit phone, Aadhaar, email) must be redacted in Layer 1 before any downstream call | Privacy |
| Service-role Supabase queries must filter `user_id` (and `session_id` where applicable) | Tenant isolation |
| Every Qdrant query must include a `user_id` payload filter | Tenant isolation |
| Every signal-extraction / orchestrator output field must have a declared consumer | No orphans — see CLAUDE.md invariant 5 |
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

- [ ] Code runs: `pytest tests -q -m "not integration"` (legacy) **and**
      `pytest tests/v3 -q` (v3) for backend changes.
- [ ] Frontend: no new ESLint errors in touched files.
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
