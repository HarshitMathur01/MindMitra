"""Re-export legacy prompt constants and add MITRA v2 prompt builders.

We import the legacy module by file path to avoid a circular import: the
legacy file lives at `chatbotAgent/app/core/prompts.py`, which would shadow
this package. We load it directly so callers can keep doing
`from app.core.prompts import CRISIS_LLM_CHECK_PROMPT` etc.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_legacy_path = Path(__file__).resolve().parent.parent / "prompts.py"

# Only load if the legacy file actually exists; otherwise be a pure package.
if _legacy_path.exists():
    spec = importlib.util.spec_from_file_location("app.core._prompts_legacy", _legacy_path)
    if spec and spec.loader:
        _legacy = importlib.util.module_from_spec(spec)
        sys.modules["app.core._prompts_legacy"] = _legacy
        spec.loader.exec_module(_legacy)
        # Re-export every public symbol.
        for _name in dir(_legacy):
            if not _name.startswith("_"):
                globals()[_name] = getattr(_legacy, _name)

# v2 prompt modules are explicit re-exports.
from . import stance as stance  # noqa: E402,F401
from . import critic as critic  # noqa: E402,F401
from . import crisis as crisis  # noqa: E402,F401
