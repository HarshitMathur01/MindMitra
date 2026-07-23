# CLAUDE.md — MindMitra codebase context for AI assistants

Use this file **before** large edits. It compresses architecture,
invariants, and foot-guns so reasoning matches how the system actually
runs.

## What MindMitra is (one paragraph)

MindMitra — Product Context
What MindMitra Is
MindMitra is an AI-powered mental health companion for Indian college students and young adults. It is the zero-th layer of mental health care — the first touchpoint before professional therapy, designed to close India's 83% mental health treatment gap.
It is not a therapy app. It is the bridge between struggling in silence and seeking real help.

Core Product
A conversational AI agent that:

Talks in the user's natural language — Hindi, English, or Hinglish
Adapts its tone to match the user's emotional state and communication style over time
Remembers across sessions (episodic memory) — not like a form, like a person
Detects distress signals and escalates through a tiered safety system
Never diagnoses, never prescribes, never replaces a therapist

Target users: Indian college students (18–25), primarily in engineering and medical colleges, hostel-living, high academic pressure environments.

Key Features
Conversational Agent
The core product. A chat interface where users talk to MindMitra's AI. The agent:

Operates in 5 modes: Companion, Active Listener, Psychoeducation, Skill Coach, Referral Bridge
Selects mode dynamically based on affect signals each turn
Personalises tone over time using an EMA-based style convergence engine
Runs on Azure OpenAI (default deployment `gpt-5-mini`, see `AZURE_OPENAI_DEPLOYMENT_NAME` in `app/core/env.py`) with a Groq → GLM-4 fallback chain

Avatar Interaction
Users can interact with a lipsync-enabled AI avatar that speaks the agent's responses aloud. The avatar animates in real-time to match the AI's spoken output — making the interaction feel less like a chatbot and more like talking to someone. This significantly reduces the cold, transactional feel of text-only mental health tools.
Therapist Handoff


Therapist Bridge
A structured referral layer connecting MindMitra users to verified therapists and counsellors:
Positions therapy as an add-on, not a replacement of the MindMitra relationship

MindGym
A structured, activity-based mental wellness module — not therapy, not chat. Evidence-based micro-interventions packaged as short, engaging exercises:

Breathing techniques (box breathing, 4-7-8)
Grounding exercises (5-4-3-2-1 sensory)
etc

Crisis responses are fixed, clinician-reviewed templates — never LLM-generated.

What MindMitra Is Not

Not a diagnostic tool
Not a replacement for therapy
Not a chatbot with canned responses
Not another mood tracker with streaks and badges


Compliance

DPDP Act 2023 (India) compliant
UGC mental health guidelines 2023 aligned
Data stored on Indian servers
User-controlled memory: view, edit, delete at any time
Append-only audit log for every data access



## Single source of narrative

1. **`html-to-markdown.md`** — the v3 architecture spec we ship to.
2. **`LOCAL_DEV.md`** — end-to-end local runbook (you should be able to
   `pytest` + `npm run dev` from the recipe inside).
3. **`chatbotAgent/README.md`** — backend quickstart + route table.

If a doc disagrees with **code**, prefer **code** and update docs in the
same PR.

## System invariants (do not break)

1. **Crisis path stays bypass-resistant.** Lexical + Groq-LLM confirmer
   in `app/pipeline/crisis_bypass.py`; tests in
   `tests/v3/test_crisis_bypass.py`. Never bypass these checks in prod
   without equivalent coverage.
2. **Auth on chat.** HTTP chat resolves the Supabase JWT against
   `SUPABASE_JWT_SECRET`. `SKIP_AUTH` is
   dev-only — production refuses unsafe SKIP_AUTH when `ENV=production`
   unless `ALLOW_INSECURE_SKIP_AUTH=true`.
3. **Memory scoped by `user_id`.** Service-role queries (Supabase +
   Qdrant) must filter `user_id` explicitly. RLS does the rest for
   authenticated reads.
4. **Post-response work is non-blocking.** Session-end consolidation,
   audit-log writes, and async memory writers run via
   `asyncio.create_task` or the session-end worker. Do NOT move
   heavy sync work into the request hot path.
