"""Qdrant integration smoke tests."""
from __future__ import annotations

import os

import pytest


@pytest.mark.integration
def test_qdrant_v3_episodic_collection_exists() -> None:
    url = os.getenv("QDRANT_URL", "http://localhost:6333")
    collection = os.getenv("QDRANT_EPISODIC_COLLECTION", "episodic_memories")

    try:
        from qdrant_client import QdrantClient
    except ImportError:
        pytest.skip("qdrant-client not installed")

    try:
        client = QdrantClient(url=url, timeout=2.0)
        info = client.get_collection(collection)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"v3 episodic collection {collection!r} not provisioned at {url}: {exc}")

    assert info is not None
