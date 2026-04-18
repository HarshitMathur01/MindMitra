# MindMitra

MindMitra is an AI mental health companion platform for conversational support, guided reflection, and therapeutic activities.

This README is intentionally concise. Deep technical behavior is documented under `docs/` and AI operating guidance under `ai/`.

## Features

- Conversational AI companion with personality modes
- Crisis-aware routing and safety-first responses
- Streaming chat responses (SSE)
- Cross-session memory and continuity
- Voice input support and avatar metadata output
- Therapeutic game/activity context integration

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: FastAPI, Python
- Data: Supabase (auth + relational storage)
- Vector Memory: Qdrant + local embeddings
- LLM Providers: multi-provider setup for routing, generation, and summaries

## Quick Setup

### 1) Frontend

```bash
npm install
npm run dev
```

Create `.env.local` with at least:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Optional frontend speech keys can be added if needed.

### 2) Backend

```bash
cd chatbotAgent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Run local vector DB (if needed):

```bash
docker run -d -p 6333:6333 qdrant/qdrant
```

Start backend:

```bash
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

Primary backend variables are defined in `chatbotAgent/.env.example`.

At minimum, set:
- Supabase credentials
- LLM provider keys
- Qdrant connection values for memory

## Repository Structure

```text
MindMitra/
├── src/                    # Frontend app
├── chatbotAgent/           # Backend API and orchestration
├── docs/                   # Source-of-truth technical docs
├── ai/                     # AI-assistant operating docs
├── supabase/               # Database migrations/config
├── public/                 # Static assets (avatar runtime included)
└── README.md
```

## Documentation index

- **Hub:** `docs/README.md` (links to all technical docs)
- Architecture: `docs/architecture.md`
- Memory (“RAG” vocabulary): `docs/MEMORY.md`
- API contracts: `docs/api_contracts.md`
- Logging & ops: `docs/LOGGING.md`, `docs/OPERATIONS.md`
- AI instructions: `ai/claude.md`
- AI skills/permissions: `ai/skills.md`

## Notes

- Use `docs/README.md` and linked docs as the source of truth for system behavior.
- Keep contracts and docs updated in the same change when behavior changes.
