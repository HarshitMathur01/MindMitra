"""BGE-M3 embeddings provider — multilingual (Hinglish-fluent), 1024-d dense.

Loads the model once per process. CPU-friendly; GPU-optional via
`MM_BGE_DEVICE=cuda`.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import List, Optional

from .base import BaseEmbeddingsProvider, ProviderUnavailable

logger = logging.getLogger(__name__)


_MODEL_NAME = os.getenv("MM_BGE_MODEL", "BAAI/bge-m3")
_DEVICE = os.getenv("MM_BGE_DEVICE", "cpu")


class BGEM3Provider(BaseEmbeddingsProvider):
    name = "bge-m3"
    dim = 1024

    _model = None  # cached SentenceTransformer instance, lazily loaded

    def __init__(self) -> None:
        # We *don't* eagerly load the model — startup latency matters.
        pass

    @classmethod
    def _ensure_model(cls):
        if cls._model is not None:
            return cls._model
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise ProviderUnavailable(f"sentence-transformers not installed: {exc}")
        logger.info("Loading BGE-M3 model %s on %s …", _MODEL_NAME, _DEVICE)
        cls._model = SentenceTransformer(_MODEL_NAME, device=_DEVICE)
        return cls._model

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        def _call_blocking() -> List[List[float]]:
            mdl = self._ensure_model()
            vecs = mdl.encode(
                texts,
                batch_size=16,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return [v.tolist() for v in vecs]

        return await asyncio.to_thread(_call_blocking)

    async def health(self) -> bool:
        try:
            self._ensure_model()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("BGE-M3 health failed: %s", exc)
            return False
