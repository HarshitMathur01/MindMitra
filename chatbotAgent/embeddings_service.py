"""
Embedding Service for MindMitra RAG System
Provides sentence-transformers MiniLM embeddings with singleton pattern and lazy loading
"""
import logging
import time
import threading
from typing import List, Optional

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Singleton service for generating 384-dim embeddings using all-MiniLM-L6-v2
    Lazy-loads model on first use to save memory at startup
    """
    
    _instance: Optional['EmbeddingService'] = None
    _model = None
    _lock = threading.Lock()
    _model_loaded = False
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def _load_model(self):
        """Lazy load the sentence transformer model (happens once, ~100MB)"""
        if self._model_loaded:
            return
        
        with self._lock:
            if self._model_loaded:
                return
            
            try:
                logger.info("📦 [Embeddings] Loading sentence-transformers model (first time, may take 30-60s)...")
                from sentence_transformers import SentenceTransformer
                
                self._model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
                self._model_loaded = True
                logger.info("✅ [Embeddings] Model loaded successfully (384-dim embeddings ready)")
            except ImportError as e:
                logger.error(f"❌ [Embeddings] sentence-transformers not installed: {e}")
                logger.error("   Run: pip install sentence-transformers torch")
                raise
            except Exception as e:
                logger.error(f"❌ [Embeddings] Failed to load model: {e}")
                raise
    
    def embed_text(self, text: str, max_length: int = 512) -> List[float]:
        """
        Generate 384-dimensional embedding for text
        
        Args:
            text: Input text to embed
            max_length: Maximum character length (truncated if longer)
            
        Returns:
            List of 384 floats representing the embedding
        """
        if not self._model_loaded:
            self._load_model()
        
        if not text or not text.strip():
            logger.warning("⚠️ [Embeddings] Empty text provided, returning zero vector")
            return [0.0] * 384
        
        try:
            # Truncate text to avoid memory issues
            text_truncated = text[:max_length]
            
            start = time.time()
            embedding = self._model.encode(
                text_truncated,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True
            ).tolist()
            duration_ms = (time.time() - start) * 1000
            
            logger.debug(f"📊 [Embeddings] Text ({len(text)} chars) → 384-dim in {duration_ms:.0f}ms")
            
            return embedding
        
        except Exception as e:
            logger.error(f"❌ [Embeddings] Embedding generation failed: {e}")
            # Return zero vector as fallback
            return [0.0] * 384
    
    def embed_batch(self, texts: List[str], max_length: int = 512) -> List[List[float]]:
        """
        Generate embeddings for multiple texts efficiently
        
        Args:
            texts: List of texts to embed
            max_length: Maximum character length per text
            
        Returns:
            List of embedding vectors
        """
        if not self._model_loaded:
            self._load_model()
        
        if not texts:
            return []
        
        try:
            texts_truncated = [t[:max_length] for t in texts]
            
            start = time.time()
            embeddings = self._model.encode(
                texts_truncated,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True
            ).tolist()
            duration_ms = (time.time() - start) * 1000
            
            logger.debug(f"📊 [Embeddings] Batch ({len(texts)} texts) → embeddings in {duration_ms:.0f}ms")
            
            return embeddings
        
        except Exception as e:
            logger.error(f"❌ [Embeddings] Batch embedding failed: {e}")
            # Return zero vectors as fallback
            return [[0.0] * 384 for _ in texts]
    
    def is_ready(self) -> bool:
        """Check if model is loaded and ready"""
        return self._model_loaded


# Create singleton instance
embedding_service = EmbeddingService()
