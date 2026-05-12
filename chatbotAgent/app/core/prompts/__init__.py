"""Static prompt blocks for v3.

Each `.txt` file is the source of truth for one block in the 7-block prompt
template. Loading is centralised so we can swap files in tests and so all
files go through identical Unicode normalisation.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_HERE = Path(__file__).resolve().parent


@lru_cache(maxsize=None)
def load_block(name: str) -> str:
    path = _HERE / f"{name}.txt"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()
