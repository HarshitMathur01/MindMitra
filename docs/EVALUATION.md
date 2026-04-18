# MindMitra Backend — Testing & Evaluation

Production-oriented test and evaluation tooling for the **chatbotAgent** FastAPI service (mental-health AI: safety, memory/RAG, response quality).

## What you get

| Artifact | Purpose |
|----------|---------|
| `docs/backend/GETTING_STARTED.md` | Routes + pipeline + eval trace + safety (reviewer quick ref) |
| `tests/fixtures/test-dataset.json` | **v2:** Few deep **multi-turn** cases (memory recall, clinical boundary + code-mix, crisis pivot, adversarial memory-poison) + 2 edge singles; see `evaluation_design` in JSON |
| `pytest` under `chatbotAgent/tests/` | API contracts, crisis keywords, mocked `/chat` |
| `tests/rag_evaluator.py` | HTTP runner + metrics + `rag_evaluation_report.json` |
| `tests/llm_judge.py` | Optional Groq-based LLM-as-judge |
| `run_full_evaluation.py` | One command: pytest + evaluator |

## Install

```bash
cd chatbotAgent
pip install -r requirements.txt
```

## Environment for tests

Pytest loads **`chatbotAgent/.env`** automatically before tests (`python-dotenv`, `override=False` so your shell already wins). To disable: `PYTEST_DOTENV=0 pytest ...`.

## Fast checks (no live server)

Runs in-process FastAPI `TestClient` + pure Python tests (integration **skipped** unless `RUN_INTEGRATION=1`):

```bash
cd chatbotAgent
pytest tests -v --tb=short
```

## Run everything at once (unit + integration)

Requires API reachable at `EVAL_BASE_URL` and server env as below.

```bash
cd chatbotAgent
export RUN_INTEGRATION=1
export EVAL_BASE_URL=http://127.0.0.1:8000
# On server: SKIP_AUTH=true for local dev OR set EVAL_AUTH_TOKEN to a valid JWT
export ALLOW_EVAL_TRACE=true   # on server — for pipeline_path / memory preview in JSON
pytest tests -v --tb=short
```

## Integration-only

```bash
cd chatbotAgent
export RUN_INTEGRATION=1
pytest tests -m integration -v --tb=short
```

## One-command evaluation (pytest + HTTP dataset)

**Terminal A — API**

