"""
UniversalMemorySystem — re-exports from original memory_architecture.py.
All heavy logic kept in memory_architecture.py to avoid duplication.
"""
import sys as _sys
import os as _os
# Ensure chatbotAgent/ is on sys.path so the bare import below resolves regardless of CWD
_pkg_root = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
if _pkg_root not in _sys.path:
    _sys.path.insert(0, _pkg_root)

# Re-export the original class so the rest of the app/ package can import from here
from memory_architecture import UniversalMemorySystem  # noqa: F401

__all__ = ["UniversalMemorySystem"]
