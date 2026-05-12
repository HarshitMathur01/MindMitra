"""
Shared pytest fixtures for MindMitra chatbotAgent.

Run from repository `chatbotAgent/`:

    pytest tests -v

Environment:
    `chatbotAgent/.env` is loaded automatically before any test runs.
    Set `PYTEST_DOTENV=0` to skip.

All tests (unit + contract + integration) in one run:

    RUN_INTEGRATION=1 pytest tests -v --tb=short

Integration-only:

    RUN_INTEGRATION=1 pytest tests -m integration -v
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

_CHATBOT_ROOT = Path(__file__).resolve().parents[1]
_DOTENV_PATH = _CHATBOT_ROOT / ".env"


def _load_dotenv_for_tests() -> None:
    if os.getenv("PYTEST_DOTENV", "1").lower() in ("0", "false", "no"):
        return
    if _DOTENV_PATH.is_file():
        load_dotenv(dotenv_path=_DOTENV_PATH, override=True)
    else:
        load_dotenv(override=True)


_load_dotenv_for_tests()


@pytest.fixture
def auth_headers() -> dict:
    """Bearer token or empty when SKIP_AUTH is used on the server."""
    tok = os.getenv("EVAL_AUTH_TOKEN", os.getenv("SUPABASE_TEST_JWT", ""))
    if tok:
        return {"Authorization": f"Bearer {tok}"}
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def eval_base_url() -> str:
    return os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


@pytest.fixture(scope="session")
def app():
    """Import the FastAPI app once for offline route/health contract tests."""
    os.environ.setdefault("ENV", "test")
    os.environ.setdefault("SKIP_AUTH", "true")
    os.environ.setdefault("MHA_V3_ENABLED", "1")
    os.environ.setdefault("DEV_USER_ID", "pytest-health-user")

    from app.core import env as env_mod

    env_mod.reload_env()
    from app.main import app as fastapi_app

    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)


def pytest_collection_modifyitems(config, items):
    if os.getenv("RUN_INTEGRATION", "").lower() not in ("1", "true", "yes"):
        skip_int = pytest.mark.skip(reason="set RUN_INTEGRATION=1 to run integration tests")
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip_int)
