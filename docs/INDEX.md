# Documentation index (`docs/`)

**Single documentation directory** for the MindMitra monorepo (backend deep-dives included under `docs/backend/`).

| Start here | Purpose |
|------------|---------|
| [`MASTER_DOCUMENTATION.md`](MASTER_DOCUMENTATION.md) | Hub: C4-style overview, ADRs, workflows, links |
| [`architecture.md`](architecture.md) | System-level architecture |
| [`api_contracts.md`](api_contracts.md) | HTTP/JSON contracts |
| [`MEMORY_AND_RAG.md`](MEMORY_AND_RAG.md) | Memory model + what “RAG” means here |
| [`EVALUATION.md`](EVALUATION.md) | Pytest, integration, eval runner, product metrics |
| [`mindgym.md`](mindgym.md) | MindGym (client-heavy) |
| [`therapist_bridge.md`](therapist_bridge.md) | Clinician handoff, evaluation checklist |

### Backend implementation reference

| File | Topic |
|------|--------|
| [`backend/GETTING_STARTED.md`](backend/GETTING_STARTED.md) | Run backend, routes, pipeline, eval trace, safety |
| [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md) | Full pipeline, APIs, screening, TTS notes |
| [`backend/MEMORY_ARCHITECTURE.md`](backend/MEMORY_ARCHITECTURE.md) | mem0, Qdrant, scoring, triggers |
| [`backend/PIPELINE.md`](backend/PIPELINE.md) | Paths A–D vs memory |
| [`backend/QDRANT_SETUP.md`](backend/QDRANT_SETUP.md) | Vector DB setup |
| [`backend/CITATIONS.md`](backend/CITATIONS.md) | Eval / citation semantics |

### SQL

- [`sql/beta_product_analytics_queries.sql`](sql/beta_product_analytics_queries.sql)

### AI assistants

- Repository root [`../CLAUDE.md`](../CLAUDE.md) and [`../AGENT.md`](../AGENT.md)

### Conventions (production-style monorepo)

- **One `docs/` tree** for all long-form documentation.  
- **Root `README.md` only** as the repo `README.md` entry (no `docs/README.md`).  
- **Service code** stays under `chatbotAgent/`; a short pointer file `chatbotAgent/STACK.md` links here.