5. **`eval_trace` / pipeline debug snippets can leak PII.** Gated by
   env + headers; never assume safe for prod logs.
6. **No legacy fallback.** `/chat/stream`, `/chat/greeting`,
   `/ws/chat`, `/me-memory`, the MITRA v2 pipeline, the mem0 layer, and the
   one-shot greeting service have been deleted. Don't reintroduce them
   without a written sign-off.

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

## Key file map (where to edit)

| Concern | Primary files |
|---------|----------------|
| HTTP surface | `app/main.py`, `app/api/health.py`, `app/api/therapist_bridge.py` |
| v3 routers | `app/api/chat_ws.py`, `onboarding.py`, `audio.py`, `admin.py` |
| Pipeline | `app/pipeline/{ingestion,signal_extraction,crisis_bypass,orchestrator,memory_retrieval,prompt_builder,llm_core,safety_gate}.py` |
| Connections | `app/core/connections.py` (Redis, Qdrant, Azure, Groq, Gemini, GLM, Supabase) |
| Session lifecycle | `app/services/session_service.py`, `app/core/session.py`, `app/jobs/session_end_worker.py` |
| Memory writers | `app/memory/{embedding,episodic_write,semantic_write,procedural_update,longitudinal_update}.py` |
| Env / feature flags | `app/core/env.py` |
| Frontend chat | `src/components/chat/ChatGPTInterface.tsx`, `src/components/chat/*`, `src/hooks/useChat.tsx` |
| Tests | `tests/v3/*`, `tests/health/*` |
| Spec | `html-to-markdown.md`, `scripts/migrations/v3_schema.sql` |

## Common pitfalls

- **Boot failure** — `SUPABASE_JWT_SECRET` is missing. The lifespan log
  prints `SUPABASE_JWT_SECRET ❌ Missing`; authenticated chat requests
  will fail unless `SKIP_AUTH` is enabled for local development.
- **Chat returns service unavailable** — `MHA_V3_ENABLED=0`. Set it to
  `1` or unset.
- **Redis keyspace warning at startup** — Redis is reachable but not
  publishing `Ex` events; the polling sweep takes over but consolidation
  fires up to 60s late. Fix by restarting Redis with
  `--notify-keyspace-events Ex`.
- **`confirmed` never arrives** — safety gate retried twice + failed
  static fallback; check Groq key + safety_gate logs.
- **`replace` event with no preceding `chunk`** — Azure stream
  short-circuited (e.g. content filter). The client UI replaces the
  buffer with the static template. Working as intended.
- **Two migration lineages.** `supabase/migrations/` is the
  dashboard-linked lineage for frontend-facing tables (profiles,
  mood_logs, product_events, therapist bridge, …). The backend chat
  schema lives in `scripts/migrations/v3_schema.sql` and is applied by
  hand per `LOCAL_DEV.md`. A backend table added only to the dashboard
  lineage will be missing from v3 environments, and vice versa — pick
  the lineage that owns the table and say so in the PR.

## How to extend safely

* **New chat response field**: extend the HTTP response shape in
  `ChatGPTInterface.tsx` and the server payload in `app/api/chat_ws.py`.
  Mirror the docs in `html-to-markdown.md`.
* **New pipeline stage**: drop a module under `app/pipeline/`, wire
  it into `chat_ws._process_turn`, and add fixtures under `tests/v3/`.
* **New memory channel**: write under `app/memory/`, hook into
  `retrieve_memory.retrieve_memory()`, update the Qdrant collection in
  `scripts/migrations/init_qdrant.py`.
* **New env var**: add it to `app/core/env.V3Env`, surface it in
  `chatbotAgent/.env.example`, and audit the startup log in
  `app/main.py` so missing prod values fail loud.


## Tone for this repo

Mental-health adjacent: prefer **conservative** behaviour on ambiguity,
**explicit** logging for safety paths, and **small PRs** with doc
updates in the same change set.

After implementing the new code, make sure to remove old used codes to clean the codebase and also tell about deleting some file if not in use.
Run tests always after implementation.