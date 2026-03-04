"""
app/main.py — Slim FastAPI factory.

Build order (critical for Railway health checks):
  1. Create FastAPI app
  2. Register /health immediately
  3. Decode Google credentials (if base64)
  4. Add CORS middleware
  5. Include routers
  6. Startup event: log env-var status
"""
import base64
import logging
import os
import tempfile
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

from dotenv import load_dotenv

load_dotenv()

# ── logging must be first ──────────────────────────────────────────────────
from app.core.logging import configure_logging  # noqa: E402 (must be early)

configure_logging()
logger = logging.getLogger(__name__)

# ── FastAPI app ────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — replaces deprecated @app.on_event."""
    logger.info("=" * 70)
    logger.info("🚀 MindMitra v2 Backend Starting…")
    logger.info(f"   PORT:                     {os.getenv('PORT', '8000')}")
    logger.info(f"   GROQ_API_KEY:             {'✅' if os.getenv('GROQ_API_KEY') else '❌ Missing'}")
    logger.info(f"   GOOGLE_API_KEY:           {'✅' if os.getenv('GOOGLE_API_KEY') else '❌ Missing'}")
    logger.info(f"   ZHIPUAI_API_KEY:          {'✅' if os.getenv('ZHIPUAI_API_KEY') else '❌ Missing'}")
    logger.info(f"   ZAI_API_KEY:              {'✅' if os.getenv('ZAI_API_KEY') else '⚠️  Not set (ZHIPUAI_API_KEY used)'}")
    logger.info(f"   SUPABASE_URL:             {'✅' if os.getenv('SUPABASE_URL') else '❌ Missing'}")
    logger.info(f"   SUPABASE_KEY:             {'✅' if os.getenv('SUPABASE_KEY') else '❌ Missing'}")
    logger.info(f"   ELEVENLABS_API_KEY:       {'✅' if os.getenv('ELEVENLABS_API_KEY') else '⚠️  Not set (gTTS fallback)'}")
    logger.info(f"   GOOGLE_CREDENTIALS_BASE64:{'✅' if os.getenv('GOOGLE_CREDENTIALS_BASE64') else '⚠️  Not set (gTTS fallback)'}")
    logger.info(f"   SKIP_AUTH:                {os.getenv('SKIP_AUTH', 'false')}")
    logger.info("=" * 70)
    yield


app = FastAPI(title="MindMitra Chatbot Agent", version="2.0.0", lifespan=lifespan)

# ── CRITICAL: register /health BEFORE any heavy imports ───────────────────
# keep a thin inline definition here as well so health works even if
# the api.health module fails to import.
from app.api.health import router as health_router

app.include_router(health_router)

# ── Google credentials (base64 → temp file, sets GOOGLE_APPLICATION_CREDENTIALS) ──
_GOOGLE_B64 = os.getenv("GOOGLE_CREDENTIALS_BASE64", "")
_GOOGLE_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

if _GOOGLE_B64:
    try:
        creds_json = base64.b64decode(_GOOGLE_B64).decode("utf-8")
        _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
        _tmp.write(creds_json)
        _tmp.close()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name
        logger.info(f"✅ [INIT] Google credentials decoded from GOOGLE_CREDENTIALS_BASE64 → {_tmp.name}")
    except Exception as e:
        logger.error(f"❌ [INIT] Failed to decode GOOGLE_CREDENTIALS_BASE64: {e}")
elif _GOOGLE_PATH and os.path.exists(_GOOGLE_PATH):
    logger.info(f"✅ [INIT] Google credentials loaded from file: {_GOOGLE_PATH}")
else:
    logger.warning("⚠️ [INIT] Google Cloud credentials not found — Google TTS will use gTTS fallback")

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mindmitra.co.in",
        "https://www.mindmitra.co.in",
        "https://mindmitra-seven.vercel.app",
        "http://localhost:8080",
        # common local/dev origins to allow browser preflight during development
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8001",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include routers (after /health) ────────────────────────────────────────
from app.api.chat import router as chat_router
from app.api.transcribe import router as transcribe_router
from app.api.onboarding import router as onboarding_router

app.include_router(chat_router)
app.include_router(transcribe_router)
app.include_router(onboarding_router)




# ── Dev entrypoint ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")
