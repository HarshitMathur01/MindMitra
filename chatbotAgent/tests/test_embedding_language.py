import numpy as np
import pytest
from unittest.mock import MagicMock, patch


def _fake_encode(inp, convert_to_numpy=True, show_progress_bar=False):
    def vec_for(s: str):
        rs = np.random.RandomState(abs(hash(s)) % (2**31 - 1))
        return rs.randn(1024).astype(np.float32)

    if isinstance(inp, str):
        return vec_for(inp)
    return np.stack([vec_for(x) for x in inp], axis=0)


@pytest.fixture
def patched_sentence_transformer(monkeypatch):
    # Isolate from developer .env (e.g. MiniLM/384): these tests need BGE-style query prefix.
    monkeypatch.setenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    monkeypatch.setenv("EMBEDDING_DIMS", "1024")
    mock_model = MagicMock()
    mock_model.get_sentence_embedding_dimension.return_value = 1024
    mock_model.encode.side_effect = _fake_encode
    with patch("sentence_transformers.SentenceTransformer", return_value=mock_model):
        import app.core.embedder as emb

        with emb._singleton_lock:
            emb._service = None
        yield mock_model
        with emb._singleton_lock:
            emb._service = None


def test_embed_returns_1024_dims(patched_sentence_transformer):
    from app.core.embedder import get_embedding_service

    assert len(get_embedding_service().embed("hello world")) == 1024


def test_query_vs_doc_embedding_differ(patched_sentence_transformer):
    from app.core.embedder import get_embedding_service

    svc = get_embedding_service()
    assert svc.embed("test", is_query=True) != svc.embed("test", is_query=False)


def test_language_detect_english():
    from app.core.language_detector import LanguageDetector

    assert LanguageDetector().detect("I am feeling very anxious today") == "en"


def test_language_detect_hinglish():
    from app.core.language_detector import LanguageDetector

    assert LanguageDetector().detect("Yaar mujhe bahut sad feel ho raha hai") == "hinglish"


def test_language_detect_handles_exception():
    from app.core.language_detector import LanguageDetector

    LanguageDetector().detect("")  # no exception


def test_embed_batch_consistent(patched_sentence_transformer):
    from app.core.embedder import get_embedding_service

    svc = get_embedding_service()
    batch = svc.embed_batch(["a", "b"])
    assert batch[0] == svc.embed("a")
