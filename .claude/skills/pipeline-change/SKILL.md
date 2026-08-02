---
name: pipeline-change
description: Checklist for adding or modifying a stage in chatbotAgent/app/pipeline/ — where the code, tests, and spec updates go, plus the safety invariants a pipeline change must not violate. Use when touching ingestion, signal_extraction, crisis_bypass, orchestrator, memory_retrieval, prompt_builder, llm_core, safety_gate, or activity_suggestion.
---

# pipeline-change — touching a MHA v3 pipeline stage

The per-turn pipeline is the safety-critical path. A change here can silently
weaken crisis handling, so the checklist is not optional.

## Where things go

| What | Where |
|------|-------|
| Stage module | `chatbotAgent/app/pipeline/<stage>.py` |
| Wiring | `chatbotAgent/app/api/chat_ws.py` → `_process_turn()` (~line 575) |
| Unit tests | `chatbotAgent/tests/unit/pipeline/test_<stage>.py` — **not** `tests/v3/` |
| Route-level tests | `chatbotAgent/tests/api/test_chat_http.py` |
| Feature slices | `chatbotAgent/tests/v3/` (per-feature, e.g. language override) |
| Spec | `html-to-markdown.md` — the LAYER 1–8 sections |
| API shape changes | `docs/api_contracts.md` (required in the same PR) |

Turn order is documented in `CLAUDE.md` → "Mental model: one chat turn". Keep
the code, that diagram, and the spec's layer numbering in agreement.

## Safety invariants a pipeline change must preserve

Read `CLAUDE.md` → "System invariants" in full. The ones this path can break:

1. **Never route a Tier-3 (urgency=3) response through an LLM.** Crisis output
   is a clinician-reviewed template, fetched, not generated. `crisis_bypass`
   short-circuits before the orchestrator for a reason.
2. **Never bypass `crisis_bypass_check` or the urgency-history pre-check** —
   including "just for this new fast path".
3. **PII (10-digit phone, Aadhaar, email) is redacted in Layer 1 (`ingestion`)
   before any downstream call.** A new stage that reads raw input reintroduces
   the leak.
4. **Every Supabase service-role query and every Qdrant query filters
   `user_id`.** No exceptions for "internal" lookups.
5. **The safety gate stays on the hot path.** It runs after generation and
   emits `replace` when needed; removing it "for latency" is not a tradeoff
   that is available.
6. **Heavy work stays off the per-turn path** — consolidation, episodic write,
   and semantic extraction belong in `asyncio.create_task` or the session-end
   worker.
7. **Prompt assembly hard-caps at 8000 tokens; never trim Block 1 or Block 6.**
8. **`eval_trace` and debug snippets can carry PII** — keep them env+header
   gated.

## Field discipline

Every field a stage emits needs a declared consumer, and every field it reads
needs a declared producer — see "Task 1: Full input-output field audit" in
`html-to-markdown.md`. If you add or remove a signal field, update the
producer, every consumer, and the audit-log entry in one change set.

## Before you call it done

```bash
# offline backend slice — mocked LLM, mocked auth (make is not installed on Windows)
cd chatbotAgent && python -m pytest -m "not integration and not live_env" --tb=short -x -q
```

Baseline on `main` is 176 passed / 16 deselected. Then:

- [ ] New/changed behaviour covered in `tests/unit/pipeline/`
- [ ] Crisis and safety-gate tests still pass unmodified — if you had to edit
      `test_crisis_bypass.py` or `test_safety_gate.py` to go green, stop and
      explain why in the PR
- [ ] `html-to-markdown.md` layer section updated
- [ ] `docs/api_contracts.md` updated if the response shape moved
- [ ] `CLAUDE.md` turn diagram updated if the stage order changed
