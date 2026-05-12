# MindMitra — local development runbook (MHA v3)

End-to-end recipe for running the new v3 conversational stack on your
laptop. After the cleanup of the legacy MITRA v2 pipeline, this is the
**only supported development flow**.

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | for the FastAPI backend |
| Node.js | 22.13.0 or 24+ | for the Vite frontend; Node 23 is intentionally blocked |
| Docker | 24+ | for Redis + Qdrant locally |
| Supabase project | — | with the v3 schema applied (see step 2) |

## 2. Supabase — apply the v3 schema

Open the Supabase SQL editor on your project and run the entire
`scripts/migrations/v3_schema.sql` file. This creates 8
tables (`users`, `user_semantic_profiles`, `user_procedural_profiles`,
`user_longitudinal_trajectory`, `sessions`, `audit_logs`,
`crisis_templates`, `static_fallback_templates`) and the RLS policies
and `increment_session_count` helper RPC.

> You said you've already run this — keep it idempotent: the SQL uses
> `IF NOT EXISTS` / `DROP POLICY IF EXISTS` so reruns are safe.

Optional seed scripts (run once per environment from the repository root):

```bash
python -m scripts.migrations.seed_fallback_templates
python -m scripts.migrations.seed_crisis_templates    # writes pending rows; approve via admin API
```

## 3. Redis + Qdrant — local Docker

```bash
docker run -d --name mha-redis -p 6379:6379 redis:7-alpine \
  redis-server --notify-keyspace-events Ex

docker run -d --name mha-qdrant -p 6333:6333 qdrant/qdrant:latest
```

Then provision the v3 Qdrant collections:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r chatbotAgent/requirements.txt
python -m scripts.migrations.init_qdrant
```

## 4. Backend — chatbotAgent

```bash
cd chatbotAgent
cp .env.example .env
# Fill secrets in .env:
#   SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, SECRET_KEY,
#   AZURE_OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, REDIS_URL.
#
# Fill non-secret runtime values in config.yaml:
#   supabase.url, providers.azure_openai.endpoint, qdrant.url.
# Local config.yaml keeps auth.skip_auth=true for development without login.

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Smoke checks (a new terminal):

```bash
curl http://127.0.0.1:8000/health
# → {"status":"healthy","service":"MindMitra Chatbot Agent","version":"3.0.0"}

curl http://127.0.0.1:8000/
# → lists /docs, /health, and POST /chat
```

## 5. Frontend — Vite SPA

```bash
cp .env.production.example .env.local
# Set:
#   VITE_BACKEND_URL=http://127.0.0.1:8000
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_PUBLISHABLE_KEY=...

npm install
npm run dev          # http://localhost:8080
```

`ChatGPTInterface` posts user turns to `${VITE_BACKEND_URL}/chat`.
The WebSocket client was removed from the local path to keep the current
development loop simple and reliable.

## 6. End-to-end chat smoke

1. Open `http://localhost:8080` and sign in (Supabase magic link).
2. Open the chat page. The status should settle to **"here when you
   are"**.
3. Type "I had a rough day" and hit send.

You should see:

* Browser console: no failed `POST /chat` request.
* Backend logs:
  ```
  POST /chat
  turn pipeline complete ...
  ```
* Chat bubble receives a single assistant reply quickly.
* In Supabase, a row appears in `audit_logs` (event_type =
  `turn_completed`) and in `chat_messages` (legacy persistence kept for
  the sidebar).

## 7. Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Chat returns `401` | `SUPABASE_JWT_SECRET` mismatch | Copy the project's JWT secret from Supabase → backend `.env`, or set `auth.skip_auth: true` in `config.yaml` locally |
| Chat returns `503` | `app.mha_v3_enabled=false` | Set it back to `true` in `config.yaml` |
| `confirmed` never arrives, only `chunk`s | Safety gate retried + failed → check Groq key | Verify `GROQ_API_KEY` and `providers.groq.safety_model` |
| `Couldn't reach the chat service` toast on first send | HTTP request failed | Confirm backend is up on `VITE_BACKEND_URL` and CORS allows the frontend origin |
| Backend log: `Redis keyspace notifications appear disabled` | Redis launched without `--notify-keyspace-events Ex` | Restart Redis with the flag |
| Onboarding never advances past turn 1 | The frontend's onboarding screen is not in this codebase yet | Use the API: `POST /onboarding { turn: 1 }` to bootstrap |

## 8. Tests

```bash
cd chatbotAgent
pytest tests -q -m "not integration"            # unit + contract suite
RUN_INTEGRATION=1 pytest tests -q                # adds Qdrant/Supabase smoke
```

Frontend lint/build:

```bash
npm run lint
npm run build
```

## 9. Once it works locally — deploy

* **Backend**: push to Railway. Put secrets/platform values from
  `chatbotAgent/.env.example` in Railway env, and keep non-secret behavior
  in `chatbotAgent/config.yaml`. The `Dockerfile` already runs
  `uvicorn app.main:app` on `$PORT`.
* **Frontend**: push to Vercel. Set every `VITE_*` variable from
  `.env.production.example`. Make sure `VITE_BACKEND_URL` points at the
  Railway HTTPS URL.

That's it.
