"""YAML configuration loader for non-secret backend runtime settings.

Secrets stay in environment variables. This loader owns the non-secret
defaults from ``chatbotAgent/config.yaml`` and gives ``app.core.env`` typed,
env-overridable access without spreading ``os.getenv`` across the codebase.
"""
from __future__ import annotations

import copy
import logging
import os
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import yaml

logger = logging.getLogger(__name__)


DEFAULT_CONFIG: Dict[str, Any] = {
    "app": {
        "mha_v3_enabled": True,
        "environment": "dev",
    },
    "server": {
        "cors_allow_origins": [
            "https://mindmitra.co.in",
            "https://www.mindmitra.co.in",
            "https://mindmitra-seven.vercel.app",
            "http://localhost:8080",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8001",
            "http://127.0.0.1:8000",
        ],
        "cors_allow_origin_regex": r"https?://((localhost|127\.0\.0\.1)(:\d+)?|[a-z0-9-]+\.(ngrok-free\.app|ngrok\.app))$",
    },
    "logging": {
        "level": "INFO",
        "format": "dev",
        "verbose_context": False,
    },
    "auth": {
        "skip_auth": False,
        "allow_insecure_skip_auth": False,
        "dev_user_id": "a0778b19-548f-47df-8413-296307566d0f",
        "auth_frame_timeout_s": 5.0,
        "auth_frame_timeout_skip_auth_s": 5.0,
    },
    "session": {
        "ttl_seconds": 1500,
        "profile_load_timeout_s": 4.0,
        "daily_chat_limit": 20,
        "dev_daily_chat_limit": 1000,
    },
    "redis": {
        "keyspace_required": True,
        "session_lock_ttl_s": 60,
    },
    "supabase": {
        "url": "",
    },
    "qdrant": {
        "url": "http://localhost:6333",
        "episodic_collection": "episodic_memories",
        "kb_collection": "knowledge_base",
    },
    "providers": {
        "primary": "azure",
        "chain": "azure,groq",
        "azure_openai": {
            "endpoint": "",
            "deployment_name": "gpt-5-mini",
            "api_version": "2025-01-01-preview",
            "timeout_s": 12.0,
            "model_family": "",
            "reasoning_effort": "low",
            "max_completion_tokens": 1600,
        },
        "groq": {
            "signal_model": "llama-3.1-8b-instant",
            "safety_model": "llama-3.1-8b-instant",
            "fallback_model": "llama-3.3-70b-versatile",
            "timeout_s": 4.0,
            "signal_extraction_timeout_s": 6.0,
        },
        "gemini": {
            "model": "gemini-1.5-flash",
        },
        "glm": {
            "api_base": "https://open.bigmodel.cn/api/paas/v4/",
            "model": "glm-4-flash",
            "timeout_s": 6.0,
        },
        "llm_generation_timeout_s": 20.0,
        "safety_gate_timeout_s": 10.0,
    },
    "speech": {
        "azure_region": "eastasia",
        "azure_token_ttl_s": 540,
        "transcribe_timeout_s": 15.0,
        "transcribe_max_audio_bytes": 6 * 1024 * 1024,
        "transcribe_concurrency_limit": 2,
    },
    "embedding": {
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "cache_ttl_s": 3600,
        "pool_workers": 2,
        "timeout_s": 4.0,
        "memory_retrieval_timeout_s": 2.0,
    },
    "budgets": {
        "max_tokens_per_turn": 8000,
        "daily_azure_token_budget": 5_000_000,
    },
    "safety": {
        "crisis_hardcoded_en": (
            "I'm really glad you said that — and I'm worried about you right now. "
            "Please reach out tonight:\n\n"
            "iCall: 9152987821\nVandrevala Foundation: 1860-2662-345\n\n"
            "You don't have to do this alone. If you're in immediate danger please "
            "call 112 or go to the nearest emergency room. I'm here when you get back."
        ),
        "crisis_hardcoded_hi": (
            "मुझे तुम्हारी फिक्र है। कृपया अभी किसी से बात करो:\n\n"
            "iCall: 9152987821\nVandrevala Foundation: 1860-2662-345\n\n"
            "अगर तुम्हें तुरंत मदद चाहिए तो 112 पर कॉल करो या सबसे नज़दीकी अस्पताल जाओ। "
            "जब तुम वापस आओगे, मैं यहीं हूँ।"
        ),
    },
    "monitoring": {
        "posthog_host": "https://app.posthog.com",
        "sentry_traces_sample_rate": 0.05,
    },
    "features": {
        "psychoeducation_mode": False,
        "skill_coach_mode": False,
        "counsellor_dashboard": False,
    },
    "debug": {
        "routes_enabled": False,
    },
    "therapist_bridge": {
        "blocking_timeout_s": 8.0,
    },
}


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _coerce_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return default


