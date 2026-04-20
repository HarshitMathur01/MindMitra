# Backend — testing and evaluation

Production-oriented tests and eval harnesses for **chatbotAgent** (safety, memory injection, response quality).

## What you get

| Artifact | Purpose |
|----------|---------|
| [platform.md](platform.md) | Routes, pipeline, env (reviewer quick ref) |
| `tests/fixtures/test-dataset.json` | Multi-turn cases (memory, crisis, boundaries); see `evaluation_design` |
| `tests/fixtures/memory_benchmark_dataset.json` | Offline gold-label retrieval scenarios |
| `pytest` under `chatbotAgent/tests/` | API contracts, crisis keywords, health suite |
| `tests/rag_evaluator.py` | HTTP runner → `rag_evaluation_report.json` |
| `tests/memory_retrieval_benchmark.py` | Offline IR metrics → `evaluations/memory_benchmark_report.json` |
| `tests/llm_judge.py` | Optional Groq judge |
| `run_full_evaluation.py` | Pytest + HTTP evaluator |

## Install

```bash
cd chatbotAgent
pip install -r requirements.txt
```

Pytest loads **`chatbotAgent/.env`** (`python-dotenv`, `override=False`). Disable with `PYTEST_DOTENV=0`.

## Fast checks (no live server)

```bash
cd chatbotAgent
pytest tests -v --tb=short
```

Integration tests stay skipped unless `RUN_INTEGRATION=1`.

## Unit + integration

```bash
cd chatbotAgent
export RUN_INTEGRATION=1
export EVAL_BASE_URL=http://127.0.0.1:8000
export ALLOW_EVAL_TRACE=true   # server — pipeline / memory fields in JSON when header sent
pytest tests -v --tb=short
```

## One-command eval (API + HTTP dataset)

**Terminal A — API**

```bash
cd chatbotAgent
export SKIP_AUTH=true ALLOW_EVAL_TRACE=true MM_PIPELINE_DEBUG=false
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Terminal B**

```bash
cd chatbotAgent
export EVAL_BASE_URL=http://127.0.0.1:8000
export EVAL_USE_JUDGE=true   # optional; needs GROQ_API_KEY
python run_full_evaluation.py
```

Output: `rag_evaluation_report.json` (override with `EVAL_REPORT_PATH`).

**Evaluator only:** `python -m tests.rag_evaluator`

## Memory retrieval benchmark (offline)

```bash
cd chatbotAgent
python -m tests.memory_retrieval_benchmark
MEMORY_BENCH_USE_JUDGE=true python -m tests.memory_retrieval_benchmark
```

Output: `chatbotAgent/evaluations/memory_benchmark_report.json` (`MEMORY_BENCH_OUTPUT`). Root `make memory-bench` if present.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ALLOW_EVAL_TRACE` | Server: `eval_trace` in `/chat` when client sends `X-MindMitra-Eval-Trace: 1` |
| `EVAL_BASE_URL` | HTTP evaluation base URL |
| `EVAL_AUTH_TOKEN` | Bearer when `SKIP_AUTH` is off |
| `EVAL_USE_JUDGE` | Groq judge on chat eval cases |
| `EVAL_JUDGE_MODEL` | Groq model id |
| `EVAL_REPORT_PATH` | RAG report path |
| `MM_PIPELINE_DEBUG` | Verbose server logging |
| `RUN_INTEGRATION` | `1` — run integration-marked tests |
| `PYTEST_DOTENV` | `0` — skip auto-loading `.env` in pytest |
| `EVAL_HISTORY_DIR` | Regression history (`runs.jsonl`) |
| `EVAL_*` CI gates | `EVAL_CI_FAIL_ON_CRITICAL`, `EVAL_CI_MAX_HALLUCINATION_RATE`, etc. |
| `MEMORY_BENCH_USE_JUDGE` | Offline retrieval judge |
| `MEMORY_BENCH_OUTPUT` | Memory benchmark JSON path |
| `MM_MEMORY_TRACE` | Server: extra retrieval logging (legacy name; prefer pipeline flags) |

## Why memory looks “empty” in local HTTP eval

Retrieval is scoped by **`user_id`**. Typical causes:

1. **No stored episodic data** for `DEV_USER_ID` (when `SKIP_AUTH=true`) — nothing to retrieve from Qdrant / Supabase `mitra_*`.
2. **Short sessions** — consolidation and episodic writes are batched; a 3–4 turn scripted dialog may not persist long-term memory yet.
3. **Mixed traffic** — using one `user_id` for both crisis stress tests and recall tests pollutes semantic search.

**Mitigation:** use a **dedicated UUID** in `.env` as `DEV_USER_ID` for memory-quality runs; run longer sessions or wait for consolidation; enable trace logging only in dev.

## Security

- **`ALLOW_EVAL_TRACE`** can expose memory-related fields — keep **off** in production or strictly gated.
- Crisis fixture phrases belong in **non-production** environments only.

## Interpreting `rag_evaluation_report.json`

- **`summary_metrics`** — pass rate, latency, judge scores, hallucination rate, rule/crisis counts.
- **`critical_failures`** — safety-priority rows.
- **`regression`** — vs previous `EVAL_HISTORY_DIR` run when configured.

## Related docs

- [MITRA.md](MITRA.md), [platform.md](platform.md), [api_contracts.md](api_contracts.md), [product.md](product.md) (analytics).
- Root `CLAUDE.md`, `AGENT.md`; optional `ai/claude.md`, `ai/skills.md`.

## CI suggestion

```yaml
- run: cd chatbotAgent && pip install -r requirements.txt
- run: cd chatbotAgent && pytest tests -m "not integration" --tb=short
```

Run integration + `run_full_evaluation.py` against a **staging** API with real secrets.

## Product metrics

Funnels, `product_events`, Mixpanel, and SQL templates: [product.md](product.md).
