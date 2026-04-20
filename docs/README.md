# MindMitra documentation

Engineering and operations docs. If code and docs disagree, **code wins** — update docs in the same change.

## Reading order

| Document | Audience | Contents |
|----------|----------|----------|
| [MITRA.md](MITRA.md) | Everyone | Canonical MITRA v2 narrative: diagrams, one turn, components |
| [platform.md](platform.md) | Backend / infra | Runbook, env, memory v2, Qdrant, pipeline, research citations index |
| [product.md](product.md) | Product / frontend | MindGym, therapist bridge, design tokens, analytics, security headers |
| [api_contracts.md](api_contracts.md) | Integrations | HTTP request/response shapes |
| [EVALUATION.md](EVALUATION.md) | QA / ML | Pytest, HTTP eval, memory benchmark |

## Repository map

| Area | Path |
|------|------|
| Web app | `src/` (Vite + React) |
| API | `chatbotAgent/app/` (FastAPI) |
| Database | `supabase/migrations/` |
| Operator SQL | [`sql/`](sql/) |

## Architecture decisions (summary)

| Topic | Decision | Where it lives |
|-------|----------|----------------|
| Chat orchestration | `MitraPipeline.process_turn` — classify → crisis → retrieve → assemble → generate | `app/pipeline/mitra/` |
| Memory | Supabase `mitra_*` + Qdrant `mitra_episodic_v2` / `mitra_reflections_v2` | `app/memory/`, `app/memory/qdrant_v2.py` |
| Legacy | `companion_memories`-only mem0 paths are **not** the v2 story; ignore old tickets that assume only that collection | [platform.md](platform.md#qdrant-mitra-v2) |

## Changing documentation

- **Behavior change:** update [MITRA.md](MITRA.md) or [platform.md](platform.md) (and [api_contracts.md](api_contracts.md) if the HTTP surface changes).
- **Product surface:** update [product.md](product.md).
