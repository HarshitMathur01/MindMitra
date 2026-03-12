# Qdrant Setup Guide (Railway)

## Overview
MindMitra uses **Qdrant** as the vector database for the mem0-powered memory system.
All user memories (facts, preferences, emotional patterns) are stored as vector
embeddings and retrieved at query time for personalised therapeutic responses.

## Railway Deployment

### 1. Add Qdrant service
1. Open your Railway project dashboard.
2. Click **"+ New"** → **"Database"** → search for **Qdrant**.
3. Railway provisions a Qdrant instance with a public hostname and port.

### 2. Note the connection details
After provisioning, go to the Qdrant service **Variables** tab:

| Variable | Example value |
|---|---|
| `QDRANT_HOST` | `qdrant-production-XXXX.up.railway.app` |
| `QDRANT_PORT` | `6333` (default HTTP) |

### 3. Set environment variables on the backend service
Add the following to your **chatbotAgent** Railway service:

```
QDRANT_HOST=<hostname from step 2>
QDRANT_PORT=6333
QDRANT_COLLECTION=companion_memories
```

> **Note:** mem0 in this repo uses local `all-MiniLM-L6-v2` embeddings and does
> not depend on `OPENAI_API_KEY`. The `/transcribe` fallback uses `GROQ_API_KEY`.

### 4. Collection auto-creation
The `MemoryManager` class auto-creates the `companion_memories` collection on
first initialisation if it does not already exist. No manual collection setup is
required.

## Local Development

For local development you can run Qdrant in Docker:

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

Then set in your `.env`:

```
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=companion_memories
```

## Collection Details

| Field | Value |
|---|---|
| Collection name | `companion_memories` |
| Embedding model | `all-MiniLM-L6-v2` (local SentenceTransformers) |
| Dimensions | 384 |
| Distance metric | cosine (mem0 default) |

## Payload Index (Optional Performance Optimisation)

If you have direct access to the Qdrant HTTP API, creating a payload index on
the `category` field speeds up filtered searches:

```bash
curl -X PUT "http://<QDRANT_HOST>:<QDRANT_PORT>/collections/companion_memories/index" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "category", "field_schema": "keyword"}'
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MemoryManager` logs `⚠️ mem0 init failed` | Check `QDRANT_HOST`, `QDRANT_PORT`, and local model download/connectivity |
| Slow first request | Cold-start: Qdrant needs ~5s to load collection on Railway free tier |
| "Connection refused" locally | Ensure Docker container is running on port 6333 |