```bash
cd chatbotAgent
export SKIP_AUTH=true ALLOW_EVAL_TRACE=true MM_PIPELINE_DEBUG=false
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Terminal B — evaluation**

```bash
cd chatbotAgent
export EVAL_BASE_URL=http://127.0.0.1:8000
# Optional: LLM-as-judge (uses GROQ_API_KEY)
export EVAL_USE_JUDGE=true
python run_full_evaluation.py
```

**Output:** `rag_evaluation_report.json` in `chatbotAgent/` (override with `EVAL_REPORT_PATH`).

### Evaluation-only (skip pytest)

```bash
cd chatbotAgent
python -m tests.rag_evaluator
```

## Memory benchmark (multi-turn, 15–16 turns)

**Fixture:** `chatbotAgent/tests/fixtures/memory-benchmark-dataset.json` — several long conversations with `expected_memory_items`, implicit recall turns, a **diet conflict** update, and a **cross-session** pair that flags leakage if niche hobby tokens appear in a fresh session.

**Runner (HTTP, same auth/trace as `rag_evaluator`):**

```bash
cd chatbotAgent
export ALLOW_EVAL_TRACE=true
export EVAL_BASE_URL=http://127.0.0.1:8000
# export EVAL_AUTH_TOKEN=...   or SKIP_AUTH=true on the API
python -m tests.memory_benchmark_runner
```

**Isolated run (recommended):** fresh `DEV_USER_ID` / `EVAL_SEED_USER_ID`, starts `uvicorn`, skips Priya/Mumbai seed by default, writes `memory_benchmark_report.isolated.json`, stops the server:

```bash
cd chatbotAgent
./scripts/run_isolated_memory_benchmark.sh
# optional: BENCH_PORT=8010 SEED_EVAL_MEMORY=1 EVAL_BENCHMARK_USER_ID=<uuid> MEMORY_BENCHMARK_REPORT_PATH=./out.json
```

Expect occasional `user_contexts` FK warnings for a random UUID — chat still works; create a matching `users` row in Supabase if you need a silent DB path.

**Output:** `memory_benchmark_report.json` (set `MEMORY_BENCHMARK_REPORT_PATH` to override). The report includes per-conversation transcripts, recall scores against `surface_forms`, regex checks on `memory_context_preview`, and **failure_cases** for strict review.

**Schema-only pytest (no network):** `pytest tests/test_memory_evaluation.py` (fixture schema + judge formatting / stub path)

**Groq memory judge:** With `GROQ_API_KEY` set, the runner attaches **`llm_deep_diagnostic`** per conversation (retrieval quality, grounding, false-recall risk, contamination risk, failure tags, root-cause hint). Disable with `MEMORY_BENCHMARK_USE_JUDGE=0`. Full five-phase protocol: **[`docs/MEMORY_QUALITY_EVAL_PROTOCOL.md`](MEMORY_QUALITY_EVAL_PROTOCOL.md)**.

**Caveats:** Heuristic scores use substring overlap; the judge is **evidence**, not a legal verdict. Mem0 extraction runs every `MEMORY_TRIGGER_INTERVAL` messages (see `app/utils/constants.py`); for reliable `memory_injected`, see `scripts/seed_eval_memory.py` or cooldown between runs. Treat as **stress/diagnostic** until human sign-off.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ALLOW_EVAL_TRACE` | Server: must be `true` for `eval_trace` in `/chat` responses |
| `X-MindMitra-Eval-Trace: 1` | Client header (evaluator sets automatically) |
| `EVAL_BASE_URL` | Base URL for HTTP evaluation |
| `EVAL_AUTH_TOKEN` | Bearer JWT when `SKIP_AUTH` is off |
| `MEMORY_BENCHMARK_REPORT_PATH` | Output path for `memory_benchmark_runner` |
| `EVAL_USE_JUDGE` | `true`/`false` — Groq judge on each case |
| `EVAL_JUDGE_MODEL` | Groq model id (default `llama-3.3-70b-versatile`) |
| `EVAL_REPORT_PATH` | Where to write JSON report |
| `MM_PIPELINE_DEBUG` | Server: log prompt/memory/response previews (verbose) |
| `RUN_INTEGRATION` | `1` to un-skip `@pytest.mark.integration` tests |
| `PYTEST_DOTENV` | `0` disables auto-loading `chatbotAgent/.env` in pytest |
| `EVAL_HISTORY_DIR` | Directory for `runs.jsonl` regression history (default: `chatbotAgent/evaluations/history`) |
| `EVAL_SAFETY_CRITICAL_THRESHOLD` | Judge `safety_score` below this marks **critical** (default `3`) |
| `EVAL_CRITICAL_ON_HALLUCINATION` | `true`/`false` — treat judge `hallucination=true` as critical (default `true`) |
| `EVAL_CI_MAX_HALLUCINATION_RATE` | If set, exit 2 from `run_full_evaluation.py` / `rag_evaluator` when rate exceeds this (0–1) |
| `EVAL_CI_FAIL_ON_CRITICAL` | `1` — exit 2 when `critical_failure_count` > 0 |
| `EVAL_CI_FAIL_ON_CRISIS` | `1` — exit 2 when `crisis_failure_count` > 0 |
| `EVAL_CI_MIN_AVG_SAFETY` | If set, exit 2 when avg safety score is below this |
| `EVAL_EXIT_ON_CRITICAL` | `1` — exit 3 when any critical failure (after successful eval) |
| `MM_MEMORY_TRACE` | Server: log retrieval query, mem0 raw hits, rerank drops, prompt injection size (`1`/`true`) |
| `MM_DISABLE_MEMORY_FAST_PATH` | **Dev only:** run Qdrant search even when `memory_metadata` is empty (debug drift); never use in production |
| `EVAL_SEED_USER_ID` | Optional UUID for `seed_eval_memory.py` (and set `DEV_USER_ID` to match for a **clean** memory-eval namespace) |

## Why `eval_trace.memory_injected` is often false on localhost

Retrieval is **scoped by `user_id`**, not `session_id`. Two common causes:

1. **Empty `memory_metadata` for your dev user**  
   With `SKIP_AUTH=true`, `/chat` uses `DEV_USER_ID`. If that UUID has **no rows** in Supabase `memory_metadata`, `retrieve_memories` **returns immediately** without hitting Qdrant (fast path). Then `memory_context` is empty → `memory_injected=false`.

2. **Short eval conversations never call `mem0.add`**  
   Fact extraction runs every **`MEMORY_TRIGGER_INTERVAL`** messages (default **12**). Multi-turn eval cases with 3–4 turns **do not** persist new long-term memories during the run.

**Fix for local HTTP eval:** seed once, same env as the API:

```bash
cd chatbotAgent
set -a && source .env && set +a
python scripts/seed_eval_memory.py
```

Then restart or continue the API and run `python -m tests.rag_evaluator`.  
Optional: `export MM_MEMORY_TRACE=1` on the server to log the retrieval query, raw hits, and injected character count.

### Clean memory eval (avoid polluted retrieval)

If your seed **probe** shows unrelated crisis or Hindi ideation lines, **`DEV_USER_ID` shares one mem0 profile** with crisis HTTP eval cases — semantic search correctly returns them. That is **not** a broken retriever; it is **mixed write traffic** under one `user_id`.

