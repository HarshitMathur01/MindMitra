# API Contracts (MHA v3)

This is the **only** supported API surface. Chat uses simple HTTP
`POST /chat`. The legacy SSE endpoints (`/chat/stream`, `/chat/greeting`,
`/chat/end-session`, `/me-memory`) and the WebSocket chat route are not
registered.

## Base

- Protocol: HTTPS
- Auth: Supabase JWT in `Authorization: Bearer <jwt>`.
- Content type: `application/json` unless otherwise stated.

## Error format

HTTP errors:

```json
{ "detail": "error message" }
```

Some validation errors return a structured `detail` object with `message`
and `reason`.

---

## 1) POST `/chat`

Request/response chat endpoint. The same 8-layer MHA pipeline runs here,
but the frontend receives one final JSON response instead of streamed frames.

### Request

```json
{
  "content": "Hello yaar",
  "session_id": "new | <uuid>",
  "device_locale": "en-IN"
}
```

### Response

```json
{
  "text": "<final response>",
  "session_id": "uuid",
  "is_new_session": true,
  "mode": "companion",
  "urgency": 0,
  "source": "llm_primary",
  "meta": {
    "response_source": "llm_primary",
    "memory_retrieved": false
  },
  "timings_ms": { "total": 2500 },
  "trace_id": "optional"
}
```

The `meta.response_source` field tells you which path produced the text:
`llm_primary | llm_retry | static_fallback | crisis_template | hardcoded_crisis`.

---

## 2) POST `/onboarding`

Four-turn conversational onboarding. The frontend drives the turn
counter; the backend is stateless across turns (the client carries
`session_state` between requests).

### Request

```json
{
  "turn": 1 | 2 | 3 | 4,
  "user_message": "string | null",
  "session_state": { "...": "carry between turns" }
}
```

### Response

```json
{
  "agent_message": "string",
  "next_turn": 2 | 3 | 4 | null,
  "onboarding_complete": false | true,
  "session_state": { "...": "updated carry-state" }
}
```

When `onboarding_complete: true` the backend has written:

- `users.onboarding_complete = TRUE`
- `user_semantic_profiles` (display_name, occupation_detail, city,
  cultural_frame_id, language_baseline)
- `user_longitudinal_trajectory` (day-0 affect entry)

---

## 3) POST `/transcribe`

Voice STT fallback (Groq Whisper). Returns a transcript for the WAV
payload uploaded by the browser.

### Request

```json
{ "audio_data": "base64-wav-or-data-url" }
```

### Response

```json
{ "transcript": "string", "model": "groq-whisper-large-v3-turbo" }
```

---

## 4) POST `/admin/crisis-templates`

Create a new crisis template (sets `active = false` — must pass
two-approver flow before going live). Requires `X-Admin-Key` header.

### Request

```json
{ "language_variant": "en|hi|hinglish_casual|hinglish_formal|neutral", "content": "..." }
```

### Response

```json
{ "id": "uuid" }
```

---

## 5) POST `/admin/crisis-templates/{id}/approve`

Two **distinct** admin user UUIDs must approve before a template flips
`active = true`. The second approval also demotes other active rows for
the same `language_variant`.

### Request

```json
{ "approver_id": "<distinct uuid>" }
```

### Response

```json
{ "id": "uuid", "status": "first_approval_recorded | activated", "active": false | true }
```

---

## 6) GET `/health`

Liveness endpoint. Used by Railway / uptime probes. Lightweight, no
imports of v3 pipeline modules.

```json
{ "status": "healthy", "service": "MindMitra Chatbot Agent", "version": "3.0.0" }
```

---

## 7) GET `/`

Root info endpoint. Lists `/health`, `/docs`, and the HTTP chat route.

```json
{
  "message": "MindMitra Chatbot Agent v3 is running",
  "docs": "/docs",
  "health": "/health",
  "chat": "POST /chat"
}
```

---

## 8) GET `/debug/memory` (operator-only)

