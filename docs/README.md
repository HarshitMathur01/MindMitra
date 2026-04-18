# MindMitra documentation

**Audience:** engineers, operators, and AI agents. This directory is the **canonical** technical reference for the monorepo (backend implementation detail lives under `docs/backend/`).

## Start here

| I need to… | Read |
|------------|------|
| System boundaries, clients, external services | [`architecture.md`](architecture.md) |
| One chat turn: HTTP → COMPASS → MEMOIR → response | [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md) |
| Path labels (`A-casual-v2`, …), memory vs path | [`backend/PIPELINE.md`](backend/PIPELINE.md) |
| Memory vocabulary (“RAG” = user memory, not document KB) | [`MEMORY.md`](MEMORY.md) |
| Memory implementation (writes, reads, Qdrant, triggers) | [`backend/MEMORY_ARCHITECTURE.md`](backend/MEMORY_ARCHITECTURE.md) |
| HTTP JSON shapes | [`api_contracts.md`](api_contracts.md) |
| Run backend locally, route table | [`backend/GETTING_STARTED.md`](backend/GETTING_STARTED.md) |
| Logs: format, `request_id`, where to look | [`LOGGING.md`](LOGGING.md) |
| Env vars, deploy, Qdrant ops | [`OPERATIONS.md`](OPERATIONS.md) |
| Pytest, eval harness, product metrics | [`EVALUATION.md`](EVALUATION.md) |
| Memory quality benchmark / judge protocol | [`MEMORY_QUALITY_EVAL_PROTOCOL.md`](MEMORY_QUALITY_EVAL_PROTOCOL.md) |
| Clinician handoff | [`therapist_bridge.md`](therapist_bridge.md) |
| MindGym (client-heavy) | [`mindgym.md`](mindgym.md) |
| Eval citation semantics | [`backend/CITATIONS.md`](backend/CITATIONS.md) |

**SQL:** [`sql/beta_product_analytics_queries.sql`](sql/beta_product_analytics_queries.sql)

**AI assistant entrypoints (repo root):** [`../CLAUDE.md`](../CLAUDE.md), [`../AGENT.md`](../AGENT.md)

---

## Product snapshot

MindMitra is a **web AI mental-health companion**: chat (JSON or SSE), onboarding, optional voice, avatar **metadata** (speech is generated in the browser), MindGym activities, and **layered safety** (keyword gate → optional LLM disambiguation → warm crisis templates).

**Not in scope:** replacing emergency services or licensed therapy.

---

## Architecture decisions (ADR summary)

| ID | Decision | Rationale |
|----|----------|-----------|
| ADR-001 | **Conversation-memory “RAG”** before any document KB | Personalization is the product differentiator |
| ADR-002 | **Multi-provider LLMs** (Groq routing/light tasks; GLM/Azure for heavy generation) | Cost/latency tuning per task |
| ADR-003 | **Python crisis keyword layer** before trusting router-only classification | Deterministic minimum safety bar |
| ADR-004 | **SSE** for `/chat/stream` | Perceived latency; client incremental render |
| ADR-005 | **Qdrant + mem0 + local embeddings** for vectors | Portable stack; ops own Qdrant uptime |
| ADR-006 | **Supabase** for auth + relational data | RLS; JWT validation on API |
| ADR-007 | **TTS in browser** | API returns text + expression hints only |
| ADR-008 | **Daemon threads** for extraction, summaries, game bridge | Protect chat p95; at-most-once side effects |
| ADR-009 | **Therapist Bridge** immutable snapshots | Audit trail + consent |
| ADR-010 | **COMPASS** (cognitive layer + v2 paths) as the only response stack | Single coherent prompt + intervention model |
| ADR-011 | **MEMOIR** (structured extract + scored retrieval) as the default memory read/write path | Quality gate + typed memories + `ContextComposer` |

Add **ADR-012+** in this table when you make a new long-lived architectural choice, and update the affected deep-dive doc in the same PR.

---

## Repository layout (engineering)

```text
src/                 React / Vite SPA
chatbotAgent/        FastAPI app (`app/`)
supabase/migrations/ Postgres schema
docs/                This tree (source of truth for behavior)
```

Frontend talks to the API with **`Authorization: Bearer`** (Supabase JWT). See `architecture.md` for trust boundaries.

---

## Conventions

- **Contracts:** `docs/api_contracts.md` must match Pydantic models in `chatbotAgent/app/models/`.
- **Pipeline or memory behavior change:** update `backend/ARCHITECTURE.md` and/or `backend/MEMORY_ARCHITECTURE.md` and any eval fixtures that assert `pipeline_path` / `memory_injected`.
- **Do not** duplicate large tables across files—each fact should have **one** primary home; other docs link here.
