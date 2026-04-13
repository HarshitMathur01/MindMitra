# Backend architecture (FastAPI)

**TL;DR:** `POST /chat` / `POST /chat/stream` validate JWT → build `UserContext` → `MindMitraWorkflow._route_and_execute` (screening hint → Groq intent → **crisis gate** → memory ∥ trend → path A/B/C/D) → `ResponseGenerator` (except crisis templates). **Response JSON:** `message`, `animation`, `facial_expression`, `modality`, `confidence`, `session_insights`, optional `eval_trace` — **no `audio`/`lipsync` fields**; avatar speech is **browser-side**. Deep memory: [`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md).

**Runtime:** Python 3.12, FastAPI, `chatbotAgent/app/`. **Config:** `config.yaml` + env substitution (`app/core/config.py`).

---

## 1. System context

```
React (Vite) ──Bearer JWT──► FastAPI (Railway/host)
                              ├► Supabase (auth, rows, RLS)
                              ├► Qdrant + mem0 (vectors)
                              └► Groq / Zhipu / Google APIs
```

| Principle | Implementation |
|-----------|----------------|
| Crisis not optional | Keyword scan + LLM disambiguation + Path C psych `risk_level` |
| Memory on hot path | Retrieved before path split; same `ctx` for A–C |
| Fail-soft | Agents try/except; empty memory string on error |
| Screening-aware routing | PHQ-9/GAD-7 severities → hint string into `IntentRouter.classify` |

**LLM roles (typical defaults — verify in `config.yaml`):**

| Role | Provider / model (typical) |
|------|----------------------------|
| Intent + Path B fast analysis + crisis LLM check | Groq `qwen3-32b` class |
| Screening, mem0-side Groq, importance, reflections, trend | Groq `llama-3.3-*` |
| Path C psych + response + procedural | GLM / Azure per `response_generator.llm_provider` |
| Session summaries | Gemini flash-lite |
| STT | Groq Whisper (`/transcribe`) |
| Embeddings | Local MiniLM (memory) |

---

## 2. Boot (`app/main.py`)

Order matters for Railway health:

1. `load_dotenv`, `configure_logging`  
2. **Guard:** `SKIP_AUTH` + `is_public_production()` → **exit**  
3. `FastAPI` + `lifespan` (logs env status)  
4. **`include_router(health)`** before heavy imports  
5. Google creds decode (`GOOGLE_CREDENTIALS_BASE64`) if set  
6. CORS (whitelist + `CORS_ALLOW_ORIGINS` + localhost regex)  
7. `include_router(chat, onboarding, therapist_bridge)` → imports agents, `memory_manager` (starts **`mem0-init`** daemon)

**Why:** `/health` must succeed while mem0/HF loads in background.

---

## 3. Request: `POST /chat` (`app/api/chat.py`)

| Step | Action |
|------|--------|
| 1 | `validate_user_token`, `enforce_chat_rate_limit` |
| 2 | Optional daemon: `get_emotional_trend(user_id)` prewarm |
| 3 | `asyncio.gather`: `fetch_user_context`, `load_session_summary`, `fetch_previous_session_summary` |
| 4 | Merge `voice_analysis`; optional Praat prosody if `audio_data` |
| 5 | `process_user_chat(...)` → pipeline |
| 6 | `_build_avatar_package` → **`animation` + `facial_expression` only** (see docstring: TTS client-side) |
| 7 | `_maybe_trigger_memory`, maybe `_run_session_end_jobs`, game bridge threads |
| 8 | `ChatResponse` (no audio fields) |

**Streaming:** `POST /chat/stream` — SSE events (`text_chunk`, `avatar_ready`, `complete`, …); structured log `metrics.event` on complete/fail (`chat_stream_complete` / `chat_stream_failed`).

**Latency:** dominated by intent router, memory parallel wait, path LLMs; Azure path uses `max_tokens_path_*` from config.

---

## 4. Orchestration

**Files:** `pipeline/workflow.py` (`MindMitraWorkflow`, `process_user_chat`), `pipeline/pipeline_orchestrator.py` (`route_and_execute`).

### `process_user_chat` (summary)

1. `create_empty_user_context` (`context.py`)  
2. Fill `session_context`, `voice_analysis`, `personality_settings`, `previous_session_summary`  
3. `_route_and_execute(ctx, session_id)`  
4. Optional: `save_user_context_to_file` (daemon)  
5. Return dict consumed by `chat.py` (`message`, `modality`, `confidence`, `session_insights`, optional `eval_trace`)

### `_route_and_execute` (ordered)

| # | Step |
|---|------|
| 1 | `fetch_latest_screening_scores` → build **screening_hint** if PHQ-9 ≥ moderate or GAD-7 ≥ moderate |
| 2 | `IntentRouter.classify(..., screening_hint)` |
| 3 | **Crisis gate** (if intent ≠ `crisis`): keywords → hard override; ambiguous → `_crisis_llm_check` |
| 4 | `retrieve_memories(text, user_id, intent)` ∥ `get_emotional_trend(user_id)` (executor, **7s** timeout each) |
| 5 | Append trend line to `memory_context` |
| 6 | Dispatch: `crisis` → `CrisisManager.crisis_fast_path`; `casual` / `emotional` / `therapeutic` → `_path_light` / `_path_standard` / `_path_rich` |

---

## 5. Intent router (`agents/intent_router.py`)

- **Output JSON:** `{ "intent": "casual"|"emotional"|"therapeutic"|"crisis", "confidence": float }`  
- **Inputs:** message (truncated), last **2** msgs (80 chars), activity hint, optional screening hint  
- **Failure default:** `emotional`, 0.5  
- **Model:** from `config` / Groq client on `GroqNLPModule`

---

## 6. Crisis (`pipeline/crisis_manager.py`)

| Layer | Mechanism |
|-------|-------------|
| 1 | Python keyword lists: **hard** → immediate crisis; **ambiguous** → layer 2 |
| 2 | Groq yes/no disambiguation (`CRISIS_LLM_CHECK_PROMPT` from `prompts.py`) |
| 3 | Path C psych JSON `risk_level == "crisis"` can escalate mid-path |

**Templates + helplines:** class `_CRISIS_RESPONSE_TEMPLATES` in **this module** (not `prompts.py` bodies).

**Side effects (typical):** `crisis_events` insert (no user message body); thread `add_crisis_memory`; stub `psychological_analysis` / `technique_selection`.

---

## 7. Paths A–D (`workflow.py`)

| Path | Trigger | Extra LLM work | Response |
|------|---------|----------------|----------|
| **A** | `casual` | None — stub psych + directive | `ResponseGenerator` short cap |
| **B** | `emotional` | `_combined_emotion_cultural_analyse` (Groq JSON) → needs→intervention map → directive | Response LLM |
| **C** | `therapeutic` | Parallel psych GLM + optional crisis LLM; may bail to crisis | Response LLM |
| **D** | `crisis` | None | `crisis_fast_path` templates only |

Path B / C analysis prompts slice `memory_context` in **`analysis_engine.py`** (**300** chars for combined emotion+culture line; **800** for psych block — confirm in file if tuning).

---

## 8. Response generation (`agents/response_agent.py`)

**System prompt slots:** identity/stage + `personality_instruction` + `language_instruction` + `intervention_directive` + CoE lens line + **memory contract** + `{memory_context}`.

**User message payload:** `_build_context()` — structured header + activities + previous session + last turns + current message (labels must not be echoed verbatim — instruction in template).

**Post-process:** `_clean` strips `<think>…`, quotes, stray JSON wrappers.

**Personalities:** `mitra`, `arjun`, `diya`, `riya`, `zen` (+ legacy aliases `calm`, `energetic`, `analytical`) — see `PERSONALITY_INSTRUCTIONS` in file.

---

## 9. Memory

All write/read/scoring detail: **[`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md)**. Do not duplicate tables here.

