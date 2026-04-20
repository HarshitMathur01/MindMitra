"""
scripts/qdrant_init_mitra.py — idempotent provisioning of MITRA v2 Qdrant collections.

Run from `chatbotAgent/`:

    python scripts/qdrant_init_mitra.py

Reads QDRANT_HOST/QDRANT_PORT from env (defaults to localhost:6333).
"""
from __future__ import annotations

import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("qdrant_init_mitra")


def main() -> int:
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams, PayloadSchemaType
    except ImportError as exc:
        log.error("qdrant-client not installed: %s", exc)
        return 1

    host = os.getenv("QDRANT_HOST", "localhost")
    port = int(os.getenv("QDRANT_PORT", "6333"))
    bge_dim = int(os.getenv("MM_BGE_DIM", "1024"))

    log.info("Connecting to Qdrant at %s:%s …", host, port)
    client = QdrantClient(host=host, port=port, timeout=10.0)

    collections = {
        os.getenv("QDRANT_COLLECTION_MITRA", "mitra_episodic_v2"): bge_dim,
        os.getenv("QDRANT_COLLECTION_REFLECTIONS", "mitra_reflections_v2"): bge_dim,
    }

    for name, dim in collections.items():
        try:
            client.get_collection(name)
            log.info("✓ Collection %s already exists", name)
        except Exception:
            log.info("Creating collection %s (dim=%d, cosine)…", name, dim)
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )
            # Create payload indices for fast filtering by user_id and theme.
            for field, schema in [
                ("user_id", PayloadSchemaType.KEYWORD),
                ("affect_label", PayloadSchemaType.KEYWORD),
                ("themes", PayloadSchemaType.KEYWORD),
                ("importance", PayloadSchemaType.FLOAT),
            ]:
                try:
                    client.create_payload_index(
                        collection_name=name,
                        field_name=field,
                        field_schema=schema,
                    )
                except Exception as exc:  # noqa: BLE001
                    log.warning("payload index %s on %s skipped: %s", field, name, exc)
            log.info("✓ Collection %s ready", name)

    log.info("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
