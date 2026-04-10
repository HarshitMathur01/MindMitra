# API Contracts

## Base
- Protocol: HTTPS
- Auth: Bearer token required for chat, streaming, greeting, transcribe
- Content type: application/json unless stream endpoint

## Error Format
Most non-stream endpoints return HTTP errors with this body shape:

```json
{ "detail": "error message" }
```

Streaming endpoint emits SSE error events:

```text
event: error
data: {"error":"..."}
```

---

## 1) POST /chat
Single-turn chat response.

### Request
```json
{
  "user_message": "string",
  "session_id": "string | null",
  "voice_analysis": {"any": "json"},
  "audio_data": "base64 wav | null",
  "avatar_visible": true,
  "personality": "mitra|arjun|diya|riya|zen | null",
  "companion_name": "string | null",
  "language": "english|hindi|hinglish|japanese|telugu|kannada|tamil | null"
}
```

### Response
```json
{
  "message": "string",
  "animation": "string",
  "facial_expression": "string",
  "modality": "string",
  "confidence": 0.0,
  "session_insights": {"any": "json"},
  "eval_trace": null
}
```

Optional **`eval_trace`** (pipeline path, routed intent, memory preview) is returned only when the server has **`ALLOW_EVAL_TRACE=true`** and the client sends header **`X-MindMitra-Eval-Trace: 1`**. See `docs/EVALUATION.md` and `docs/backend_system_map.md`. Do not enable trace in production without strict access control.

---

## 2) POST /chat/stream
SSE streaming chat endpoint.

### Request
Same JSON schema as POST /chat.

### Response (SSE events)
- text_chunk_delta
- text_chunk
- avatar_ready
- complete
- error

### Event payload examples
```text
event: text_chunk_delta
data: {"chunk":"partial text"}

```

```text
event: text_chunk
data: {"message":"full text","modality":"...","confidence":0.8}

```

```text
event: avatar_ready
data: {"animation":"Talking_0","facial_expression":"empathy"}

```

```text
event: complete
data: {"status":"success"}

```

---

## 3) GET /chat/greeting
Personalized greeting for a session.

### Query Params
- session_id (optional)
- user_id (optional)
- personality (optional)
- companion_name (optional)

### Response
Returns greeting payload with message and metadata. Fallback response shape includes:

```json
{
  "greeting": "string",
  "show_greeting": true,
  "language_used": "english|hindi|hinglish",
  "time_slot": "string"
}
```

---

## 4) POST /transcribe
Speech-to-text fallback transcription.

### Request
```json
{ "audio_data": "base64 wav" }
```

### Response
```json
{
  "transcript": "string",
  "model": "groq-whisper-large-v3-turbo"
}
```

---

## 5) POST /onboarding/mirror-response
Generate short empathic mirror text with crisis screening.

### Request
```json
{
  "user_answer": "string",
  "language": "en|hi"
}
```

### Response
```json
{
  "response_text": "string",
  "crisis_assessment": {
    "level": "critical|high|none",
    "matched": true
  }
}
```

---

## 6) POST /onboarding/crisis-check
Nuanced LLM crisis check for ambiguous cases.

### Request
```json
{
  "text": "string",
  "language": "en|hi",
  "client_level": "critical|high|medium|none"
}
```

### Response
```json
{
  "level": "critical|high|medium|none",
  "reasoning": "string",
  "recommended_action": "string"
}
```

---

## 7) GET /health
Liveness endpoint.

### Response
```json
{
  "status": "healthy",
  "service": "string",
  "version": "string"
}
```

---

## 8) GET /
Root info endpoint.

### Response
```json
{
  "message": "string",
  "docs": "/docs",
  "health": "/health",
  "debug_memory": "/debug/memory?user_id=<uid>"
}
```

---

## 9) GET /debug/memory
Memory diagnostics endpoint.

### Query Params
- user_id (optional)

### Response
```json
{
  "mem0_ready": true,
  "qdrant_host": "string",
  "qdrant_port": "string",
  "collection": "string",
  "user_id": "string",
  "stats": {"any": "json"},
  "recent_memories_preview": []
}
```

---

## 10) GET /therapist-bridge/therapists
Directory stub for MVP (JSON list of therapist cards for the web client).

### Response
Array of therapist objects (see `Therapist` type in the web app).

---

## 11) POST /therapist-bridge/profile-preview
Builds a **consent-filterable** emotional profile from Supabase (`user_activities`, `session_summaries`, `crisis_events`, `user_contexts` screening block) plus optional **LLM narrative** (non-diagnostic).

### Auth
- `Authorization: Bearer <Supabase JWT>` (or dev `SKIP_AUTH` bypass)

### Request
```json
{
  "includeNarrative": true,
  "narrativeAsync": false,
  "consent": {
    "shareFullProfile": true,
    "shareAssessments": true,
    "sharePatterns": true,
    "shareAnonymously": true
  }
}
```
`consent` may be omitted for an unfiltered preview.

### Response (aliases camelCase in JSON)
```json
{
  "emotionalProfile": {
    "moodTrends": [],
    "patterns": [],
    "topics": [],
    "assessments": [],
    "crisisEvents": []
  },
  "layers": { "facts": {}, "metrics": {}, "narrative": {} },
  "disclaimer": "string",
  "dataGaps": [],
  "schemaVersion": "1"
}
```

---

## 12) POST /therapist-bridge/referral
Creates an immutable **profile snapshot** and **referral** row. Returns an opaque **clinician view token** for the magic-link brief endpoint.

### Auth
- `Authorization: Bearer <Supabase JWT>`

### Request
```json
{
  "therapistId": "string",
  "consent": {
    "shareFullProfile": true,
    "shareAssessments": true,
    "sharePatterns": true,
    "shareAnonymously": true
  }
}
```

### Response
```json
{
  "id": "uuid",
  "status": "created | failed",
  "snapshotId": "uuid | null",
  "clinicianViewToken": "string | null"
}
```

---

## 13) GET /therapist-bridge/clinician-brief/{token}
Returns the **stored snapshot** for a referral. Intended for clinician-facing UI or PDF export; secured by opaque token (resolve server-side with service role — do not embed PII in URLs in production mailers without additional gates).

### Response
Same high-level shape as snapshot `emotionalProfile` + `disclaimer` + `consentScope`.

---

## Contract Notes
- This API currently has no explicit versioned prefix.
- Contracts are derived from current implementation and may evolve; breaking changes should be documented here first.
- **Therapist Bridge** content is screening and platform-signal summary only — not a diagnosis.
