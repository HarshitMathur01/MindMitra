"""
Phase 6 — /me/memory transparency endpoint.

We test the endpoint by directly invoking the FastAPI app via TestClient,
patching `validate_user_token` to a stub. No live Supabase/Qdrant required.
"""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _skip_auth(monkeypatch):
    monkeypatch.setenv("SKIP_AUTH", "true")


def _make_client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def test_me_memory_route_is_registered():
    client = _make_client()
    routes = {r.path for r in client.app.routes}
    assert "/me/memory" in routes


def test_me_memory_returns_shape_with_anonymous_supabase_or_skip():
    """Even with offline Supabase the endpoint must respond with the canonical
    JSON shape (warnings populated, fields defaulted) rather than 5xx."""
    with patch("app.api.me_memory.validate_user_token", return_value="user_under_test"):
        client = _make_client()
        resp = client.get("/me/memory")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user_id"] == "user_under_test"
        assert body["stack_version"] == "mitra_v2"
        assert "identity_card" in body
        assert isinstance(body["recent_memories"], list)
        assert "warnings" in body and isinstance(body["warnings"], list)


def test_me_memory_redacts_archived_memories():
    """If we inject a fake repo with one archived + one active memory, only
    the active one is surfaced."""
    fake_rows = [
        {"id": "1", "summary": "alive memory", "themes": ["x"],
         "affect_label": "calm", "importance": 0.6, "strength": 0.9,
         "created_at": "2026-04-01T00:00:00Z", "archived_at": None},
        {"id": "2", "summary": "archived memory", "themes": ["y"],
         "affect_label": "low", "importance": 0.2, "strength": 0.05,
         "created_at": "2025-04-01T00:00:00Z", "archived_at": "2025-12-01T00:00:00Z"},
    ]

    class _FakeRepo:
        def __init__(self, *_): pass
        def by_user(self, user_id, limit=20): return list(fake_rows)

    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.repositories.EpisodicRepo", _FakeRepo):
        client = _make_client()
        resp = client.get("/me/memory")
        assert resp.status_code == 200
        body = resp.json()
        ids = [m["id"] for m in body["recent_memories"]]
        assert ids == ["1"]


def test_me_memory_query_param_limit_validated():
    with patch("app.api.me_memory.validate_user_token", return_value="u1"):
        client = _make_client()
        bad = client.get("/me/memory?limit=999")
        assert bad.status_code == 422
        ok = client.get("/me/memory?limit=50")
        assert ok.status_code == 200


# ── Memory Mirror v1 — preferences + pause/resume ──────────────────────────

class _PrefsServiceStub:
    """Tiny in-memory stand-in for PreferencesService."""
    _state = {}

    def __init__(self, *_):
        pass

    def load(self, user_id):
        from app.memory.preferences import UserPreferences
        return self._state.get(user_id) or UserPreferences(user_id=user_id)

    def upsert_partial(self, user_id, patch):
        from app.memory.preferences import UserPreferences
        cur = self.load(user_id)
        for k, v in (patch or {}).items():
            if hasattr(cur, k):
                setattr(cur, k, v)
        self._state[user_id] = cur
        return cur


def test_pause_and_resume_memory_writes():
    _PrefsServiceStub._state.clear()
    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.preferences.PreferencesService", _PrefsServiceStub):
        # Inject a real-looking Supabase client so the route doesn't 503.
        with patch("app.api.me_memory.supabase_client", object()):
            client = _make_client()
            r = client.post("/me/memory/pause", json={"hours": 2})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["incognito"]["active"] is True
            assert body["incognito"]["until"] is not None

            r2 = client.post("/me/memory/resume")
            assert r2.status_code == 200
            assert r2.json()["incognito"]["active"] is False


def test_get_and_put_preferences_round_trip():
    _PrefsServiceStub._state.clear()
    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.preferences.PreferencesService", _PrefsServiceStub), \
         patch("app.api.me_memory.supabase_client", object()):
        client = _make_client()
        r = client.get("/me/memory/preferences")
        assert r.status_code == 200
        assert r.json()["preferences"]["tone"] == "warm"

        r2 = client.put("/me/memory/preferences", json={"tone": "calm_coach"})
        assert r2.status_code == 200
        assert r2.json()["preferences"]["tone"] == "calm_coach"


# ── Memory Mirror v1 — episode mutations ───────────────────────────────────

class _FakeEpisodicRepo:
    """In-process stand-in for EpisodicRepo, scoped per test."""
    def __init__(self, *_):
        pass

    rows = {}  # mem_id -> dict

    def by_user(self, user_id, limit=20):
        return [r for r in self.rows.values() if r["user_id"] == user_id]

    def get_by_id(self, user_id, mem_id):
        r = self.rows.get(mem_id)
        return r if (r and r["user_id"] == user_id) else None

    def archive(self, user_id, mem_id):
        r = self.get_by_id(user_id, mem_id)
        if not r:
            return None
        r["archived_at"] = "2026-04-19T00:00:00Z"
        return r

    def unarchive(self, user_id, mem_id):
        r = self.get_by_id(user_id, mem_id)
        if not r:
            return None
        r["archived_at"] = None
        return r

    def update_summary(self, user_id, mem_id, summary):
        r = self.get_by_id(user_id, mem_id)
        if not r:
            return None
        r["summary"] = summary
        return r

    def delete(self, user_id, mem_id):
        r = self.get_by_id(user_id, mem_id)
        if not r:
            return None
        qid = r.get("qdrant_id")
        del self.rows[mem_id]
        return qid