**Production-hygienic dev pattern:** use a **dedicated UUID** for memory/RAG eval only:

1. Generate a UUID; put in `.env`: `EVAL_SEED_USER_ID=<uuid>` and **`DEV_USER_ID=<same uuid>`** while you run “memory quality” sessions (so `/chat` and seed script share one clean namespace).
2. Run `python scripts/seed_eval_memory.py` (it prefers `EVAL_SEED_USER_ID`).
3. Run `rag_evaluator` against that API. Use a **different** `DEV_USER_ID` when running heavy **crisis** dataset sweeps so you do not contaminate the memory-test user.

`scripts/seed_eval_memory.py` prints a warning if the probe preview looks like crisis leakage.

## Phase 2 — Component health (what “working” means)

Use this as a **smoke matrix**, not a guarantee of clinical safety. One failing row means that **slice** is broken, not necessarily the whole product.

| Component | Quick check | Pass criterion |
|-----------|-------------|----------------|
| **API** | `GET /health` | 200, memory readiness if you depend on mem0 |
| **Auth** | `/chat` with real JWT OR `SKIP_AUTH` dev | Stable `user_id`; prod must verify JWT |
| **Pipeline / routing** | `ALLOW_EVAL_TRACE` + evaluator | `pipeline_path` matches intent class (A/B/C/D) on fixture cases |
| **Crisis path** | Integration or fixture crisis turn | Template / helpline behavior; `crisis_events` if configured |
| **mem0 + Qdrant** | `memory_manager.is_ready`; seed probe | Non-empty `retrieve_memories` for seeded user |
| **Supabase `memory_metadata`** | Row count for `user_id` after seed | Inserts after `add_memories` (importance thread) |
| **Retrieval fast path** | New user with zero metadata | Empty memory without error (by design) |
| **Write path** | 12+ messages in session or `seed_eval_memory` | New vectors + metadata over time |
| **GLM / chat model** | `/chat` latency & body | Coherent reply; monitor provider errors |
| **Eval runner** | `pytest` + `rag_evaluator` | Contracts green; report JSON generated |

**Deep analysis in one line:** your architecture splits **read** (retrieve → system prompt) and **write** (batched mem0.add). Failing “memory in eval” is usually **empty metadata + short session**, or **one user_id used for both crisis traffic and recall tests**.

## Phase 3 — RAG / memory architecture checks (clean, layered)

Do **not** ask one HTTP fixture to prove everything. Separate **concerns**:

### Layer A — Latency & availability (cheap)

- Log or metrics: p50/p95 **`retrieve_memories`** wall time (you already have orchestration timeout ~7s).
- Alert on: mem0 not ready, Qdrant errors, systematic empty retrieval for users **with** `memory_metadata` rows.

### Layer B — Retrieval quality (controlled user)

- **Staging user** with **known** seeded facts (dedicated `EVAL_SEED_USER_ID` / clean namespace).
- Assertions: **non-zero** `memory_injected`, **`turn_eval_stats`** show injection on later turns, probe query overlap with seeded entities (Priya, Mumbai, etc.).
- **Not** judged solely by `test-dataset.json` when that user has never been seeded — that tests **routing + safety**, not “RAG recall”.

### Layer C — Hallucination / grounding (judge + rules)

- Keep **`EVAL_USE_JUDGE`** for **trend** scoring on staging, not as legal truth.
- Rule checks (`must_not_contain_regex`, crisis globals) for **deterministic** safety regression.
- Optionally cap judge cost: run judge on a **subset** of cases in CI (`EVAL_JUDGE_SAMPLE_RATE` future) — omit unless you add it.

### Layer D — End-product conversation quality

- Multi-turn **golden** dialogs (small N) with human spot-check quarterly; automate only what is stable.

**Why this stays production-grade:** production keeps **strict user isolation** and **no eval-only hacks** in the request path; **staging** uses **separate identities** and optional `MM_MEMORY_TRACE` / seed scripts. You validate **each component** in the layer where it belongs, instead of piling flags into one messy “mega eval.”

## Security notes

- **`ALLOW_EVAL_TRACE`** exposes memory previews to clients that send the header. **Disable in production** or gate behind auth + allowlisting.
- **Crisis test cases** send high-risk phrases — run only against **non-production** data and environments.

## Interpreting the report

- **`summary_metrics`**: pass rate, avg latency, judge scores (LLM or heuristic), hallucination rate, memory relevance, rule/crisis/critical counts.
- **`category_performance`**: per-category pass rate and avg memory relevance.
- **`critical_failures`**: safety-priority rows (crisis handling, low safety score, or hallucination when enabled).
- **`regression`**: deltas vs last line in `EVAL_HISTORY_DIR/runs.jsonl` (if present).
- **`worst_performing_queries`**: prioritized failures (critical and crisis first).
- **`meta.suggestions`**: heuristic remediation hints (retrieval, memory misuse, regression).

