"""
Embedding Service — singleton SentenceTransformer wrapper (384-dim MiniLM).
"""
import logging
import time
import threading
from typing import List, Optional

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Singleton: lazy-loads all-MiniLM-L6-v2 on first use (~100 MB).
    Thread-safe double-checked locking for startup.
    """

    _instance: Optional["EmbeddingService"] = None
    _model = None
    _lock = threading.Lock()
    _model_loaded: bool = False

    def __new__(cls) -> "EmbeddingService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    # ── model loading ──────────────────────────────────────────────────────
    def _load_model(self) -> None:
        if self._model_loaded:
            return
        with self._lock:
            if self._model_loaded:
                return
            try:
                logger.info(
                    "📦 [Embeddings] Loading sentence-transformers model "
                    "(first use – may take 30-60 s)..."
                )
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
                self._model_loaded = True
                logger.info("✅ [Embeddings] Model loaded (384-dim embeddings ready)")
            except ImportError as e:
                logger.error(f"❌ [Embeddings] sentence-transformers not installed: {e}")
                raise
            except Exception as e:
                logger.error(f"❌ [Embeddings] Failed to load model: {e}")
                raise

    # ── public API ─────────────────────────────────────────────────────────
    def embed_text(self, text: str, max_length: int = 512) -> List[float]:
        """Return 384-dimensional embedding for a single text."""
        if not self._model_loaded:
            self._load_model()

        if not text or not text.strip():
            logger.warning("⚠️ [Embeddings] Empty text – returning zero vector")
            return [0.0] * 384

        try:
            start = time.time()
            embedding: List[float] = self._model.encode(
                text[:max_length],
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True,
            ).tolist()
            logger.debug(
                f"📊 [Embeddings] {len(text)} chars → 384-dim in "
                f"{(time.time() - start) * 1000:.0f} ms"
            )
            return embedding
        except Exception as e:
            logger.error(f"❌ [Embeddings] Embedding failed: {e}")
            return [0.0] * 384

    def embed_batch(self, texts: List[str], max_length: int = 512) -> List[List[float]]:
        """Return embeddings for a list of texts in one model call."""
        if not self._model_loaded:
            self._load_model()

        if not texts:
            return []

        try:
            start = time.time()
            embeddings: List[List[float]] = self._model.encode(
                [t[:max_length] for t in texts],
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True,
            ).tolist()
            logger.debug(
                f"📊 [Embeddings] Batch {len(texts)} texts in "
                f"{(time.time() - start) * 1000:.0f} ms"
            )
            return embeddings
        except Exception as e:
            logger.error(f"❌ [Embeddings] Batch embedding failed: {e}")
            return [[0.0] * 384 for _ in texts]

    def is_ready(self) -> bool:
        return self._model_loaded


# Module-level singleton (mirrors original embeddings_service.embedding_service)
embedding_service = EmbeddingService()
