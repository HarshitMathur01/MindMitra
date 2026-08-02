"""v3 runtime settings.

Non-secret defaults come from ``chatbotAgent/config.yaml``. Environment
variables are reserved for secrets, platform-injected values, and explicit
operator overrides. The rest of the app should read this module instead of
calling ``os.getenv`` directly.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional
from urllib.parse import urlparse

from .config import config

logger = logging.getLogger(__name__)


def _secret(name: str, *aliases: str) -> str:
    for candidate in (name, *aliases):
        value = os.getenv(candidate, "").strip()
        if value:
            return value
    return ""


def _env_present(name: str, *aliases: str) -> bool:
    return any(bool(os.getenv(candidate, "").strip()) for candidate in (name, *aliases))


def _default_chat_daily_limit() -> int:
    """Keep prod conservative while making local SKIP_AUTH testing usable."""
    if _env_present("CHAT_DAILY_LIMIT"):
        return config.get_int("session.daily_chat_limit", 40, env="CHAT_DAILY_LIMIT")

    env_name = config.get_str("app.environment", "dev", env="ENV").lower()
    skip_auth = config.get_bool("auth.skip_auth", False, env="SKIP_AUTH")
    if skip_auth and env_name in ("", "dev", "development", "local", "test", "testing"):
        return config.get_int("session.dev_daily_chat_limit", 1000)
    return config.get_int("session.daily_chat_limit", 40)


def _azure_model_family() -> str:
    explicit = config.get_str("providers.azure_openai.model_family", "", env="AZURE_MODEL_FAMILY").lower()
    if explicit:
        return explicit
    deployment = config.get_str(
        "providers.azure_openai.deployment_name",
        "gpt-5-mini",
        env="AZURE_OPENAI_DEPLOYMENT_NAME",
    ).lower()
    return "gpt5_reasoning" if "gpt-5" in deployment else "classic"


@dataclass(frozen=True)
class V3Env:
    # Master kill-switch. v3 is the production architecture; defaults to True
    # so that a fresh deploy "just works" without the operator having to know
    # about the flag. Set ``MHA_V3_ENABLED=0`` only when intentionally taking
    # the HTTP chat endpoint offline (e.g. for an emergency rollback drill).
    enabled: bool = field(default_factory=lambda: config.get_bool("app.mha_v3_enabled", True, env="MHA_V3_ENABLED"))

    # Environment tag (used for safety gates around SKIP_AUTH and similar).
    env_name: str = field(default_factory=lambda: config.get_str("app.environment", "dev", env="ENV").lower())

    # ── Logging ───────────────────────────────────────────────────────────
    log_level: str = field(default_factory=lambda: config.get_str("logging.level", "INFO", env="LOG_LEVEL").upper())
    log_format: str = field(default_factory=lambda: config.get_str("logging.format", "dev", env="LOG_FORMAT").lower())
    log_verbose_context: bool = field(
        default_factory=lambda: config.get_bool("logging.verbose_context", False, env="LOG_VERBOSE_CONTEXT")
    )

    # ── Session / Redis ────────────────────────────────────────────────────
    redis_url: str = field(default_factory=lambda: _secret("REDIS_URL"))
    session_ttl_seconds: int = field(
        default_factory=lambda: config.get_int("session.ttl_seconds", 1500, env="SESSION_TTL_SECONDS")
    )
    redis_keyspace_required: bool = field(
        default_factory=lambda: config.get_bool("redis.keyspace_required", True, env="REDIS_KEYSPACE_REQUIRED")
    )
    redis_keyspace_mode: str = field(
        default_factory=lambda: config.get_str(
            "redis.keyspace_mode",
            "auto",
            env="REDIS_KEYSPACE_MODE",
        ).lower()
    )
    redis_session_lock_ttl_s: int = field(
        default_factory=lambda: config.get_int("redis.session_lock_ttl_s", 60, env="REDIS_SESSION_LOCK_TTL_S")
    )
    session_profile_load_timeout_s: float = field(
        default_factory=lambda: config.get_float(
            "session.profile_load_timeout_s",
            4.0,
            env="SESSION_PROFILE_LOAD_TIMEOUT_S",
        )
    )

    # ── Supabase ───────────────────────────────────────────────────────────
    supabase_url: str = field(default_factory=lambda: config.get_str("supabase.url", "", env="SUPABASE_URL"))
    supabase_service_key: str = field(default_factory=lambda: _secret("SUPABASE_SERVICE_KEY", "SUPABASE_KEY"))
    supabase_jwt_secret: str = field(default_factory=lambda: _secret("SUPABASE_JWT_SECRET"))
    secret_key: str = field(default_factory=lambda: _secret("SECRET_KEY"))

    # ── Qdrant ─────────────────────────────────────────────────────────────
    qdrant_url: str = field(default_factory=lambda: config.get_str("qdrant.url", "", env="QDRANT_URL"))
    qdrant_api_key: Optional[str] = field(default_factory=lambda: _secret("QDRANT_API_KEY") or None)
    qdrant_episodic_collection: str = field(
        default_factory=lambda: config.get_str(
            "qdrant.episodic_collection",
            "episodic_memories",
            env="QDRANT_EPISODIC_COLLECTION",
        )
    )
    qdrant_kb_collection: str = field(
        default_factory=lambda: config.get_str("qdrant.kb_collection", "knowledge_base", env="QDRANT_KB_COLLECTION")
    )

    # ── LLM providers ──────────────────────────────────────────────────────
    llm_primary_provider: str = field(
        default_factory=lambda: config.get_str("providers.primary", "azure", env="LLM_PRIMARY_PROVIDER").lower()
    )
    llm_provider_chain: str = field(
        default_factory=lambda: config.get_str("providers.chain", "", env="LLM_PROVIDER_CHAIN").lower()
    )
    azure_endpoint: str = field(
        default_factory=lambda: config.get_str("providers.azure_openai.endpoint", "", env="AZURE_OPENAI_ENDPOINT")
    )
    azure_api_key: str = field(default_factory=lambda: _secret("AZURE_OPENAI_API_KEY", "AZURE_API_KEY"))
    azure_deployment: str = field(
        default_factory=lambda: config.get_str(
            "providers.azure_openai.deployment_name",
            "gpt-5-mini",
            env="AZURE_OPENAI_DEPLOYMENT_NAME",
        )
    )
    # GPT-5 and future reasoning models require api-version >= 2025-01-01-preview
    azure_api_version: str = field(
        default_factory=lambda: config.get_str(
            "providers.azure_openai.api_version",
            "2025-01-01-preview",
            env="AZURE_OPENAI_API_VERSION",
        )
    )
    azure_timeout_s: float = field(
        default_factory=lambda: config.get_float("providers.azure_openai.timeout_s", 12.0, env="AZURE_TIMEOUT_S")
    )

    # ── Azure GPT-5 / reasoning-model capability flags ─────────────────────
    # Auto-detected from the deployment name: any name containing "gpt-5" is
    # treated as a reasoning model and gets GPT-5-safe parameters.
    # Override explicitly via AZURE_MODEL_FAMILY=gpt5_reasoning|classic.
    azure_model_family: str = field(default_factory=_azure_model_family)
    # reasoning_effort controls how many reasoning tokens the model spends.
    # "low" → ~100-200 reasoning tokens, fastest, recommended for chat latency.
    # "medium" → ~500-1000 tokens, more thoughtful.
    # "high" → max reasoning, slow.
    azure_reasoning_effort: str = field(
        default_factory=lambda: config.get_str(
            "providers.azure_openai.reasoning_effort",
            "low",
            env="AZURE_REASONING_EFFORT",
        ).lower()
    )
    # Total token budget for a single Azure reasoning call.
    # Reasoning tokens + output tokens both count against this.
    # At reasoning_effort="low", the model consumes ~200-400 reasoning tokens,
    # leaving ~3600 tokens for visible output — enough for a full response.
    # 1600 was too tight: reasoning could exhaust the budget, producing <10 words
    # and triggering the safety-gate length fallback.
    azure_max_completion_tokens: int = field(
        default_factory=lambda: config.get_int(
            "providers.azure_openai.max_completion_tokens",
            4000,
            env="AZURE_MAX_COMPLETION_TOKENS",
        )
    )

    groq_api_key: str = field(default_factory=lambda: _secret("GROQ_API_KEY"))
    groq_signal_model: str = field(
        default_factory=lambda: config.get_str(
            "providers.groq.signal_model",
            "llama-3.1-8b-instant",
            env="GROQ_SIGNAL_MODEL",
        )
    )
    groq_safety_model: str = field(
        default_factory=lambda: config.get_str(
            "providers.groq.safety_model",
            "llama-3.1-8b-instant",
            env="GROQ_SAFETY_MODEL",
        )
    )
    groq_fallback_model: str = field(
        default_factory=lambda: config.get_str(
            "providers.groq.fallback_model",
            "llama-3.3-70b-versatile",
            env="GROQ_FALLBACK_MODEL",
        )
    )
    groq_timeout_s: float = field(
        default_factory=lambda: config.get_float("providers.groq.timeout_s", 4.0, env="GROQ_TIMEOUT_S")
    )
    signal_extraction_timeout_s: float = field(
        default_factory=lambda: config.get_float(
            "providers.groq.signal_extraction_timeout_s",
            6.0,
            env="SIGNAL_EXTRACTION_TIMEOUT_S",
        )
    )

    # ── Speech ─────────────────────────────────────────────────────────────
    transcribe_timeout_s: float = field(
        default_factory=lambda: config.get_float("speech.transcribe_timeout_s", 15.0, env="TRANSCRIBE_TIMEOUT_S")
    )
    transcribe_max_audio_bytes: int = field(
        default_factory=lambda: config.get_int(
            "speech.transcribe_max_audio_bytes",
            6 * 1024 * 1024,
            env="TRANSCRIBE_MAX_AUDIO_BYTES",
        )
    )
    transcribe_concurrency_limit: int = field(
        default_factory=lambda: config.get_int(
            "speech.transcribe_concurrency_limit",
            2,
            env="TRANSCRIBE_CONCURRENCY_LIMIT",
        )
    )
    azure_speech_key: str = field(default_factory=lambda: _secret("AZURE_SPEECH_KEY", "AZURE_TTS_KEY"))
    azure_speech_region: str = field(
        default_factory=lambda: config.get_str(
            "speech.azure_region",
            "eastasia",
            env=("AZURE_SPEECH_REGION", "AZURE_TTS_REGION"),
        )
    )
    azure_speech_token_ttl_s: int = field(
        default_factory=lambda: config.get_int("speech.azure_token_ttl_s", 540, env="AZURE_SPEECH_TOKEN_TTL_S")
    )

    # Anam.ai hosted avatar. Only used by POST /avatar/session-token, which
    # brokers a short-lived session token so the API key never reaches the
    # browser. Optional: the frontend defaults to the local TalkingHead
    # renderer unless VITE_AVATAR_PROVIDER=anam.
    anam_api_key: str = field(default_factory=lambda: _secret("ANAM_API_KEY"))
    anam_api_base: str = field(
        default_factory=lambda: config.get_str("avatar.anam_api_base", "https://api.anam.ai/v1", env="ANAM_API_BASE")
    )
    anam_timeout_s: float = field(
        default_factory=lambda: config.get_float("avatar.anam_timeout_s", 8.0, env="ANAM_TIMEOUT_S")
    )
    # Blank = let Anam pick its default model for the persona.
    anam_llm_id: str = field(default_factory=lambda: config.get_str("avatar.anam_llm_id", "", env="ANAM_LLM_ID"))

    gemini_api_key: str = field(default_factory=lambda: _secret("GEMINI_API_KEY", "GOOGLE_API_KEY"))
    gemini_model: str = field(
        default_factory=lambda: config.get_str("providers.gemini.model", "gemini-1.5-flash", env="GEMINI_MODEL")
    )

    glm_api_key: str = field(default_factory=lambda: _secret("GLM_API_KEY", "ZAI_API_KEY", "ZHIPUAI_API_KEY"))
    glm_api_base: str = field(
        default_factory=lambda: config.get_str(
            "providers.glm.api_base",
            "https://open.bigmodel.cn/api/paas/v4/",
            env=("GLM_API_BASE", "GLM_BASE_URL"),
        )
    )
    glm_model: str = field(default_factory=lambda: config.get_str("providers.glm.model", "glm-4-flash", env="GLM_MODEL"))
    glm_timeout_s: float = field(
        default_factory=lambda: config.get_float("providers.glm.timeout_s", 6.0, env="GLM_TIMEOUT_S")
    )
    llm_generation_timeout_s: float = field(
        default_factory=lambda: config.get_float(
            "providers.llm_generation_timeout_s",
            20.0,
            env="LLM_GENERATION_TIMEOUT_S",
        )
    )
    # Safety gate runs AFTER LLM and calls Groq for harm classification.
    # Must be > GPT-5 TTLT (~8-12s) + Groq safety check (~2-4s).
    safety_gate_timeout_s: float = field(
        default_factory=lambda: config.get_float(
            "providers.safety_gate_timeout_s",
            10.0,
            env="SAFETY_GATE_TIMEOUT_S",
        )
    )

    # ── Embedding ──────────────────────────────────────────────────────────
    embedding_model: str = field(
        default_factory=lambda: config.get_str(
            "embedding.model",
            "sentence-transformers/all-MiniLM-L6-v2",
            env="V3_EMBEDDING_MODEL",
        )
    )
    embedding_cache_ttl_s: int = field(
        default_factory=lambda: config.get_int("embedding.cache_ttl_s", 3600, env="V3_EMBEDDING_CACHE_TTL_S")
    )
    embedding_pool_workers: int = field(
        default_factory=lambda: config.get_int("embedding.pool_workers", 2, env="V3_EMBEDDING_POOL_WORKERS")
    )
    embedding_timeout_s: float = field(
        default_factory=lambda: config.get_float("embedding.timeout_s", 4.0, env="EMBEDDING_TIMEOUT_S")
    )
    memory_retrieval_timeout_s: float = field(
        default_factory=lambda: config.get_float(
            "embedding.memory_retrieval_timeout_s",
            2.0,
            env="MEMORY_RETRIEVAL_TIMEOUT_S",
        )
    )

    # ── Token / cost ──────────────────────────────────────────────────────
    max_total_tokens: int = field(
        default_factory=lambda: config.get_int("budgets.max_tokens_per_turn", 8000, env="MAX_TOKENS_PER_TURN")
    )
    daily_azure_token_budget: int = field(
        default_factory=lambda: config.get_int(
            "budgets.daily_azure_token_budget",
            5_000_000,
            env="DAILY_AZURE_TOKEN_BUDGET",
        )
    )
    chat_daily_limit: int = field(default_factory=_default_chat_daily_limit)

    # ── Safety / crisis ───────────────────────────────────────────────────
    crisis_hardcoded_en: str = field(
        default_factory=lambda: config.get_str(
            "safety.crisis_hardcoded_en",
            (
                "I'm really glad you said that — and I'm worried about you right now. "
                "Please reach out tonight:\n\n"
                "iCall: 9152987821\nVandrevala Foundation: 1860-2662-345\n\n"
                "You don't have to do this alone. If you're in immediate danger please "
                "call 112 or go to the nearest emergency room. I'm here when you get back."
            ),
            env="CRISIS_HARDCODED_EN",
        )
    )
    crisis_hardcoded_hi: str = field(
        default_factory=lambda: config.get_str(
            "safety.crisis_hardcoded_hi",
            (
                "मुझे तुम्हारी फिक्र है। कृपया अभी किसी से बात करो:\n\n"
                "iCall: 9152987821\nVandrevala Foundation: 1860-2662-345\n\n"
                "अगर तुम्हें तुरंत मदद चाहिए तो 112 पर कॉल करो या सबसे नज़दीकी अस्पताल जाओ। "
                "जब तुम वापस आओगे, मैं यहीं हूँ।"
            ),
            env="CRISIS_HARDCODED_HI",
        )
    )

    # ── Sanctuary ambient personalization ─────────────────────────────────
    # Hours the SanctuaryHome landing page stays in "crisis quiet" mode
    # after a session ends with peak_urgency >= 2. session_startup() also
    # clears the flag early once the user's most recent affect shows
    # valence > 0 + urgency 0 AND at least 6h have passed since it was set.
    crisis_cooldown_hours: int = field(
        default_factory=lambda: config.get_int(
            "safety.crisis_cooldown_hours",
            24,
            env="CRISIS_COOLDOWN_HOURS",
        )
    )

    # ── Monitoring ────────────────────────────────────────────────────────
    sentry_dsn: Optional[str] = field(default_factory=lambda: _secret("SENTRY_DSN") or None)
    sentry_traces_sample_rate: float = field(
        default_factory=lambda: config.get_float(
            "monitoring.sentry_traces_sample_rate",
            0.05,
            env="SENTRY_TRACES_SAMPLE_RATE",
        )
    )
    posthog_api_key: Optional[str] = field(default_factory=lambda: _secret("POSTHOG_API_KEY") or None)
    posthog_host: str = field(
        default_factory=lambda: config.get_str("monitoring.posthog_host", "https://app.posthog.com", env="POSTHOG_HOST")
    )

    # ── Feature flags ─────────────────────────────────────────────────────
    psychoeducation_enabled: bool = field(
        default_factory=lambda: config.get_bool(
            "features.psychoeducation_mode",
            False,
            env="PSYCHOEDUCATION_MODE_ENABLED",
        )
    )
    skill_coach_enabled: bool = field(
        default_factory=lambda: config.get_bool("features.skill_coach_mode", False, env="SKILL_COACH_MODE_ENABLED")
    )
    counsellor_dashboard_enabled: bool = field(
        default_factory=lambda: config.get_bool(
            "features.counsellor_dashboard",
            False,
            env="COUNSELLOR_DASHBOARD_ENABLED",
        )
    )

    # ── Dev auth bypass (mirrors legacy semantics) ────────────────────────
    raw_skip_auth: bool = field(default_factory=lambda: config.get_bool("auth.skip_auth", False, env="SKIP_AUTH"))
    allow_insecure_skip_auth: bool = field(
        default_factory=lambda: config.get_bool(
            "auth.allow_insecure_skip_auth",
            False,
            env="ALLOW_INSECURE_SKIP_AUTH",
        )
    )
    dev_user_id: str = field(
        default_factory=lambda: config.get_str(
            "auth.dev_user_id",
            "a0778b19-548f-47df-8413-296307566d0f",
            env="DEV_USER_ID",
        )
    )
    auth_frame_timeout_s: float = field(
        default_factory=lambda: config.get_float("auth.auth_frame_timeout_s", 5.0, env="AUTH_FRAME_TIMEOUT_S")
    )
    auth_frame_timeout_skip_auth_s: float = field(
        default_factory=lambda: config.get_float(
            "auth.auth_frame_timeout_skip_auth_s",
            5.0,
            env="AUTH_FRAME_TIMEOUT_SKIP_AUTH_S",
        )
    )

    # ── Routing / admin / debug ───────────────────────────────────────────
    cors_allow_origins: list[str] = field(
        default_factory=lambda: config.get_list("server.cors_allow_origins", [])
    )
    cors_extra_allow_origins: list[str] = field(
        default_factory=lambda: config.get_list(
            "server.cors_extra_allow_origins",
            [],
            env=("CORS_ALLOW_ORIGINS", "CORS_EXTRA_ALLOW_ORIGINS"),
        )
    )
    cors_allow_origin_regex: str = field(
        default_factory=lambda: config.get_str("server.cors_allow_origin_regex", "")
    )
    debug_routes_enabled: bool = field(
        default_factory=lambda: config.get_bool("debug.routes_enabled", False, env=("DEBUG", "DEBUG_ROUTES"))
    )
    debug_memory_token: Optional[str] = field(default_factory=lambda: _secret("DEBUG_MEMORY_TOKEN") or None)
    v3_admin_key: str = field(default_factory=lambda: _secret("V3_ADMIN_KEY"))
    therapist_bridge_blocking_timeout_s: float = field(
        default_factory=lambda: config.get_float(
            "therapist_bridge.blocking_timeout_s",
            8.0,
            env="THERAPIST_BRIDGE_BLOCKING_TIMEOUT_S",
        )
    )

    @property
    def is_non_prod(self) -> bool:
        return self.env_name in ("", "dev", "development", "local", "test", "testing")

    @property
    def skip_auth_effective(self) -> bool:
        return self.raw_skip_auth and (self.is_non_prod or self.allow_insecure_skip_auth)


@lru_cache(maxsize=1)
def env() -> V3Env:
    """Cached env object — read once at module import / first access."""
    e = V3Env()
    if e.raw_skip_auth and not e.skip_auth_effective:
        logger.error(
            "🚨 [v3 env] SKIP_AUTH=true ignored because ENV=%r looks like production. "
            "Set ALLOW_INSECURE_SKIP_AUTH=true to override.",
            e.env_name or "<unset>",
        )
    return e


def reload_env() -> V3Env:
    """Test helper — force a re-read of env after monkeypatching os.environ."""
    config.reload()
    env.cache_clear()
    return env()


REQUIRED_SECRET_ENV_VARS: Dict[str, tuple[str, ...]] = {
    "ENV": ("ENV",),
    "AZURE_OPENAI_API_KEY": ("AZURE_OPENAI_API_KEY", "AZURE_API_KEY"),
    "GROQ_API_KEY": ("GROQ_API_KEY",),
    "GEMINI_API_KEY": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "SUPABASE_SERVICE_KEY": ("SUPABASE_SERVICE_KEY", "SUPABASE_KEY"),
    "SUPABASE_JWT_SECRET": ("SUPABASE_JWT_SECRET",),
    "REDIS_URL": ("REDIS_URL",),
    "SECRET_KEY": ("SECRET_KEY",),
}

REQUIRED_CONFIG_VARS: Dict[str, str] = {
    "SUPABASE_URL": "supabase.url",
    "QDRANT_URL": "qdrant.url",
    "AZURE_OPENAI_ENDPOINT": "providers.azure_openai.endpoint",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "providers.azure_openai.deployment_name",
}

OPTIONAL_ENV_VARS: Dict[str, str] = {
    "GLM_API_KEY": "GLM fallback unavailable",
    "QDRANT_API_KEY": "Qdrant running without auth — OK for localhost",
    "AZURE_SPEECH_KEY": "Browser STT/TTS token endpoint unavailable",
}

OPTIONAL_ENV_ALIASES: Dict[str, tuple[str, ...]] = {
    "GLM_API_KEY": ("GLM_API_KEY", "ZAI_API_KEY", "ZHIPUAI_API_KEY"),
    "QDRANT_API_KEY": ("QDRANT_API_KEY",),
    "AZURE_SPEECH_KEY": ("AZURE_SPEECH_KEY", "AZURE_TTS_KEY"),
}


def _first_present(aliases: tuple[str, ...]) -> tuple[str, str]:
    for name in aliases:
        value = os.getenv(name, "").strip()
        if value:
            return name, value
    return aliases[0], ""


def validate_redis_url(redis_url: str) -> Optional[str]:
    """Return a human-readable error if ``REDIS_URL`` is not usable, else ``None``.

    Fails fast on common production mistakes (e.g. Upstash without TLS) instead
    of silently rewriting URLs at runtime.
    """
    raw = (redis_url or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").lower()

    if scheme in ("http", "https"):
        return (
            "REDIS_URL must be a Redis protocol URL (redis:// or rediss://), "
            "not an HTTP/HTTPS endpoint; use the TCP URL from your provider."
        )
    if scheme not in ("redis", "rediss"):
        return (
            f"REDIS_URL has invalid scheme {scheme!r}; use redis:// or rediss:// "
            "(see provider docs for TLS)."
        )
    if not host:
        return "REDIS_URL must include a hostname."

    # Upstash and similar managed endpoints expect TLS on the standard port.
    if host.endswith(".upstash.io") and scheme != "rediss":
        return (
            "REDIS_URL points to Upstash but uses redis://; Upstash requires TLS. "
            "Set REDIS_URL to rediss://default:<password>@<host>:6379 "
            "(copy the TLS URL from the Upstash console)."
        )

    return None


def validate_required_env() -> tuple[bool, List[str], List[str], Dict[str, str], Dict[str, str]]:
    """Validate startup config/env contract without exposing secret values.

    Returns
    -------
    ok
        True when nothing required is missing and semantic checks pass.
    missing
        Canonical names of required variables not set.
    config_errors
        Operator-facing messages for invalid values (e.g. bad ``REDIS_URL``).
    present_prefixes
        Which required values are present (values are coarse, never secrets).
    optional_warnings
        Map of optional env name → startup warning if unset.
    """
    e = env()
    strict_mode = not e.is_non_prod
    missing: List[str] = []
    config_errors: List[str] = []
    present_prefixes: Dict[str, str] = {}
    optional_warnings: Dict[str, str] = {}
    for canonical, aliases in REQUIRED_SECRET_ENV_VARS.items():
        loaded_name, value = _first_present(aliases)
        if not value:
            if strict_mode:
                missing.append(canonical)
            else:
                optional_warnings[canonical] = f"{canonical} missing — feature will degrade in local development"
        else:
            present_prefixes[canonical] = "present"
            if loaded_name != canonical:
                present_prefixes[f"{canonical}_loaded_from"] = loaded_name
            if canonical == "REDIS_URL":
                err = validate_redis_url(value)
                if err:
                    config_errors.append(err)
    for canonical, config_path in REQUIRED_CONFIG_VARS.items():
        value = config.get_str(config_path, "", env=canonical)
        if not value:
            if strict_mode:
                missing.append(canonical)
            else:
                optional_warnings[canonical] = f"{canonical} missing — feature will degrade in local development"
        else:
            present_prefixes[canonical] = "present"
    for optional, warning in OPTIONAL_ENV_VARS.items():
        aliases = OPTIONAL_ENV_ALIASES.get(optional, (optional,))
        loaded_name, value = _first_present(aliases)
        if not value:
            optional_warnings[optional] = warning
        else:
            present_prefixes[optional] = "present"
            if loaded_name != optional:
                present_prefixes[f"{optional}_loaded_from"] = loaded_name
    ok = not missing and not config_errors
    return ok, missing, config_errors, present_prefixes, optional_warnings