---

## 10. Background jobs (`chat.py` + threads)

| Cadence | Action |
|---------|--------|
| Every **12** msgs (`MEMORY_TRIGGER_INTERVAL`) | `fetch_last_n_messages` → `add_memories` |
| Every **36** msgs | `_run_session_end_jobs` (summary if ≥5 msgs, procedural keywords on last 15, reflections if session milestone, screening if ≥8 msgs) |
| When `user_activities` present | `_extract_game_insights_for_memory` |

**Procedural keyword sample:** breathing, journal, meditate, cope, grounding, sleep, yoga, … (full list in `_trigger_procedural_synthesis`).

---

## 11. Screening (`agents/screening_agent.py`)

- **Session assessment:** Groq on last **30** turns → PHQ-9 + GAD-7 JSON; fallback GLM.  
- **EMA:** `SCREENING_EMA_ALPHA` (default **0.6**) — `ema = round(α·raw + (1-α)·prev)`.  
- **Persist:** `save_screening_scores` → `user_contexts`; consumed next turn for screening hint.

Severity bands: see implementation / `docs` product docs — thresholds in agent + constants.

---

## 12. TTS & lipsync (backend services vs product path)

| Fact | Detail |
|------|--------|
| **Product default** | Browser (Azure SDK / fallbacks) generates speech; backend returns **text + expression metadata** only. |
| **Repo still contains** | `services/tts_service.py`, `services/lipsync_service.py`, `bin/rhubarb` — usable for experiments or non-default deployments; **not** attached to default `ChatResponse` schema (`app/models/response_models.py`). |

---

## 13. Greeting (`services/greeting_service.py`)

`GET /chat/greeting`: time slot → personality template → optional theme callback from `fetch_previous_session_summary` (with tight timeout guard). Returns `{ greeting, show_greeting, language_used, time_slot }`.

---

## 14. Services (short)

| Module | Role |
|--------|------|
| `controllers/glm_controller.py` | Thread-safe Zhipu invoke + retries + optional Groq fallback |
| `services/supabase_service.py` | Context fetch, hybrid counts, messages, screening I/O — **always filter `user_id`** on service-role reads |
| `core/config.py` | Singleton YAML + `${ENV}` substitution; `config.get`, `get_api_key`, `is_enabled` |
| `utils/json_utils.py` | `parse_json_from_llm_output` (multi-tier), `compact_for_merge_prompt` |

