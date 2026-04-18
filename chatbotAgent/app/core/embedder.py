"""
Local embedding service (sentence-transformers).

Model and dimension are read at runtime via embedding_settings (after load_dotenv).
"""

from __future__ import annotations

import logging
import threading
from typing import List, Optional

from .embedding_settings import get_embedding_dims, get_embedding_model

logger = logging.getLogger(__name__)

# Official retrieval query instruction for BGE / BGE-M3 style models.
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_singleton_lock = threading.Lock()
_service: Optional["EmbeddingService"] = None


def get_embedding_service() -> "EmbeddingService":
    global _service
    if _service is None:
        with _singleton_lock:
            if _service is None:
                _service = EmbeddingService()
    return _service


class EmbeddingService:
    """
    Thread-safe lazy-loaded SentenceTransformer; model name from env at load time.
    """

    def __init__(self) -> None:
        self._model = None
        self._loaded_name: Optional[str] = None
        self._load_lock = threading.Lock()
        self._infer_lock = threading.Lock()
        self._loaded = threading.Event()

    def ensure_loaded(self) -> None:
        """Block until the model is ready (used by background warm and tests)."""
        self._ensure_model()
        self._loaded.set()

    def _ensure_model(self) -> None:
        wanted = get_embedding_model()
        if self._model is not None and self._loaded_name == wanted:
            return
        with self._load_lock:
            wanted = get_embedding_model()
            if self._model is not None and self._loaded_name == wanted:
                return
            from sentence_transformers import SentenceTransformer

            if self._model is not None:
                logger.info("[EMBED] Reloading model (EMBEDDING_MODEL changed): %s", wanted)
                self._model = None
                self._loaded_name = None

            logger.info("[EMBED] Loading %s …", wanted)
            self._model = SentenceTransformer(wanted)
            self._loaded_name = wanted
            dim = int(self._model.get_sentence_embedding_dimension())
            expected = get_embedding_dims()
            if dim != expected:
                logger.error(
                    "[EMBED] Model %s outputs dimension %s but EMBEDDING_DIMS=%s — "
                    "Qdrant queries will fail until they match the collection. "
                    "Set EMBEDDING_DIMS=%s in the environment or pick a model that matches your collection.",
                    wanted,
                    dim,
                    expected,
                    dim,
                )
            logger.info("[EMBED] %s ready (%s-dim)", wanted, dim)
        self._loaded.set()

    def _prepare_text(self, text: str, *, is_query: bool) -> str:
        t = (text or "").strip()
        if not t:
            return " "
        if is_query and "bge" in get_embedding_model().lower():
            return f"{BGE_QUERY_PREFIX}{t}"
        return t

    def embed(self, text: str, is_query: bool = False) -> List[float]:
        self._ensure_model()
        assert self._model is not None
        to_encode = self._prepare_text(text, is_query=is_query)
        with self._infer_lock:
            vec = self._model.encode(
                to_encode,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        return vec.tolist()

    def embed_batch(self, texts: List[str], is_query: bool = False) -> List[List[float]]:
        self._ensure_model()
        assert self._model is not None
        prepared = [self._prepare_text(t, is_query=is_query) for t in texts]
        with self._infer_lock:
            mat = self._model.encode(
                prepared,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        return [row.tolist() for row in mat]
