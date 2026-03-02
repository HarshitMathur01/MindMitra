"""
UniversalMemorySystem — re-exports from original memory_architecture.py.
All heavy logic kept in memory_architecture.py to avoid duplication.
"""
# Re-export the original class so the rest of the app/ package can import from here
from memory_architecture import UniversalMemorySystem  # noqa: F401

__all__ = ["UniversalMemorySystem"]
