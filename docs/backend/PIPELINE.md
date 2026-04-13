# Pipeline paths & memory injection

**TL;DR:** `retrieve_memories` + `get_emotional_trend` run in `PipelineOrchestrator.route_and_execute` **before** path A/B/C/D. All paths receive the same `ctx["memory_context"]` (and trend suffix). Path A uses a **light** prompt directive (“don’t force callbacks”); Path B/C use richer analysis + more memory in analysis prompts. Path D uses **templates**, not the response LLM.

**Full backend reference:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · **Memory mechanics:** [`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md)

---

## Memory vs path

| Question | Answer |
|----------|--------|
| Does Path A get retrieval? | **Yes** — retrieval is central; Path A’s **directive** limits therapeutic depth, not whether `memory_context` exists. |
| Where is retrieval invoked? | `pipeline_orchestrator.py` — after intent + crisis gate, before `_path_light` / `_path_standard` / `_path_rich` / crisis fast path. |
| Timeout | Each of `retrieve_memories` and `get_emotional_trend` is collected with a **7s** budget (`fut.result(timeout=7.0)`). |

---

## Paths (summary)

| Path | Intent | Analysis | Response LLM |
|------|--------|-----------|--------------|
| **A** | `casual` | None — stub psych fields | Yes (short cap) |
| **B** | `emotional` | Groq combined emotion + culture | Yes |
| **C** | `therapeutic` | GLM psych JSON; parallel ambiguous crisis check | Yes |
| **D** | `crisis` | None | **No** — `CrisisManager` templates + helplines |

**Crisis entry:** Router returns `crisis`, **or** keyword layer upgrades to crisis (`crisis_manager`), **or** Path C psych returns `risk_level == "crisis"` / LLM crisis check true.

---

## Flow (ASCII)

```
user_message
    → IntentRouter.classify (Groq)
    → crisis keyword / LLM gate (may override intent → crisis)
    → retrieve_memories ∥ get_emotional_trend
    → ctx["memory_context"] += trend line
    → Path A | B | C | D
    → ResponseGenerator.generate (except D)
```

---

## `ctx` role

Single dict through the pipeline: `user_message`, `session_context.*`, `memory_context`, `psychological_analysis`, `technique_selection`, `intervention_directive`, `ai_response`, flags like `_response_max_tokens`, `_pipeline_path`. Built from `create_empty_user_context` (`context.py`) then mutated in `workflow.py` / orchestrator.

---

## When this doc drifts

If you change **when** memory runs or **Path A** prompt rules, update this file and any eval fixtures that assert `pipeline_path` / `memory_injected`.
