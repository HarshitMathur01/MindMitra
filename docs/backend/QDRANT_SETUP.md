# Qdrant (vector DB)

**TL;DR:** mem0 stores conversation-memory vectors in Qdrant collection **`companion_memories`** (default). Embeddings: local **`all-MiniLM-L6-v2`**, 384 dims. Backend reads **`QDRANT_URL`** or **`QDRANT_HOST`** + **`QDRANT_PORT`**. **Memory detail:** [`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md).

---

## Railway

1. Add Qdrant service (template or Docker `qdrant/qdrant`).
2. Point backend env (private preferred):

```env
QDRANT_URL=http://<RAILWAY_PRIVATE_DOMAIN>:6333
# optional if private DNS fails
QDRANT_FALLBACK_URL=https://<RAILWAY_PUBLIC_DOMAIN>
QDRANT_COLLECTION=companion_memories
```

Legacy:

```env
QDRANT_HOST=<host>
QDRANT_PORT=6333
```

mem0 does **not** require `OPENAI_API_KEY` for embeddings (local model). `/transcribe` uses **`GROQ_API_KEY`**.

**Collection:** created on first successful mem0 init if missing (no manual create required for default path).

---

## Local

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

```env
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=companion_memories
```

---

## Collection parameters

| Item | Value |
|------|--------|
| Name | `companion_memories` (env override `QDRANT_COLLECTION`) |
| Embedding | `all-MiniLM-L6-v2`, dim **384** |
| Metric | Cosine (mem0 default) |

---

## Optional payload index

Speeds filtered search on `category`:

```bash
curl -X PUT "http://<HOST>:<PORT>/collections/companion_memories/index" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "category", "field_schema": "keyword"}'
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `mem0 init failed` | `QDRANT_URL` resolvable from same network as API; Qdrant up |
| `ENOTFOUND` / DNS | Try `QDRANT_FALLBACK_URL` to public hostname |
| First request slow | Cold Qdrant / model load |
| Local refused | Docker listening on `6333` |
