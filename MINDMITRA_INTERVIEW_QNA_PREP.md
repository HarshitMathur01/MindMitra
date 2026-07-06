# MindMitra — CTO Interview Q&A Prep

Companion to `MINDMITRA_UNDERSTANDING_BRIEF.md`. Format per question:
**Answer** = what to say out loud (30–60 s), **Show** = file to pull up if asked,
**Trap** = the follow-up they're fishing for and how to handle it.

**The one technique that matters:** concede-then-fix. This CTO explicitly wants
honest failure-mode awareness. Every weak spot below has a one-line concession
and a one-line fix ready. Volunteering a flaw before they find it is worth more
than defending it.

---

## 0. The 60-second opening (memorize the shape, not the words)

> "MindMitra is a mental-health companion for Indian college students — the layer
> before therapy. The core architectural bet is deterministic safety over LLM
> autonomy: crisis responses are clinician-authored templates served by pure
> Python with no LLM in the path, every LLM output passes a post-hoc safety gate,
> and every external dependency has a timeout plus a typed fallback, so a turn
> always returns something. Stack is React on Vercel, FastAPI on Railway, Supabase
> for auth/profiles/audit, Redis for live sessions, Qdrant for episodic memory,
> four LLM providers split by job: Azure GPT-5-mini for generation quality, Groq
> for everything latency-critical, GLM as a fenced low-stakes fallback, Gemini
> off the hot path for summaries. It's a beta-stage system — I'll be upfront
> about what's proven and what's scaffolding."

That last sentence buys you credibility for the whole hour.

---

## 1. Reliability / failure modes

### Q: "Azure dies mid-request. What does the user see?"
**Answer:** "The provider loop catches it and falls through: Azure → Groq
Llama-70B → GLM, in order — GLM only if it's a calm companion-mode turn, it's
hard-blocked for any elevated urgency. Separately a circuit breaker counts
failures — 3 in a 60-second window opens the circuit, so subsequent requests skip
Azure instantly instead of eating the 8-second timeout, half-open retry after 60
seconds. If all three providers fail, the safety gate serves a static template
from Supabase with a 1-second budget, and if *that* fails, a hardcoded string.
The user always gets a response; the `fallback_chain` actually exercised is
written to the audit log. One nuance: since HTTP buffers chunks server-side, a
mid-stream death is invisible to the user — they just get the fallback."
**Show:** `llm_core.py:76-173` (loop), `connections.py:41-43,200-257` (breaker),
`chat_ws.py:944-966` (static ladder).
**Trap:** "Is the breaker state shared across instances?" → "No — in-process
memory. Fine at our current single replica; it's on the scale-out checklist
along with the rate limiter."

### Q: "Redis dies. What breaks?"
**Answer:** "Four things degrade, none fatally, but one loses data. Sessions
fall back to a per-process in-memory dict — the conversation continues but with
no persistence across restarts. The rate limiter falls back to an in-memory
counter and, on transient errors, fails open — availability over enforcement,
a deliberate call for a mental-health product. Embedding cache misses just cost
~50 ms of CPU. The real loss: session-end memory consolidation is triggered by
Redis TTL expiry, so with Redis down those sessions never consolidate — the
episodic memory for that session is lost. Circuit breaker plus pool-reset logic
handles the managed-Redis dropped-connection case specifically."
**Show:** `session_service.py:35-49,486-516`, `connections.py:236-249`.
**Trap:** "Fails open — really?" → own it: "Yes. For this product a user in
distress getting 'try again tomorrow' because Redis hiccuped is the worse
failure. It's logged as an error every time it happens."

### Q: "Supabase down?"
**Answer:** "Profiles load as defaults — the user gets a generic-toned but
working conversation. Crisis templates fall back to hardcoded strings with the
same helpline numbers, so the crisis path survives a full Supabase outage. Audit
logs and activity feedback are fire-and-forget — they fail silently by design so
they can never block a turn. Failed memory writes go to `failed_summaries` /
`failed_extractions` dead-letter tables for replay."
**Show:** `crisis_bypass.py:101-115`, `env.py:318-342` (hardcoded templates),
`episodic_write.py:49-65` (dead-letter).
**Trap:** "Who replays the dead-letter queue?" → "Today, manually. No worker
exists yet — it's a table plus an operator, honestly."

