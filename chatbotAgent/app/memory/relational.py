"""
Relational graph — `mitra_entities` + `mitra_entity_edges`.

Tracks people, places, and things the user references over time. Allows
multi-hop callbacks like:

    "How are things with Dad?"
    → entity 'Dad' → edges (mentioned_in: e_42, e_98, e_120)
    → episodic memories e_42, e_98, e_120 (last one was a fight, 12 days ago)

Used by the assembler in Familiar+ stages.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .repositories import EntityRepo, EntityEdgeRepo, SupabaseLike

logger = logging.getLogger(__name__)


@dataclass
class Entity:
    id: str
    user_id: str
    kind: str               # 'person' | 'place' | 'event' | 'thing' | 'concept'
    display_name: str
    aliases: List[str] = field(default_factory=list)
    attributes: Dict[str, Any] = field(default_factory=dict)
    last_mentioned_at: Optional[str] = None


@dataclass
class Edge:
    user_id: str
    src_id: str
    dst_id: str
    edge_type: str          # 'mentioned_with' | 'caused' | 'happened_at' | ...
    weight: float = 1.0


class RelationalGraphService:
    def __init__(self, client: SupabaseLike):
        self.entities = EntityRepo(client)
        self.edges = EntityEdgeRepo(client)

    # ── Entities ────────────────────────────────────────────────────────────

    def upsert_entity(
        self, *, user_id: str, kind: str, display_name: str,
        aliases: Optional[List[str]] = None, attributes: Optional[Dict[str, Any]] = None,
    ) -> Entity:
        existing = self.entities.find_by_alias(user_id, display_name)
        if existing:
            # Merge aliases / attributes.
            cur_aliases = list(existing.get("aliases") or [])
            for a in (aliases or []):
                if a and a not in cur_aliases:
                    cur_aliases.append(a)
            cur_attrs = dict(existing.get("attributes") or {})
            cur_attrs.update(attributes or {})
            row = {
                **existing,
                "aliases": cur_aliases,
                "attributes": cur_attrs,
                "last_mentioned_at": datetime.now(timezone.utc).isoformat(),
            }
            saved = self.entities.upsert(row)
            return _row_to_entity(saved)

        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "kind": kind,
            "display_name": display_name,
            "aliases": list(aliases or []),
            "attributes": dict(attributes or {}),
            "last_mentioned_at": datetime.now(timezone.utc).isoformat(),
        }
        saved = self.entities.upsert(row)
        return _row_to_entity(saved)

    def by_user(self, user_id: str) -> List[Entity]:
        return [_row_to_entity(r) for r in self.entities.by_user(user_id)]

    def find(self, user_id: str, name_or_alias: str) -> Optional[Entity]:
        row = self.entities.find_by_alias(user_id, name_or_alias)
        return _row_to_entity(row) if row else None

    # ── Edges ───────────────────────────────────────────────────────────────

    def link(self, *, user_id: str, src_id: str, dst_id: str,
             edge_type: str, weight: float = 1.0) -> None:
        self.edges.insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "src_id": src_id,
            "dst_id": dst_id,
            "edge_type": edge_type,
            "weight": float(weight),
        })

    def neighbours(self, user_id: str, entity_id: str,
                   *, edge_types: Optional[List[str]] = None) -> List[Edge]:
        out = []
        for e in self.edges.by_user(user_id):
            if e["src_id"] != entity_id and e["dst_id"] != entity_id:
                continue
            if edge_types and e["edge_type"] not in edge_types:
                continue
            out.append(Edge(user_id=user_id, src_id=e["src_id"], dst_id=e["dst_id"],
                            edge_type=e["edge_type"], weight=float(e.get("weight") or 1.0)))
        return out


def _row_to_entity(r: Dict[str, Any]) -> Entity:
    return Entity(
        id=r["id"], user_id=r["user_id"], kind=r["kind"], display_name=r["display_name"],
        aliases=list(r.get("aliases") or []),
        attributes=dict(r.get("attributes") or {}),
        last_mentioned_at=r.get("last_mentioned_at"),
    )
