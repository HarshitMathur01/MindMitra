# Platform — legacy v2 backend reference

> ⚠️ **Archaeology only.** This document refers to the **legacy MITRA v2**
> stack which has been removed from the codebase. The current backend
> run book lives in [`../LOCAL_DEV.md`](../LOCAL_DEV.md); HTTP
> contracts in [`api_contracts.md`](api_contracts.md). Keep this file
> for spelunking through old commits — do **not** treat it as
> authoritative.

Grounded in `chatbotAgent/app/`. For the narrative walkthrough, see
[MITRA.md](MITRA.md).

---

## Local development

```bash
cd chatbotAgent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Optional: Qdrant for prod-like episodic retrieval
docker run -d -p 6333:6333 qdrant/qdrant
export MITRA_STACK_ENABLED=1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI: `http://127.0.0.1:8000/docs`

**Chat requires `MITRA_STACK_ENABLED=1`** — otherwise routes return **503**. JSON responses do **not** include audio; TTS and lipsync run in the browser.

---

## HTTP routes (high level)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | No | Liveness |
| GET | `/health/ready` | No | Required env sanity |
| POST | `/chat` | Bearer | MITRA turn |
| POST | `/chat/stream` | Bearer | SSE stream |
| GET | `/chat/greeting` | Bearer | Session greeting |
| POST | `/chat/end-session` | Bearer | Session end / consolidation kick |
| POST | `/transcribe` | Bearer | WAV base64 → transcript |
| * | `/onboarding/*` | varies | Onboarding |
| * | `/therapist-bridge/*` | Bearer | Clinician handoff |
| * | `/me/*` | Bearer | Memory mirror / user memory |

Routers are wired in `app/main.py`.

**Dev:** `SKIP_AUTH=true` uses a fixed dev user (`app/core/auth.py`). **Production:** unsafe `SKIP_AUTH` is refused when public prod is detected.

---

## Code map

| Concern | Module |
|---------|--------|
| Entry, CORS, middleware | `app/main.py` |
| Chat, stream, end-session | `app/api/chat.py` |
| MITRA pipeline | `app/pipeline/mitra/orchestrator.py`, `dispatch.py`, `classifier.py`, `retriever.py`, `assembler.py`, `generator.py` |
| Crisis | `app/pipeline/crisis_fast_path.py` |
| Memory | `app/memory/*.py` |
| Jobs | `app/jobs/consolidation_worker.py`, `extractor.py` |
| Supabase | `app/services/supabase_service.py` |
| Flags / models | `app/core/env_flags.py`, `app/core/models.py` |

---

## Environment (minimum)

- Supabase URL + service key (see `chatbotAgent/.env.example`).
- **`MITRA_STACK_ENABLED=1`** for chat.
- Provider keys per `ModelRegistry` in `app/core/models.py` (e.g. Groq, Azure OpenAI, Gemini).
- Qdrant host/port when episodic retrieval is required (see below).

---

## One turn (debugging)

```
POST /chat/stream
  → validate_user_token
  → mitra_dispatch.run_mitra_turn
       → MitraPipeline.process_turn
            → classify → crisis → retrieve → assemble → generate
```

Path labels **A / B / C / D** in traces are **stance / intent buckets** (casual → crisis), not separate orchestrator binaries. Definitions: `app/pipeline/mitra/classifier.py` and stance code.

---

## Pipeline flow

```
user_message
  → IntentClassifier
  → crisis_fast_path (may short-circuit)
  → RetrieverOrchestrator.fetch (deadline-bounded; default 250 ms — `MITRA_RETRIEVE_DEADLINE_MS`)
  → ContextAssembler
  → TwoPassGenerator | DualTrackGenerator (draft → critic)
  → TurnResult (+ eval_trace when allowed)
```

| Trace label | Typical meaning |
|-------------|-----------------|
| A-casual | Light / small-talk |
| B-emotional | Emotional support |
| C-therapeutic | Deeper therapeutic stance |
| D-crisis | Crisis templates / safety-first |

---

## Memory — MITRA v2

