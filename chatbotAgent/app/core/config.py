"""
Configuration loader for MindMitra.
Reads config.yaml (located two directories above this file, at chatbotAgent/config.yaml).
Provides dot-notation access with ${ENV_VAR} substitution.
"""
import os
import yaml
import re
from typing import Any, Dict, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class Config:
    """
    Singleton configuration loader.

    Usage:
        from app.core.config import config

        model_name = config.get("nlp_module.model")
        api_key    = config.get_api_key("groq")
        enabled    = config.is_enabled("features.rag_memory_retrieval")
    """

    _instance = None
    _config_data: Dict[str, Any] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self) -> None:
        # config.yaml lives at chatbotAgent/config.yaml
        # This file lives at chatbotAgent/app/core/config.py
        # → two parent dirs up = chatbotAgent/
        config_path = Path(__file__).parent.parent.parent / "config.yaml"

        if not config_path.exists():
            logger.warning(f"⚠️ Config file not found at {config_path}, using defaults")
            self._config_data = self._get_default_config()
            return

        try:
            raw_config = self._load_yaml_with_fallback_encodings(config_path)
            self._config_data = self._substitute_env_vars(raw_config)
            logger.info(f"✅ Loaded configuration from {config_path}")
        except Exception as e:
            logger.error(f"❌ Failed to load config.yaml: {e}")
            self._config_data = self._get_default_config()

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

    # ── defaults ───────────────────────────────────────────────────────────
    def _get_default_config(self) -> Dict[str, Any]:
        return {
            "api_keys": {
                "groq_api_key": os.getenv("GROQ_API_KEY", ""),
                "zai_api_key": os.getenv("ZAI_API_KEY", ""),
                "google_api_key": os.getenv("GOOGLE_API_KEY", ""),
                "supabase_url": os.getenv("SUPABASE_URL", ""),
                "supabase_key": os.getenv("SUPABASE_KEY", ""),
            },
            "logging": {
                "level": os.getenv("LOG_LEVEL", "INFO"),
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            },
            "nlp_module": {
                "model": "qwen/qwen-2.5-32b-instruct",
                "temperature": 0.1,
                "max_tokens": 400,
            },
            "llm_controller": {
                "model": "glm-4-32b",
                "max_concurrent": 1,
                "max_retries": 2,
                "temperature": 0.3,
                "top_p": 0.8,
            },
            "features": {
                "rag_memory_retrieval": True,
                "screening_assessments": True,
                "cultural_context": True,
                "episodic_promotion": True,
                "nlp_analysis": True,
                "background_memory_extraction": True,
                "save_to_supabase": True,
                "user_contexts_table": True,
                "parallel_processing": True,
            },
            "workflow": {
                "max_workers": 3,
                "timeout_seconds": 30,
            },
            "performance": {
                "max_workers": 3,
                "timeout_seconds": 30,
            },
        }

    # ── env-var substitution ───────────────────────────────────────────────
    def _substitute_env_vars(self, obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: self._substitute_env_vars(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._substitute_env_vars(item) for item in obj]
        if isinstance(obj, str):
            pattern = r"\$\{([^}]+)\}"
            matches = re.findall(pattern, obj)
            if matches:
                result = obj
                for var_name in matches:
                    result = result.replace(f"${{{var_name}}}", os.getenv(var_name, ""))
                return result
        return obj

    # ── public API ─────────────────────────────────────────────────────────
    def get(self, key_path: str, default: Any = None) -> Any:
        """Dot-notation access: config.get('nlp_module.model')."""
        keys = key_path.split(".")
        value = self._config_data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def is_enabled(self, key_path: str) -> bool:
        return bool(self.get(key_path, default=False))

    def get_section(self, section: str) -> Dict[str, Any]:
        return self.get(section, default={})

    def reload(self) -> None:
        self._load_config()
        logger.info("🔄 Configuration reloaded")

    def get_all(self) -> Dict[str, Any]:
        return self._config_data.copy()

    # ── convenience helpers ────────────────────────────────────────────────
    def get_model(self, module: str) -> str:
        model_paths = {
            "nlp": "nlp_module.model",
            "groq_nlp": "nlp_module.model",
            "glm": "glm_controller.model",
            "azure": "azure_controller.model",
            "screening": "screening_assessments.groq_model",
        }
        path = model_paths.get(module)
        return self.get(path, default="") if path else ""

    # Special keys whose yaml path / env var name don't follow the standard pattern
    _SPECIAL_API_KEYS: Dict[str, tuple] = {
        "supabase_url": ("api_keys.supabase_url", "SUPABASE_URL"),
        "supabase_key": ("api_keys.supabase_key", "SUPABASE_KEY"),
    }

    def get_api_key(self, service: str) -> Optional[str]:
        if service in self._SPECIAL_API_KEYS:
            yaml_path, env_var = self._SPECIAL_API_KEYS[service]
            key = self.get(yaml_path)
            return key if key else os.getenv(env_var)
        key = self.get(f"api_keys.{service}_api_key")
        if key:
            return key
        return os.getenv(f"{service.upper()}_API_KEY")

    def get_temperature(self, module: str) -> float:
        temp_paths = {
            "nlp": "nlp_module.temperature",
            "glm": "llm_controller.temperature",
            "azure": "azure_controller.temperature",
            "screening": "screening_assessments.temperature",
        }
        path = temp_paths.get(module)
        return float(self.get(path, default=0.3)) if path else 0.3

    def get_max_tokens(self, module: str) -> int:
        token_paths = {
            "nlp": "nlp_module.max_tokens",
            "screening": "screening_assessments.max_tokens",
        }
        path = token_paths.get(module)
        return int(self.get(path, default=400)) if path else 400


# ── singleton ──────────────────────────────────────────────────────────────
config = Config()


# ── backward-compat helpers ────────────────────────────────────────────────
def get_config(key_path: str, default: Any = None) -> Any:
    return config.get(key_path, default)


def is_feature_enabled(feature: str) -> bool:
    return config.is_enabled(f"features.{feature}")


def get_rag_config() -> Dict[str, Any]:
    return config.get_section("rag_memory")


def get_logging_config() -> Dict[str, Any]:
    return config.get_section("logging")
