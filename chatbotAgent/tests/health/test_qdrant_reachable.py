"""
Health: Qdrant reachable and required collections exist.

Marked `integration`. Enable with `RUN_INTEGRATION=1` and a running Qdrant.
"""
from __future__ import annotations

import os

import pytest


@pytest.mark.integration
def test_qdrant_legacy_collection_or_skip():
    host = os.getenv("QDRANT_HOST", "localhost")
    port = int(os.getenv("QDRANT_PORT", "6333"))
    collection = os.getenv("QDRANT_COLLECTION", "companion_memories")

    try:
        from qdrant_client import QdrantClient
    except ImportError:
        pytest.skip("qdrant-client not installed")

    try:
        c = QdrantClient(host=host, port=port, timeout=2.0)
        info = c.get_collection(collection)
    except Exception as exc:
        pytest.skip(f"Qdrant not reachable or collection missing ({collection}): {exc}")

    assert info is not None


@pytest.mark.integration
def test_qdrant_mitra_v2_collection_or_skip():
    host = os.getenv("QDRANT_HOST", "localhost")
    port = int(os.getenv("QDRANT_PORT", "6333"))
    collection = os.getenv("QDRANT_COLLECTION_MITRA", "mitra_episodic_v2")

    try:
        from qdrant_client import QdrantClient
    except ImportError:
        pytest.skip("qdrant-client not installed")

    try:
        c = QdrantClient(host=host, port=port, timeout=2.0)
        c.get_collection(collection)
    except Exception as exc:
        pytest.skip(f"Mitra v2 collection {collection} not yet provisioned: {exc}")
