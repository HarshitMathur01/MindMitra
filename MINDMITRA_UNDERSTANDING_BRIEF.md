# MindMitra — Understanding Brief (interview prep, verified against code)

> Every claim below was verified by reading the source on 2026-07-02.
> **There is no `ARCHITECTURE.md` in this repo.** The architecture spec is
> `html-to-markdown.md` (root) plus `CLAUDE.md`. Where those docs disagree
> with code, the mismatch is flagged inline with a ⚠️.

---

## 1. System Overview (30-second version)

MindMitra is an AI mental-health companion for Indian college students (18–25),
positioned as the "zero-th layer" before therapy — chat in English/Hindi/Hinglish,
cross-session memory, and a tiered crisis-safety system. The core architectural
bet is **deterministic safety over LLM autonomy**: crisis responses are
clinician-authored templates served by pure-Python code with *no LLM in the
path* ([crisis_bypass.py:12](chatbotAgent/app/pipeline/crisis_bypass.py#L12) — "No LLM call
participates in this path. Ever."), every LLM output passes a post-hoc safety
gate, and every external dependency has a timeout + fallback so a turn always
returns *something*. Stack: React/Vite/TS frontend on Vercel (~55.8k LOC),
FastAPI backend on Railway at **1 replica** ([railway.toml](chatbotAgent/railway.toml),
`numReplicas = 1`) (~12.9k LOC app + ~3.2k LOC tests, 138 test functions),
Supabase Postgres (auth + profiles + audit), Redis (sessions, 25-min TTL),
Qdrant (episodic vectors). Four LLM providers (Azure OpenAI, Groq, GLM,
Gemini) plus Azure Speech. **Live user count is not inferable from code** —
don't state one; `docs/sql/beta_product_analytics_queries.sql` implies beta
stage only.

---

## 2. Request Lifecycle (end-to-end trace)

One user message, hop by hop:

1. **Frontend capture** — [ChatGPTInterface.tsx:761-774](src/components/chat/ChatGPTInterface.tsx#L761-L774):
   plain `fetch` `POST {VITE_BACKEND_URL}/chat` with `Authorization: Bearer <supabase JWT>`,
   body `{content, session_id, device_locale, language}`. Endpoint resolution at
   [ChatGPTInterface.tsx:103-110](src/components/chat/ChatGPTInterface.tsx#L103-L110).
   [useChat.tsx:209](src/hooks/useChat.tsx#L209) is a no-op stub — the component owns the call.
   Separately, the frontend persists turns to `chat_messages` via the anon-key
   Supabase client for the sidebar UX ([ChatGPTInterface.tsx:551](src/components/chat/ChatGPTInterface.tsx#L551)) —
   the backend does **not** write chat transcripts to Postgres.

2. **Auth** — [chat_ws.py:145-167](chatbotAgent/app/api/chat_ws.py#L145-L167) `_resolve_http_user_id`
   → [auth.py:23-43](chatbotAgent/app/core/auth.py#L23-L43) `decode_supabase_jwt` (HS256 against
   `SUPABASE_JWT_SECRET`). `user_id` comes from the token, never from the URL/body.
   `SKIP_AUTH` is refused when `ENV` looks like prod unless `ALLOW_INSECURE_SKIP_AUTH=true`
   ([env.py:449-450](chatbotAgent/app/core/env.py#L449-L450)).

3. **Rate limit** — [session_service.py:486-516](chatbotAgent/app/services/session_service.py#L486-L516):
   Redis `INCR rate:{user_id}` expiring at next UTC midnight; 40 turns/day in prod
   ([env.py:34-43](chatbotAgent/app/core/env.py#L34-L43)). **Fails open** if Redis is down
   (line 514-516: "rate limit bypassed for availability").

4. **Session startup** — `session_service.session_startup()`: load/resume from Redis
   (TTL 1500 s), 4 parallel Supabase profile loads (semantic, procedural,
   longitudinal, most-recent-episodic), 4 s budget (`session_profile_load_timeout_s`).

5. **The turn pipeline** — `_process_turn` in
   [chat_ws.py:575-1187](chatbotAgent/app/api/chat_ws.py#L575). There are **not "4 paths"** ⚠️ —
   there are **two paths** (crisis bypass vs. normal), and within normal, **4 active
   modes** chosen deterministically:
   - **L1 ingestion** ([ingestion.py](chatbotAgent/app/pipeline/ingestion.py)) — pure Python,
     Unicode normalise + regex PII redaction (Indian phone/email patterns), <5 ms.
   - **Crisis pre-check** ([chat_ws.py:624-654](chatbotAgent/app/api/chat_ws.py#L624-L654)) —
     if last turn's urgency was 3, serve the crisis template immediately.
   - **L2 parallel** ([chat_ws.py:669-686](chatbotAgent/app/api/chat_ws.py#L669-L686)) — Groq
     `llama-3.1-8b-instant` structured-JSON signal extraction
     ([signal_extraction.py:38-60](chatbotAgent/app/pipeline/signal_extraction.py#L38-L60):
     affect vector, urgency 0–3, code-mix ratio…) races a local MiniLM embedding.
     Regex "passive monitor" (farewell/hopelessness patterns,
     [signal_extraction.py:63-80](chatbotAgent/app/pipeline/signal_extraction.py#L63-L80)) can
     *raise* urgency to at most 2.
   - **Crisis post-check** ([chat_ws.py:708-733](chatbotAgent/app/api/chat_ws.py#L708-L733)) —
     fresh `urgency==3` → crisis bypass, return.
   - **L3 orchestrator** ([orchestrator.py:68](chatbotAgent/app/pipeline/orchestrator.py#L68)) —
     **pure-Python rules, no LLM, no embeddings, no classifier**. Six decisions: mode
     (`companion | active_listener | recovery_check | referral_bridge`; psychoeducation
     and skill_coach are feature-flagged off, [env.py:372-381](chatbotAgent/app/core/env.py#L372-L381)),
     memory gate + strength, 8-float tone params, cultural frame, max tokens
     ([orchestrator.py:37-48](chatbotAgent/app/pipeline/orchestrator.py#L37-L48): 80–180 by
     mode×urgency), dependency flag.
   - **L3.5 activity suggestion** ([activity_suggestion.py](chatbotAgent/app/pipeline/activity_suggestion.py)) —
     deterministic rule engine for MindGym suggestions; suppressed on crisis turns twice
     (rule engine + wire-level kill switch [chat_ws.py:1058-1062](chatbotAgent/app/api/chat_ws.py#L1058-L1062)).
   - **L4 memory retrieval** ([memory_retrieval.py:43](chatbotAgent/app/pipeline/memory_retrieval.py#L43)) —
     Qdrant vector search filtered by `user_id`, harmonic mean of topic-similarity ×
     affect-similarity; top 2 above 0.62 ("full" gate) or top 1 above 0.75 ("light").
   - **L5 prompt build** ([prompt_builder.py](chatbotAgent/app/pipeline/prompt_builder.py)) —
     7-block prompt, tiktoken-trimmed to 8000 tokens.
   - **L6 LLM** ([llm_core.py:41](chatbotAgent/app/pipeline/llm_core.py#L41)) — provider chain
     (§3), streamed server-side.
   - **L7 safety gate** ([safety_gate.py:91](chatbotAgent/app/pipeline/safety_gate.py#L91)) — §4.
   - **L8 delivery + async writes** — event `confirmed | replace | crisis`; Redis session
     save, audit-log insert, PostHog event all `asyncio.create_task` (non-blocking).

6. **Response shape** — HTTP is request/response JSON. The WebSocket handler exists but
   is **deliberately unregistered** ([chat_ws.py:312-315](chatbotAgent/app/api/chat_ws.py#L312-L315));
   LLM "streaming" chunks are buffered into `_HttpEventSink`
   ([chat_ws.py:135-142](chatbotAgent/app/api/chat_ws.py#L135-L142)) and the client gets one
   final JSON. **Users see nothing until the whole pipeline finishes.**

7. **Session end** — Redis TTL expiry (keyspace event or 60 s polling sweep) →
   [session_end_worker.py:35](chatbotAgent/app/jobs/session_end_worker.py#L35), distributed
   lock, then 6 concurrent tasks: session record, crisis-cooldown flag, episodic memory
   (Gemini summary → MiniLM → Qdrant), semantic facts (Groq → Supabase), procedural EMA,
   longitudinal slope.

**Where routing decisions are made, precisely:** the only LLM involved in routing is the
Groq signal extractor (urgency + affect). Mode selection, memory gating, tone, and
crisis bypass are all deterministic Python rules. No embeddings-based router, no
intent classifier.

---

## 3. Multi-Provider LLM Orchestration

⚠️ **"5 providers" needs care.** There are **4 LLM providers** in code — Azure OpenAI,
Groq, GLM (Zhipu), Gemini — plus **Azure Speech** (browser TTS token endpoint) as a 5th
external AI service. Say "4 LLM providers + Azure Speech" to be exact.
Also ⚠️ CLAUDE.md says "Azure GPT-4o (primary) with GLM-4 fallback" — the code default
is **`gpt-5-mini`** ([env.py:133-139](chatbotAgent/app/core/env.py#L133-L139)) with GPT-5
reasoning-model parameter handling ([llm_core.py:288-299](chatbotAgent/app/pipeline/llm_core.py#L288-L299)),
and Groq — not GLM — is the first fallback.

| Provider | Model(s) | Used for | Why |
|---|---|---|---|
| Azure OpenAI | `gpt-5-mini` deployment (reasoning family auto-detect) | Primary chat generation | Quality; India-region data-residency story |
| Groq | `llama-3.1-8b-instant` (signal + safety classifier), `llama-3.3-70b-versatile` (chat fallback + safety-gate regeneration), `whisper-large-v3-turbo` (STT, [audio.py:5](chatbotAgent/app/api/audio.py#L5)) | Latency-critical paths | Fast + cheap; safety retries must finish inside a 10 s gate budget ([chat_ws.py:918-924](chatbotAgent/app/api/chat_ws.py#L918-L924)) |
| GLM (Zhipu) | `glm-4-flash` | Third chat fallback | Free tier; **hard-blocked** for urgency > 0 or any non-companion mode ([llm_core.py:250-257](chatbotAgent/app/pipeline/llm_core.py#L250-L257)), enforced by an assert at [llm_core.py:63](chatbotAgent/app/pipeline/llm_core.py#L63) |
| Gemini | `gemini-1.5-flash` | Session-end episodic summaries only ([episodic_write.py:71](chatbotAgent/app/memory/episodic_write.py#L71)), Groq as its fallback | Off the hot path; cheap long-context summarisation |
| Azure Speech | region token endpoint | Browser TTS/avatar voice | — |

**Fallback logic is real, not aspirational.** Two independent layers:

1. **Sequential provider chain** — [llm_core.py:215-231](chatbotAgent/app/pipeline/llm_core.py#L215-L231)
   `_provider_chain()`: default `azure → groq → glm` (env-overridable via
   `LLM_PROVIDER_CHAIN`). The loop at [llm_core.py:76-164](chatbotAgent/app/pipeline/llm_core.py#L76-L164)
   tries each; any exception or empty response falls through to the next, and the
   `fallback_chain` actually exercised is recorded in the result and audit log. If all
   three fail, the safety-gate caller serves a **static fallback template** from Supabase
   (1 s budget, [chat_ws.py:949-966](chatbotAgent/app/api/chat_ws.py#L949-L966)), and if *that*
   fails, hardcoded strings ([chat_ws.py:944-947](chatbotAgent/app/api/chat_ws.py#L944-L947)).
   A turn cannot return nothing.

2. **Circuit breaker + retry** — [connections.py:200-257](chatbotAgent/app/core/connections.py#L200-L257)
   `guarded_call()` wraps every external call:
   ```python
   CIRCUIT_FAILURE_THRESHOLD = 3   # failures in a 60s window
   CIRCUIT_WINDOW_S = 60.0
   HALF_OPEN_AFTER_S = 60.0        # connections.py:41-43
   ```
   Retries: `retries=2` default, **but only for transient errors** (HTTP 429/503,
   [connections.py:189-197](chatbotAgent/app/core/connections.py#L189-L197)), with exponential
   backoff `0.5 * 2**attempt` ([connections.py:253](chatbotAgent/app/core/connections.py#L253)).
   Open circuit → `get_azure()` etc. return `None` and the chain skips that provider
   instantly ([connections.py:426-430](chatbotAgent/app/core/connections.py#L426-L430)).
   Caveat: breaker state is **in-process memory** — fine at 1 replica, not shared if you scale out.

3. **Stage-level timeout harness** — `_await_or_default`
   ([chat_ws.py:1191-1219](chatbotAgent/app/api/chat_ws.py#L1191-L1219)): every pipeline stage
   races a timeout and degrades to a typed default instead of failing the turn.

**Exact numbers** (defaults from [env.py](chatbotAgent/app/core/env.py) /
[connections.py:32-40](chatbotAgent/app/core/connections.py#L32-L40)):

| Knob | Value |
|---|---|
| Azure client / call timeout | 12 s client, 8 s `guarded_call` |
| Groq timeout | 5 s SDK / 4 s signal call |
| GLM timeout | 6 s |
| Signal extraction stage | 6 s |
| Embedding stage | 4 s |
| Memory retrieval stage | 2 s |
| LLM generation stage | 20 s |
| Safety gate stage | 10 s |
| Static fallback fetch | 1 s |
| Harm retries / sycophancy / tone / length retries | 2 / 1 / 1 / 1 |
| Chat rate limit | 40 turns/user/day prod, 1000 dev |
| Azure `max_completion_tokens` | 4000 (reasoning budget included) |
| Session TTL (Redis) | 1500 s |

---

## 4. The Safety Gate (honest version)

⚠️ **It is not a "3-layer gate"** — describe it as **pre-LLM crisis bypass (2 checkpoints)
+ post-LLM 5-check gate + provider content-filter handling**.

**Pre-LLM crisis bypass** ([crisis_bypass.py:71-166](chatbotAgent/app/pipeline/crisis_bypass.py#L71-L166)):
triggered only by `urgency_score == 3`, which comes from the **Groq LLM signal extractor**
(prompted rules at [signal_extraction.py:55-58](chatbotAgent/app/pipeline/signal_extraction.py#L55-L58)).
⚠️ **CLAUDE.md claims a "Lexical + Groq-LLM confirmer" in crisis_bypass.py — there is no
lexical crisis-keyword layer anywhere in the backend.** (The only `CRISIS_KEYWORDS` list
lives in the *frontend* MindGym overlay, [types.ts:73](src/lib/mindgym/types.ts#L73).) The
regex passive monitor ([signal_extraction.py:144-147](chatbotAgent/app/pipeline/signal_extraction.py#L144-L147))
can only escalate to urgency **2**, never 3. Consequence, stated plainly: **if Groq is
down, tier-3 crisis detection is down** — `_fallback_signals` reuses the last known
urgency ([chat_ws.py:1230-1242](chatbotAgent/app/api/chat_ws.py#L1230-L1242)), which is 0 on a
first message. Crisis *response* text is clinician-authored: Supabase `crisis_templates`
with a **2-approver governance flow** ([admin.py](chatbotAgent/app/api/admin.py),
[v3_schema.sql:143-158](scripts/migrations/v3_schema.sql#L143-L158)), falling back to
hardcoded strings with iCall/Vandrevala numbers ([env.py:318-342](chatbotAgent/app/core/env.py#L318-L342)).

**Post-LLM gate** — 5 checks in [safety_gate.py](chatbotAgent/app/pipeline/safety_gate.py):
1. **Harm** — Groq `llama-3.1-8b-instant`, temp 0, JSON mode, combined prompt
   ([safety_gate.py:45-60](chatbotAgent/app/pipeline/safety_gate.py#L45-L60)); up to 2
   regenerations (via Groq 70B, lowered temperature) then static fallback.
2. **Sycophancy** — same Groq call; 1 regeneration.
3. **Hallucination** — **skipped, a TODO** ([safety_gate.py:207-210](chatbotAgent/app/pipeline/safety_gate.py#L207-L210)).
4. **Tone conformance** — pure-Python heuristics (code-mix ratio, sentence length,
   question count), threshold 0.65; 1 regeneration.
5. **Length** — min 10 tokens (3 for active_listener), truncate at sentence boundary.

**Critical honesty point — the gate fails OPEN:** if the Groq classifier is unavailable,
the response is *allowed through* with `harm=None`
([safety_gate.py:151-159](chatbotAgent/app/pipeline/safety_gate.py#L151-L159), logged as
`degraded_allow`). Combined with the crisis-detection dependency above, a total Groq
outage degrades both input and output safety simultaneously — the remaining protections
are the system prompt, Azure's content filter (which short-circuits to static fallback,
[chat_ws.py:985-1006](chatbotAgent/app/api/chat_ws.py#L985-L1006)), and the regex passive monitor.

**"Routes to human" reality:** there is **no human alerting**. A tier-3 event produces:
the template response, a `tier3_trigger` row in `audit_logs`
([crisis_bypass.py:129-145](chatbotAgent/app/pipeline/crisis_bypass.py#L129-L145)), a
`recent_crisis_flag` on the user's longitudinal row that quiets the landing-page ambience
for 24 h ([session_end_worker.py:185-250](chatbotAgent/app/jobs/session_end_worker.py#L185-L250)),
and PostHog telemetry. Nobody is paged. The therapist bridge
([therapist_bridge.py](chatbotAgent/app/api/therapist_bridge.py)) is *user-initiated*
referral, not escalation. A `counsellor_dashboard` feature flag exists but defaults off
([env.py:382-388](chatbotAgent/app/core/env.py#L382-L388)).

**Evaluation status:** real harness, tiny sample. `run_full_evaluation.py` +
`tests/rag_evaluator.py` + an optional Groq LLM-judge produce
[rag_evaluation_report.json](chatbotAgent/rag_evaluation_report.json): **6 multi-turn
cases** (dated 2026-04-10), pass rate 83.3%, **2/2 crisis cases passed**, 0 critical
failures, avg end-to-end latency **11,445 ms**. 13 historical runs in
`evaluations/history/runs.jsonl`. Unit tests cover crisis phrase→urgency mappings and
gate mechanics ([test_crisis_bypass.py](chatbotAgent/tests/unit/pipeline/test_crisis_bypass.py),
[test_safety_gate.py](chatbotAgent/tests/unit/pipeline/test_safety_gate.py)). **There is no
false-positive/false-negative rate for the harm classifier or the urgency scorer** — no
labelled dataset at meaningful scale. Say: "validated for mechanics and known crisis
phrases; not statistically validated for classifier accuracy."

---

## 5. Data Isolation & RLS

**Two schema sources feed one Supabase Postgres** — flag this proactively:
[scripts/migrations/v3_schema.sql](scripts/migrations/v3_schema.sql) (backend v3 tables,
run manually) and [supabase/migrations/](supabase/migrations/) (19 CLI migration files,
frontend-era tables). ⚠️ "12 tables" is not accurate in either direction: v3_schema.sql
creates **10 tables** (all RLS-enabled, [v3_schema.sql:176-185](scripts/migrations/v3_schema.sql#L176-L185));
supabase/migrations created ~30 more over time, of which
[20260601000000_production_cleanup.sql](supabase/migrations/20260601000000_production_cleanup.sql)
dropped 10 dead ones — but the **12 `mitra_*` tables** from the deleted MITRA v2 pipeline
([20260420120000_mitra_memory_v2.sql](supabase/migrations/20260420120000_mitra_memory_v2.sql))
were *not* dropped and have zero code references. Every `CREATE TABLE` in the repo does
enable RLS; the RLS-less migration files are ALTER-only.

Real policy definitions to quote live:

```sql
-- v3_schema.sql:189-190 — users: owner-only select via auth linkage
CREATE POLICY users_self_select ON public.users
    FOR SELECT USING (auth.uid() = auth_id);

-- v3_schema.sql:199-203 — profile tables resolve ownership through users
CREATE POLICY user_semantic_self ON public.user_semantic_profiles
    FOR ALL USING (
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    );

-- 20250905…sql:94-95 — frontend chat transcript table
CREATE POLICY "Users can manage their own chat messages" ON chat_messages
    FOR ALL USING (auth.uid() = user_id);
```

`audit_logs` is deny-all by construction: RLS enabled, **no policies**
([v3_schema.sql:233-234](scripts/migrations/v3_schema.sql#L233-L234)) — service-role only.

**The honest answer to "DB-enforced or app-enforced?" is: both, split by path.**
- **Browser → Supabase** (chat_messages sidebar history, mood_logs, settings, MindGym
  clinical sync, therapist referrals): anon-key client → **RLS-enforced at the DB**.
- **Backend → Supabase**: the FastAPI service uses the **service-role key**
  ([connections.py:374](chatbotAgent/app/core/connections.py#L374)), which **bypasses RLS
  entirely**. Isolation on the chat hot path is **application-layer**: `user_id` from
  the JWT, explicit `.eq("user_id", …)` filters in
  [profile_service.py](chatbotAgent/app/services/profile_service.py), plus a session-ownership
  check ([chat_ws.py:219-220](chatbotAgent/app/api/chat_ws.py#L219-L220)). This is a
  documented invariant ([v3_schema.sql:11-12](scripts/migrations/v3_schema.sql#L11-L12),
  CLAUDE.md invariant #3), but it is convention-enforced, not schema-enforced — one
  missed filter in a service-role query is a cross-user leak. **Qdrant has no RLS
  concept at all**: isolation is purely the `user_id` payload filter at
  [memory_retrieval.py:213-219](chatbotAgent/app/pipeline/memory_retrieval.py#L213-L219).

---

## 6. Memory System

⚠️ **mem0 is gone.** Zero imports anywhere in `chatbotAgent/app` — the only traces are a
test fixture and a comment in production_cleanup.sql. If you've been saying "mem0 +
Qdrant", correct it to: **custom 4-channel memory (episodic/semantic/procedural/
longitudinal), Qdrant for episodic vectors, Supabase JSONB for the rest.**

How compounding memory actually works:
- **Write (session end)** — [episodic_write.py:45-67](chatbotAgent/app/memory/episodic_write.py#L45-L67):
  Gemini 1.5 Flash summarises the full transcript to 80–120 words (Groq 8B fallback),
  local **`sentence-transformers/all-MiniLM-L6-v2`** (384-dim,
  [env.py:280-286](chatbotAgent/app/core/env.py#L280-L286)) embeds it, Qdrant upsert with
  payload `{user_id, summary_text, affect_mean, ending_affect, topic_keywords,
  peak_urgency, named_entities, techniques_used}`. If any step fails, the raw transcript
  goes to a `failed_summaries` dead-letter table for operator replay
  ([episodic_write.py:49-65](chatbotAgent/app/memory/episodic_write.py#L49-L65)).
  Parallel writers: semantic facts (Groq → `user_semantic_profiles` JSONB), procedural
  style EMA (pure Python), longitudinal affect slope → `longitudinal_risk_flag`, which
  escalates urgency by +1 on later turns ([signal_extraction.py:165-171](chatbotAgent/app/pipeline/signal_extraction.py#L165-L171)).
- **Read (per turn)** — dual-channel scoring
  ([memory_retrieval.py:110-142](chatbotAgent/app/pipeline/memory_retrieval.py#L110-L142)):
  harmonic mean of Qdrant cosine similarity and affect-distance similarity, thresholds
  0.62/top-2 or 0.75/top-1. Embeddings of user messages are Redis-cached 1 h
  ([embedding.py:50-83](chatbotAgent/app/memory/embedding.py#L50-L83)).

**Bloat/staleness honesty:** growth is **unbounded** — one Qdrant point per session per
user, no dedup, no decay, no consolidation of old points, no cap. Mitigations are
read-side only (top-2 cap + thresholds + a recency-worded `relative_date`). A
`memory_scoring_upgrade` migration created `memory_metadata`/`user_memory_stats` tables
for scored memory, but the v3 hot path doesn't read them. Also a real bug to own before
someone finds it: **`techniques_used` is always written as `[]`**
([episodic_write.py:192](chatbotAgent/app/memory/episodic_write.py#L192)), so the "don't
re-suggest a technique they just did" suppression at
[chat_ws.py:806-823](chatbotAgent/app/api/chat_ws.py#L806-L823) **can never fire**.

---

## 7. Known Weak Points (top 5, brutally honest)

1. **Groq is a safety single-point-of-failure and the system fails open.** Signal
   extraction (urgency scoring), the harm/sycophancy classifier, and safety-retry
   generation all run on Groq. Outage ⇒ urgency falls back to last-known
   ([chat_ws.py:1230-1242](chatbotAgent/app/api/chat_ws.py#L1230-L1242)), tier-3 detection
   effectively off (regex monitor caps at 2), and unvetted LLM output is allowed
   (`degraded_allow`, [safety_gate.py:151-159](chatbotAgent/app/pipeline/safety_gate.py#L151-L159)).
   No backend lexical crisis keyword layer exists despite CLAUDE.md claiming one.

2. **Latency: no streaming to the client.** WS is unregistered; chunks are buffered
   server-side and the user waits for the *entire* pipeline — own eval shows **avg
   11.4 s** per turn. GPT-5 reasoning TTFT + a 10 s safety gate stack additively. This is
   the first thing a CTO will feel in a demo.

3. **Single replica + in-process state.** Railway `numReplicas = 1`; circuit breakers,
   the in-memory rate-limit fallback ([session_service.py:494-501](chatbotAgent/app/services/session_service.py#L494-L501)),
   embedding model (2-thread pool), and the session-end worker all live in the web
   process. 10x load means scaling out, and several of these silently stop being correct
   (unshared breaker state, unshared rate counts); the session-end distributed lock is
   the only multi-instance-aware piece.

4. **App-layer-only isolation on the hot path + schema drift.** Service-role bypasses
   RLS (§5); Qdrant isolation is one payload filter. Two migration systems, 12 dead
   `mitra_*` tables still in the DB, `production_cleanup.sql` says "13 tables" and lists
   12, and legacy service code ([supabase_service.py](chatbotAgent/app/services/supabase_service.py))
   still reads `session_summaries`/`user_contexts` that the v3 pipeline never writes.

5. **Thin observability + unvalidated safety accuracy.** Sentry (5% traces) + PostHog +
   structured logs exist, but no metrics/alerting on the things that matter (fallback-chain
   rate, circuit-open events, `degraded_allow` count, crisis-template fetch failures).
   Eval evidence is 6 cases / 13 runs; harm-classifier FP/FN rates unknown. Honest frame:
   "instrumented, not yet observable; evaluated for mechanics, not accuracy."

Also worth pre-empting if pushed for a 6th: rate limiting fails open; `daily_azure_token_budget`
exists in env ([env.py:308-314](chatbotAgent/app/core/env.py#L308-L314)) but nothing enforces it.

---

## 8. Metrics I Can State With Confidence

| Claim | Verified number | Source |
|---|---|---|
| Backend LOC (app) | **12,935** Python | `wc -l` over `chatbotAgent/app` |
| Backend test LOC / tests | **3,238** LOC, **138** test functions | `chatbotAgent/tests` |
| Frontend LOC | **55,782** TS/TSX | `wc -l` over `src` |
| LLM providers | **4** (Azure OpenAI, Groq, GLM, Gemini) + Azure Speech | [connections.py:32-40](chatbotAgent/app/core/connections.py#L32-L40) |
| LLM models in use | 6 (gpt-5-mini, llama-3.1-8b, llama-3.3-70b, whisper-v3-turbo, glm-4-flash, gemini-1.5-flash) | env.py defaults |
| Chat modes | **4 active** (companion, active_listener, recovery_check, referral_bridge); 2 flagged off | [orchestrator.py:8-9](chatbotAgent/app/pipeline/orchestrator.py#L8) |
| Backend v3 tables | **10** (all RLS-enabled) | [v3_schema.sql](scripts/migrations/v3_schema.sql) |
| MindGym tools | **16** registered | [types.ts:26-43](src/lib/mindgym/types.ts#L26-L43) |
| Personalities | **5** (mitra, arjun, diya, riya, zen) — static TS data; the DB table was dropped as unused | [personalities.ts](src/data/personalities.ts), cleanup migration |
| Crisis template languages | 4 variants (en, hi, hinglish_formal, hinglish_casual); 7 chat languages | [crisis_bypass.py:27-50](chatbotAgent/app/pipeline/crisis_bypass.py#L27-L50), [chat_ws.py:101-103](chatbotAgent/app/api/chat_ws.py#L101-L103) |
| Eval results | 6 cases, 83.3% pass, 2/2 crisis, avg 11.4 s latency | rag_evaluation_report.json |

**Stop claiming (code doesn't support it):** "mem0", "GPT-4o primary", "5 LLM providers",
"3-layer safety gate", "lexical crisis detection", "12 RLS tables", any live user count,
and "human escalation" (it's a DB flag + audit row, not a human).

---

## 9. Likely Interview Questions + Where To Point

**"Walk me through what happens if your primary LLM provider goes down mid-request."**
→ [llm_core.py:76-173](chatbotAgent/app/pipeline/llm_core.py#L76-L173) (`generate_response`
loop — Azure fails → `_error_result` → Groq 70B → GLM if companion/urgency-0 → all-fail
returns error result) and [connections.py:200-257](chatbotAgent/app/core/connections.py#L200-L257)
(`guarded_call` — timeout, transient-only retry, circuit opens after 3 failures/60 s so
subsequent requests skip Azure instantly). Then the caller's static-fallback ladder:
[chat_ws.py:944-966](chatbotAgent/app/api/chat_ws.py#L944-L966). Mid-*stream* failure with
partial text: [llm_core.py:407-416](chatbotAgent/app/pipeline/llm_core.py#L407-L416) — kept
pieces or error. Bonus detail: because HTTP buffers chunks, a mid-stream provider death
is invisible to the user; they just get the fallback.

**"How do you actually enforce per-user data isolation?"**
→ Both layers, honestly split: RLS for direct client access
([v3_schema.sql:176-245](scripts/migrations/v3_schema.sql#L176-L245) — quote `users_self_select`
and the deny-all `audit_logs`), but the backend runs service-role which bypasses RLS, so
the hot path is app-enforced: JWT→user_id at [chat_ws.py:145-167](chatbotAgent/app/api/chat_ws.py#L145-L167),
session-ownership check at [chat_ws.py:219-220](chatbotAgent/app/api/chat_ws.py#L219-L220),
explicit `.eq("user_id")` in [profile_service.py](chatbotAgent/app/services/profile_service.py),
and the Qdrant `must`-filter at [memory_retrieval.py:213-219](chatbotAgent/app/pipeline/memory_retrieval.py#L213-L219).

**"What's your eval story for the safety gate — how do you know it works?"**
→ Mechanics: [tests/unit/pipeline/test_safety_gate.py](chatbotAgent/tests/unit/pipeline/test_safety_gate.py)
and [test_crisis_bypass.py](chatbotAgent/tests/unit/pipeline/test_crisis_bypass.py). End-to-end:
[run_full_evaluation.py](chatbotAgent/run_full_evaluation.py) → [rag_evaluation_report.json](chatbotAgent/rag_evaluation_report.json)
(multi-turn staged-disclosure design, LLM judge, 2/2 crisis pass). Then concede the gap
yourself: n=6, no classifier FP/FN rates, gate fails open on Groq outage
([safety_gate.py:151-159](chatbotAgent/app/pipeline/safety_gate.py#L151-L159)) — and state
the fix you'd ship (lexical tier-3 pre-filter + fail-closed-to-template on classifier
outage + labelled eval set).

**"What's the messiest part of this codebase right now?"**
→ The DB layer: two migration systems ([scripts/migrations/](scripts/migrations/) vs
[supabase/migrations/](supabase/migrations/)), 12 orphaned `mitra_*` tables from the
deleted v2 pipeline, legacy reads in [supabase_service.py](chatbotAgent/app/services/supabase_service.py),
and duplicate chat persistence (frontend writes `chat_messages` for UX while the backend
keeps its own Redis+Qdrant session state). Plus the dead `techniques_used` logic
([episodic_write.py:192](chatbotAgent/app/memory/episodic_write.py#L192) vs
[chat_ws.py:806-823](chatbotAgent/app/api/chat_ws.py#L806-L823)). Naming these yourself,
with file paths, is the credibility move.
