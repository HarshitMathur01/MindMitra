"""
app/core/models.py — The ModelRegistry.

Single source of truth for which provider+model is used for which pipeline role.
Read by every new MITRA-stack module (providers/, pipeline/, memory/, jobs/).

Bound to the credentials MindMitra actually has: Groq + Azure OpenAI (gpt-5-mini)
+ Gemini + Z.AI/GLM. No OpenAI direct, no Anthropic.

Role taxonomy aligns with `docs/MITRA.md` and `docs/platform.md`.

Usage:

    from app.core.models import ModelRegistry, Role

    cfg = ModelRegistry.for_role(Role.CLASSIFIER)
    # cfg.provider == "groq", cfg.model == "llama-3.1-8b-instant"
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ── Pipeline roles ──────────────────────────────────────────────────────────

class Role(str, Enum):
    """Semantic roles used by the MITRA pipeline."""

    CLASSIFIER = "classifier"            # affect + intent + retrieval-need
    CRISIS_CONFIRMER = "crisis_confirmer"
    CRITIC = "critic"                    # 5-rubric draft critic
    IMPORTANCE_SCORER = "importance"     # write-time memory gate

    GENERATOR_PRIMARY = "generator_primary"      # authoritative final response
    GENERATOR_SPECULATIVE = "generator_speculative"  # fast first-token draft
    GENERATOR_BACKUP = "generator_backup"        # cross-provider failover

    EXTRACTOR = "extractor"              # post-turn memory extraction (long ctx)
    REFLECTION = "reflection"            # nightly higher-order synthesis

    EMBEDDINGS = "embeddings"            # multilingual; default BGE-M3 self-hosted
    EMBEDDINGS_FALLBACK = "embeddings_fallback"

    ASR = "asr"                          # speech-to-text (Whisper)


# ── Provider tags ───────────────────────────────────────────────────────────

class Provider(str, Enum):
    GROQ = "groq"
    AZURE_OPENAI = "azure_openai"
    GEMINI = "gemini"
    GLM = "glm"           # Z.AI / Zhipu
    LOCAL_BGE = "local_bge"
    GEMINI_EMBED = "gemini_embed"


# ── Per-role configuration ──────────────────────────────────────────────────

@dataclass(frozen=True)
class ModelConfig:
    role: Role
    provider: Provider
    model: str
    max_tokens: int = 1024
    temperature: float = 0.4
    timeout_s: float = 30.0
    extra: Dict[str, Any] = field(default_factory=dict)


# Defaults aligned with §10.1 of the architecture proposal. Override per-deploy
# with env vars `MM_MODEL_<ROLE>=<provider>:<model>` (e.g.
# `MM_MODEL_CLASSIFIER=groq:llama-3.3-70b-versatile`).
_DEFAULTS: Dict[Role, ModelConfig] = {
    Role.CLASSIFIER: ModelConfig(
        role=Role.CLASSIFIER,
        provider=Provider.GROQ,
        model="llama-3.1-8b-instant",
        max_tokens=256,
        temperature=0.0,
        timeout_s=8.0,
    ),
    Role.CRISIS_CONFIRMER: ModelConfig(
        role=Role.CRISIS_CONFIRMER,
        provider=Provider.GROQ,
        model="llama-3.1-8b-instant",
        max_tokens=64,
        temperature=0.0,
        timeout_s=6.0,
    ),
    Role.CRITIC: ModelConfig(
        role=Role.CRITIC,
        provider=Provider.GROQ,
        model="llama-3.1-8b-instant",
        max_tokens=512,
        temperature=0.0,
        timeout_s=10.0,
    ),
    Role.IMPORTANCE_SCORER: ModelConfig(
        role=Role.IMPORTANCE_SCORER,
        provider=Provider.GROQ,
        model="llama-3.1-8b-instant",
        max_tokens=128,
        temperature=0.0,
        timeout_s=6.0,
    ),
    Role.GENERATOR_PRIMARY: ModelConfig(
        role=Role.GENERATOR_PRIMARY,
        provider=Provider.AZURE_OPENAI,
        model=os.getenv("GLM_MODEL", "gpt-5-mini"),  # GLM_* vars actually point at Azure
        max_tokens=900,
        temperature=0.7,
        timeout_s=30.0,
    ),
    Role.GENERATOR_SPECULATIVE: ModelConfig(
        role=Role.GENERATOR_SPECULATIVE,
        provider=Provider.GEMINI,
        model="gemini-2.5-flash",
        max_tokens=400,
        temperature=0.7,
        timeout_s=15.0,
    ),
    Role.GENERATOR_BACKUP: ModelConfig(
        role=Role.GENERATOR_BACKUP,
        provider=Provider.GLM,
        model="glm-4-32b-0414-128k",
        max_tokens=900,
        temperature=0.7,
        timeout_s=30.0,
    ),
    Role.EXTRACTOR: ModelConfig(
        role=Role.EXTRACTOR,
        provider=Provider.GEMINI,
        model="gemini-2.5-flash",
        max_tokens=2048,
        temperature=0.1,
        timeout_s=30.0,
    ),
    Role.REFLECTION: ModelConfig(
        role=Role.REFLECTION,
        provider=Provider.GEMINI,
        model="gemini-2.5-flash",
        max_tokens=2048,
        temperature=0.3,
        timeout_s=60.0,
    ),
    Role.EMBEDDINGS: ModelConfig(
        role=Role.EMBEDDINGS,
        provider=Provider.LOCAL_BGE,
        model="BAAI/bge-m3",
        timeout_s=10.0,
        extra={"dim": 1024},
    ),
    Role.EMBEDDINGS_FALLBACK: ModelConfig(
        role=Role.EMBEDDINGS_FALLBACK,
        provider=Provider.GEMINI_EMBED,
        model="text-embedding-004",
        timeout_s=10.0,
        extra={"dim": 768},
    ),
    Role.ASR: ModelConfig(
        role=Role.ASR,
        provider=Provider.GROQ,
        model="whisper-large-v3-turbo",
        timeout_s=30.0,
    ),
}


# ── Registry ────────────────────────────────────────────────────────────────

class ModelRegistry:
    """Singleton-style accessor; defaults are immutable, env overrides supported."""

    @staticmethod
    def for_role(role: Role) -> ModelConfig:
        cfg = _DEFAULTS[role]
        # Env override format: MM_MODEL_<ROLE>=<provider>:<model>
        override_key = f"MM_MODEL_{role.value.upper()}"
        override = os.getenv(override_key, "").strip()
        if not override or ":" not in override:
            return cfg
        try:
            prov_str, model_str = override.split(":", 1)
            provider = Provider(prov_str.strip().lower())
        except (ValueError, KeyError):
            return cfg
        return ModelConfig(
            role=cfg.role,
            provider=provider,
            model=model_str.strip(),
            max_tokens=cfg.max_tokens,
            temperature=cfg.temperature,
            timeout_s=cfg.timeout_s,
            extra=dict(cfg.extra),
        )

    @staticmethod
    def all() -> List[ModelConfig]:
        return [ModelRegistry.for_role(r) for r in Role]

    @staticmethod
    def required_env_for(provider: Provider) -> List[str]:
        """Return env vars that must be set for a given provider to be usable."""
        return {
            Provider.GROQ: ["GROQ_API_KEY"],
            Provider.AZURE_OPENAI: ["AZURE_API_KEY", "GLM_BASE_URL", "GLM_MODEL"],
            Provider.GEMINI: ["GOOGLE_API_KEY"],
            Provider.GLM: ["ZAI_API_KEY"],
            Provider.LOCAL_BGE: [],         # purely local
            Provider.GEMINI_EMBED: ["GOOGLE_API_KEY"],
        }[provider]


# ── Feature flags (single, central place) ───────────────────────────────────

def _flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


class FeatureFlags:
    """All MITRA migration flags in one module so ops can grep them."""

    @staticmethod
    def mitra_stack_enabled() -> bool:
        """Master switch for the new MITRA pipeline (Phase 5 cutover)."""
        return _flag("MITRA_STACK_ENABLED", default=False)

    @staticmethod
    def mitra_crisis_v2_enabled() -> bool:
        """Phase 1 — new C-SSRS crisis fast-path."""
        return _flag("MITRA_CRISIS_V2_ENABLED", default=False)

    @staticmethod
    def mitra_critic_v0_enabled() -> bool:
        """Phase 1 — minimal critic on top of legacy generator."""
        return _flag("MITRA_CRITIC_V0_ENABLED", default=False)

    @staticmethod
    def mitra_memory_v2_dual_write() -> bool:
        """Phase 2 — dual-write memory to new + legacy stores."""
        return _flag("MITRA_MEMORY_V2_DUAL_WRITE", default=False)

    @staticmethod
    def mitra_consolidation_enabled() -> bool:
        """Phase 4 — nightly reflection + decay."""
        return _flag("MITRA_CONSOLIDATION_ENABLED", default=False)

    @staticmethod
    def mitra_dual_track_enabled() -> bool:
        """Phase 3 — Track A streaming + Track B parallel deep generation."""
        return _flag("MITRA_DUAL_TRACK_ENABLED", default=False)

    @staticmethod
    def debug_pipeline() -> bool:
        return _flag("MM_PIPELINE_DEBUG", default=False)

    @staticmethod
    def debug_memory() -> bool:
        return _flag("MM_MEMORY_TRACE", default=False)

    @staticmethod
    def disable_memory_fast_path() -> bool:
        return _flag("MM_DISABLE_MEMORY_FAST_PATH", default=False)

    @staticmethod
    def allow_eval_trace() -> bool:
        return _flag("ALLOW_EVAL_TRACE", default=False)
