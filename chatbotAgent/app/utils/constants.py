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

# ── Question Budget Enforcer ─────────────────────────────────
# Conversation stages (based on user message count in session)
STAGE_TRUST_WINDOW_MAX: int = 3       # Messages 1-3: zero questions
STAGE_DEEPENING_MAX: int = 7          # Messages 4-7: "I wonder..." only
STAGE_INSIGHT_MAX: int = 12           # Messages 8-12: max 1 question
# Messages 13+: Companion stage, max 1 question

# Per-stage question caps (max "?" allowed in a single response)
QUESTION_CAP_TRUST: int = 1      # Trust Window: at most 1 warm, specific question
QUESTION_CAP_DEEPENING: int = 1  # Deepening: at most 1 question — prefer "I wonder..." statements
QUESTION_CAP_INSIGHT: int = 1    # Insight: at most 1 genuine question
QUESTION_CAP_COMPANION: int = 1  # Companion: at most 1 question — lead with statements

# Forbidden interrogative phrases → soft-statement replacements
# Keys are regex patterns (case-insensitive); values are replacement text
FORBIDDEN_QUESTION_PATTERNS: dict = {
    # ── Original patterns ──
    r"\bhow does that make you feel\b\s*\??": "I can only imagine how that feels.",
    r"\bwhat do you think\b\s*\??": "I'd love to hear your thoughts on that.",
    r"\bcan you tell me more\b\s*\??": "I'd like to hear more about that.",
    r"\bwould you like to talk about\b\s*\??": "We could explore that together.",
    r"\bwhat happened\b\s*\??": "It sounds like something happened there.",
    r"\bhow are you feeling\b\s*\??": "I'm curious about how you're feeling.",
    r"\bdo you want to\b\s*\??": "It might be worth considering.",
    r"\bwhat would help\b\s*\??": "I wonder what might help here.",
    r"\bcan you share\b\s*\??": "I'd love to hear about that.",
    r"\bwhat do you mean\b\s*\??": "I want to make sure I understand you.",
    r"\bhow did that go\b\s*\??": "I wonder how that went.",
    r"\bwhat's on your mind\b[^.!?\n]*\??": "I'm here whenever you want to share what's on your mind.",
    r"\bhow do you cope\b\s*\??": "I wonder what helps you cope.",
    r"\bis there anything\b[^.!?\n]*\??": "I'm here if there's anything.",
    r"\bwhat brings you here\b\s*\??": "I'm glad you're here.",
    r"\btell me more\b\s*\??": "I'd like to hear more.",
    # ── New patterns (common LLM questions) ──
    r"\bwhat are you\b[^.!?\n]*\??": "I wonder what you're thinking about.",
    r"\bwhat(?:'s| is) (?:been|it) like\b[^.!?\n]*\??": "I wonder what that's been like for you.",
    r"\bwhat made you\b[^.!?\n]*\??": "I'm curious about what brought that on.",
    r"\bdo you (?:feel|think|believe|mind)\b[^.!?\n]*\??": "I wonder how you feel about that.",
    r"\bwhat(?:'s| is) (?:your|the) (?:plan|goal|next step)\b[^.!?\n]*\??": "I wonder what feels right as a next step.",
    r"\bhow can I help\b[^.!?\n]*\??": "I'm here to help however feels right.",
    r"\bwhat do you (?:need|want)\b[^.!?\n]*\??": "I wonder what would feel most helpful right now.",
    r"\bwhat(?:'s| is) (?:bothering|troubling|worrying) you\b[^.!?\n]*\??": "I sense something might be weighing on you.",
    r"\bwould you (?:like|want) to\b[^.!?\n]*\??": "We could explore that if it feels right.",
    r"\bany (?:plans|thoughts)\b[^.!?\n]*\??": "I wonder what you might have planned.",
    # ── Edge-case / tag questions ──
    r"\bright\s*\?": ".",
    r"\byeah\s*\?": ".",
    r"\bno\s*\?": ".",
    r"\bsee\s*\?": ".",
    r"\bwhat(?:'s| is) on your (?:heart|chest)\b[^.!?\n]*\??": "I'm here for whatever's on your heart.",
    r"\bwhat(?:'s| is) (?:that|it) like\b[^.!?\n]*\??": "I wonder what that's like for you.",
    r"\bwant to (?:talk|share|explore|discuss)\b[^.!?\n]*\??": "We could explore that if it feels right.",
    r"\bready to\b[^.!?\n]*\??": "Whenever you're ready.",
}

# Hinglish forbidden question patterns
FORBIDDEN_QUESTION_PATTERNS_HINGLISH: dict = {
    r"\bkya aap\b[^.!?\n]*\?": "Main samajhna chahta hoon.",
    r"\bkaise ho\b\s*\??": "I hope you're doing okay.",
    r"\bkya hua\b\s*\??": "Lagta hai kuch hua hai.",
    r"\bbatao na\b\s*\??": "Main sunna chahta hoon.",
    r"\bkya chal raha\b[^.!?\n]*\??": "I hope sab theek chal raha hai.",
    r"\bkaisa (?:feel|lag) (?:ho raha|kar raha)\b[^.!?\n]*\??": "I wonder kaisa feel ho raha hai.",
    r"\btum(?:he|ko) kya\b[^.!?\n]*\??": "Main samajhna chahta hoon tumhare baare mein.",
    r"\bkuch aur\b[^.!?\n]*\??": "Main yahan hoon agar kuch aur share karna ho.",
}