Qdrant connectivity probe. Returns `404` in production unless
`DEBUG_ROUTES=1` (and the optional `X-Debug-Token` header matches).

### Response

```json
{
  "qdrant_ready": true,
  "qdrant_url": "http://localhost:6333",
  "collections": { "episodic": "episodic_memories", "knowledge_base": "knowledge_base" },
  "user_id": "string",
  "episodic_recent_count": 0,
  "recent_memories_preview": []
}
```

---

## 9) Anam avatar endpoints

Broker + compensating controls for the Anam AI avatar (turnkey mode — Anam's
own LLM writes the replies). See `app/api/anam.py`, `app/api/avatar.py` and
`docs/anam-avatar.md` for the full picture; this is the wire contract.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/anam/session-token` | GET | JWT | Mints a short-lived Anam session token. Gated by the daily video quota. |
| `/anam/heartbeat` | POST | JWT | Debits real elapsed video time against the daily quota while the avatar plays. |
| `/anam/crisis-check` | POST | JWT | Runs `crisis_bypass` over one utterance — the compensating control for turnkey mode not running it inline. |
| `/anam/conversation` | POST | JWT | Lightweight Redis-only turn recorder for turnkey-mode conversations. |
| `/avatar/session-token` | POST | JWT | Same broker as `/anam/session-token`, older shape. Not called by the frontend; kept gated rather than deleted. |

### Daily video quota

10 minutes of Anam avatar video per account per day, resetting at IST
(`Asia/Kolkata`) midnight — not UTC. Enforced by `app/services/anam_quota.py`:
a Redis counter is the hot path, mirrored into the Supabase
`anam_usage_daily` table so a Redis eviction cannot silently reset a spent
user's balance back to a full quota.

`GET /anam/session-token`

```json
// 200
{
  "sessionToken": "string",
  "avatarId": "string",
  "remainingSeconds": 540,
  "maxSessionLengthSeconds": 540
}
```

`remainingSeconds` is the daily balance as of this mint, before the session
spends any of it. `maxSessionLengthSeconds` is the smaller of the configured
per-session cap and the caller's remaining daily balance — Anam enforces this
itself and closes the WebRTC connection when it elapses, which is the
backstop if the client's heartbeat loop dies or lies. Returns **429** if less
than `min_session_seconds` (default 30s) remains for the day.

`POST /anam/heartbeat`

```json
// Request
{ "session_id": "string | null" }

// 200
{ "remaining_seconds": 525, "exhausted": false }
```

Carries no duration. The server computes elapsed time itself from a
timestamp anchored at mint (`mark_session_start`), clamped to twice the
expected heartbeat interval — a client cannot inflate its remaining balance
by reporting a fabricated duration or by polling off-cadence. The frontend
calls this on a fixed ~15s interval while the `<video>` is actually playing
(`useAnamAvatar.ts`).

---

## 10) Therapist-bridge endpoints

The therapist-bridge feature is a separate product surface that shares
this FastAPI process. See `app/api/therapist_bridge.py` for the source of truth.

> **No frontend calls these.** `/therapist-bridge` in the SPA is a verbatim port
> of `rana-jatin/remix-of-gentle-bridge` and runs entirely on the fixtures in
> `src/lib/therapist-bridge/`. The endpoints below are live, tested and hardened
> — they are simply unused by the UI today. Everything documented here is what a
> client *would* get; none of it is currently exercised in production.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/therapist-bridge/therapists` | GET | none | Directory stub. Returns ids, not photos — the frontend maps id → bundled asset. |
| `/therapist-bridge/profile-preview` | POST | JWT | Consent-filtered emotional profile (with optional LLM narrative) |
| `/therapist-bridge/referral` | POST | JWT | Snapshot + referral in one transaction; returns a clinician token and its expiry |
| `/therapist-bridge/clinician-brief/{token}` | GET | **none** | Magic-link read of the snapshot |

### Data sources

