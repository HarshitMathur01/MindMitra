"""
Groq NLP module — Groq client factory for the MindMitra pipeline.

Provides a pre-configured Groq client (`.client`) and model name (`.model`)
used by IntentRouter, crisis checks, combined analysis, screening, and
memory importance scoring across the pipeline.
"""
import logging
from typing import Dict, Optional

from groq import Groq

from ..core.config import config

logger = logging.getLogger(__name__)


class GroqNLPModule:
    """
    Lightweight Groq client wrapper.

    The routed pipeline accesses `.client` and `.model` directly — individual
    analysis methods were removed as they duplicated functionality now handled
    by specialised agents (IntentRouter, combined analysis in workflow, etc.).
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or config.get_api_key("groq")
        self.model = model or config.get_model("nlp")
        self.temperature = config.get_temperature("nlp")
        self.max_tokens = config.get_max_tokens("nlp")
        self._MODEL_TOKEN_LIMITS = config.get("nlp_module.model_token_limits", {})

        if not self.api_key:
            logger.warning("⚠️ [GROQ-NLP] GROQ_API_KEY not set — NLP module disabled")
            self.client: Optional[Groq] = None
            return

        try:
            self.client = Groq(api_key=self.api_key)
            self._max_input_chars = self._MODEL_TOKEN_LIMITS.get(self.model, 8_192) * 3
            logger.info(f"✅ [GROQ-NLP] Initialised with model={self.model}")
        except ImportError:
            logger.warning("⚠️ [GROQ-NLP] `groq` package not installed — NLP module disabled")
            self.client = None
        except Exception as e:
            logger.error(f"❌ [GROQ-NLP] Init failed: {e}")
            self.client = None
