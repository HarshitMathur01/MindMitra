"""
Thin repository wrappers around Supabase tables. Each repo accepts an
injected client (dict-like fake or real `SupabaseClient`) so we can unit-test
without a live DB.

Repos:
    IdentityCardRepo       — mitra_identity_cards
    EpisodicRepo           — mitra_episodic_memories
    AffectRepo             — mitra_affect_timeseries
    EntityRepo             — mitra_entities + mitra_entity_edges (Phase 3)
    ProceduralRepo         — mitra_procedural_ledger (Phase 3)
    RelationshipStateRepo  — mitra_relationship_state (Phase 3)
    TurnTraceRepo          — mitra_turn_traces (write-only path)
"""
from __future__ import annotations

import logging
import re
from typing import Any, ClassVar, Dict, Iterable, List, Optional, Protocol

logger = logging.getLogger(__name__)


# ── Repository protocol ─────────────────────────────────────────────────────

class SupabaseLike(Protocol):
    """Subset of supabase-py we use; lets us inject an in-memory fake."""

    def table(self, name: str) -> Any: ...


# ── In-memory fake (used by tests, also a working dev backend) ──────────────

class InMemorySupabase:
    """Tiny stand-in implementing the postgrest fluent API we touch."""

    def __init__(self) -> None:
        self._tables: Dict[str, List[Dict[str, Any]]] = {}

    def table(self, name: str) -> "_FakeTable":
        self._tables.setdefault(name, [])
        return _FakeTable(self._tables[name])

    def dump(self, name: str) -> List[Dict[str, Any]]:
        return list(self._tables.get(name, []))


class _FakeTable:
    """Fluent fake. Implements the surface we touch in repos."""

    def __init__(self, rows: List[Dict[str, Any]]):
        self._rows = rows
        self._filters: List[tuple] = []
        self._select: Optional[str] = None
        self._order: Optional[tuple] = None
        self._limit: Optional[int] = None
        self._upsert_payload: Optional[List[Dict[str, Any]]] = None
        self._insert_payload: Optional[List[Dict[str, Any]]] = None
        self._update_payload: Optional[Dict[str, Any]] = None

    def select(self, cols: str = "*") -> "_FakeTable":
        self._select = cols
        return self

    def insert(self, payload) -> "_FakeTable":
        self._insert_payload = payload if isinstance(payload, list) else [payload]
        return self

    def upsert(self, payload, on_conflict: Optional[str] = None) -> "_FakeTable":
        self._upsert_payload = payload if isinstance(payload, list) else [payload]
        self._on_conflict = on_conflict
        return self

    def update(self, payload: Dict[str, Any]) -> "_FakeTable":
        self._update_payload = payload
        return self

    def delete(self) -> "_FakeTable":
        self._delete = True
        return self

    def eq(self, col: str, val: Any) -> "_FakeTable":
        self._filters.append(("eq", col, val))
        return self

    def in_(self, col: str, vals: Iterable[Any]) -> "_FakeTable":
        self._filters.append(("in", col, list(vals)))
        return self

    def gte(self, col: str, val: Any) -> "_FakeTable":
        self._filters.append(("gte", col, val))
        return self

    def order(self, col: str, desc: bool = False) -> "_FakeTable":
        self._order = (col, desc)
        return self

    def limit(self, n: int) -> "_FakeTable":
        self._limit = n
        return self

    def _apply_filters(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out = list(rows)
        for op, col, val in self._filters:
            if op == "eq":
                out = [r for r in out if r.get(col) == val]
            elif op == "in":
                out = [r for r in out if r.get(col) in val]
            elif op == "gte":
                out = [r for r in out if r.get(col) is not None and r.get(col) >= val]
        if self._order:
            col, desc = self._order
            out.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=desc)
        if self._limit is not None:
            out = out[: self._limit]
        return out

    def execute(self) -> "_FakeResult":
        # Insert / Upsert / Update / Delete first.
        if self._insert_payload is not None:
            import uuid as _uuid
            saved: List[Dict[str, Any]] = []
            for row in self._insert_payload:
                r = dict(row)
                r.setdefault("id", str(_uuid.uuid4()))
                self._rows.append(r)
                saved.append(r)
            return _FakeResult(saved)
        if self._upsert_payload is not None:
            # Honour `on_conflict` if given (comma-separated cols), else fall back
            # to `id`/`user_id` heuristic.
            conflict_cols = (
                [c.strip() for c in (getattr(self, "_on_conflict", "") or "").split(",") if c.strip()]
                or (["id"] if any("id" in r for r in self._upsert_payload) else ["user_id"])
            )
            for row in self._upsert_payload:
                idx = next(
                    (i for i, r in enumerate(self._rows)
                     if all(r.get(c) == row.get(c) for c in conflict_cols)),
                    None,
                )
                if idx is None:
                    self._rows.append(dict(row))
                else:
                    self._rows[idx].update(row)
            return _FakeResult(self._upsert_payload)
        if self._update_payload is not None:
            target = self._apply_filters(self._rows)
            for r in target:
                r.update(self._update_payload)
            return _FakeResult(target)
        if getattr(self, "_delete", False):
            target = self._apply_filters(self._rows)
            for r in target:
                self._rows.remove(r)
            return _FakeResult(target)
        # Plain select.
        return _FakeResult(self._apply_filters(self._rows))