---

## 15. `UserContext` (`pipeline/context.py`)

Envelope: `user_id`, `session_id`, `user_message`, `session_context` (messages, summary, activities), `psychological_analysis`, `technique_selection`, `memory_context`, `ai_response`, … Pipeline adds `personality_settings`, `intervention_directive`, `_pipeline_path`, `_response_max_tokens`, etc.

---

## 16. HTTP API (authoritative shapes)

### `POST /chat` → `ChatResponse`

```json
{
  "message": "string",
  "animation": "Talking_0",
  "facial_expression": "empathy",
  "modality": "therapy",
  "confidence": 0.85,
  "session_insights": { },
  "eval_trace": { }
}
```

`eval_trace` only when env + header allow (`eval_trace_enabled_for_request` + `X-MindMitra-Eval-Trace`).

### Other routes

| Method | Path | Notes |
|--------|------|------|
| GET | `/health` | Liveness |
| GET | `/health/ready` | 503 if Groq or Supabase env missing |
| GET | `/debug/memory` | Gated (`env_flags.debug_memory_route_enabled`) |
| POST | `/chat/stream` | SSE |
| GET | `/chat/greeting` | Query: `session_id`, `personality`, `language`, … |
| POST | `/transcribe` | JSON `{ "audio_data": "<base64 wav>" }` |
| POST | `/onboarding/mirror-response` | Router prefix `/onboarding` |
| POST | `/onboarding/crisis-check` | |
| * | `/therapist-bridge/*` | Auth required |

Full JSON schemas: **[`../api_contracts.md`](../api_contracts.md)**.

---

## 17. Database (Supabase)

**Authoritative schema:** `supabase/migrations/*.sql`. Commonly referenced tables:

`chat_messages`, `user_activities`, `user_profiles`, `user_settings`, `user_onboarding`, `crisis_events`, `user_contexts`, `session_summaries`, `memory_metadata`, `user_memory_stats`, `voice_analysis_events`, `onboarding_analytics`, `product_events`, therapist bridge tables — **verify columns in migrations**, not only this list.

---

## 18. LLM call map (representative)

| Call site | Purpose |
|-----------|---------|
| `IntentRouter.classify` | Intent JSON |
| `_combined_emotion_cultural_analyse` | Path B structured affect |
| `_crisis_llm_check` | Ambiguous crisis |
| `_optimized_psych_analysis` | Path C clinical JSON |
| `ResponseGenerator.generate` | Final reply |
| `ScreeningAgent.generate_session_assessment` | PHQ-9/GAD-7 |
| mem0 internal `add` | Groq extraction |
| `memory_store` importance batch | Scores |
| `memory_reflection` summary / procedural / reflections / trend | Gemini / GLM / Groq |

Exact model IDs → **`config.yaml`**.

---

## 19. Constants & env

- **Knobs:** `app/utils/constants.py` + `MEMORY_ARCHITECTURE.md` table.  
- **Secrets / toggles:** `chatbotAgent/.env.example` (`SKIP_AUTH`, `ALLOW_EVAL_TRACE`, `ALLOW_EVAL_TRACE_IN_PROD`, rate limits, `LOG_FORMAT=json`, …).

---

## 20. Feature flags

`config.yaml` → `features.*` consumed via `config.is_enabled(...)`. Do not assume a flag’s default — read YAML.

---

## 21. Repo layout (service)

```
chatbotAgent/
  app/
    main.py
    api/          chat, health, onboarding, therapist_bridge
    pipeline/     workflow, orchestrator, crisis_manager, analysis_engine, context
    agents/       intent_router, response_agent, screening_agent, memory_*
    services/     supabase_service, greeting_service, tts_service, lipsync_service, …
    controllers/  glm_controller, …
    core/         config, auth, prompts, logging, env_flags, rate_limit
    models/       request/response pydantic
    utils/        constants, json_utils
  config.yaml
  Dockerfile
  railway.toml
  requirements.txt
```

Markdown deep-dives live in **`docs/backend/`** (this directory).

---

## 22. Dependencies (conceptual)

```
main → health (early)
main → chat → workflow → orchestrator → intent_router / crisis_manager / memory_manager / response_agent
main → onboarding
main → therapist_bridge
```

---

## 23. Deploy & logs

- **Docker / Railway:** see `Dockerfile`, `railway.toml`, `Procfile`.  
- **Logging:** `configure_logging`; JSON logs when `LOG_FORMAT=json`; request id via `request_id_var`.  
- **Rate limit:** `app/core/rate_limit.py` on chat routes.

---

## 24. Maintenance

When you change routing, crisis behavior, memory triggers, or API fields: update **`../api_contracts.md`**, this file or **`MEMORY_ARCHITECTURE.md`**, and tests under `chatbotAgent/tests/`.

**Code wins over prose** — if this doc disagrees with `git`, fix the doc in the same PR.
