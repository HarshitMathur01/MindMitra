# CLAUDE.md — MindMitra codebase context for AI assistants

Single source of truth for repo facts: paths, gates, invariants, foot-guns.
`AGENT.md` covers behaviour and PR conventions and defers to this file for
anything factual. Read this before large edits.

If a doc disagrees with **code**, prefer **code** and fix the doc in the same PR.

## What MindMitra is

An AI mental-health companion for Indian college students (18–25) — the *zero-th
layer* of care, the first touchpoint before professional therapy. Not a therapy
app, not a diagnostic tool, not a mood tracker with streaks.

- **Conversational agent** (the core): Hindi / English / Hinglish, 5 modes
  (Companion, Active Listener, Psychoeducation, Skill Coach, Referral Bridge)
  selected per turn from affect signals; EMA-based tone convergence; episodic
  memory across sessions. Azure OpenAI (`gpt-5-mini`, see
  `AZURE_OPENAI_DEPLOYMENT_NAME`) → Groq → GLM-4 → static template.
- **Avatar** — lipsync avatar speaks responses aloud.
- **Therapist Bridge** — referral to verified therapists, positioned as an
  add-on to the MindMitra relationship, never a replacement.
- **MindGym** — evidence-based micro-interventions (box breathing, 4-7-8,
  5-4-3-2-1 grounding).

Never diagnoses, never prescribes, never replaces a therapist. **Crisis
responses are fixed, clinician-reviewed templates — never LLM-generated.**

Compliance: DPDP Act 2023, UGC mental-health guidelines 2023, Indian data
residency, user-controlled memory (view/edit/delete), append-only audit log on
every data access.

## System invariants (do not break)

