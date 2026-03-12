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
# MAX_MEMORIES_PER_TYPE — removed (replaced by intent-based MEMORY_LIMIT_* constants)
MAX_ACTIVITIES_PER_AGENT: int = 5
RECENT_MESSAGES_COUNT: int = 5
RESPONSE_RECENT_MESSAGES_COUNT: int = 5
# RESPONSE_MAX_MEMORIES — removed (unused)

# ── Screening assessment ───────────────────────────────────────
SCREENING_MIN_MESSAGES: int = 8           # minimum messages before running screening
SCREENING_EMA_ALPHA: float = 0.6          # EMA weight for new scores (higher = more recent)

# ── TTS / Audio ────────────────────────────────────────────────
ELEVENLABS_TIMEOUT_S: float = 35.0
GOOGLE_TTS_SAMPLE_RATE_HZ: int = 16_000    # 16 kHz PCM for Rhubarb compatibility
GTTS_DEFAULT_LANG: str = "en"

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

# ── Memory Scoring (Generative-Agents-inspired) ───────────────
MEMORY_OVERFETCH_LIMIT: int = 25           # over-fetch from mem0 before re-ranking
RECENCY_DECAY_RATE: float = 0.999          # exponential decay per hour (~84% at 1 week)
SCORE_WEIGHT_RECENCY: float = 0.15         # α_r in composite score
SCORE_WEIGHT_IMPORTANCE: float = 0.35      # α_i in composite score
SCORE_WEIGHT_RELEVANCE: float = 0.50       # α_v in composite score
MEMORY_RELEVANCE_THRESHOLD: float = 0.25   # minimum composite score to include

# ── Memory Retrieval Limits (per intent) ──────────────────────
MEMORY_LIMIT_CASUAL: int = 3
MEMORY_LIMIT_EMOTIONAL: int = 5
MEMORY_LIMIT_THERAPEUTIC: int = 7
MEMORY_LIMIT_CRISIS: int = 4

# ── Reflection / Synthesis ────────────────────────────────────
REFLECTION_INTERVAL_SESSIONS: int = 5      # generate reflections every N sessions
REFLECTION_MAX_INSIGHTS: int = 5           # max reflection insights per synthesis
REFLECTION_MEMORY_FETCH_LIMIT: int = 30    # top-N memories by importance for reflection

# ── Emotional Continuity ──────────────────────────────────────
EMOTIONAL_TREND_SESSIONS: int = 5          # how many past sessions to analyze for trend

# ── Greeting cache ────────────────────────────────────────────
GREETING_CACHE_TTL_S: int = 600           # 10 minutes

# ── Auth / Security ───────────────────────────────────────────
BEARER_PREFIX: str = "Bearer "
DEV_USER_ID_DEFAULT: str = "dev-user"
