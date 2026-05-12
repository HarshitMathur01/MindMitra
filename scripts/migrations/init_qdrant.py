"""Create the v3 Qdrant collections if they don't already exist.

Run with::

    python -m scripts.migrations.init_qdrant

Creates:
  * ``episodic_memories``  (dim=384, distance=Cosine, payload index on user_id)
  * ``knowledge_base``     (dim=384, distance=Cosine, Phase-2 placeholder)
"""
from __future__ import annotations

import asyncio
import logging

from scripts.migrations._cli_env import load_chatbot_env

load_chatbot_env()

from app.core.connections import get_qdrant
from app.core.env import env

logger = logging.getLogger(__name__)


async def _ensure_collection(name: str) -> bool:
    from qdrant_client.http import models as qmodels

    client = get_qdrant()
    if client is None:
        raise RuntimeError("Qdrant client not available — check QDRANT_URL / QDRANT_HOST env vars")

    try:
        existing = await client.get_collections()
        if any(c.name == name for c in existing.collections):
            logger.info("[v3 qdrant] collection %s already exists", name)
            return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 qdrant] get_collections failed: %s", exc)

    await client.create_collection(
        collection_name=name,
        vectors_config=qmodels.VectorParams(size=384, distance=qmodels.Distance.COSINE),
    )
    logger.info("[v3 qdrant] created collection %s", name)

    # Payload index on user_id — bounded scan at filter time scales much
    # better than a full payload sweep once we have ~10K points.
    try:
        await client.create_payload_index(
            collection_name=name,
            field_name="user_id",
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )
        logger.info("[v3 qdrant] created user_id payload index on %s", name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[v3 qdrant] payload index create failed for %s: %s", name, exc)
    return True


async def main() -> None:
    e = env()
    await _ensure_collection(e.qdrant_episodic_collection)
    await _ensure_collection(e.qdrant_kb_collection)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
