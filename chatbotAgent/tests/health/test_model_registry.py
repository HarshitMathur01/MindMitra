"""Phase 0 — ModelRegistry & FeatureFlags unit tests (offline)."""
from __future__ import annotations

import importlib
import os

import pytest


def _reload_models_module():
    import app.core.models as m
    importlib.reload(m)
    return m


def test_registry_returns_a_config_for_every_role():
    from app.core.models import ModelRegistry, Role

    cfgs = {r: ModelRegistry.for_role(r) for r in Role}
    assert len(cfgs) == len(Role)
    for r, c in cfgs.items():
        assert c.role == r
        assert c.provider is not None
        assert c.model and isinstance(c.model, str)


def test_generator_primary_is_azure_gpt5mini_by_default(monkeypatch):
    monkeypatch.delenv("MM_MODEL_GENERATOR_PRIMARY", raising=False)
    monkeypatch.setenv("GLM_MODEL", "gpt-5-mini")
    m = _reload_models_module()
    cfg = m.ModelRegistry.for_role(m.Role.GENERATOR_PRIMARY)
    assert cfg.provider == m.Provider.AZURE_OPENAI
    assert cfg.model == "gpt-5-mini"


def test_env_override_works(monkeypatch):
    monkeypatch.setenv("MM_MODEL_CLASSIFIER", "groq:llama-3.3-70b-versatile")
    m = _reload_models_module()
    cfg = m.ModelRegistry.for_role(m.Role.CLASSIFIER)
    assert cfg.provider == m.Provider.GROQ
    assert cfg.model == "llama-3.3-70b-versatile"


def test_required_env_listed_per_provider():
    from app.core.models import ModelRegistry, Provider

    assert "GROQ_API_KEY" in ModelRegistry.required_env_for(Provider.GROQ)
    assert "GOOGLE_API_KEY" in ModelRegistry.required_env_for(Provider.GEMINI)
    assert "ZAI_API_KEY" in ModelRegistry.required_env_for(Provider.GLM)
    azure = ModelRegistry.required_env_for(Provider.AZURE_OPENAI)
    assert "AZURE_API_KEY" in azure and "GLM_BASE_URL" in azure


# ── Feature flags ────────────────────────────────────────────────────────────

def test_feature_flags_default_off(monkeypatch):
    for k in [
        "MITRA_STACK_ENABLED",
        "MITRA_CRISIS_V2_ENABLED",
        "MITRA_CRITIC_V0_ENABLED",
        "MITRA_MEMORY_V2_DUAL_WRITE",
        "MITRA_CONSOLIDATION_ENABLED",
    ]:
        monkeypatch.delenv(k, raising=False)
    from app.core.models import FeatureFlags
    assert FeatureFlags.mitra_stack_enabled() is False
    assert FeatureFlags.mitra_crisis_v2_enabled() is False
    assert FeatureFlags.mitra_critic_v0_enabled() is False
    assert FeatureFlags.mitra_memory_v2_dual_write() is False
    assert FeatureFlags.mitra_consolidation_enabled() is False


@pytest.mark.parametrize("truthy", ["1", "true", "TRUE", "yes", "on"])
def test_feature_flag_truthy_values(monkeypatch, truthy):
    monkeypatch.setenv("MITRA_STACK_ENABLED", truthy)
    from app.core.models import FeatureFlags
    assert FeatureFlags.mitra_stack_enabled() is True


def test_feature_flag_falsy_values(monkeypatch):
    monkeypatch.setenv("MITRA_STACK_ENABLED", "no")
    from app.core.models import FeatureFlags
    assert FeatureFlags.mitra_stack_enabled() is False