### Q: "Why is a turn taking 8–15 seconds?" (they will feel this in any demo)
**Answer:** "Three additive costs: GPT-5-mini is a reasoning model so time-to-
first-token is high even at `reasoning_effort=low`; the safety gate runs *after*
generation completes and can add a Groq classification plus up to two
regenerations; and we deliberately disabled streaming to the client while
stabilizing — the WebSocket handler exists but is unregistered, so chunks buffer
server-side. Our own eval measured 11.4 s average. The fix path is known:
re-enable streaming with the safety gate operating on the buffered tail, or
switch the replace-event UX we already have — the frontend already handles
`confirmed` vs `replace` events."
**Trap:** "So users wait 11 seconds staring at a spinner?" → "Yes, with a
thinking animation. It's the #1 UX debt and it's a transport decision, not an
architecture rewrite."

### Q: "What happens at 10x load?"
**Answer:** "Honest answer: the first bottleneck isn't the LLMs, it's that we
run one Railway replica with in-process state — the embedding model on a
2-thread CPU pool, circuit breakers, and the rate-limit fallback all live in the
web process. Scaling out is mechanically easy (stateless FastAPI, Redis-backed
sessions, a distributed lock already guards session-end double-fires) but three
things silently stop being correct: breaker state, in-memory rate counts, and
the keyspace-event listener needs exactly-one-consumer thinking. Second
bottleneck is provider rate limits — there's a `daily_azure_token_budget` env
var but nothing enforces it yet. I'd sequence: extract embedding to a service or
switch to an API, move breaker state to Redis, then scale replicas."
**Trap:** "Have you load-tested?" → "No. 138 tests cover contracts and
mechanics; no load tests exist. It's on the list before any scale event."

### Q: "Deploy / rollback story?"
**Answer:** "Dockerfile on Railway, healthcheck on `/health`, restart-on-failure
×3. Frontend is Vercel with CSP headers. Kill switch: `MHA_V3_ENABLED=0` takes
chat offline returning 503 while health stays green. Startup validates the full
env contract and hard-fails loud in prod on missing secrets — that's tested in
`tests/integration/test_env_contract.py`."

---

## 2. Safety (expect the deepest probing here)

### Q: "How do you *know* a suicidal message gets the crisis response?"
**Answer:** "Two checkpoints per turn: before signal extraction — if the
previous turn was urgency 3 — and after, on the fresh score. Urgency comes from
a Groq structured-JSON extractor with explicit rules, including Hindi phrase
families like 'jeena nahi chahta', and an instruction to never lower urgency for
regional languages. A regex passive monitor independently catches farewell
patterns and repeated hopelessness and escalates. At urgency 3 everything else
is skipped — no LLM touches the response; the template is clinician-authored,
stored in Supabase behind a two-approver governance flow, hardcoded fallback if
Supabase is down. Both checkpoints are unit-tested with the phrase list.
Now the honest part —" *(go straight into the next answer before they ask)*
**Show:** `chat_ws.py:624-654,708-733`, `signal_extraction.py:38-60`,
`crisis_bypass.py`, `admin.py` (2-approver).

### Q: "What if Groq — your safety classifier — is down?" ⚠️ THE question
**Answer:** "Then I have a real gap, and I'd rather name it than have you find
it. Groq carries three safety jobs: urgency scoring, the output harm classifier,
and safety regenerations. On outage, signal extraction falls back to
last-known urgency — zero on a first message — and the regex monitor caps at
urgency 2, so tier-3 detection is effectively down. The output gate explicitly
fails *open*: it logs `degraded_allow` and lets the response through with only
Python checks. Remaining protections are the system prompt, Azure's content
filter, and the passive monitor. The fix is scoped and cheap: a lexical tier-3
keyword pre-filter in ingestion — pure Python, no dependency — and flipping the
gate to fail-closed-to-static-template when the classifier is unreachable.
Neither is shipped yet."
**Show:** `safety_gate.py:151-159` (`degraded_allow`), `chat_ws.py:1230-1242`
(fallback signals).
**Why volunteer it:** the brief found that CLAUDE.md *claims* a lexical layer
exists. If they've read any docs, claiming it works would be caught as a lie.

### Q: "Why trust an 8B model as a harm classifier?"
**Answer:** "Deliberate trade: the gate has a 10-second budget and the
classifier runs on every turn — 8B at temperature 0 with JSON schema output is
~300 ms. The prompt is narrow: harm categories plus sycophancy, with an explicit
carve-out that reflecting emotion isn't sycophancy. But I won't overclaim: we
have no measured false-positive/false-negative rates. The eval harness exists
and passed 2/2 crisis cases, but n=6. Building a labelled set for the classifier
specifically is the next eval milestone."