The profile is built from what the v3 pipeline actually writes. The pre-v3
sources (`session_summaries`, `user_contexts.screening_assessments`,
`crisis_events`) have no writer and are deliberately **not** read — pointing the
builder back at them returns an empty profile for every user.

| Section | Source |
|---------|--------|
| `assessments` | `user_longitudinal_trajectory.phq2_scores` (session-end Task C) |
| `moodTrends` | `user_activities`, backfilled from `…trajectory.affect_series` |
| `topics` | Qdrant `episodic_memories` + `user_semantic_profiles.recurring_themes` |
| `patterns` | MindGym rows in `user_activities`, plus session-derived metrics |
| `crisisEvents` | `sessions.peak_urgency >= 2` + `…trajectory.recent_crisis_flag` |

**PHQ-2, not PHQ-9.** It is inferred by a language model from conversation, two
items scored 0–3, banked at most once every three sessions. Every row carries
that provenance in `note`, and `DISCLAIMER` states it. Do not relabel it as a
completed questionnaire.

### Consent

`ConsentStatePayload` has one key per real payload section. A request that omits
`consent` **denies everything** — it is opt-in, not opt-out.

| Key (camelCase alias) | Default | Governs |
|---|---|---|
| `shareAssessments` | `true` | `assessments` |
| `sharePatterns` | `true` | `moodTrends`, `patterns`, `topics` |
| `shareSummaries` | `false` | Layer C narrative bullets inside `patterns` |
| `shareWords` | `false` | User-attached verbatim quotes |
| `shareCrisisFlags` | `true` | `crisisEvents` |

`shareAnonymously` was removed: it was accepted and read by nothing.
`crisisEvents` used to ride `sharePatterns`, so enabling mood trends silently
also shared crisis history.

### Clinician token

Opaque `secrets.token_urlsafe(32)`, expiring after
`THERAPIST_BRIDGE_TOKEN_TTL_DAYS` (default 14). First read stamps `viewed_at`
and flips `status` to `delivered`. Expired and unknown tokens both return 404 —
they must be indistinguishable to whoever holds the link.

**Residual risk:** the token is a path segment, so it lands in proxy and access
logs regardless of the "do not log token" discipline in the handler. Expiry and
the recorded first view are the real mitigations. Moving it to a header would
break the magic-link flow and has not been done.

Requires the `20260814120000_therapist_bridge_hardening.sql` migration — it adds
`expires_at` / `viewed_at` and the `create_therapist_referral` function the
referral endpoint calls.

---

## v3 Postgres schema

The v3 stack uses 8 tables (created by
`scripts/migrations/v3_schema.sql`):

- `users`
- `user_semantic_profiles`
- `user_procedural_profiles`
- `user_longitudinal_trajectory`
- `sessions`
- `audit_logs` (service-role only)
- `crisis_templates` (read-only via RLS; admin writes via `/admin/*`)
- `static_fallback_templates`

Plus Qdrant collections from `QDRANT_EPISODIC_COLLECTION` and
`QDRANT_KB_COLLECTION` (dim=384, Cosine, indexed on `user_id`).

## v3 environment flags

| Flag | Purpose |
|------|---------|
| `ENV` | Must be `production` on Railway; controls auth/debug safety gates. |
| `MHA_V3_ENABLED` | Master kill-switch; `1` (default) to enable chat routes. |
| `REDIS_URL` | Session state + embedding cache + keyspace expiry. |
| `SUPABASE_JWT_SECRET` | Required for Supabase JWT auth on `/chat`. |
| `AZURE_OPENAI_*` | Primary streaming LLM. |
| `GROQ_API_KEY` | Signal extraction + safety gate. |
| `GEMINI_API_KEY` | Episodic summarisation. |
| `GLM_API_KEY` | Urgency=0 fallback LLM. |
| `CRISIS_HARDCODED_EN` / `CRISIS_HARDCODED_HI` | Last-resort crisis text. |
| `V3_ADMIN_KEY` | Required for `/admin/*`. |
| `SENTRY_DSN`, `POSTHOG_API_KEY` | Optional monitoring. |
