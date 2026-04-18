## Production-grade evaluation (COMPASS × MEMOIR)

This folder contains **two complementary evaluation tracks**:

- **Response quality + safety + latency (HTTP)**: `tests/rag_evaluator.py`
- **Memory retrieval quality (HTTP, long multi-turn)**: `tests/memory_benchmark_runner.py`

Both can optionally use **Groq as an LLM-as-judge** (set `GROQ_API_KEY`).

### 1) Response evaluation (routing + safety + response quality)

**Start API (Terminal A)**:

```bash
cd chatbotAgent
export SKIP_AUTH=true
export ALLOW_EVAL_TRACE=true
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Run evaluator (Terminal B)**:

```bash
cd chatbotAgent
export EVAL_BASE_URL=http://127.0.0.1:8000
export EVAL_USE_JUDGE=true
export EVAL_FIXTURE_PATH=tests/fixtures/prod-eval-dataset.json
python -m tests.rag_evaluator
```

**Outputs**:
- `rag_evaluation_report.json` (override: `EVAL_REPORT_PATH`)
- Summary includes **p50/p95** latency plus stage timing percentiles when server returns `eval_trace.stage_timings`.

### 2) Memory benchmark (retrieval quality + contamination risk)

```bash
cd chatbotAgent
export EVAL_BASE_URL=http://127.0.0.1:8000
export ALLOW_EVAL_TRACE=true
export MEMORY_BENCHMARK_USE_JUDGE=1
python -m tests.memory_benchmark_runner
```

### Recommended production metrics

- **Safety**
  - `crisis_handling_pass_rate` (crisis cases)
  - `avg_safety_score` + `critical_failure_count`
  - `hallucination_rate`
- **Response quality**
  - Judge: `relevance`, `correctness`
  - Judge subscores (if present): `empathy`, `clarity`, `actionability`, `boundary_respect`
- **Memory quality**
  - `avg_memory_relevance_score` (heuristic)
  - Memory benchmark: `memory_accuracy_score` + judge `llm_deep_diagnostic` tags
  - “No false recall” rate (memory-dependent cases where `memory_injected=false` but reply claims recall)
- **Latency**
  - HTTP `p50_latency_ms`, `p95_latency_ms`
  - Stage percentiles when available:
    - Stage1 parallel (crisis+memoir+arc)
    - Cognitive layer
    - Response LLM time

### Latency analysis tips (what to watch)

- If **p95 spikes** but p50 is stable: likely external provider tail latency (Azure/Groq) or DB network jitter.
- If Stage1 p95 spikes: Qdrant/Supabase slowness, Redis unavailable, or memory timeouts.
- If response_llm p95 spikes: provider rate-limit retries/backoff; consider concurrency caps.

