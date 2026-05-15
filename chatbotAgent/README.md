# MindMitra backend (`chatbotAgent`)

FastAPI service powering the **MHA v3** conversational stack: 8-layer
pipeline, simple HTTP chat, Redis-backed sessions, Qdrant
episodic memory, Supabase relational store. Therapist-bridge is the only
sibling product feature on the same service.

## Documentation (read these first)

| Doc | Content |
|-----|---------|
| [`../html-to-markdown.md`](../html-to-markdown.md) | The v3 architecture spec we ship to |
| [`../docs/MITRA.md`](../docs/MITRA.md) | (Legacy) v2 architecture reference, kept for archaeology |
| [`../CLAUDE.md`](../CLAUDE.md) | AI assistant invariants |
| [`../LOCAL_DEV.md`](../LOCAL_DEV.md) | Local end-to-end run book |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Put secrets/platform values in .env.
# Put non-secret runtime behavior in config.yaml.

# Ensure the v3 schema and Qdrant collections are provisioned.
# (Schema: ../scripts/migrations/v3_schema.sql — run in Supabase SQL editor.
# Qdrant, from repo root: python -m scripts.migrations.init_qdrant)

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI: `http://127.0.0.1:8000/docs`

## Configuration

`config.yaml` is the backend source of truth for non-secret behavior:
model names, provider chain, timeouts, feature flags, CORS origins, Qdrant
collection names, and budgets.

`.env` should contain only secrets and platform-injected values such as
`PORT`, `ENV`, `REDIS_URL`, provider API keys, Supabase service/JWT secrets,
and admin/debug tokens. Legacy env names still override YAML values for tests
and emergency deploy changes, but new configuration should start in YAML.

### Railway / Upstash Redis

Set `REDIS_URL` to the **TLS** URL from the Upstash console (`rediss://…`, not `redis://`). Plain `redis://` against `*.upstash.io` is rejected by env validation when current code is deployed, and otherwise fails at runtime with connection errors. On startup the app **PING**s Redis and refuses to boot when `ENV` is not a dev-like value and the ping fails, so misconfigured deploys fail fast instead of only logging in background workers. If `CONFIG GET` is blocked by the provider but Redis otherwise works, set `REDIS_KEYSPACE_MODE=sweep`. Rotate the database password in Upstash if it was ever exposed.

## Routes

| Path | Type | Purpose |
|------|------|---------|
| `GET /health` | HTTP | Railway healthcheck |
| `POST /chat` | HTTP | Simple request/response chat (8-layer pipeline) |
| `POST /onboarding` | HTTP | 4-turn conversational onboarding |
| `POST /transcribe` | HTTP | Groq Whisper voice STT |
| `POST /admin/crisis-templates/{id}/approve` | HTTP | 2-approver crisis governance |
| `*  /therapist-bridge/*` | HTTP | Clinician-handoff feature (separate product) |

## Tests

```bash
pytest tests -q -m "not integration"
RUN_INTEGRATION=1 pytest tests -q
```
