# Memory and conversation quality — evaluation protocol

**Audience:** engineers and evaluators preparing **production** releases of the MindMitra chat stack.  
**Scope:** multi-turn **memory** (conversation-memory RAG), **retrieval**, **generation grounding**, and **cross-session** behavior — not a substitute for clinical safety review.

This document maps to a **five-phase** workflow: measure → diagnose → root-cause → design → **gated** implementation. **Implementation of product changes is intentionally deferred** until Phases 1–4 pass your internal bar.

---

## Phase 1 — Evaluation and verification

### 1.1 Automated layers (run in order)

| Layer | Command / artifact | What it validates |
|--------|---------------------|-------------------|
| Unit + contract | `pytest tests -m "not integration"` | API contracts, crisis keywords, mocks |
| Integration (full pipeline) | `RUN_INTEGRATION=1 pytest tests -m integration` | Live LLM path in-process (`TestClient` + `SKIP_AUTH` patch) |
| HTTP eval set | `python -m tests.rag_evaluator` | Short multi-turn cases, rules, optional **per-reply** Groq judge (`llm_judge.py`) |
| Memory benchmark | `python -m tests.memory_benchmark_runner` | Long (15–16 turn) dialogs, heuristic recall + optional **Groq memory judge** (`memory_judge.py`) |
| Isolated memory benchmark | `./scripts/run_isolated_memory_benchmark.sh` (from `chatbotAgent/`) | Fresh `DEV_USER_ID`, temp `uvicorn`, default **no** Priya/Mumbai seed — avoids cross-eval Qdrant pollution |

**Environment (memory benchmark + judges):**

- API: `EVAL_BASE_URL`, `ALLOW_EVAL_TRACE=true`, auth (`SKIP_AUTH` on server or `EVAL_AUTH_TOKEN`).
- **Per-reply judge** (rag evaluator): `EVAL_USE_JUDGE`, `GROQ_API_KEY`, optional `EVAL_JUDGE_MODEL`.
- **Memory deep judge** (benchmark report `llm_deep_diagnostic`): `GROQ_API_KEY`. Disable with `MEMORY_BENCHMARK_USE_JUDGE=0`.

### 1.2 Logical checks to perform manually on each report

1. **Multi-turn consistency** — Does the assistant contradict an earlier commitment in the same session without acknowledging change?
2. **Memory accuracy** — On implicit probes, does the model (a) use salient prior facts, (b) hedge honestly, or (c) invent specifics?
3. **Hallucinated recall** — Names, dates, or medical claims not present in user text or retrieved memory preview.
4. **Edge cases** — Empty retrieval + user asks “what did I say”; crisis overlap; conflicting user updates (see benchmark `bench_diet_conflict_brunch_01`).
5. **Cross-session** — Benchmark `bench_cross_session_hobby_leak_01`: session B must not surface session-A niche tokens unless retrieval leaks.

### 1.3 Heuristic vs LLM judge

| Signal | Heuristic (fixture + `eval_memory.py`) | Groq memory judge (`memory_judge.py`) |
|--------|------------------------------------------|----------------------------------------|
| Substring recall | Yes | Informed by full transcript |
| False recall risk | Partial | Explicit `false_recall_risk_0_5` |
| Retrieval quality | `memory_injected` + preview length | `memory_retrieval_quality_0_5` |
| Root cause | No | `likely_root_cause_category` (hypothesis, not ground truth) |

Treat judge output as **evidence**, not verdict — calibrate against human spot checks.

---

## Phase 2 — Deep error analysis (taxonomy)

For each failure, record:

| Field | Description |
|-------|-------------|
| **Symptom** | What the user or evaluator saw |
| **Error class** | One or more: `memory_miss`, `memory_overwrite`, `cross_session_leakage`, `retrieval_failure`, `context_misalignment`, `reasoning_inconsistency`, `safety_regression` |
| **Evidence** | Turn index, `eval_trace` snippet, `memory_context_preview`, assistant excerpt |
| **Severity** | Blocker / major / minor for your release |

**Map judge tags → engineering buckets:**

- `memory_miss`, `retrieval_mismatch` → storage/trigger/top‑k/embedding path.
- `memory_noise_irrelevant` → ranking, deduplication, or prompt stuffing.
- `false_recall`, `overconfident_personalization` → generation prompt + memory injection policy.
- `cross_session_contamination_suspected` → `user_id` / collection isolation / eval user hygiene (`EVAL_SEED_USER_ID`).
- `context_drift`, `reasoning_inconsistency` → orchestration path or model limits.

