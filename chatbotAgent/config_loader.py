"""
Configuration Loader for MindMitra
Loads and validates config.yaml with environment variable substitution
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
    Singleton configuration loader that reads config.yaml and provides
    easy access to all configuration parameters.
    
    Usage:
        from config_loader import config
        
        # Access nested config
        model_name = config.get("nlp_module.model")
        api_key = config.get("api_keys.groq_api_key")
        
        # With default
        max_tokens = config.get("nlp_module.max_tokens", default=500)
        
        # Check if feature enabled
        if config.is_enabled("features.rag_memory_retrieval"):
            # do RAG stuff
    """
    
    _instance = None
    _config_data: Dict[str, Any] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance
    
    def _load_config(self):
        """Load configuration from config.yaml with fallback defaults"""
        config_path = Path(__file__).parent / "config.yaml"
        
        if not config_path.exists():
            logger.warning(f"⚠️ Config file not found at {config_path}, using defaults")
            self._config_data = self._get_default_config()
            return
        
        try:
            with open(config_path, 'r') as f:
                raw_config = yaml.safe_load(f)
            
            # Substitute environment variables
            self._config_data = self._substitute_env_vars(raw_config)
            logger.info(f"✅ Loaded configuration from {config_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to load config.yaml: {e}")
            logger.warning("   Using default configuration")
            self._config_data = self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration if config.yaml is missing or invalid"""
        return {
            "api_keys": {
                "groq_api_key": os.getenv("GROQ_API_KEY", ""),
                "zai_api_key": os.getenv("ZAI_API_KEY", ""),
                "google_api_key": os.getenv("GOOGLE_API_KEY", ""),
                "supabase_url": os.getenv("SUPABASE_URL", ""),
                "supabase_key": os.getenv("SUPABASE_KEY", "")
            },
            "logging": {
                "level": os.getenv("LOG_LEVEL", "INFO"),
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            },
            "nlp_module": {
                "model": "qwen/qwen-2.5-32b-instruct",
                "temperature": 0.1,
                "max_tokens": 400
            },
            "glm_controller": {
                "model": "glm-4-32b",
                "max_concurrent": 1,
                "max_retries": 2,
                "temperature": 0.3
            },
            "features": {
                "rag_memory_retrieval": True,
                "screening_assessments": True,
                "cultural_context": True,
                "episodic_promotion": True
            },
            "performance": {
                "max_workers": 3,
                "timeout_seconds": 30
            }
        }
    
    def _substitute_env_vars(self, obj: Any) -> Any:
        """
        Recursively substitute ${ENV_VAR} patterns with environment variables
        """
        if isinstance(obj, dict):
            return {k: self._substitute_env_vars(v) for k, v in obj.items()}
        
        elif isinstance(obj, list):
            return [self._substitute_env_vars(item) for item in obj]
        
        elif isinstance(obj, str):
            # Match ${VAR_NAME} pattern
            pattern = r'\$\{([^}]+)\}'
            matches = re.findall(pattern, obj)
            
            if matches:
                result = obj
                for var_name in matches:
                    env_value = os.getenv(var_name, "")
                    result = result.replace(f"${{{var_name}}}", env_value)
                return result
            return obj
        
        else:
            return obj
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get configuration value using dot notation.
        
        Args:
            key_path: Dot-separated path like "nlp_module.model"
            default: Default value if key not found
        
        Returns:
            Configuration value or default
        
        Examples:
            config.get("glm_controller.model")
            config.get("rag_memory.retrieval.top_k", default=5)
        """
        keys = key_path.split('.')
        value = self._config_data
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def is_enabled(self, key_path: str) -> bool:
        """
        Check if a feature is enabled.
        
        Args:
            key_path: Dot-separated path to boolean config
        
        Returns:
            True if enabled, False otherwise
        """
        return bool(self.get(key_path, default=False))
    
    def get_section(self, section: str) -> Dict[str, Any]:
        """
        Get entire configuration section.
        
        Args:
            section: Top-level section name
        
        Returns:
            Dictionary of section config or empty dict
        """
        return self.get(section, default={})
    
    def reload(self):
        """Reload configuration from file"""
        self._load_config()
        logger.info("🔄 Configuration reloaded")
    
    def get_all(self) -> Dict[str, Any]:
        """Get entire configuration dictionary"""
        return self._config_data.copy()
    
    # ── Convenience methods for common config access ──
    
    def get_model(self, module: str) -> str:
        """Get model name for a module"""
        model_paths = {
            "nlp": "nlp_module.model",
            "groq_nlp": "nlp_module.model",
            "glm": "glm_controller.model",
            "cultural_deep": "cultural_module.deep_analysis_model",
            "query_decision_groq": "rag_memory.query_decision.groq_model",
            "query_decision_glm": "rag_memory.query_decision.glm_fallback_model",
            "embedding": "rag_memory.embeddings.model",
            "screening": "screening_assessments.groq_model",
        }
        path = model_paths.get(module)
        if path:
            return self.get(path, default="")
        return ""
    
    def get_api_key(self, service: str) -> Optional[str]:
        """Get API key for a service, trying config then environment"""
        # First try config file
        key = self.get(f"api_keys.{service}_api_key")
        if key:
            return key
        
        # Fallback to direct environment variable
        env_var = f"{service.upper()}_API_KEY"
        return os.getenv(env_var)
    
    def get_temperature(self, module: str) -> float:
        """Get temperature setting for a module"""
        temp_paths = {
            "nlp": "nlp_module.temperature",
            "glm": "glm_controller.temperature",
            "cultural": "cultural_module.temperature",
            "query_decision": "rag_memory.query_decision.temperature",
            "screening": "screening_assessments.temperature",
        }
        path = temp_paths.get(module)
        if path:
            return float(self.get(path, default=0.3))
        return 0.3
    
    def get_max_tokens(self, module: str) -> int:
        """Get max_tokens setting for a module"""
        token_paths = {
            "nlp": "nlp_module.max_tokens",
            "cultural": "cultural_module.max_tokens",
            "query_decision": "rag_memory.query_decision.max_tokens",
            "screening": "screening_assessments.max_tokens",
        }
        path = token_paths.get(module)
        if path:
            return int(self.get(path, default=400))
        return 400


