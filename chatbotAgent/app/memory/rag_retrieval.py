"""
MemoryRetriever — re-exports from original rag_retrieval.py.
"""
import sys as _sys
import os as _os
_pkg_root = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
if _pkg_root not in _sys.path:
    _sys.path.insert(0, _pkg_root)

from rag_retrieval import MemoryRetriever  # noqa: F401

__all__ = ["MemoryRetriever"]