## Related internal docs

- `ai/claude.md` (pointer), `ai/skills.md` — optional; root `CLAUDE.md` / `AGENT.md` are authoritative
- `docs/architecture.md`, `docs/MEMORY.md`, `docs/therapist_bridge.md`

## CI suggestion

```yaml
- run: cd chatbotAgent && pip install -r requirements.txt -r requirements-eval.txt
- run: cd chatbotAgent && pytest tests -m "not integration" --tb=short
```

Schedule integration + `run_full_evaluation.py` on a **staging** API with secrets injected from your vault.

---

## Product metrics and beta analytics

**Goal:** know **where** metrics live, how they stay privacy-aligned, and when to add a third-party product tool.

### Three layers (different questions)

| Layer | What it is | Best for | Where you read it |
|--------|------------|----------|-------------------|
| **1. Supabase (first-party)** | Rows the app writes: messages, games, voice metadata, explicit product events | Funnels, retention, beta cohorts | Supabase SQL Editor, CSV export, Metabase/Lightdash later |
| **2. Server logs** | Structured lines from `chatbotAgent` (host) | Errors, latency, rate limits | Log tail; `LOG_FORMAT=json` + drain |
| **3. Optional third-party** | PostHog / Plausible / GA4 | Session replay, marketing attribution | Vendor dashboards |

**Beta default:** (1) + (2). Add (3) only for attribution or analytics UX without writing SQL — with strict event allowlists and **no autocapture on chat surfaces**.

### What exists in the database (high level)

- **`chat_messages`** — activity and timing; **content is sensitive**; prefer aggregates.
- **`onboarding_analytics`** — structural onboarding events (`metadata.event_type`, etc.).
- **`crisis_events`** — detections **without user text** (see migration comments).
- **`user_activities`**, **`voice_analysis_events`** — Mind Gym / voice usage.
- **`product_events`** — explicit funnel events from the web app (`trackProductEvent`); migration `supabase/migrations/20260409120000_product_events.sql`. **Never** put raw chat text in `properties`.

**SQL templates:** [`docs/sql/beta_product_analytics_queries.sql`](sql/beta_product_analytics_queries.sql).

### Client funnel writes

- **Client:** `src/lib/productAnalytics.ts` — `trackProductEvent(name, props)`.
- **RLS:** users insert/select **own** rows; cross-user beta dashboards use **postgres** / service role in SQL Editor, consistent with other operator queries.
- **Disable:** set `VITE_ENABLE_PRODUCT_ANALYTICS=0` so the queue never flushes.

### Server logs (`chatbotAgent`)

Request middleware logs path, status, duration with `X-Request-ID`. Streaming chat logs a structured **`metrics`** blob on completion (**no message body**): event name, duration, language, flags, optional error type. Prefer JSON logs in production when the collector expects JSON.

### Third-party tools (short)

| Tool | Strength | Risk for mental-health products |
|------|----------|----------------------------------|
| **PostHog** | Funnels, flags, replay | Autocapture can over-collect; mask, disable replay on `/chat`, allowlist events |
| **Plausible** | Simple, lightweight | Less depth on custom cohorts |
| **GA4** | Ads integration | Complex; harder to guarantee no PHI in props |

If you add one: **one** vendor, **explicit events only**, document allowed properties (same rules as `product_events`).

### Weekly beta review (~30 min)

1. Run SQL templates — DAU, chat volume, onboarding distribution, crisis counts.  
2. Scan logs for `5xx` spikes and `429`.  
3. Backlog themes: **stability**, **confusing UX**, **safety wording**.

### COMPASS chat path (latency / LLM calls)

- **`config.yaml` → `compass.skip_intent_router`:** when `true` (default in this repo), the separate Groq **IntentRouter** call is skipped; **CognitiveLayer** supplies intent for MEMOIR scoring and for path A/B/C/D. Set `false` only if you need legacy router labels for A/B experiments.
- **Order:** crisis keyword gate (and optional ambiguous LLM check) → parallel **within-session arc** (`EmotionalArcReader`) and **cross-session emotional trend** → **CognitiveLayer** → **MEMOIR** `retrieve_memories` with `current_affect` from cognitive valence/intensity → final response stream.
- **MEMOIR:** default `retrieve_memories` **limit** is **7**; `ContextComposer` can drop episodic/affective rows when `cl_memory_reference_allowed` is false (venting / crisis risk).

### Governance

- Treat **chat content** as highly restricted; control exports and dashboard access.  
- Beta agreement / privacy policy should state **what** is logged at a high level (events + operational logs).
