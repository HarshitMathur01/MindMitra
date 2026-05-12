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

## 9) Therapist-bridge endpoints

The therapist-bridge feature is a separate product surface that shares
this FastAPI process. Its contracts are unchanged from the legacy
release. See `app/api/therapist_bridge.py` for the source of truth.

| Route | Method | Purpose |
|-------|--------|---------|
| `/therapist-bridge/therapists` | GET | Directory stub |
| `/therapist-bridge/profile-preview` | POST | Consent-filterable emotional profile (with optional LLM narrative) |
| `/therapist-bridge/referral` | POST | Creates a snapshot + clinician view token |
| `/therapist-bridge/clinician-brief/{token}` | GET | Returns the snapshot for the clinician UI |

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