### Q: "What does 'escalate to a human' mean in your system?"
**Answer:** "Today: nothing automatic, and I want to be precise about that. A
tier-3 event produces the template with helpline numbers, an audit-log row, a
24-hour crisis-cooldown flag that quiets the app's landing experience, and
telemetry. Nobody is paged. The therapist bridge is user-initiated referral with
consented profile snapshots — it's a bridge, not an escalation. A counsellor
dashboard exists as a feature flag, off. For the target population, unsolicited
human contact has real privacy risks in hostel environments — so 'no silent
human alerting' is partly a product stance, but the monitoring gap (nobody
reviews tier-3 events on any cadence) is just a gap."

### Q: "Can users jailbreak it?"
**Answer:** "The gate checks *output*, not input intent — that's deliberate: a
jailbreak only matters if it produces harmful output, and that's exactly what
the harm classifier and Azure's content filter see. Input side we do PII
redaction pre-LLM and length/content validation. What we don't have is
adversarial red-teaming at scale — the eval set has staged-disclosure and
boundary cases, but no systematic jailbreak suite."

---

## 3. Data isolation & privacy

### Q: "Isolation — DB-enforced or app-enforced?"
**Answer:** "Split by path, and I'll give you the honest version. Browser-to-
Supabase traffic — chat history sidebar, mood logs, settings — uses the anon key
and is RLS-enforced at the DB; I can show the policies. The backend uses the
service-role key, which bypasses RLS — so the chat hot path is app-enforced:
user_id comes only from the JWT, never from the request body, there's an
explicit session-ownership check, and every service-role query filters user_id.
That's a documented invariant with the failure mode named in the schema file
itself. Qdrant has no RLS concept at all — isolation there is a mandatory
user_id payload filter on every search. App-enforced is weaker than
DB-enforced; the mitigation is that the pattern is uniform and greppable, and
the strongest tables — audit_logs — are deny-all to clients."
**Show:** `v3_schema.sql:11-12,176-245`, `chat_ws.py:219-220`,
`memory_retrieval.py:213-219`.
**Trap:** "Why not run backend queries as the user with RLS?" → "Legitimate
hardening step — Postgres `set role` / JWT-passthrough via PostgREST. Cost is
per-request connection semantics; it's on the roadmap, not done."

### Q: "DPDP compliance — deletion, data residency?" ⚠️ know this cold
**Answer:** "Three layers of honesty. What's real: PII redaction happens in
ingestion before any LLM sees text; raw transcripts live only in Redis with a
25-minute TTL; long-term memory is an 80–120-word summary, not the transcript;
audit logs are metadata-only, no content. What's partial: deleting a Supabase
user cascades through every Postgres table via FK — but there is **no deletion
path for Qdrant**; episodic memory vectors survive account deletion today.
That's a genuine right-to-erasure gap and the fix is a single
delete-by-user_id-filter call in an account-deletion endpoint that doesn't exist
yet. Also: the frontend writes full chat transcripts to `chat_messages` for the
sidebar — RLS-protected, but it means transcripts *do* persist in Postgres via
the client path even though the backend deliberately doesn't store them. On
residency: region config lives in the deployment dashboards, not the repo — I
can verify Supabase/Railway/Qdrant regions but won't claim them from code."
**Trap:** "So your product docs say 'delete at any time' and the code can't?" →
"Correct, and that mismatch is exactly why I audited this before shipping a
compliance claim to anyone."

---

## 4. Memory

### Q: "Why custom memory instead of mem0 / LangChain?"
**Answer:** "We ran mem0 in an earlier iteration and removed it. Reasons:
deterministic token budgets — every prompt block has a hard cap and I need to
reason about worst-case prompt size; a retrieval signal generic frameworks don't
have — we score memories by harmonic mean of topic similarity *and* affect
similarity, so a memory that matches topically but is emotionally alien doesn't
get injected; and fewer abstraction layers on a safety-critical path. Cost was
owning the write pipeline — Gemini summary, MiniLM embed, Qdrant upsert, with a
dead-letter table when it fails."
**Show:** `memory_retrieval.py:110-142` (harmonic scoring), `episodic_write.py`.

