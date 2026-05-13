"""Startup trace — instruments every import and phase to find where the backend hangs."""
import sys
import time
import importlib

_import_log = []
_TRACE_START = time.perf_counter()

def _ts():
    return f"{(time.perf_counter() - _TRACE_START)*1000:.0f}ms"

# Wrap builtins.__import__ to trace slow imports
_original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__
_active_imports = []

def _traced_import(name, *args, **kwargs):
    if name.startswith("app.") or name.startswith("sentence_transformers"):
        indent = "  " * len(_active_imports)
        print(f"[{_ts()}] {indent}→ import {name}", flush=True)
        _active_imports.append(name)
        t0 = time.perf_counter()
        try:
            result = _original_import(name, *args, **kwargs)
            elapsed = (time.perf_counter() - t0) * 1000
            if elapsed > 50:  # Only log slow imports
                print(f"[{_ts()}] {indent}✓ import {name} ({elapsed:.0f}ms)", flush=True)
            return result
        except Exception as exc:
            print(f"[{_ts()}] {indent}✗ import {name} FAILED: {exc}", flush=True)
            raise
        finally:
            _active_imports.pop()
    return _original_import(name, *args, **kwargs)

import builtins
builtins.__import__ = _traced_import

print(f"[{_ts()}] ═══ STARTUP TRACE BEGINS ═══", flush=True)

# Phase 1: dotenv
print(f"\n[{_ts()}] ── Phase 1: dotenv ──", flush=True)
from pathlib import Path
from dotenv import load_dotenv
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path, override=True)
    print(f"[{_ts()}] ✓ dotenv loaded from {_env_path}", flush=True)
else:
    load_dotenv()
    print(f"[{_ts()}] ✓ dotenv loaded (default search)", flush=True)

# Phase 2: logging
print(f"\n[{_ts()}] ── Phase 2: logging config ──", flush=True)
from app.core.logging import configure_logging, get_logger
configure_logging()
print(f"[{_ts()}] ✓ logging configured", flush=True)

# Phase 3: FastAPI + CORS
print(f"\n[{_ts()}] ── Phase 3: FastAPI creation ──", flush=True)
from fastapi import FastAPI
print(f"[{_ts()}] ✓ FastAPI imported", flush=True)

# Phase 4: Health router
print(f"\n[{_ts()}] ── Phase 4: health router ──", flush=True)
from app.api.health import router as health_router
print(f"[{_ts()}] ✓ health router imported", flush=True)

# Phase 5: Other routers (this is where heavy imports happen)
print(f"\n[{_ts()}] ── Phase 5a: therapist_bridge router ──", flush=True)
t0 = time.perf_counter()
try:
    from app.api.therapist_bridge import router as tb_router
    print(f"[{_ts()}] ✓ therapist_bridge imported ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ therapist_bridge FAILED: {exc}", flush=True)

print(f"\n[{_ts()}] ── Phase 5b: admin router ──", flush=True)
t0 = time.perf_counter()
try:
    from app.api.admin import router as admin_router
    print(f"[{_ts()}] ✓ admin imported ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ admin FAILED: {exc}", flush=True)

print(f"\n[{_ts()}] ── Phase 5c: audio router ──", flush=True)
t0 = time.perf_counter()
try:
    from app.api.audio import router as audio_router
    print(f"[{_ts()}] ✓ audio imported ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ audio FAILED: {exc}", flush=True)

print(f"\n[{_ts()}] ── Phase 5d: chat_ws router ──", flush=True)
t0 = time.perf_counter()
try:
    from app.api.chat_ws import router as chat_ws_router
    print(f"[{_ts()}] ✓ chat_ws imported ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ chat_ws FAILED: {exc}", flush=True)

print(f"\n[{_ts()}] ── Phase 5e: onboarding router ──", flush=True)
t0 = time.perf_counter()
try:
    from app.api.onboarding import router as onboarding_router
    print(f"[{_ts()}] ✓ onboarding imported ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ onboarding FAILED: {exc}", flush=True)

# Phase 6: Env validation
print(f"\n[{_ts()}] ── Phase 6: env validation ──", flush=True)
t0 = time.perf_counter()
try:
    from app.core.env import env as get_env, validate_required_env
    ok, missing, config_errors, prefixes, warnings_ = validate_required_env()
    print(f"[{_ts()}] env ok={ok}, missing={missing}, config_errors={config_errors}", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ env validation FAILED: {exc}", flush=True)

# Phase 7: Redis ping
print(f"\n[{_ts()}] ── Phase 7: Redis connectivity ──", flush=True)
import asyncio

async def _test_redis():
    t0 = time.perf_counter()
    try:
        from app.core.connections import get_redis
        r = get_redis()
        if r is None:
            print(f"[{_ts()}] ✗ Redis client is None", flush=True)
            return
        result = await asyncio.wait_for(r.ping(), timeout=3.0)
        print(f"[{_ts()}] ✓ Redis ping={result} ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
    except Exception as exc:
        print(f"[{_ts()}] ✗ Redis failed: {exc} ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)

asyncio.run(_test_redis())

# Phase 8: Embedding model pre-warm
print(f"\n[{_ts()}] ── Phase 8: Embedding model load ──", flush=True)
t0 = time.perf_counter()
try:
    from app.core.connections import get_embedding_model
    model = get_embedding_model()
    if model:
        print(f"[{_ts()}] ✓ Embedding model loaded ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
    else:
        print(f"[{_ts()}] ✗ Embedding model returned None ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
except Exception as exc:
    print(f"[{_ts()}] ✗ Embedding model FAILED: {exc} ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)

# Phase 9: Keyspace verification
print(f"\n[{_ts()}] ── Phase 9: Keyspace notifications ──", flush=True)

async def _test_keyspace():
    t0 = time.perf_counter()
    try:
        from app.services.session_service import verify_keyspace_notifications
        ok = await asyncio.wait_for(verify_keyspace_notifications(), timeout=5.0)
        print(f"[{_ts()}] ✓ Keyspace notifications ok={ok} ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
    except Exception as exc:
        print(f"[{_ts()}] ✗ Keyspace check FAILED: {exc} ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)

asyncio.run(_test_keyspace())

# Phase 10: Test lifespan
print(f"\n[{_ts()}] ── Phase 10: Full lifespan test ──", flush=True)
print(f"[{_ts()}] About to call _log_startup_report()...", flush=True)

async def _test_startup_report():
    t0 = time.perf_counter()
    try:
        from app.main import _log_startup_report
        await asyncio.wait_for(_log_startup_report(), timeout=30.0)
        print(f"[{_ts()}] ✓ _log_startup_report completed ({(time.perf_counter()-t0)*1000:.0f}ms)", flush=True)
    except asyncio.TimeoutError:
        print(f"[{_ts()}] ✗ _log_startup_report TIMED OUT after 30s", flush=True)
    except Exception as exc:
        print(f"[{_ts()}] ✗ _log_startup_report FAILED: {exc}", flush=True)

asyncio.run(_test_startup_report())

print(f"\n[{_ts()}] ═══ ALL STARTUP PHASES TRACED SUCCESSFULLY ═══", flush=True)
print(f"[{_ts()}] Now attempting uvicorn.run (which will block if it starts)...", flush=True)
print(f"[{_ts()}] If you see no output after this, the startup hangs during uvicorn/lifespan.\n", flush=True)
