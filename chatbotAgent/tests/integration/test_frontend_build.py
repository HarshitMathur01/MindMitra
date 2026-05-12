"""Frontend build integration smoke test."""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.integration
@pytest.mark.slow
def test_frontend_builds_cleanly() -> None:
    if shutil.which("npm") is None:
        pytest.skip("npm not on PATH")
    if not (REPO_ROOT / "node_modules").exists():
        pytest.skip("node_modules missing; run `npm install` first")

    result = subprocess.run(
        ["npm", "run", "build", "--silent"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=180,
        env={**os.environ, "CI": "1"},
        check=False,
    )

    assert result.returncode == 0, (
        f"Frontend build failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
