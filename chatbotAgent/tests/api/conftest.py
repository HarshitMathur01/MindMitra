"""FastAPI contract fixtures."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def app():
    import os

    os.environ.setdefault("ENV", "test")
    os.environ.setdefault("SKIP_AUTH", "true")
    os.environ.setdefault("MHA_V3_ENABLED", "1")
    os.environ.setdefault("DEV_USER_ID", "00000000-0000-0000-0000-000000000001")
    from app.core import env as env_mod

    env_mod.reload_env()
    from app.main import app as fastapi_app

    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)
