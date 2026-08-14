#!/usr/bin/env python
"""Create (or list) the Anam system tools MindMitra's avatar persona uses.

System tools cannot be declared inline in a session-token request: the live
``POST /v1/auth/session-token`` rejects ``tools[].type: "system"`` even though
the published OpenAPI spec lists it. They have to be created once per Anam
organisation via ``POST /v1/tools`` with ``type: "SYSTEM"``, then referenced by
id from ``config.yaml`` → ``avatar.tool_ids``.

    python scripts/anam_system_tools.py            # list what already exists
    python scripts/anam_system_tools.py --create    # create the missing ones

Creating a tool is a persistent write to your Anam account, so ``--create`` is
opt-in. Re-running it is safe: tools that already exist by name are skipped.

Needs ANAM_API_KEY in chatbotAgent/.env (or the environment).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

API_BASE = os.getenv("ANAM_API_BASE", "https://api.anam.ai/v1").rstrip("/")

# Why each one earns its place on a mental-health surface. `skip_turn` is
# deliberately absent: a model that can silence itself is a model that can
# decline to answer a crisis.
WANTED = [
    (
        "change_language",
        "Switch the language the student is expected to speak, when they move "
        "between English, Hindi or Hinglish mid-conversation.",
    ),
    (
        "pause_conversation",
        "Stay quiet for a short while when the student asks for a moment, "
        "without ending the session.",
    ),
    (
        "end_call",
        "End the conversation when the student asks to stop.",
    ),
]


def _api_key() -> str:
    key = os.getenv("ANAM_API_KEY", "").strip()
    if not key:
        try:
            from dotenv import load_dotenv  # noqa: PLC0415

            load_dotenv(ROOT / ".env")
            key = os.getenv("ANAM_API_KEY", "").strip()
        except ImportError:
            pass
    if not key:
        sys.exit("ANAM_API_KEY is not set (checked env and chatbotAgent/.env)")
    return key


def _headers(key: str) -> dict:
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def list_tools(key: str) -> list[dict]:
    response = httpx.get(f"{API_BASE}/tools", headers=_headers(key), timeout=20.0)
    response.raise_for_status()
    payload = response.json()
    return payload.get("data", payload) if isinstance(payload, dict) else payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--create",
        action="store_true",
        help="create missing tools (writes to your Anam account)",
    )
    args = parser.parse_args()

    key = _api_key()
    existing = {t.get("name"): t for t in list_tools(key)}

    created: list[tuple[str, str]] = []
    for name, description in WANTED:
        found = existing.get(name)
        if found:
            print(f"  exists   {found['id']}  {name}")
            created.append((name, found["id"]))
            continue
        if not args.create:
            print(f"  MISSING  {'-' * 36}  {name}   (run with --create)")
            continue

        response = httpx.post(
            f"{API_BASE}/tools",
            headers=_headers(key),
            json={"type": "SYSTEM", "name": name, "description": description},
            timeout=20.0,
        )
        if response.status_code not in (200, 201):
            print(f"  FAILED   {name}: {response.status_code} {response.text[:300]}")
            continue
        tool_id = response.json().get("id", "")
        print(f"  created  {tool_id}  {name}")
        created.append((name, tool_id))

    if created:
        print("\nPaste into chatbotAgent/config.yaml under `avatar:`\n")
        print("  tool_ids:")
        for name, tool_id in created:
            print(f'    - "{tool_id}"   # {name}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