1. **Crisis path stays bypass-resistant.** Lexical + Groq-LLM confirmer in
   `app/pipeline/crisis_bypass.py`; tests in
   `chatbotAgent/tests/unit/pipeline/test_crisis_bypass.py`. Never bypass these
   checks in prod without equivalent coverage. The Anam avatar runs in turnkey
   mode (Anam's LLM writes the replies), so `crisis_bypass` is not inline there
   — `POST /anam/crisis-check` re-adds it out-of-band and the frontend must call
   it on every user utterance. Do not ship the avatar without that interceptor.
2. **Auth on chat.** HTTP chat resolves the Supabase JWT against
   `SUPABASE_JWT_SECRET`. `SKIP_AUTH` is dev-only — production refuses unsafe
   SKIP_AUTH when `ENV=production` unless `ALLOW_INSECURE_SKIP_AUTH=true`.
3. **Memory scoped by `user_id`.** Service-role queries (Supabase + Qdrant) must
   filter `user_id` explicitly. RLS does the rest for authenticated reads.
4. **Post-response work is non-blocking.** Session-end consolidation, audit-log
   writes, and async memory writers run via `asyncio.create_task` or the
   session-end worker. Do NOT move heavy sync work into the request hot path.
5. **`eval_trace` / pipeline debug snippets can leak PII.** Gated by env +
   headers; never assume safe for prod logs.
6. **No legacy fallback.** `/chat/stream`, `/chat/greeting`, `/ws/chat`,
   `/me-memory`, the MITRA v2 pipeline, the mem0 layer, and the one-shot
   greeting service have been deleted. Don't reintroduce them without a written
   sign-off.
7. **Therapist-bridge consent is deny-by-default.** A `profile-preview` or
   `referral` request with no `consent` block shares nothing. Every key in
   `ConsentStatePayload` must govern a real section of the payload — a toggle
   the server ignores is a promise the UI cannot keep. Filtering happens
   server-side so the "what your therapist sees" preview is the payload, not a
   drawing of it.
8. **Three tables have no writer.** `session_summaries`,
   `user_contexts.screening_assessments` and `crisis_events` are pre-v3 and
   nothing populates them. `therapist_profile_builder` reads Qdrant
   `episodic_memories`, `user_longitudinal_trajectory` and `sessions` instead.
   Don't point new code at the dead three without adding a writer first —
   there's a test pinning this (`test_builder_does_not_query_pre_v3_tables`).

## Gates — local only, there is no CI

`.github/workflows/` does not exist. Nothing runs on push. **The local gates are
the only gates**; run them before you claim done.

| Gate | Command | Baseline on `main` |
|------|---------|--------------------|
| Backend (offline pytest, mocked LLM + auth) | `make test-health-fast` | green — 176 passed, 16 deselected, ~9s |
| Backend + frontend build | `make test-health` | green |
| Live Supabase/Qdrant smoke | `make test-health-full` | needs services + `RUN_INTEGRATION=1` |
| Episodic retrieval IR metrics | `make memory-bench` | writes JSON to `chatbotAgent/evaluations/` |
| Frontend build | `npm run build` | green, ~34s |
| ESLint | `npm run lint` | 0 errors, 81 warnings — gate is **0 errors** |
| Copy guard | `npm run lint:copy` | **exits 1** — 4 pre-existing hits |
| Type-check | `npx tsc -p tsconfig.app.json --noEmit` | **16 pre-existing errors** |

**`make` is not installed on the primary Windows dev box.** Raw equivalents:

```bash
cd chatbotAgent && python -m pytest -m "not integration and not live_env" --tb=short -x -q
npm run build
```

Gate rules that are easy to get wrong:

- **`npx tsc --noEmit` at the repo root is a no-op.** Root `tsconfig.json` is a
  solution file (`"files": []` + project references), so it always reports zero
  errors. The real check is `npx tsc -p tsconfig.app.json --noEmit`, which has
  **16 pre-existing errors** across 10 files (`components/app/Section.tsx`,
  `PageContainer.tsx`, `PageHeader.tsx`, `chat/ChatGPTInterface.tsx`,
  `mindgym/shared/{Buddy,ParticleField}.tsx`, `hooks/useAzureSpeech.tsx`,
  `lib/companion/buddyBrain{,.test}.ts`, `mindgym/tools/MemoryChallenge.tsx`).
  The rule is **no NEW errors in files you touched**, not "clean".
- **`npm run lint:copy` already fails on `main`** — 4 banned-word hits
  (`MoodMountain.tsx:251` "journey"; `ThoughtDetective.tsx:262,712,713`
  "unlock"). The gate is **zero new hits**. Multi-token `willChange` CSS values
  are false positives, not real hits.
- **Node is pinned.** `.nvmrc` = 22.13.0, `engines` = `>=22.13.0 <23 || >=24`.
  Every npm script shells through `scripts/with-supported-node.mjs`, so run
  scripts via `npm run …`, not bare `vite`/`eslint`.
- **Ports:** frontend Vite `8080` (`strictPort: true` — fails rather than
  drifting to 8081), backend uvicorn `8000`.

## Mental model: one chat turn

```
POST /chat → resolve authenticated user               — JWT
   → session_service.session_startup()                — 4 parallel loads, Redis
   → pipeline.ingestion.ingest_input()                — Unicode + PII redact
   → pipeline.signal_extraction.extract_signals()     — Groq structured, parallel w/ embed
   → pipeline.crisis_bypass.crisis_bypass_check()     — deterministic, urgency=3 short-circuits
   → pipeline.orchestrator.run_orchestrator()         — pure Python (mode, tone, gates)
   → pipeline.memory_retrieval.retrieve_memory()      — Qdrant dual-channel
   → pipeline.prompt_builder.build_full_prompt()      — 7-block, tiktoken trim
   → pipeline.llm_core.generate_response()            — Azure OpenAI (gpt-5-mini) stream + fallback chain
   → pipeline.safety_gate.run_safety_gate()           — 5 checks, retry/replace/static fallback
   → HTTP response: confirmed | replace | crisis text
   → asyncio: audit_log, session persist, session-end worker on idle/timeout
```

## Key file map (paths relative to `chatbotAgent/` unless under `src/`)

| Concern | Primary files |
|---------|----------------|
| HTTP surface | `app/main.py`, `app/api/health.py`, `app/api/therapist_bridge.py` |
| v3 routers | `app/api/chat_ws.py` (`POST /chat`, `_process_turn`), `onboarding.py`, `audio.py`, `anam.py`, `avatar.py`, `admin.py`, `snapshot.py` |
| Anam avatar | `app/api/anam.py` (session token, heartbeat, crisis-check, turn recorder), `app/api/avatar.py` (persona builder), `app/services/anam_quota.py` (daily video quota), `config.yaml` → `avatar:`, `src/hooks/useAnamAvatar.ts`, `docs/anam-avatar.md` |
| Therapist Bridge | Backend: `app/api/therapist_bridge.py`, `app/services/therapist_profile_{builder,synthesis}.py` — live and hardened. Frontend: `src/pages/TherapistBridge.tsx`, `src/components/therapist-bridge/*`, `src/lib/therapist-bridge/*` — a verbatim port of `rana-jatin/remix-of-gentle-bridge` running on **fixtures only**. The two halves are not connected; see `docs/api_contracts.md` §10. |
| Pipeline | `app/pipeline/{ingestion,signal_extraction,crisis_bypass,orchestrator,memory_retrieval,prompt_builder,llm_core,safety_gate,activity_suggestion}.py` |
| Connections | `app/core/connections.py` (Redis, Qdrant, Azure, Groq, Gemini, GLM, Supabase) |
| Session lifecycle | `app/services/session_service.py`, `app/core/session.py`, `app/jobs/session_end_worker.py` |
| Memory writers | `app/memory/{embedding,episodic_write,semantic_write,procedural_update,longitudinal_update}.py` |
| Env / feature flags | `app/core/env.py`, `chatbotAgent/config.yaml` |
| Frontend chat | `src/components/chat/ChatGPTInterface.tsx`, `src/components/chat/*`, `src/hooks/useChat.tsx` |
| Backend tests | `tests/unit/{pipeline,memory,services,delivery}/`, `tests/api/`, `tests/v3/` (feature slices), `tests/integration/` (needs live services) |
| Schema | `scripts/migrations/v3_schema.sql`, `scripts/migrations/init_qdrant.py` (repo root, not `chatbotAgent/`) |
| Spec / runbook | `html-to-markdown.md` (MHA Impl Spec v3.0, 2414 lines, TOC at top), `LOCAL_DEV.md` |

## Common pitfalls

- **Boot failure** — `SUPABASE_JWT_SECRET` missing. The lifespan log prints
  `SUPABASE_JWT_SECRET ❌ Missing`; authenticated chat fails unless `SKIP_AUTH`
  is on for local dev.
- **Chat returns service unavailable** — `MHA_V3_ENABLED=0`. Set to `1` or unset.
- **Redis keyspace warning at startup** — Redis reachable but not publishing
  `Ex` events; the polling sweep takes over but consolidation fires up to 60s
  late. Restart Redis with `--notify-keyspace-events Ex`.
- **`confirmed` never arrives** — safety gate retried twice + failed static
  fallback; check Groq key + safety_gate logs.
- **`replace` event with no preceding `chunk`** — Azure stream short-circuited
  (e.g. content filter). The client replaces the buffer with the static
  template. Working as intended.
- **Two migration lineages.** `supabase/migrations/` is the dashboard-linked
  lineage for frontend-facing tables (profiles, mood_logs, product_events,
  therapist bridge). The backend chat schema lives in
  `scripts/migrations/v3_schema.sql` and is applied by hand per `LOCAL_DEV.md`.
  A backend table added only to the dashboard lineage will be missing from v3
  environments, and vice versa — pick the lineage that owns the table and say so
  in the PR.

## How to extend safely

* **New pipeline stage** — see the `pipeline-change` skill
  (`.claude/skills/pipeline-change/`) for the full checklist.
* **New chat response field**: extend the HTTP response shape in
  `ChatGPTInterface.tsx` and the server payload in `app/api/chat_ws.py`; mirror
  the docs in `html-to-markdown.md` and `docs/api_contracts.md`.
* **New memory channel**: write under `app/memory/`, hook into
  `memory_retrieval.retrieve_memory()`, update the Qdrant collection in
  `scripts/migrations/init_qdrant.py`.
* **New env var**: add to `app/core/env.V3Env`, surface in
  `chatbotAgent/.env.example`, and audit the startup log in `app/main.py` so
  missing prod values fail loud.

## Tone for this repo

Mental-health adjacent: prefer **conservative** behaviour on ambiguity,
**explicit** logging for safety paths, **small PRs** with doc updates in the same
change set. Remove code you replaced; call out files that look dead rather than
deleting them silently. Run the gates after implementing.
