"""Config/YAML runtime settings regression tests."""
from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def temp_config_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from app.core import env as env_mod
    from app.core.config import config

    override_names = (
        "ENV",
        "MHA_V3_ENABLED",
        "SESSION_TTL_SECONDS",
        "CHAT_DAILY_LIMIT",
        "SUPABASE_URL",
        "QDRANT_URL",
        "QDRANT_EPISODIC_COLLECTION",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_DEPLOYMENT_NAME",
        "AZURE_MODEL_FAMILY",
        "LLM_PROVIDER_CHAIN",
        "LOG_LEVEL",
        "LOG_FORMAT",
        "LOG_VERBOSE_CONTEXT",
        "SKIP_AUTH",
        "DEV_USER_ID",
    )
    for name in override_names:
        monkeypatch.delenv(name, raising=False)

    original_path = config._config_path
    try:
        yield tmp_path / "config.yaml"
    finally:
        config.reload(original_path)
        env_mod.env.cache_clear()


def _write_minimal_config(path: Path, *, daily_limit: int = 7, deployment: str = "gpt-4o") -> None:
    path.write_text(
        f"""
app:
  environment: "test"
  mha_v3_enabled: true
auth:
  skip_auth: true
  dev_user_id: "yaml-dev-user"
session:
  ttl_seconds: 321
  daily_chat_limit: {daily_limit}
  dev_daily_chat_limit: 777
supabase:
  url: "https://yaml-project.supabase.co"
qdrant:
  url: "http://yaml-qdrant:6333"
  episodic_collection: "yaml_episodic"
providers:
  primary: "azure"
  chain: "groq"
  azure_openai:
    endpoint: "https://yaml-azure.openai.azure.com"
    deployment_name: "{deployment}"
    api_version: "2025-01-01-preview"
    timeout_s: 9.5
  groq:
    signal_model: "yaml-signal"
    safety_model: "yaml-safety"
    fallback_model: "yaml-fallback"
logging:
  level: "WARNING"
  format: "json"
  verbose_context: true
""",
        encoding="utf-8",
    )


def test_yaml_values_populate_v3_env(temp_config_path: Path) -> None:
    from app.core import env as env_mod
    from app.core.config import config

    _write_minimal_config(temp_config_path)
    config.reload(temp_config_path)
    e = env_mod.reload_env()

    assert e.session_ttl_seconds == 321
    assert e.chat_daily_limit == 777
    assert e.supabase_url == "https://yaml-project.supabase.co"
    assert e.qdrant_episodic_collection == "yaml_episodic"
    assert e.azure_endpoint == "https://yaml-azure.openai.azure.com"
    assert e.azure_model_family == "classic"
    assert e.llm_provider_chain == "groq"
    assert e.log_level == "WARNING"
    assert e.log_format == "json"
    assert e.log_verbose_context is True


def test_env_overrides_yaml_values(temp_config_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod
    from app.core.config import config

    _write_minimal_config(temp_config_path, daily_limit=11, deployment="gpt-4o")
    config.reload(temp_config_path)
    monkeypatch.setenv("CHAT_DAILY_LIMIT", "99")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5-mini")
    monkeypatch.setenv("AZURE_MODEL_FAMILY", "gpt5_reasoning")
    monkeypatch.setenv("LOG_LEVEL", "ERROR")

    e = env_mod.reload_env()

    assert e.chat_daily_limit == 99
    assert e.azure_deployment == "gpt-5-mini"
    assert e.azure_model_family == "gpt5_reasoning"
    assert e.log_level == "ERROR"


def test_required_validation_accepts_yaml_backed_non_secrets(
    temp_config_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import env as env_mod
    from app.core.config import config

    _write_minimal_config(temp_config_path)
    config.reload(temp_config_path)
    for name in (
        "ENV",
        "AZURE_OPENAI_API_KEY",
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_JWT_SECRET",
        "SECRET_KEY",
    ):
        monkeypatch.setenv(name, f"{name.lower()}-test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    ok, missing, errors, present, _warnings = env_mod.validate_required_env()

    assert ok is True
    assert missing == []
    assert errors == []
    assert present["SUPABASE_URL"] == "present"
    assert present["QDRANT_URL"] == "present"
    assert present["AZURE_OPENAI_ENDPOINT"] == "present"


@pytest.mark.asyncio
async def test_auth_reads_reloaded_settings(temp_config_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import env as env_mod
    from app.core.auth import validate_user_token
    from app.core.config import config

    _write_minimal_config(temp_config_path)
    config.reload(temp_config_path)
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("SKIP_AUTH", "true")
    monkeypatch.setenv("DEV_USER_ID", "first-user")
    env_mod.reload_env()

    assert await validate_user_token(None, None) == "first-user"

    monkeypatch.setenv("DEV_USER_ID", "second-user")
    env_mod.reload_env()

    assert await validate_user_token(None, None) == "second-user"


def test_supabase_proxy_bool_uses_reloaded_settings(
    temp_config_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import env as env_mod
    from app.core.config import config
    from app.services import supabase_service

    _write_minimal_config(temp_config_path)
    config.reload(temp_config_path)
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "service-key")
    env_mod.reload_env()

    assert bool(supabase_service.supabase_client) is True

    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    env_mod.reload_env()

    assert bool(supabase_service.supabase_client) is False


def test_validate_redis_url_upstash_requires_tls() -> None:
    from app.core.env import validate_redis_url

    assert validate_redis_url("redis://default:secret@host.upstash.io:6379") is not None
    assert validate_redis_url("rediss://default:secret@host.upstash.io:6379") is None


def test_validate_redis_url_rejects_https() -> None:
    from app.core.env import validate_redis_url

    err = validate_redis_url("https://host.upstash.io")
    assert err is not None
    assert "redis://" in err or "rediss://" in err


def test_validate_required_env_fails_on_invalid_redis_url(
    temp_config_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import env as env_mod
    from app.core.config import config

    _write_minimal_config(temp_config_path)
    config.reload(temp_config_path)
    for name in (
        "ENV",
        "AZURE_OPENAI_API_KEY",
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_JWT_SECRET",
        "SECRET_KEY",
    ):
        monkeypatch.setenv(name, "x")
    monkeypatch.setenv("REDIS_URL", "redis://default:x@db.upstash.io:6379")

    ok, missing, errors, _present, _warnings = env_mod.validate_required_env()
    assert ok is False
    assert not missing
    assert len(errors) == 1
