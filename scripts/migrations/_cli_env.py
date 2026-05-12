"""Load ``chatbotAgent/.env`` for standalone ``python -m scripts.migrations.*`` runs.

FastAPI's lifespan calls ``load_dotenv`` in ``app/main.py``; one-off scripts do not,
so ``SUPABASE_*`` and other keys would otherwise stay unset.
"""
from __future__ import annotations

import sys
from pathlib import Path


def load_chatbot_env() -> None:
    project_root = Path(__file__).resolve().parents[2]
    backend_root = project_root / "chatbotAgent"
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_file = backend_root / ".env"
    if not env_file.is_file():
        return
    load_dotenv(env_file, override=False)
    from app.core.connections import reset_all
    from app.core.env import reload_env

    reload_env()
    reset_all()
