# Memory and RAG — MindMitra

**Audience:** engineers, evaluators, PMs who need a shared vocabulary for “memory” and “RAG” in this product.  
**Implementation detail:** [`docs/backend/MEMORY_ARCHITECTURE.md`](backend/MEMORY_ARCHITECTURE.md) (triggers, Qdrant, mem0, scoring).  
**Pipeline context:** [`docs/backend/PIPELINE.md`](backend/PIPELINE.md) (paths A–D vs memory).

---

## What “RAG” means here

MindMitra ships **conversation-memory RAG**, not a general document knowledge base.

| Area | Status |
|------|--------|
| Retrieve **user-specific** memories at query time, score, inject into prompts | Implemented |
| External corpus (PDFs, wikis, enterprise KB), hybrid dense+sparse, tenant collections | Not in production scope today |

**Quality drivers:** freshness of extracted memories, composite retrieval scoring, and intent-aware limits — not corpus breadth.

---

## Memory types (conceptual)

| Type | Role |
|------|------|
| **Semantic** | Stable facts and preferences |
| **Procedural** | Coping approaches and what has helped |
| **Reflection** | Cross-session synthesized insights |
| **Crisis** | High-importance crisis-related records |

**Storage pattern:** vector payloads for retrieval-oriented entries; relational metadata (importance, type, access timestamps); session summaries for continuity across sessions.

---

## Write path (high level)

**Triggers (examples):** periodic extraction from recent windows; session-end summarization; procedural synthesis when coping signals appear; reflection on a cadence; crisis-specific writes on high-risk events.

**Execution:** post-response work is **non-blocking** / best-effort; failures must not block the user-facing response path.

---

## Read path (high level)

1. Retrieve candidates for the current user + query.  
2. Join metadata for scoring.  
3. Composite score (relevance, importance, recency).  
4. Apply intent-aware limits.  
5. Format as `memory_context` (and related fields) for generation and analysis.

**Context assembly:** semantic + procedural + reflection snippets as appropriate; emotional trend where available.

---

## Lifecycle and operations

- Access timestamps update on retrieval.  
- Metadata evolves after extraction jobs.  
- Reflection and trend generation use cached / periodic strategies.

**Roadmap (product, not committed in code):** human-reviewed memory curation workflow; optional explainability metadata to clients; document-ingestion RAG if product requires it.

---

## Evaluation and testing language

When tests or judges refer to “RAG” or “grounding,” they mean **continuity against injected memory context**, not Wikipedia-style citations to uploaded documents. See [`docs/EVALUATION.md`](EVALUATION.md) and [`docs/backend/CITATIONS.md`](backend/CITATIONS.md).

---

## Related docs

| Need | Doc |
|------|-----|
| Module-level chat pipeline | [`docs/backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md) |
| Memory implementation | [`docs/backend/MEMORY_ARCHITECTURE.md`](backend/MEMORY_ARCHITECTURE.md) |
| HTTP contracts (incl. optional `eval_trace`) | [`docs/api_contracts.md`](api_contracts.md) |
| Quick backend run + route table | [`docs/backend/GETTING_STARTED.md`](backend/GETTING_STARTED.md) |
