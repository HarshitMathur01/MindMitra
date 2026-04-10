#!/usr/bin/env python3
"""
Seed long-term memory for the local dev user so HTTP eval sees memory_injected=true.

Why this exists
---------------
With SKIP_AUTH=true, every /chat uses DEV_USER_ID (see app/core/auth.py). Retrieval first
checks Supabase memory_metadata; if there are zero rows, retrieve_memories returns ""
immediately (fast path). Short eval conversations (< MEMORY_TRIGGER_INTERVAL messages)
also never call mem0.add — so nothing gets written during the eval run itself.

Run once (same env as your API: GROQ_API_KEY, Qdrant, Supabase):

    cd chatbotAgent
    set -a && source .env && set +a
    # Optional clean namespace (set DEV_USER_ID to the same value when hitting /chat):
    # export EVAL_SEED_USER_ID=$(python -c "import uuid; print(uuid.uuid4())")
    python scripts/seed_eval_memory.py

Then re-run: python -m tests.rag_evaluator
Expect MM_MEMORY_TRACE=1 logs and eval_trace.memory_injected true when retrieval matches.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from app.agents.memory_manager import memory_manager

# If probe preview matches these, the Qdrant profile for this user_id almost certainly
# includes unrelated traffic (e.g. crisis eval turns) — use EVAL_SEED_USER_ID ≠ DEV_USER_ID.
_CRISIS_LEAK_HINTS = (
    "jeena nahi",
    "end my life",
    "kill myself",
    "want to die",
    "khudkhushi",
)


def main() -> int:
    default_uid = "a0778b19-548f-47df-8413-296307566d0f"
    uid = os.getenv("EVAL_SEED_USER_ID") or os.getenv("DEV_USER_ID", default_uid)
    print(f"Seeding memories for user_id={uid}")
    if not os.getenv("EVAL_SEED_USER_ID"):
        print(
            "Tip: set EVAL_SEED_USER_ID to a dedicated UUID for clean memory eval; "
            "reusing DEV_USER_ID mixes crisis/test traffic into retrieved bullets.",
            file=sys.stderr,
        )

    # Wait for background mem0 init (same as a fresh shell importing the app)
    for _ in range(90):
        if memory_manager.is_ready:
            break
        time.sleep(0.5)
    else:
        print("ERROR: memory_manager.is_ready never became True (GROQ_API_KEY / mem0 init).", file=sys.stderr)
        return 1

    messages = [
        {
            "role": "user",
            "content": (
                "I'm overwhelmed — law school finals next week in Mumbai "
                "and I'm scared I'll disappoint my parents."
            ),
        },
        {
            "role": "assistant",
            "content": "That sounds like an enormous weight — finals plus family expectations.",
        },
        {
            "role": "user",
            "content": "My cousin Priya keeps comparing her grades to mine and it wrecks me.",
        },
        {
            "role": "assistant",
            "content": "Having someone close constantly compare scores can erode confidence.",
        },
    ]

    result = memory_manager.add_memories(
        messages,
        uid,
        session_id="eval-seed-session",
        metadata={"source": "eval_seed", "content_locale": "english"},
    )
    n = len(result.get("results") or [])
    print(f"mem0.add returned {n} result row(s); waiting for metadata thread (8s)...")
    time.sleep(8)

    probe = "Priya exams parents Mumbai cousin"
    ctx = memory_manager.retrieve_memories(probe, uid, intent="emotional")
    print(f"Probe retrieve_memories({probe!r}) → {len(ctx or '')} chars")
    if ctx:
        print("--- preview ---")
        print(ctx[:600])
        print("--- end preview ---")
        low = (ctx or "").lower()
        if any(h in low for h in _CRISIS_LEAK_HINTS):
            print(
                "\n⚠️  Retrieved memories include crisis-like phrases not from this seed. "
                "Your mem0/Qdrant store for this user_id is polluted (same ID used for "
                "rag eval crisis cases). Fix: export a fresh EVAL_SEED_USER_ID and set "
                "DEV_USER_ID to match when running the API for memory-only eval, OR purge "
                "memories for this user in Qdrant+Supabase (ops procedure).",
                file=sys.stderr,
            )
        return 0

    print(
        "WARNING: Still empty. Check: Supabase memory_metadata for this user_id, "
        "Qdrant connectivity, and logs for _score_and_save_metadata.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
