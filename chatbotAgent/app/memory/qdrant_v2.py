"""
Thin Qdrant client wrapper for MITRA v2 episodic + reflection collections.

Designed so every method accepts an injectable client. In tests we pass an
`InMemoryQdrant` that mimics the surface we use.
"""
from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)


COLLECTION_EPISODIC = os.getenv("QDRANT_COLLECTION_MITRA", "mitra_episodic_v2")
COLLECTION_REFLECTIONS = os.getenv("QDRANT_COLLECTION_REFLECTIONS", "mitra_reflections_v2")


# ── Protocols / data ────────────────────────────────────────────────────────

@dataclass
class HitV2:
    id: str
    score: float
    payload: Dict[str, Any]


class QdrantLike(Protocol):
    def upsert_point(self, collection: str, *, point_id: str,
                     vector: List[float], payload: Dict[str, Any]) -> None: ...
    def search(self, collection: str, *, vector: List[float],
               user_id: str, top_k: int = 10) -> List[HitV2]: ...
    def delete_points(self, collection: str, point_ids: List[str]) -> None: ...


# ── In-memory fake (tests + dev) ────────────────────────────────────────────

class InMemoryQdrant:
    def __init__(self) -> None:
        self._collections: Dict[str, List[Dict[str, Any]]] = {}

    def upsert_point(self, collection: str, *, point_id: str,
                     vector: List[float], payload: Dict[str, Any]) -> None:
        rows = self._collections.setdefault(collection, [])
        rows[:] = [r for r in rows if r["id"] != point_id]
        rows.append({"id": point_id, "vector": list(vector), "payload": dict(payload)})

    def delete_points(self, collection: str, point_ids: List[str]) -> None:
        rows = self._collections.get(collection, [])
        wanted = set(point_ids or [])
        self._collections[collection] = [r for r in rows if r["id"] not in wanted]

    def search(self, collection: str, *, vector: List[float],
               user_id: str, top_k: int = 10) -> List[HitV2]:
        rows = [r for r in self._collections.get(collection, [])
                if r["payload"].get("user_id") == user_id]

        # cosine similarity
        def _dot(a, b): return sum(x * y for x, y in zip(a, b))
        def _norm(a):
            import math
            return math.sqrt(sum(x * x for x in a)) or 1.0

        nv = _norm(vector)
        scored: List[HitV2] = []
        for r in rows:
            nr = _norm(r["vector"])
            score = _dot(vector, r["vector"]) / (nv * nr) if nv and nr else 0.0
            scored.append(HitV2(id=r["id"], score=score, payload=r["payload"]))
        scored.sort(key=lambda h: h.score, reverse=True)
        return scored[:top_k]


# ── Real Qdrant wrapper ─────────────────────────────────────────────────────

class QdrantV2Client:
    """Real client wrapping qdrant-client. Initialise with `from_env()`."""

    def __init__(self, raw_client) -> None:
        self._c = raw_client

    @classmethod
    def from_env(cls) -> "QdrantV2Client":
        from qdrant_client import QdrantClient
        host = os.getenv("QDRANT_HOST", "localhost")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        return cls(QdrantClient(host=host, port=port, timeout=10.0))

    def upsert_point(self, collection: str, *, point_id: str,
                     vector: List[float], payload: Dict[str, Any]) -> None:
        from qdrant_client.models import PointStruct
        self._c.upsert(collection_name=collection, points=[
            PointStruct(id=point_id, vector=vector, payload=payload)
        ])

    def search(self, collection: str, *, vector: List[float],
               user_id: str, top_k: int = 10) -> List[HitV2]:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        flt = Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))])
        res = self._c.search(collection_name=collection, query_vector=vector,
                             query_filter=flt, limit=top_k)
        return [HitV2(id=str(r.id), score=float(r.score), payload=dict(r.payload or {})) for r in res]

    def delete_points(self, collection: str, point_ids: List[str]) -> None:
        if not point_ids:
            return
        from qdrant_client.models import PointIdsList
        self._c.delete(collection_name=collection, points_selector=PointIdsList(points=list(point_ids)))


def new_qdrant_id() -> str:
    return str(uuid.uuid4())


_QDRANT_SINGLETON: Optional[QdrantLike] = None


def get_qdrant() -> Optional[QdrantLike]:
    """Return a process-wide Qdrant client, lazily initialised. Returns None
    if QDRANT_HOST is unset *and* the qdrant-client library can't load."""
    global _QDRANT_SINGLETON
    if _QDRANT_SINGLETON is not None:
        return _QDRANT_SINGLETON
    try:
        _QDRANT_SINGLETON = QdrantV2Client.from_env()
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_qdrant: real client unavailable (%s); falling back to in-memory", exc)
        _QDRANT_SINGLETON = InMemoryQdrant()
    return _QDRANT_SINGLETON
