"""
Unit tests: TurnTraceRepo must survive schema drift in `mitra_turn_traces`.

The orchestrator writes optional fields (`accepted_on_pass`, `fallback_used`,
`stance`, `callback_budget`, `critic`, `used_episodes`) that older
deployments may not have. The repo must:
  1. Accept the row on the first try if the columns exist.
  2. Detect PostgREST's "Could not find the 'X' column" and retry once
     with the offender folded into an `extra` JSON column.
  3. Cache the missing column so we don't burn a round-trip on every
     subsequent insert.
"""
from __future__ import annotations

from typing import Any, Dict, List

import pytest

from app.memory.repositories import TurnTraceRepo


@pytest.fixture(autouse=True)
def _reset_global_missing_cache():
    """Class-level missing-column cache is process-wide; clear between tests."""
    TurnTraceRepo._missing_optional_global.clear()
    yield
    TurnTraceRepo._missing_optional_global.clear()


class _FakeExecResult:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data


class _FakeTable:
    def __init__(self, reject_columns: set[str], inserts: list[Dict[str, Any]]):
        self._reject = set(reject_columns)
        self._inserts = inserts

    def insert(self, row: Dict[str, Any]):
        self._row = row
        return self

    def execute(self):
        offender = next((c for c in self._reject if c in self._row), None)
        if offender is not None:
            raise RuntimeError(
                f"{{'message': \"Could not find the '{offender}' column "
                f"of 'mitra_turn_traces' in the schema cache\", "
                f"'code': 'PGRST204'}}"
            )
        self._inserts.append(self._row)
        return _FakeExecResult([dict(self._row, id="row-1")])


class _FakeClient:
    def __init__(self, reject_columns: set[str]):
        self._reject = reject_columns
        self.inserts: list[Dict[str, Any]] = []

    def table(self, name: str) -> _FakeTable:
        assert name == "mitra_turn_traces"
        return _FakeTable(self._reject, self.inserts)


@pytest.fixture
def base_row() -> Dict[str, Any]:
    return {
        "user_id": "u1",
        "session_id": "s1",
        "intent": "vent",
        "safety_signal": "safe",
        "is_crisis": False,
        "response_chars": 312,
        "timings_ms": {"total_ms": 1500},
        "used_episodes": 3,
        "accepted_on_pass": 1,
        "fallback_used": False,
        "stance": "holding",
        "callback_budget": 0,
        "critic": {"v1": None, "v2": None},
    }


def test_insert_succeeds_when_all_columns_exist(base_row):
    client = _FakeClient(reject_columns=set())
    repo = TurnTraceRepo(client)
    out = repo.insert(base_row)
    assert out["id"] == "row-1"
    assert client.inserts[0]["accepted_on_pass"] == 1
    assert client.inserts[0]["used_episodes"] == 3


def test_insert_recovers_when_optional_column_missing(base_row):
    client = _FakeClient(reject_columns={"accepted_on_pass"})
    repo = TurnTraceRepo(client)
    out = repo.insert(base_row)
    assert out["id"] == "row-1"
    written = client.inserts[0]
    # Offending column must be demoted to `extra` JSON, never sent raw.
    assert "accepted_on_pass" not in written
    assert written["extra"]["accepted_on_pass"] == 1
    # All other optional columns should still be at the top level.
    assert written["fallback_used"] is False
    assert written["stance"] == "holding"


def test_insert_caches_missing_column(base_row):
    client = _FakeClient(reject_columns={"accepted_on_pass"})
    repo = TurnTraceRepo(client)
    repo.insert(base_row)
    # Second insert must NOT trigger the schema-cache 400 again.
    repo.insert(dict(base_row, intent="ask"))
    assert "accepted_on_pass" not in client.inserts[0]
    assert "accepted_on_pass" not in client.inserts[1]
    assert client.inserts[1]["extra"]["accepted_on_pass"] == 1


def test_insert_asserts_required_keys(base_row):
    client = _FakeClient(reject_columns=set())
    repo = TurnTraceRepo(client)
    bad = dict(base_row)
    bad.pop("user_id")
    with pytest.raises(AssertionError):
        repo.insert(bad)
