"""
Runtime embedding configuration (read from the environment when accessed).

Importing `app.utils.constants` before `load_dotenv()` used to freeze wrong defaults.
Call `get_embedding_model()` / `get_embedding_dims()` at use time (e.g. inside
EmbeddingService._ensure_model) so values match the loaded .env file.
"""

from __future__ import annotations

import os


def infer_embedding_dims_for_model(model: str) -> int:
    ml = model.lower()
    if "bge-m3" in ml or "bge_m3" in ml:
        return 1024
    if "minilm" in ml and "l6" in ml:
        return 384
    if "mpnet" in ml and "base" in ml:
        return 768
    return 1024


def get_embedding_model() -> str:
    return (os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3") or "BAAI/bge-m3").strip()


def get_embedding_dims() -> int:
    raw = (os.getenv("EMBEDDING_DIMS", "") or "").strip()
    if raw.isdigit():
        return int(raw)
    return infer_embedding_dims_for_model(get_embedding_model())