# Singleton instance - import this in other modules
config = Config()


# ── Helper functions for backward compatibility ──

def get_config(key_path: str, default: Any = None) -> Any:
    """Shorthand for config.get()"""
    return config.get(key_path, default)


def is_feature_enabled(feature: str) -> bool:
    """Shorthand for checking feature flags"""
    return config.is_enabled(f"features.{feature}")


def get_rag_config() -> Dict[str, Any]:
    """Get complete RAG configuration"""
    return config.get_section("rag_memory")


def get_logging_config() -> Dict[str, Any]:
    """Get logging configuration"""
    return config.get_section("logging")


if __name__ == "__main__":
    # Test configuration loader
    print("Testing Configuration Loader...")
    print("="*80)
    
    # Test basic access
    print(f"NLP Model: {config.get_model('nlp')}")
    print(f"GLM Model: {config.get_model('glm')}")
    print(f"NLP Temperature: {config.get_temperature('nlp')}")
    print(f"RAG Enabled: {config.is_enabled('features.rag_memory_retrieval')}")
    
    # Test nested access
    print(f"\nTop K: {config.get('rag_memory.retrieval.top_k')}")
    print(f"Vector Weight: {config.get('rag_memory.retrieval.vector_weight')}")
    
    # Test API keys
    print(f"\nGroq API Key Set: {bool(config.get_api_key('groq'))}")
    print(f"GLM API Key Set: {bool(config.get_api_key('zai'))}")
    
    # Test defaults
    print(f"\nNon-existent Key (with default): {config.get('foo.bar.baz', default='DEFAULT')}")
    
    print("\n" + "="*80)
    print("Configuration loaded successfully!")