### Q: "What stops memory from growing forever / going stale?"
**Answer:** "Read side is bounded: top-2 memories max, similarity thresholds,
recency phrased into the prompt. Write side is honestly unbounded — one vector
per session, no dedup, no decay, no consolidation. At current scale that's
kilobytes per user per month, so it's the right corner to cut; the designed fix
is periodic consolidation of old points into monthly rollups. There's also a
small bug I'll name before you find it: the technique-tracking field is written
empty, so the 'don't re-suggest an exercise they just did' logic can never fire.
Found it in this audit; one-line fix in the payload builder."
**Show:** `episodic_write.py:192` vs `chat_ws.py:806-823`.

---

## 5. Architecture choices (why-questions)

- **"Why request/response HTTP, not streaming?"** — "Stabilization decision
  while chasing latency and dependency bugs; the WS handler is written and
  unregistered, one line to bring back. The event protocol (`chunk` /
  `confirmed` / `replace` / `crisis`) already assumes streaming, so the client
  contract won't change."
- **"Why four providers instead of one?"** — "Split by job, not redundancy
  theater: Azure for generation quality, Groq because the safety gate and signal
  extraction have sub-second budgets Azure can't meet, GLM as a free-tier
  fallback fenced to zero-stakes turns by an assert, Gemini for long-context
  summaries off the hot path. Each also serves as fallback for its neighbors."
- **"Why a local embedding model?"** — "MiniLM at 384-dim is ~50 ms on CPU, free,
  and removes a network dependency from the per-turn path; embeddings are also
  Redis-cached an hour. Trade-off is in-process CPU and English-biased
  embeddings for Hinglish text — a known quality ceiling."
- **"Why is mode selection pure Python rules and not an LLM?"** — "Auditability.
  When a distressed user gets routed, I can point to the exact rule that fired —
  it's in the audit log as `mode_change_reason`. An LLM router would be
  unexplainable in an incident review."

---

## 6. Rapid-fire numbers (say these without looking)

| Question | Answer |
|---|---|
| Backend / frontend size | ~12.9k LOC Python app, ~3.2k tests (138 tests), ~55.8k TS/TSX |
| Providers | 4 LLM (Azure, Groq, GLM, Gemini) + Azure Speech |
| Timeouts | Azure 8s, Groq 4–5s, generation stage 20s, safety gate 10s, memory 2s |
| Circuit breaker | 3 failures / 60s window, half-open after 60s |
| Retries | transient-only (429/503), 2 max, exp backoff from 0.5s |
| Rate limit | 40 turns/user/day (Redis, UTC reset), fails open |
| Session | Redis, TTL 1500s = 25 min |
| Crisis | 2 checkpoints, 4 template variants, 2-approver governance, 0 LLM calls |
| Safety gate | 5 checks; harm 2 retries, syco/tone/length 1 each; conformance ≥0.65 |
| Memory | MiniLM 384-dim, harmonic topic×affect, top-2 @ 0.62 / top-1 @ 0.75 |
| Eval | 6 multi-turn cases, 83.3% pass, 2/2 crisis, 11.4s avg latency, 13 runs |
| Modes | 4 active + 2 feature-flagged off |
| MindGym / personalities | 16 tools / 5 personalities |
| Deploy | Railway 1 replica + Vercel; kill switch `MHA_V3_ENABLED=0` |

---

## 7. Never say / always say

**Never say** (code contradicts it): "mem0" · "GPT-4o" · "5 LLM providers" ·
"3-layer safety gate" · "lexical crisis detection" (backend has none) ·
"12 RLS tables" · "users can delete their memory" (no Qdrant deletion) ·
"human escalation" · any live user count · "battle-tested at scale".

**Always say:** "deterministic safety over LLM autonomy" · "a turn always
returns something" · "fails open — deliberately, and logged" (rate limit) vs
"fails open — a gap with a scoped fix" (safety classifier) · "app-enforced with
a uniform, greppable pattern" (isolation) · "instrumented, not yet observable" ·
"evaluated for mechanics, not yet for classifier accuracy".

**If you don't know:** "I don't know off-hand — my instinct is X because Y, and
I'd verify in <file>." Never guess numbers; you have real ones.

---

## 8. Dry-run drill (do this once tonight)

Answer these five out loud, no notes, 45 seconds each. They cover every theme:
1. Azure dies mid-request — walk me through it.
2. Groq dies — what happens to safety?
3. Prove user A can't read user B's memories.
4. How do you know the safety gate works?
5. What would you fix first with one engineer-week?
   *(Suggested: lexical tier-3 pre-filter + fail-closed gate — safety; then
   Qdrant deletion endpoint — compliance; then streaming — UX.)*