**Not** a single mem0-only path. **Supabase** holds structured rows (`mitra_*`); **Qdrant** holds episodic vectors; **salience** blends retrieval scores; **importance** gates writes; **consolidation** runs in background jobs.

| Module | Role |
|--------|------|
| `app/memory/episodic.py` | `EpisodicService` — embed → Qdrant + `mitra_episodic_memories` |
| `app/memory/qdrant_v2.py` | Qdrant client + `InMemoryQdrant` for tests |
| `app/memory/repositories.py` | Supabase facades |
| `app/memory/identity_card.py` | `mitra_identity_cards` |
| `app/memory/working.py` | Short-term turn window |
| `app/memory/importance.py` | Write gate (`score_turn`) |
| `app/memory/salience.py` | Read-time composite score |
| `app/memory/decay.py` | Strength / recall |
| `app/pipeline/mitra/retriever.py` | `RetrieverOrchestrator` |
| `app/jobs/extractor.py` | Consolidation extraction |
| `app/jobs/consolidation_worker.py` | Merge, decay, reflection |

**Read path:** classifier → `RetrieverOrchestrator.fetch` (parallel channels; overdue work dropped) → `ContextAssembler` → generator.

**Write path:** extraction and consolidation are **best-effort** and **must not block** the streaming response for the current turn.

**Privacy:** every query filters by `user_id`.

**Schema:** `supabase/migrations/20260420120000_mitra_memory_v2.sql` and related migrations.

Legacy tables (`memory_metadata`, `session_summaries`, …) may still exist for older paths; new code targets v2.

### Conversation-memory “RAG”

In evals and internal language, **RAG** means **injected user memory** in prompts — not a user-uploaded document corpus.

---

## Qdrant (MITRA v2)

Authoritative defaults are in `app/memory/qdrant_v2.py`:

| Env | Default | Purpose |
|-----|---------|---------|
| `QDRANT_COLLECTION_MITRA` | `mitra_episodic_v2` | Episodic vectors |
| `QDRANT_COLLECTION_REFLECTIONS` | `mitra_reflections_v2` | Reflections |
| `QDRANT_HOST` / `QDRANT_PORT` | `localhost` / `6333` | Connection |
| `MM_BGE_DIM` | `1024` | Vector size for collection creation |

**Provision collections (idempotent):**

```bash
cd chatbotAgent
python scripts/qdrant_init_mitra.py
```

Deploy Qdrant on your host (Docker, Railway, etc.) and point env at the private URL. Dimension must match your embedding provider configuration.

---

## Research citations (engineering)

Compact index — academic hooks for salience, reflection, stance, and screening. Update when modules move.

### Memory and retrieval

| Topic | Reference | Code |
|-------|-----------|------|
| Composite / salience | Park et al., *Generative Agents*, UIST 2023 ([arXiv:2304.03442](https://arxiv.org/abs/2304.03442)) | `app/memory/salience.py`, `app/memory/episodic.py` |
| Reflection / consolidation | Park et al. §5.3 | `app/jobs/consolidation_worker.py`, `extractor.py` |
| Episodic vs identity vs procedural | Tulving (1972); product split | `episodic.py`, `identity_card.py`, `procedural.py` |
| Importance at write | Heuristic + optional LLM | `app/memory/importance.py` |
| Decay | MemoryBank-style reinforcement | `app/memory/decay.py` |
| Vectors | [Qdrant](https://qdrant.tech/) | `app/memory/qdrant_v2.py` |

### Response generation

| Topic | Reference | Code |
|-------|-----------|------|
| Two-pass draft → critic | Self-critique patterns | `generator.py`, `app/core/prompts/critic.py` |
| Stance / boundaries | Therapeutic disclosure limits | `assembler.py`, `stance_selector.py` |
| Routed intents | Wang et al. survey ([arXiv:2308.11432](https://arxiv.org/abs/2308.11432)) | `classifier.py` |

Presence-mode and avatar UX research is summarized in [docs/research/CITATIONS.md](research/CITATIONS.md) (product / design precedent).

---

## Tests

```bash
cd chatbotAgent
pytest tests -v --tb=short
```

See [EVALUATION.md](EVALUATION.md) for integration flags and HTTP eval.
