"""
Named constants — all magic numbers live here and nowhere else.
Import and use these instead of hard-coding values across the codebase.
"""

# ── Database fetch limits ──────────────────────────────────────
MAX_ACTIVITIES_FETCH: int = 50
MAX_MESSAGES_FETCH: int = 10
MAX_SUMMARIES_FETCH: int = 1
MEMORY_TRIGGER_INTERVAL: int = 12          # messages between memory extraction runs
STREAM_MEMORY_TRIGGER_INTERVAL: int = 12   # same for streaming endpoint (was 8 — fixed)

# ── Agent context limits ───────────────────────────────────────
MAX_MEMORIES_PER_TYPE: int = 4
MAX_ACTIVITIES_PER_AGENT: int = 5
RECENT_MESSAGES_COUNT: int = 5
RESPONSE_RECENT_MESSAGES_COUNT: int = 3
RESPONSE_MAX_MEMORIES: int = 3

# ── TTS / Audio ────────────────────────────────────────────────
ELEVENLABS_TIMEOUT_S: float = 35.0
GOOGLE_TTS_SAMPLE_RATE_HZ: int = 16_000    # 16 kHz PCM for Rhubarb compatibility
GTTS_DEFAULT_LANG: str = "en"

# ── STT / Whisper ──────────────────────────────────────────────
WHISPER_TIMEOUT_S: float = 30.0
WHISPER_MAX_FILE_BYTES: int = 25 * 1024 * 1024  # 25 MB
WHISPER_MODEL: str = "whisper-1"
STT_VALID_MIME_TYPES: tuple = (
    "audio/webm", "audio/wav", "audio/mp3", "audio/mp4",
    "audio/mpeg", "audio/mpga", "audio/m4a", "audio/ogg",
)

# ── Lipsync ────────────────────────────────────────────────────
RHUBARB_TIMEOUT_S: int = 10
PHONEME_DURATION_S: float = 0.15          # seconds per phoneme (text-based fallback)
WORD_PAUSE_S: float = 0.10                # seconds between words

# ── NLP / LLM ─────────────────────────────────────────────────
GROQ_QUERY_TIMEOUT_S: float = 5.0
NLP_HISTORY_MESSAGES: int = 3             # messages included in NLP context window
SESSION_HISTORY_MESSAGES_MEMORY: int = 15 # messages fetched for memory extraction

# ── Embeddings ────────────────────────────────────────────────
EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
EMBEDDING_MAX_LENGTH: int = 512
EMBEDDING_DIMS: int = 384

# ── RAG / Memory deduplication ────────────────────────────────
DEDUP_SIMILARITY_THRESHOLD: float = 0.85
EPISODIC_PROMOTION_THRESHOLD: int = 2
RAG_TOP_K: int = 5
CONFIDENCE_HIGH_GATE: float = 0.60        # → global_memories
CONFIDENCE_MID_GATE: float = 0.40         # → session_memories  (below → discard)

# ── Greeting cache ────────────────────────────────────────────
GREETING_CACHE_TTL_S: int = 600           # 10 minutes

# ── Auth / Security ───────────────────────────────────────────
BEARER_PREFIX: str = "Bearer "
DEV_USER_ID_DEFAULT: str = "dev-user"
