# Logging — MindMitra backend (`chatbotAgent`)

## Philosophy

- **Structured by default in production:** set `LOG_FORMAT=json` so log aggregators get one JSON object per line with a stable schema.
- **Request correlation:** each `/chat` and `/chat/stream` request sets a short **`request_id`** (hex) in a `ContextVar`; every log line from `app.core.logging.CustomFormatter` includes it when not `"-"`.
- **Safety-sensitive paths** (crisis detection, crisis logging) use **explicit** levels (`WARNING`/`CRITICAL`) so alerts can route without parsing free text.
- **No secrets in logs:** prompts and `eval_trace` previews are gated (`MM_PIPELINE_DEBUG`, `ALLOW_EVAL_TRACE` + header)—treat production logs as **sensitive** if those gates are ever enabled.

## Configuration

| Variable | Effect |
|----------|--------|
| `LOG_LEVEL` | Root level (default `INFO`). |
| `LOG_FORMAT` | `colored` (local dev, human-readable) or **`json`** (production). |

Boot calls `configure_logging()` from `app/main.py` early in startup.

## JSON record shape (`LOG_FORMAT=json`)

Each line is a single JSON object with at minimum:

| Field | Meaning |
|-------|---------|
| `timestamp` | UTC ISO-8601 |
| `level` | `DEBUG` … `CRITICAL` |
| `logger` | Python logger name (often module path) |
| `msg` | Human-readable message |
| `request_id` | Correlation id from `request_id_var` |
| `file` | `filename:lineno` |

Optional: `metrics` dict merged in when callers use `logger.info("...", extra={"metrics": {...}})`.

## `log_timing` context manager

`app.core.logging.log_timing` wraps a block and logs start/end duration (debug/info). Used for coarse spans (e.g. workflow entry in `chat.py`).

## Where important logs are emitted (non-exhaustive)

| Area | Module | What to expect |
|------|--------|----------------|
| Request entry | `app/api/chat.py` | Incoming `/chat` / `/chat/stream` with `request_id`, session, message length. |
| Memory trigger | `app/api/chat.py` | `[MEMORY-TRIGGER]` hybrid count, `MEMORY_TRIGGER_INTERVAL`, whether extraction/checkpoint will fire. |
| Orchestrator | `app/pipeline/pipeline_orchestrator.py` | Intent router, crisis gate, `[MEMORY-READ]` latency and char count, `[COMPASS]` cognitive layer latency and intent/risk. |
| Crisis | `app/pipeline/crisis_manager.py` | Keyword hits; `log_crisis_event` for **D-crisis-warm** (Supabase + crisis memory thread). |
| Response LLM | `app/agents/response_agent.py` | Prompt build size, LLM `invoke` latency, post-process completion. |
| MEMOIR fetch | `app/agents/memory_retriever.py` | `[MEMOIR-FETCH]` record count, latency, legacy fallback warning if `memory_crud` missing. |
| Structured writes | `app/agents/memory_store.py` | `[MEMORY-WRITE]` around `add_structured` (candidates, approvals, rejects). |
| Session lifecycle | `app/core/session_lifecycle.py` | Periodic extraction / checkpoint triggers. |
| Workflow | `app/pipeline/workflow.py` | Pipeline start/end banner with `_pipeline_path`. |

## Operations tips

- Filter production logs by **`request_id`** to stitch one user turn across modules.
- Tag alerts on **`[CRISIS]`** / **`CRITICAL`** from crisis paths.
- If memory seems “missing” in logs, search **`[MEMORY-READ]`** and **`memory_crud unavailable`** for degraded mode.
