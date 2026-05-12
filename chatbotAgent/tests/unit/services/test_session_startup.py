"""Session startup latency and fallback tests."""
from __future__ import annotations

import asyncio
import time

import pytest


@pytest.fixture(autouse=True)
def _isolated_session_state(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("REDIS_URL", "")
    monkeypatch.setenv("SESSION_PROFILE_LOAD_TIMEOUT_S", "0.05")
    from app.core import connections, env as env_mod
    from app.services import session_service

    env_mod.reload_env()
    connections.reset_all()
    session_service._INMEM_ACTIVE.clear()
    session_service._INMEM_SESSIONS.clear()
    yield
    env_mod.reload_env()
    connections.reset_all()
    session_service._INMEM_ACTIVE.clear()
    session_service._INMEM_SESSIONS.clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_session_startup_times_out_slow_profile_loads(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import session_service

    async def slow_profile(*_args, **_kwargs):
        await asyncio.sleep(0.25)
        return {"should_not": "arrive"}

    monkeypatch.setattr(session_service.profile_service, "load_semantic_profile", slow_profile)
    monkeypatch.setattr(session_service.profile_service, "load_procedural_profile", slow_profile)
    monkeypatch.setattr(session_service.profile_service, "load_longitudinal", slow_profile)
    monkeypatch.setattr(session_service.profile_service, "fetch_most_recent_episodic", slow_profile)

    started = time.perf_counter()
    session = await session_service.session_startup("user-timeout", requested_session_id="new")
    elapsed_ms = (time.perf_counter() - started) * 1000

    assert elapsed_ms < 500, f"session_startup should not wait on slow caches ({elapsed_ms:.0f}ms)"
    assert session.current_mode == "companion"
    assert session.cultural_frame_id == "metro_social"
    assert session.longitudinal_risk_flag is False
    assert session.previous_session_peak_urgency == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_session_startup_times_out_slow_previous_episodic(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import session_service

    async def fast_semantic(_user_id: str):
        return {"cultural_frame_id": "metro_social", "total_sessions": 0}

    async def fast_procedural(_user_id: str):
        return {"style_vector": {}, "dependency_risk_counter": 0, "social_mentions_count": 0}

    async def fast_longitudinal(_user_id: str):
        return {"longitudinal_risk_flag": False, "affect_series": [], "phq2_scores": []}

    async def slow_previous(_user_id: str):
        await asyncio.sleep(0.25)
        return {"peak_urgency": 2}

    monkeypatch.setattr(session_service.profile_service, "load_semantic_profile", fast_semantic)
    monkeypatch.setattr(session_service.profile_service, "load_procedural_profile", fast_procedural)
    monkeypatch.setattr(session_service.profile_service, "load_longitudinal", fast_longitudinal)
    monkeypatch.setattr(session_service.profile_service, "fetch_most_recent_episodic", slow_previous)

    started = time.perf_counter()
    session = await session_service.session_startup("user-blocking-qdrant", requested_session_id="new")
    elapsed_ms = (time.perf_counter() - started) * 1000

    assert elapsed_ms < 500, f"slow Qdrant prefetch leaked into startup ({elapsed_ms:.0f}ms)"
    assert session.current_mode == "companion"
    assert session.previous_session_peak_urgency == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_session_startup_uses_previous_episodic_for_recovery_check(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import session_service

    async def semantic(_user_id: str):
        return {"cultural_frame_id": "working_professional", "total_sessions": 3}

    async def procedural(_user_id: str):
        return {"style_vector": {}, "dependency_risk_counter": 0, "social_mentions_count": 0}

    async def longitudinal(_user_id: str):
        return {"longitudinal_risk_flag": False, "affect_series": [], "phq2_scores": []}

    async def previous(_user_id: str):
        return {"peak_urgency": 2, "summary_text": "Last session had high distress."}

    monkeypatch.setattr(session_service.profile_service, "load_semantic_profile", semantic)
    monkeypatch.setattr(session_service.profile_service, "load_procedural_profile", procedural)
    monkeypatch.setattr(session_service.profile_service, "load_longitudinal", longitudinal)
    monkeypatch.setattr(session_service.profile_service, "fetch_most_recent_episodic", previous)

    session = await session_service.session_startup("user-recovery", requested_session_id="new")

    assert session.current_mode == "recovery_check"
    assert session.cultural_frame_id == "working_professional"
    assert session.previous_session_peak_urgency == 2


@pytest.mark.unit
def test_session_service_does_not_create_throwaway_event_loops() -> None:
    import inspect

    from app.services import session_service

    source = inspect.getsource(session_service)
    assert "def _run_offloop" not in source
    assert "asyncio.run(" not in source