---

## Phase 3 — Root cause research (systematic debugging)

### 3.1 Known architecture coupling points (justify with code, not folklore)

1. **Extraction timing** — `MEMORY_TRIGGER_INTERVAL` (default 12) in `app/utils/constants.py` and `_maybe_trigger_memory` in `app/api/chat.py`. Short sessions may **never** call `add_memories`; retrieval stays empty → “miss” is often **expected**, not a random bug.
2. **Retrieval fast path** — If Supabase `memory_metadata` has no rows for the user, retriever may short-circuit (see `memory_retriever.py` comments and `scripts/seed_eval_memory.py`).
3. **Async extraction** — mem0 work runs in **background threads**; a benchmark that ends immediately can race teardown → FK or log noise; allow sleep between conversations (fixture `between_conversations_sleep_s`).
4. **Preview in eval_trace** — Sensitive; gated by env + header. Never enable trace for end users in production without controls.

### 3.2 Compare to common LLM failure patterns

| Pattern | Question to answer |
|---------|-------------------|
| Context window | Are salient facts still in recent messages when extraction runs? |
| Embedding mismatch | Paraphrases / code-mix: are chunks and query in the same embedding space? |
| Improper persistence | Wrong `user_id`, shared dev UUID, or mixed eval traffic in Qdrant |
| Prompt ambiguity | System text rewards “sound personal” without requiring grounding in `memory_context` |

### 3.3 Systematic vs random

- **Systematic:** Reproduces on same fixture + same seed user + cold Qdrant state.
- **Random:** Flaky path routing or model sampling — mitigate with `temperature` caps, repeated runs, and CI tolerance bands.

---

## Phase 4 — Solution design (before coding)

For each **validated** root cause, document **multiple options** and trade-offs:

| Approach | Reliability | Latency | Cost | Complexity |
|----------|-------------|---------|------|--------------|
| Tune trigger interval / batch size | Medium | Small | Low | Low |
| Dedicated eval user + seed script | High for eval | None in prod | Low | Low |
| Reranker / cross-encoder on memory candidates | High | +ms–s | $$ | Medium |
| Structured memory schema (typed slots) | Very high for facts | Small | Medium | High |
| Abstain policy in prompt (“I don’t have that on file”) | High trust | None | Low | Low |

**Select** the smallest change that removes the failure class **reproducibly**, then add **guardrails** (e.g. max preview chars, citation-style “you mentioned X” only when preview contains X).

---

## Phase 5 — Implementation gate (strict)

**Do not merge product changes until:**

1. Root cause is written in an ADR or ticket with **evidence** (trace + logs + judge output).
2. **Solution** is peer-reviewed (conceptual OK).
3. **Test plan** exists: unit + integration + benchmark regression + optional judge budget cap.

**Implementation plan template (post-gate):**

1. Code change in smallest slice (e.g. retriever only).
2. Update `docs/backend/MEMORY_ARCHITECTURE.md` / `docs/MEMORY.md` if behavior changes.
3. Extend `memory-benchmark-dataset.json` or add a case to `test-dataset.json` that **fails before** the fix and **passes after**.
4. CI: keep `MEMORY_BENCHMARK_USE_JUDGE=0` on default PR pipeline if Groq secrets are absent; run judge nightly or on `main`.

---

## Artifacts and paths

| Artifact | Path |
|----------|------|
| Long-turn benchmark | `chatbotAgent/tests/fixtures/memory-benchmark-dataset.json` |
| Benchmark runner | `chatbotAgent/tests/memory_benchmark_runner.py` |
| Groq memory judge | `chatbotAgent/tests/memory_judge.py` |
| Per-reply judge | `chatbotAgent/tests/llm_judge.py` |
| Memory heuristics | `chatbotAgent/tests/eval_memory.py` |
| Seed retrieval for eval | `chatbotAgent/scripts/seed_eval_memory.py` |
| Narrative + links | `docs/MEMORY.md`, `docs/backend/MEMORY_ARCHITECTURE.md` |

---

## Critical stance (non-goals)

- This protocol does **not** certify medical safety or therapeutic efficacy.
- Judge models can **hallucinate judgments** — use consistency checks (repeat call, variance).
- **Depth over optimism:** prefer recording `judge_uncertain` and filing a human ticket over forcing a green dashboard.

---

*End of protocol. Implementation begins only after Phase 5 gate is explicitly cleared by your team.*