class _FakeResult:
    def __init__(self, data):
        self.data = data


# ── Repos ───────────────────────────────────────────────────────────────────

class _BaseRepo:
    table_name: str = ""

    def __init__(self, client: SupabaseLike):
        self.client = client

    @property
    def t(self):
        return self.client.table(self.table_name)


class IdentityCardRepo(_BaseRepo):
    table_name = "mitra_identity_cards"

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        res = self.t.select("*").eq("user_id", user_id).limit(1).execute()
        return (res.data or [None])[0]

    def upsert(self, card: Dict[str, Any]) -> Dict[str, Any]:
        assert "user_id" in card, "Identity card requires user_id"
        res = self.t.upsert(card, on_conflict="user_id").execute()
        return (res.data or [card])[0]

    def is_empty(self, user_id: str) -> bool:
        c = self.get(user_id)
        if not c:
            return True
        # Card exists but has no meaningful content.
        for k in ("preferred_name", "pronouns", "stated_identities", "values_facets"):
            v = c.get(k)
            if v not in (None, "", [], {}):
                return False
        return True


class EpisodicRepo(_BaseRepo):
    table_name = "mitra_episodic_memories"

    def insert(self, row: Dict[str, Any]) -> Dict[str, Any]:
        assert "user_id" in row and "summary" in row and "qdrant_id" in row
        row.setdefault("importance", 0.5)
        row.setdefault("strength", 1.0)
        res = self.t.insert(row).execute()
        return (res.data or [row])[0]

    def by_user(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        return (self.t.select("*").eq("user_id", user_id)
                .order("importance", desc=True).limit(limit).execute().data) or []

    def by_qdrant_ids(self, user_id: str, qdrant_ids: List[str]) -> List[Dict[str, Any]]:
        return (self.t.select("*").eq("user_id", user_id)
                .in_("qdrant_id", qdrant_ids).execute().data) or []

    def count(self, user_id: str) -> int:
        return len(self.by_user(user_id, limit=10_000))

    # ── Memory Mirror — user-controlled mutations ────────────────────────────

    def get_by_id(self, user_id: str, mem_id: str) -> Optional[Dict[str, Any]]:
        rows = (self.t.select("*").eq("user_id", user_id).eq("id", mem_id)
                .limit(1).execute().data) or []
        return rows[0] if rows else None

    def archive(self, user_id: str, mem_id: str) -> Optional[Dict[str, Any]]:
        from datetime import datetime, timezone
        ts = datetime.now(timezone.utc).isoformat()
        res = (self.t.update({"archived_at": ts})
               .eq("user_id", user_id).eq("id", mem_id).execute())
        return (res.data or [None])[0]

    def unarchive(self, user_id: str, mem_id: str) -> Optional[Dict[str, Any]]:
        res = (self.t.update({"archived_at": None})
               .eq("user_id", user_id).eq("id", mem_id).execute())
        return (res.data or [None])[0]

    def delete(self, user_id: str, mem_id: str) -> Optional[str]:
        """Hard delete the row in Postgres. Returns the qdrant_id (caller is
        responsible for purging it from Qdrant)."""
        existing = self.get_by_id(user_id, mem_id)
        if not existing:
            return None
        qid = existing.get("qdrant_id")
        self.t.delete().eq("user_id", user_id).eq("id", mem_id).execute()
        return qid

    def update_summary(self, user_id: str, mem_id: str, summary: str) -> Optional[Dict[str, Any]]:
        if not summary or not summary.strip():
            return None
        res = (self.t.update({"summary": summary.strip()})
               .eq("user_id", user_id).eq("id", mem_id).execute())
        return (res.data or [None])[0]


class AffectRepo(_BaseRepo):
    table_name = "mitra_affect_timeseries"

    def upsert_bucket(self, row: Dict[str, Any]) -> Dict[str, Any]:
        for k in ("user_id", "bucket_date", "bucket_kind", "channel"):
            assert k in row, f"affect bucket missing {k}"
        return self.t.upsert(
            row, on_conflict="user_id,bucket_date,bucket_kind,channel",
        ).execute().data[0]

    def recent_buckets(
        self, user_id: str, *, channel: Optional[str] = None, days: int = 14,
    ) -> List[Dict[str, Any]]:
        from datetime import date, timedelta
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        q = self.t.select("*").eq("user_id", user_id).gte("bucket_date", cutoff)
        if channel:
            q = q.eq("channel", channel)
        return q.order("bucket_date", desc=False).execute().data or []


class EntityRepo(_BaseRepo):
    table_name = "mitra_entities"

    def upsert(self, ent: Dict[str, Any]) -> Dict[str, Any]:
        for k in ("user_id", "kind", "display_name"):
            assert k in ent, f"entity missing {k}"
        return self.t.upsert(ent, on_conflict="id").execute().data[0]

    def find_by_alias(self, user_id: str, alias: str) -> Optional[Dict[str, Any]]:
        rows = self.t.select("*").eq("user_id", user_id).execute().data or []
        a = alias.strip().lower()
        for r in rows:
            if (r.get("display_name") or "").strip().lower() == a:
                return r
            for x in (r.get("aliases") or []):
                if (x or "").strip().lower() == a:
                    return r
        return None

    def by_user(self, user_id: str) -> List[Dict[str, Any]]:
        return self.t.select("*").eq("user_id", user_id).execute().data or []


class EntityEdgeRepo(_BaseRepo):
    table_name = "mitra_entity_edges"

    def insert(self, edge: Dict[str, Any]) -> Dict[str, Any]:
        for k in ("user_id", "src_id", "dst_id", "edge_type"):
            assert k in edge, f"edge missing {k}"
        return self.t.insert(edge).execute().data[0]

    def by_user(self, user_id: str) -> List[Dict[str, Any]]:
        return self.t.select("*").eq("user_id", user_id).execute().data or []


class ProceduralRepo(_BaseRepo):
    table_name = "mitra_procedural_ledger"

    def insert(self, row: Dict[str, Any]) -> Dict[str, Any]:
        for k in ("user_id", "intervention"):
            assert k in row, f"procedural row missing {k}"
        return self.t.insert(row).execute().data[0]

    def by_intervention(self, user_id: str, intervention: str) -> List[Dict[str, Any]]:
        return (self.t.select("*").eq("user_id", user_id)
                .eq("intervention", intervention)
                .order("used_at", desc=True).execute().data) or []


class RelationshipStateRepo(_BaseRepo):
    table_name = "mitra_relationship_state"

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        res = self.t.select("*").eq("user_id", user_id).limit(1).execute()
        return (res.data or [None])[0]

    def upsert(self, row: Dict[str, Any]) -> Dict[str, Any]:
        assert "user_id" in row
        return self.t.upsert(row, on_conflict="user_id").execute().data[0]


class TurnTraceRepo(_BaseRepo):
    table_name = "mitra_turn_traces"

    # Columns we are confident exist in every deployment of `mitra_turn_traces`.
    # Anything else gets folded into `extra` JSONB so the insert never fails
    # on a schema drift (PGRST204 "column not found in schema cache").
    _CORE_COLUMNS = {
        "user_id", "session_id", "intent", "safety_signal", "is_crisis",
        "response_chars", "timings_ms", "created_at",
    }
    # Optional columns we'll write through if the deployment has them. We
    # learn at runtime which ones the table actually accepts.
    _OPTIONAL_COLUMNS = {
        "used_episodes", "accepted_on_pass", "fallback_used",
        "critic", "stance", "callback_budget",
    }
    # Process-wide so a rebuilt orchestrator (or a new repo instance) still
    # honours what we already learned about this deployment's schema. Keeps
    # the WARNING strictly one-shot per missing column per process.
    _missing_optional_global: ClassVar[set[str]] = set()

    def __init__(self, sb) -> None:  # type: ignore[no-untyped-def]
        super().__init__(sb)

    def insert(self, row: Dict[str, Any]) -> Dict[str, Any]:
        for k in ("user_id", "session_id"):
            assert k in row, f"turn trace missing {k}"

        # Split known optional columns out into `extra` so we can retry
        # cleanly if the table doesn't have them yet.
        cleaned: Dict[str, Any] = {}
        extras: Dict[str, Any] = {}
        for k, v in row.items():
            if k in self._CORE_COLUMNS:
                cleaned[k] = v
            elif k in self._OPTIONAL_COLUMNS and k not in self._missing_optional_global:
                cleaned[k] = v
            else:
                extras[k] = v
        if extras:
            cleaned.setdefault("extra", {}).update(extras) if isinstance(
                cleaned.get("extra"), dict
            ) else cleaned.update({"extra": extras})

        try:
            return self.t.insert(cleaned).execute().data[0]
        except Exception as exc:  # noqa: BLE001
            # PostgREST schema-cache miss → retry without the offending
            # optional column and remember to skip it next time.
            msg = str(exc)
            offender = _extract_missing_column(msg)
            if offender and offender in self._OPTIONAL_COLUMNS:
                first_time = offender not in self._missing_optional_global
                if first_time:
                    logger.warning(
                        "turn-trace: column '%s' missing in mitra_turn_traces; "
                        "demoting to extra JSON for the rest of this process.",
                        offender,
                    )
                else:
                    # Defensive: shouldn't happen because we filter above,
                    # but if a parallel insert raced ahead, log at debug.
                    logger.debug(
                        "turn-trace: column '%s' still missing (already cached)",
                        offender,
                    )
                self._missing_optional_global.add(offender)
                cleaned.setdefault("extra", {})[offender] = cleaned.pop(offender, None)
                return self.t.insert(cleaned).execute().data[0]
            raise

    def recent_for_session(self, user_id: str, session_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        return (self.t.select("*").eq("user_id", user_id).eq("session_id", session_id)
                .order("created_at", desc=True).limit(limit).execute().data) or []


_MISSING_COL_RE = re.compile(
    r"Could not find the '([^']+)' column",
    re.IGNORECASE,
)


def _extract_missing_column(msg: str) -> Optional[str]:
    m = _MISSING_COL_RE.search(msg or "")
    return m.group(1) if m else None
