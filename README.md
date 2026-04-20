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

Start backend (MITRA v2 requires the stack flag):

```bash
export MITRA_STACK_ENABLED=1
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

- **Entry:** [`docs/README.md`](docs/README.md) — table of contents  
- **Architecture:** [`docs/MITRA.md`](docs/MITRA.md) — diagrams and request path  
- **Platform:** [`docs/platform.md`](docs/platform.md) — runbook, memory v2, Qdrant  
- **Product:** [`docs/product.md`](docs/product.md) — MindGym, bridge, analytics  
- **API:** [`docs/api_contracts.md`](docs/api_contracts.md) · **AI context:** [`CLAUDE.md`](CLAUDE.md)

## Notes

- Use `docs/` files as source of truth for system behavior.
- Keep contracts and docs updated in the same change when behavior changes.