def _split_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    """Singleton loader for ``chatbotAgent/config.yaml``."""

    _instance = None
    _config_data: Dict[str, Any]
    _config_path: Path

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._config_path = Path(__file__).resolve().parents[2] / "config.yaml"
            cls._instance._load_config()
        return cls._instance

    def _load_config(self) -> None:
        config_path = self._config_path
        if not config_path.exists():
            logger.warning("Config file not found at %s; using built-in defaults", config_path)
            self._config_data = copy.deepcopy(DEFAULT_CONFIG)
            return

        try:
            raw_config = self._load_yaml_with_fallback_encodings(config_path)
            self._config_data = _deep_merge(DEFAULT_CONFIG, raw_config)
            logger.info("Loaded configuration from %s", config_path)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to load config.yaml: %s", exc)
            self._config_data = copy.deepcopy(DEFAULT_CONFIG)

    def _load_yaml_with_fallback_encodings(self, config_path: Path) -> Dict[str, Any]:
        encodings = ("utf-8", "utf-8-sig", "utf-16", "cp1252", "latin-1")
        last_error: Optional[Exception] = None

        for encoding in encodings:
            try:
                with open(config_path, "r", encoding=encoding) as config_file:
                    loaded = yaml.safe_load(config_file)
                return loaded if isinstance(loaded, dict) else {}
            except UnicodeDecodeError as decode_error:
                last_error = decode_error
                continue

        if last_error:
            raise last_error
        raise RuntimeError("Unable to load config.yaml with supported encodings")

    def get(self, key_path: str, default: Any = None) -> Any:
        keys = key_path.split(".")
        value: Any = self._config_data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def get_str(self, key_path: str, default: str = "", *, env: str | Iterable[str] | None = None) -> str:
        raw_env = self._env_value(env)
        if raw_env is not None:
            return raw_env.strip()
        value = self.get(key_path, default)
        return str(value).strip() if value is not None else default

    def get_int(self, key_path: str, default: int, *, env: str | Iterable[str] | None = None) -> int:
        raw_env = self._env_value(env)
        value = raw_env if raw_env is not None else self.get(key_path, default)
        try:
            return int(value)
        except (TypeError, ValueError):
            logger.warning("config %s=%r not an int; using default %d", key_path, value, default)
            return default

    def get_float(self, key_path: str, default: float, *, env: str | Iterable[str] | None = None) -> float:
        raw_env = self._env_value(env)
        value = raw_env if raw_env is not None else self.get(key_path, default)
        try:
            return float(value)
        except (TypeError, ValueError):
            logger.warning("config %s=%r not a float; using default %f", key_path, value, default)
            return default

    def get_bool(self, key_path: str, default: bool = False, *, env: str | Iterable[str] | None = None) -> bool:
        raw_env = self._env_value(env)
        value = raw_env if raw_env is not None else self.get(key_path, default)
        return _coerce_bool(value, default)

    def get_list(self, key_path: str, default: list[str] | None = None, *, env: str | Iterable[str] | None = None) -> list[str]:
        fallback = list(default or [])
        raw_env = self._env_value(env)
        if raw_env is not None:
            return _split_list(raw_env)
        value = self.get(key_path, fallback)
        if isinstance(value, str):
            return _split_list(value)
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return fallback

    def is_enabled(self, key_path: str) -> bool:
        return self.get_bool(key_path, False)

    def get_section(self, section: str) -> Dict[str, Any]:
        value = self.get(section, {})
        return value if isinstance(value, dict) else {}

    def reload(self, config_path: Path | None = None) -> None:
        if config_path is not None:
            self._config_path = config_path
        self._load_config()
        logger.info("Configuration reloaded")

    def get_all(self) -> Dict[str, Any]:
        return copy.deepcopy(self._config_data)

    @staticmethod
    def _env_value(names: str | Iterable[str] | None) -> Optional[str]:
        if names is None:
            return None
        candidates = (names,) if isinstance(names, str) else names
        for name in candidates:
            value = os.getenv(name)
            if value is not None and value.strip():
                return value
        return None

    # Deprecated compatibility shim. Runtime code should use app.core.env.
    def get_api_key(self, service: str) -> Optional[str]:
        env_names = {
            "groq": ("GROQ_API_KEY",),
            "glm": ("GLM_API_KEY", "ZAI_API_KEY", "ZHIPUAI_API_KEY"),
            "gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
            "azure": ("AZURE_OPENAI_API_KEY", "AZURE_API_KEY"),
            "supabase_key": ("SUPABASE_SERVICE_KEY", "SUPABASE_KEY"),
            "supabase_url": ("SUPABASE_URL",),
        }.get(service, (f"{service.upper()}_API_KEY",))
        return self._env_value(env_names)


config = Config()


def get_config(key_path: str, default: Any = None) -> Any:
    return config.get(key_path, default)


def is_feature_enabled(feature: str) -> bool:
    return config.is_enabled(f"features.{feature}")


def get_rag_config() -> Dict[str, Any]:
    return config.get_section("rag_memory")


def get_logging_config() -> Dict[str, Any]:
    return config.get_section("logging")