def test_patch_episode_archive_then_restore():
    _FakeEpisodicRepo.rows = {
        "m1": {"id": "m1", "user_id": "u1", "summary": "first", "themes": [],
               "affect_label": "neutral", "importance": 0.5, "strength": 1.0,
               "created_at": "2026-04-01T00:00:00Z", "archived_at": None,
               "qdrant_id": "q-m1"},
    }
    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.repositories.EpisodicRepo", _FakeEpisodicRepo), \
         patch("app.api.me_memory.supabase_client", object()):
        client = _make_client()
        r = client.patch("/me/memory/episodes/m1", json={"archived": True})
        assert r.status_code == 200
        assert r.json()["memory"]["archived_at"] is not None

        r2 = client.patch("/me/memory/episodes/m1", json={"archived": False})
        assert r2.status_code == 200
        assert r2.json()["memory"]["archived_at"] is None


def test_patch_episode_edit_summary():
    _FakeEpisodicRepo.rows = {
        "m2": {"id": "m2", "user_id": "u1", "summary": "old", "themes": [],
               "affect_label": "neutral", "importance": 0.5, "strength": 1.0,
               "created_at": "2026-04-01T00:00:00Z", "archived_at": None,
               "qdrant_id": "q-m2"},
    }
    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.repositories.EpisodicRepo", _FakeEpisodicRepo), \
         patch("app.api.me_memory.supabase_client", object()):
        client = _make_client()
        r = client.patch("/me/memory/episodes/m2", json={"summary": "rewritten by user"})
        assert r.status_code == 200
        assert r.json()["memory"]["summary"] == "rewritten by user"


def test_patch_episode_rejects_blank_summary():
    _FakeEpisodicRepo.rows = {
        "m3": {"id": "m3", "user_id": "u1", "summary": "x", "themes": [],
               "affect_label": "neutral", "importance": 0.5, "strength": 1.0,
               "created_at": "2026-04-01T00:00:00Z", "archived_at": None,
               "qdrant_id": "q-m3"},
    }
    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.repositories.EpisodicRepo", _FakeEpisodicRepo), \
         patch("app.api.me_memory.supabase_client", object()):
        client = _make_client()
        r = client.patch("/me/memory/episodes/m3", json={"summary": "   "})
        assert r.status_code == 400


def test_delete_episode_soft_archive_default():
    _FakeEpisodicRepo.rows = {
        "m4": {"id": "m4", "user_id": "u1", "summary": "x", "themes": [],
               "affect_label": "neutral", "importance": 0.5, "strength": 1.0,
               "created_at": "2026-04-01T00:00:00Z", "archived_at": None,
               "qdrant_id": "q-m4"},
    }
    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.repositories.EpisodicRepo", _FakeEpisodicRepo), \
         patch("app.api.me_memory.supabase_client", object()):
        client = _make_client()
        r = client.delete("/me/memory/episodes/m4")
        assert r.status_code == 200
        assert r.json()["mode"] == "archived"
        # Row preserved, just flagged.
        assert "m4" in _FakeEpisodicRepo.rows


def test_delete_episode_hard_purges_qdrant():
    _FakeEpisodicRepo.rows = {
        "m5": {"id": "m5", "user_id": "u1", "summary": "x", "themes": [],
               "affect_label": "neutral", "importance": 0.5, "strength": 1.0,
               "created_at": "2026-04-01T00:00:00Z", "archived_at": None,
               "qdrant_id": "q-m5"},
    }
    purged = []

    class _FakeQ:
        def delete_points(self, collection, ids):
            purged.append((collection, list(ids)))

    with patch("app.api.me_memory.validate_user_token", return_value="u1"), \
         patch("app.memory.repositories.EpisodicRepo", _FakeEpisodicRepo), \
         patch("app.memory.qdrant_v2.get_qdrant", return_value=_FakeQ()), \
         patch("app.api.me_memory.supabase_client", object()):
        client = _make_client()
        r = client.delete("/me/memory/episodes/m5?hard=1")
        assert r.status_code == 200
        assert r.json()["mode"] == "deleted"
        assert "m5" not in _FakeEpisodicRepo.rows
        assert purged and purged[0][1] == ["q-m5"]


# ── EpisodicService.write must skip when incognito=True ────────────────────

@pytest.mark.asyncio
async def test_episodic_write_is_noop_when_incognito():
    from app.memory.episodic import EpisodicService
    from app.memory.qdrant_v2 import InMemoryQdrant

    class _FakeSb:
        pass

    # Ensure embed_fn is never called: pass a function that would explode if it were.
    async def _embed(_):  # pragma: no cover
        raise AssertionError("embed_fn should not be called when incognito=True")

    svc = EpisodicService(sb=_FakeSb(), qdrant=InMemoryQdrant(), embed_fn=_embed)
    out = await svc.write(
        user_id="u-inc",
        summary="should not persist",
        importance=0.9,
        incognito=True,
    )
    assert out is None
