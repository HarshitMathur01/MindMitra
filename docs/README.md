# MindMitra documentation

Engineering and operations docs. If code and docs disagree, **code wins** —
update docs in the same change.

## Reading order (v3 stack)

| Document | Audience | Contents |
|----------|----------|----------|
| [`../html-to-markdown.md`](../html-to-markdown.md) | Everyone | The canonical MHA v3 architecture spec (8-layer pipeline) we ship to |
| [`../LOCAL_DEV.md`](../LOCAL_DEV.md) | Anyone running it | End-to-end laptop runbook (Redis + Qdrant + Supabase + Vite + FastAPI) |
| [`../CLAUDE.md`](../CLAUDE.md) | AI tools | System invariants, file map, common pitfalls |
| [`product.md`](product.md) | Product / frontend | MindGym, therapist bridge, analytics, security headers |
| [`product_problem_solution.md`](product_problem_solution.md) | Product / pitch | Problem statement and proposed solution |
| [`research/CITATIONS.md`](research/CITATIONS.md) | Product / design | Presence-mode and avatar research citations |
| [`api_contracts.md`](api_contracts.md) | Integrations | HTTP/WS request/response shapes (**v3 surface only**) |
| [`MITRA.md`](MITRA.md) | Archaeology | Legacy v2 narrative — kept for context, **not** the current runtime |

## Repository map

| Area | Path |
|------|------|
| Web app | `src/` (Vite + React) |
| API | `chatbotAgent/app/` (FastAPI) — v3 routers under `app/` |
| v3 schema | `scripts/migrations/v3_schema.sql` |
| Database (history) | `supabase/migrations/` |
| Operator SQL | [`sql/`](sql/) |

## Architecture decisions (current)

| Topic | Decision | Where it lives |
|-------|----------|----------------|
| Chat transport | JWT-authenticated HTTP `POST /chat` returning one assistant reply | `app/api/chat_ws.py`, `src/components/chat/ChatGPTInterface.tsx` |
| Pipeline | 8 layers: ingestion → signals → crisis → orchestrator → memory → prompt → LLM → safety gate | `app/pipeline/*.py` |
| Sessions | Redis-backed `SessionObject` with keyspace expiry → consolidation worker | `app/services/session_service.py`, `app/jobs/session_end_worker.py` |
| Memory | Qdrant episodic vectors + 4 Postgres profile tables; semantic-fact injection from in-memory profile | `app/memory/*.py`, `app/services/profile_service.py` |
| Crisis | Deterministic lexical detector + Groq confirmer, hardcoded fallback when Supabase is unavailable | `app/pipeline/crisis_bypass.py`, `app/core/env.py` |
| Backend config | Non-secret runtime behavior in YAML; secrets and platform values in env | `chatbotAgent/config.yaml`, `chatbotAgent/app/core/env.py` |

## Changing documentation

- **Behaviour change:** update `html-to-markdown.md`, `CLAUDE.md`, and
  `LOCAL_DEV.md` if the surface or run book changed.
- **Product surface:** update [`product.md`](product.md).
- **API change:** update [`api_contracts.md`](api_contracts.md) and add a
  test under `chatbotAgent/tests/` that pins the new contract.
