# MindMitra backend (`chatbotAgent`)

FastAPI service — **MITRA v2** therapeutic chat pipeline, memory v2, crisis fast-path, SSE streaming.

## Documentation (read these first)

| Doc | Content |
|-----|---------|
| [`../docs/README.md`](../docs/README.md) | Documentation entry and TOC |
| [`../docs/MITRA.md`](../docs/MITRA.md) | Diagrams, file map, one turn |
| [`../docs/platform.md`](../docs/platform.md) | Run, env, routes, memory v2, Qdrant |
| [`../docs/api_contracts.md`](../docs/api_contracts.md) | HTTP contracts |
| [`../CLAUDE.md`](../CLAUDE.md) | AI assistant invariants |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
export MITRA_STACK_ENABLED=1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI: `http://127.0.0.1:8000/docs`

## Tests

See [`../docs/EVALUATION.md`](../docs/EVALUATION.md) (`pytest`, HTTP eval, memory benchmark).
