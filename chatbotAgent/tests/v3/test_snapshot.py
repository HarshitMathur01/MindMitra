"""Contract tests for GET /me/snapshot.

Covers:
  * happy path with full semantic + longitudinal data,
  * crisis-flag set surfaces in the response,
  * longitudinal risk flag surfaces in the response,
  * Redis cache hit short-circuits the Supabase build,
  * empty / null semantic profile returns null fields, never 500.

The route runs under SKIP_AUTH inside the test client (set in
tests/conftest.py) so a bare `Authorization: Bearer dev` header is enough.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient


def _fake_semantic() -> Dict[str, Any]:
    return {
        "user_id": "snap-user",
        "display_name": "Aarav",
        "cultural_frame_id": "iit_pressure",
        "recurring_themes": {
            "sleep": 0.9,
            "academic-pressure": 0.7,
            "family": 0.3,
        },
        "comfort_topics": ["music", "calls-with-mom"],
        "language_baseline": {"code_mix_mean": 0.62, "formality_mean": 0.3},
        "total_sessions": 7,
    }


def _fake_longitudinal(
    *,
    crisis: bool = False,
    risk: bool = False,
    affect_series: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    return {
        "user_id": "snap-user",
        "longitudinal_risk_flag": risk,
        "recent_crisis_flag": crisis,
        "crisis_flag_set_at": "2026-05-24T10:00:00+00:00" if crisis else None,
        "last_slope": -0.08,
        "affect_series": affect_series
        or [
            {"valence": -0.5, "arousal": 0.6, "urgency": 1},
            {"valence": -0.3, "arousal": 0.55, "urgency": 1},
            {"valence": -0.4, "arousal": 0.6, "urgency": 2},
        ],
        "phq2_scores": [],
    }


def _fake_sessions() -> List[Dict[str, Any]]:
    return [
        {
            "started_at": "2026-05-22T10:00:00+00:00",
            "mode_sequence": ["companion", "companion", "skill_coach"],
        },
        {
            "started_at": "2026-05-20T18:00:00+00:00",
            "mode_sequence": ["companion"],
        },
        {
            "started_at": "2026-05-18T08:00:00+00:00",
            "mode_sequence": ["companion", "skill_coach"],
        },
    ]


class _FakeRedis:
    """In-memory async-ish Redis replacement for cache-path tests."""

    def __init__(self) -> None:
        self.store: Dict[str, str] = {}
        self.get_calls = 0
        self.setex_calls = 0

    async def get(self, key: str) -> str | None:
        self.get_calls += 1
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> bool:
        self.setex_calls += 1
        self.store[key] = value
        return True


@pytest.fixture
def patched_snapshot_pipeline(monkeypatch: pytest.MonkeyPatch):
    from app.api import snapshot as snap_mod

    semantic = _fake_semantic()
    longitudinal = _fake_longitudinal()
    sessions = _fake_sessions()

    state: Dict[str, Any] = {
        "semantic": semantic,
        "longitudinal": longitudinal,
        "sessions": sessions,
        "semantic_calls": 0,
        "longitudinal_calls": 0,
        "session_calls": 0,
    }

    async def fake_semantic(_user_id: str):
        state["semantic_calls"] += 1
        return state["semantic"]

    async def fake_longitudinal(_user_id: str):
        state["longitudinal_calls"] += 1
        return state["longitudinal"]

    async def fake_sessions(_user_id: str):
        state["session_calls"] += 1
        return state["sessions"]

    monkeypatch.setattr(snap_mod.profile_service, "load_semantic_profile", fake_semantic)
    monkeypatch.setattr(snap_mod.profile_service, "load_longitudinal", fake_longitudinal)
    monkeypatch.setattr(snap_mod, "_load_sessions", fake_sessions)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(snap_mod, "get_redis", lambda: fake_redis)
    state["redis"] = fake_redis
    return state


def test_snapshot_happy_path(client: TestClient, patched_snapshot_pipeline) -> None:
    response = client.get("/me/snapshot", headers={"Authorization": "Bearer dev"})
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["user_id"]
    assert body["computed_at"]
    assert body["affect_ema"] is not None
    assert -1.0 <= body["affect_ema"]["valence"] <= 1.0
    assert 0.0 <= body["affect_ema"]["arousal"] <= 1.0

    assert body["recent_crisis_flag"] is False
    assert body["longitudinal_risk_flag"] is False
    assert body["last_slope"] == pytest.approx(-0.08)

    # Themes are sorted by frequency, capped to 5 entries; sleep should win.
    assert body["dominant_themes"][0] == "sleep"
    assert "academic-pressure" in body["dominant_themes"]
    assert body["comfort_topics"] == ["music", "calls-with-mom"]

    # Companion appears most across the seeded sessions.
    assert body["dominant_mode"] == "companion"
    assert body["cultural_frame_id"] == "iit_pressure"
    assert body["language_baseline"]["code_mix"] == pytest.approx(0.62, abs=1e-3)
    assert body["language_baseline"]["register"] == "casual"

    assert body["session_count_28d"] == 3
    assert body["distinct_days_28d"] == 3


def test_snapshot_crisis_flag_set(
    client: TestClient, patched_snapshot_pipeline
) -> None:
    patched_snapshot_pipeline["longitudinal"] = _fake_longitudinal(crisis=True)

    response = client.get("/me/snapshot", headers={"Authorization": "Bearer dev"})
    assert response.status_code == 200
    body = response.json()
    assert body["recent_crisis_flag"] is True
    assert body["crisis_flag_set_at"] == "2026-05-24T10:00:00+00:00"


def test_snapshot_longitudinal_risk_flag(
    client: TestClient, patched_snapshot_pipeline
) -> None:
    patched_snapshot_pipeline["longitudinal"] = _fake_longitudinal(risk=True)

    response = client.get("/me/snapshot", headers={"Authorization": "Bearer dev"})
    assert response.status_code == 200
    body = response.json()
    assert body["longitudinal_risk_flag"] is True


def test_snapshot_cache_hit_skips_supabase(
    client: TestClient, patched_snapshot_pipeline
) -> None:
    first = client.get("/me/snapshot", headers={"Authorization": "Bearer dev"})
    assert first.status_code == 200

    semantic_calls_after_first = patched_snapshot_pipeline["semantic_calls"]
    assert patched_snapshot_pipeline["redis"].setex_calls == 1

    second = client.get("/me/snapshot", headers={"Authorization": "Bearer dev"})
    assert second.status_code == 200
    # Cache hit must avoid re-running the Supabase loaders.
    assert patched_snapshot_pipeline["semantic_calls"] == semantic_calls_after_first
    assert patched_snapshot_pipeline["longitudinal_calls"] == semantic_calls_after_first
    assert patched_snapshot_pipeline["session_calls"] == semantic_calls_after_first

    assert first.json()["computed_at"] == second.json()["computed_at"]


def test_snapshot_missing_semantic_profile_returns_nulls(
    client: TestClient, patched_snapshot_pipeline
) -> None:
    patched_snapshot_pipeline["semantic"] = {}
    patched_snapshot_pipeline["longitudinal"] = {
        "user_id": "snap-user",
        "longitudinal_risk_flag": False,
        "recent_crisis_flag": False,
        "affect_series": [],
        "phq2_scores": [],
    }
    patched_snapshot_pipeline["sessions"] = []

    response = client.get("/me/snapshot", headers={"Authorization": "Bearer dev"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["affect_ema"] is None
    assert body["dominant_themes"] == []
    assert body["comfort_topics"] == []
    assert body["dominant_mode"] is None
    assert body["cultural_frame_id"] is None
    assert body["language_baseline"] is None
    assert body["session_count_28d"] == 0
    assert body["distinct_days_28d"] == 0
    assert body["recent_crisis_flag"] is False
    assert body["longitudinal_risk_flag"] is False
