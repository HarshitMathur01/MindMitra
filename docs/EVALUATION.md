# MindMitra Backend — Testing & Evaluation

Production-oriented test and evaluation tooling for the **chatbotAgent** FastAPI service (mental-health AI: safety, memory/RAG, response quality).

## What you get

| Artifact | Purpose |
|----------|---------|
| `docs/backend_system_map.md` | Route + pipeline map for reviewers |
| `tests/fixtures/test-dataset.json` | Labeled scenarios (normal, memory, unknown, crisis, edge) |
| `pytest` under `chatbotAgent/tests/` | API contracts, crisis keywords, mocked `/chat` |
| `tests/rag_evaluator.py` | HTTP runner + metrics + `rag_evaluation_report.json` |
| `tests/llm_judge.py` | Optional Groq-based LLM-as-judge |
| `run_full_evaluation.py` | One command: pytest + evaluator |

## Install

```bash
cd chatbotAgent
pip install -r requirements.txt -r requirements-eval.txt
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

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ALLOW_EVAL_TRACE` | Server: must be `true` for `eval_trace` in `/chat` responses |
| `X-MindMitra-Eval-Trace: 1` | Client header (evaluator sets automatically) |
| `EVAL_BASE_URL` | Base URL for HTTP evaluation |
| `EVAL_AUTH_TOKEN` | Bearer JWT when `SKIP_AUTH` is off |
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

- `ai/claude.md`, `ai/skills.md` — contributor context
- `docs/architecture.md`, `docs/rag.md`, `docs/memory.md`, `docs/therapist_bridge*.md`

## CI suggestion

```yaml
- run: cd chatbotAgent && pip install -r requirements.txt -r requirements-eval.txt
- run: cd chatbotAgent && pytest tests -m "not integration" --tb=short
```

Schedule integration + `run_full_evaluation.py` on a **staging** API with secrets injected from your vault.
