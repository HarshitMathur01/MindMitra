  MHA Implementation Spec v3.0 :root { --ink: #1a1a1a; --ink2: #3d3d3a; --ink3: #7a7a7a; --surface: #ffffff; --surface2: #f7f6f3; --surface3: #f0ede8; --border: rgba(0,0,0,0.10); --border2: rgba(0,0,0,0.18); --accent: #2563eb; --accent-bg: #eff6ff; --green: #15803d; --green-bg: #f0fdf4; --amber: #b45309; --amber-bg: #fffbeb; --red: #dc2626; --red-bg: #fef2f2; --purple: #7c3aed; --purple-bg: #f5f3ff; --code-bg: #f4f3f0; --font-serif: Georgia, 'Times New Roman', serif; --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; --font-mono: 'Courier New', Consolas, monospace; } @media (prefers-color-scheme: dark) { :root { --ink: #e8e6e0; --ink2: #b0ada6; --ink3: #767370; --surface: #18181b; --surface2: #222226; --surface3: #2a2a2e; --border: rgba(255,255,255,0.09); --border2: rgba(255,255,255,0.16); --accent: #60a5fa; --accent-bg: #1e3a5f; --green-bg: #052e16; --amber-bg: #1c1400; --red-bg: #1c0707; --purple-bg: #1e1040; --code-bg: #26262b; } } \* { box-sizing: border-box; margin: 0; padding: 0; } html { scroll-behavior: smooth; } body { font-family: var(--font-serif); color: var(--ink); background: var(--surface); font-size: 15px; line-height: 1.85; max-width: 860px; margin: 0 auto; padding: 2.5rem 1.5rem 6rem; } h1 { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.03em; margin: 2rem 0 0.4rem; line-height: 1.2; border-bottom: 2px solid var(--border2); padding-bottom: 0.6rem; } h2 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; margin: 2.2rem 0 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; font-family: var(--font-sans); } h3 { font-size: 1.0rem; font-weight: 700; margin: 1.6rem 0 0.5rem; font-family: var(--font-sans); color: var(--ink); } h4 { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink3); margin: 1.3rem 0 0.4rem; font-family: var(--font-sans); } p { margin-bottom: 0.75rem; } ul, ol { padding-left: 1.4rem; margin-bottom: 0.75rem; } li { margin-bottom: 0.3rem; } a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; } hr { border: none; border-top: 1px solid var(--border2); margin: 2rem 0; } pre { background: var(--code-bg); border: 0.5px solid var(--border); border-radius: 8px; padding: 1rem 1.1rem; overflow-x: auto; margin: 0.8rem 0 1rem; font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.65; color: var(--ink2); } code { font-family: var(--font-mono); font-size: 0.83em; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; color: var(--ink); } pre code { background: none; padding: 0; border-radius: 0; font-size: inherit; } table { width: 100%; border-collapse: collapse; font-family: var(--font-sans); font-size: 0.82rem; margin: 0.8rem 0 1rem; display: block; overflow-x: auto; } th { text-align: left; padding: 7px 10px; border-bottom: 1.5px solid var(--border2); font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink3); white-space: nowrap; background: var(--surface2); } td { padding: 7px 10px; border-bottom: 0.5px solid var(--border); vertical-align: top; color: var(--ink2); } tr:last-child td { border: none; } blockquote { border-left: 3px solid var(--accent); padding: 0.6rem 1rem; margin: 0.8rem 0; background: var(--accent-bg); border-radius: 0 6px 6px 0; font-family: var(--font-sans); font-size: 0.88rem; color: var(--ink2); } .toc-box { background: var(--surface2); border: 0.5px solid var(--border); border-radius: 10px; padding: 1.2rem 1.5rem; margin: 1.5rem 0 2rem; font-family: var(--font-sans); } .toc-box h2 { border: none; padding: 0; margin: 0 0 0.8rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink3); } .toc-box ol { margin: 0; padding-left: 1.2rem; } .toc-box li { margin-bottom: 0.25rem; font-size: 0.88rem; } .toc-box a { color: var(--ink2); } .toc-box a:hover { color: var(--ink); } .meta { font-family: var(--font-sans); font-size: 0.82rem; color: var(--ink3); margin-bottom: 1.5rem; display: flex; gap: 1.5rem; flex-wrap: wrap; } .top-banner { background: var(--purple-bg); border: 0.5px solid var(--purple); border-radius: 10px; padding: 1rem 1.2rem; margin-bottom: 2rem; font-family: var(--font-sans); font-size: 0.85rem; color: var(--ink2); } strong { font-weight: 600; color: var(--ink); } em { font-style: italic; }

MHA Conversational Agent

Complete Implementation Specification v3.0
==========================================

Target: Indian Young Adults (18–30) Stack: FastAPI · React · Supabase · Qdrant · Azure OpenAI · Railway · Vercel Status: Ready for coding agent

**Current deployment note:** the production chat surface is HTTP `POST /chat`. Older WebSocket/SSE protocol sections in this exported spec are retained as design history and are not registered in the running FastAPI app.

**How to use this document:** This spec is complete and ordered. Tasks 0–15 build on each other. Task 0 contains decisions that every other layer depends on — read it first. Every input/output field in every layer is traced to exactly one producer and one or more consumers. No dangling fields. No missing consumers. No bugs in the data flow.

Contents
--------

1.  Task 0: Foundational decisions (session boundary, Qdrant schema, Supabase tables, fallback routing)
2.  Task 1: Full input-output field audit — every layer, every field
3.  Task 2: LLM call audit — every call justified, orphaned fields fixed
4.  Task 3: Concurrency & parallelism — asyncio design, per-turn timeline
5.  Task 4: Session startup flow
6.  Task 5: Full system data flow
7.  Task 6: LLM vs non-LLM decision table
8.  Task 7: Audience expansion (18–30 Indian young adults)
9.  Task 8: Anti-dependency system
10.  Task 9: Graceful degradation
11.  Task 10: Monitoring & observability
12.  Task 11: Dependency stack (requirements.txt + env vars)
13.  Task 12: Answer — why recent 6–10 messages in Orchestrator
14.  Task 13: Onboarding flow
15.  Task 14: Supabase auth architecture
16.  Task 15: Crisis template governance
17.  Summary: Full layer sequence with latency budget

MHA Conversational Agent — Complete Implementation Specification
================================================================

Version 3.0 | Target: Indian Young Adults (18–30) | Zero-Bug Spec
-----------------------------------------------------------------

* * *

TASK 0: FOUNDATIONAL DECISIONS (Read Before Everything Else)
============================================================

These decisions flow through every layer. Getting them wrong here creates bugs everywhere.

* * *

0.1 Session Boundary Definition
-------------------------------

**Decision:** Time-based with activity detection.

A session is a continuous conversation window. Session ends when: - User is inactive for **25 minutes** (Redis TTL fires, session marked `status: ended`) - User explicitly closes the chat (frontend sends a `session_close` event) - App goes to background on mobile for > 25 minutes

When user returns after > 25 minutes: **new session created**, previous session summary loaded from episodic memory as context. Session ID changes. User ID stays the same.

When user returns within 25 minutes: **same session continues**. Redis TTL resets. No new session.

**Why 25 minutes:** Indian young adults use the app in short bursts — between lectures, late night, during commute. 30 minutes was too aggressive for commute-break usage. 20 minutes cut off genuine conversation pauses. 25 is the calibrated midpoint.

**Session object stored in Redis:**

    session:{user_id}:{session_id} → {
      session_id: str (UUID),
      user_id: str (UUID, hashed),
      started_at: ISO timestamp,
      last_activity: ISO timestamp,
      status: "active" | "ended",
      turn_count: int,
      current_mode: str,
      mode_history: list[{mode, turn_number, reason}],
      affect_history: list[{turn: int, valence: float, arousal: float, dominance: float, urgency: int}],
      urgency_history: list[int],  // last 10 urgency scores
      turns: list[{role: "user"|"assistant", content: str, timestamp: ISO}],  // full transcript
      language_register: str,
      code_mix_ratio: float,
      dependency_signals: {sessions_this_week: int, social_mentions_count: int},
      cultural_frame_id: str,
      longitudinal_risk_flag: bool,
      session_peak_urgency: int,  // highest urgency seen this session
      llm_tokens_used: int        // for cost tracking
    }
    

**Redis TTL:** 25 minutes from last write. Every user message resets TTL.

**Key naming:** `session:{user_id}:{session_id}` — allows multiple concurrent sessions per user (rare but valid, e.g. web + mobile simultaneously). Active session pointer: `active_session:{user_id}` → session\_id.

* * *

0.2 Qdrant Collection Structure
-------------------------------

**Decision:** Single shared collection, user\_id as payload filter.

One collection: `episodic_memories`

Each point:

    {
      id: UUID,
      vector: float[384],  // MiniLM-L6-v2 embedding of summary text
      payload: {
        user_id: str,
        session_id: str,
        session_date: ISO timestamp,
        summary_text: str,         // 80-120 tokens, human-readable
        affect_mean: {valence: float, arousal: float},
        topic_keywords: list[str], // extracted by Groq, 3-6 keywords
        peak_urgency: int,         // highest urgency seen in that session
        ending_affect: {valence: float, arousal: float},
        mode_sequence: list[str],  // modes used in that session
        named_entities: list[str], // people mentioned
        techniques_used: list[str] // CBT/breathing if used
      }
    }
    

Second collection: `knowledge_base` (psychoeducation content, Phase 2)

    {
      id: UUID,
      vector: float[384],
      payload: {
        content: str,
        topic_category: str,
        source: str,
        clinical_approved: bool,
        language: "en" | "hi" | "hinglish"
      }
    }
    

**Why single collection with filter:** At MVP scale (< 5000 users), per-user collections are wasteful and unmanageable. Qdrant's payload filtering is fast enough. At 100K users, revisit partitioning by user\_id prefix.

* * *

0.3 Supabase Table Structure
----------------------------

### Table: `users`

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    auth_id UUID UNIQUE REFERENCES auth.users(id),
    age_group VARCHAR(10),           -- "18-22", "23-26", "27-30"
    occupation VARCHAR(50),          -- "student", "working", "other"
    city VARCHAR(100),
    region VARCHAR(50),              -- for cultural frame seeding
    onboarding_complete BOOLEAN DEFAULT FALSE
    

### Table: `user_semantic_profiles`

    user_id UUID PRIMARY KEY REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    display_name VARCHAR(100),       -- if user shared it
    occupation_detail VARCHAR(200),  -- "engineering student at IIT", "software engineer at startup"
    city VARCHAR(100),
    recurring_themes JSONB,          -- {"academic_pressure": 0.8, "loneliness": 0.6, "family": 0.4}
    relationship_map JSONB,          -- [{"name": "Priya", "relation": "friend", "context": "roommate issues"}]
    comfort_topics JSONB,            -- ["cricket", "music", "coding"]
    discomfort_topics JSONB,         -- ["career uncertainty"]
    language_baseline JSONB,         -- {"code_mix_mean": 0.55, "formality_mean": 0.3}
    cultural_frame_id VARCHAR(50),   -- "iit_pressure" | "working_professional" | "first_gen" | "metro_social" | "small_town_aspirant"
    total_sessions INT DEFAULT 0,
    first_session_at TIMESTAMPTZ
    

### Table: `user_procedural_profiles`

    user_id UUID PRIMARY KEY REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    style_vector JSONB,              -- {formality, code_mix, sentence_length, warmth, emoji_use, directness, humour_tolerance, pace}
    deflection_topics JSONB,         -- topics user consistently avoids
    engagement_topics JSONB,         -- topics user responds well to
    response_length_pref FLOAT,      -- 0=short, 1=long, learned from engagement
    dependency_risk_counter INT DEFAULT 0,
    sessions_this_week INT DEFAULT 0,
    last_session_date DATE,
    consecutive_high_urgency_sessions INT DEFAULT 0,
    preferred_time_slots JSONB       -- ["22:00-01:00", "07:00-09:00"] learned from usage
    

### Table: `user_longitudinal_trajectory`

    user_id UUID PRIMARY KEY REFERENCES users(id),
    affect_series JSONB,             -- [{date, valence_mean, arousal_mean, peak_urgency}, ...] max 30 entries
    phq2_scores JSONB,               -- [{date, score, raw_responses}] permanent
    longitudinal_risk_flag BOOLEAN DEFAULT FALSE,
    last_slope FLOAT,                -- valence slope over last 7 sessions
    last_computed_at TIMESTAMPTZ,
    risk_flag_set_at TIMESTAMPTZ
    

### Table: `sessions`

    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    turn_count INT,
    peak_urgency INT,
    mode_sequence JSONB,
    final_affect JSONB,              -- {valence, arousal} at session end
    episodic_memory_written BOOLEAN DEFAULT FALSE,
    tokens_used INT,
    llm_primary_used VARCHAR(50)     -- which LLM was primary
    

### Table: `audit_logs`

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id UUID REFERENCES sessions(id),
    user_id UUID,                    -- NOT a FK to users, for anonymisation
    event_type VARCHAR(50),          -- "tier3_trigger", "tier2_trigger", "sycophancy_flag", "hallucination_flag", "llm_fallback"
    urgency_score INT,
    mode VARCHAR(50),
    memory_used BOOLEAN,
    tokens_used INT,
    llm_used VARCHAR(50),
    safety_flags JSONB,              -- {harm: bool, sycophancy: bool, hallucination: bool}
    -- NO content stored in audit logs. Metadata only.
    

### Table: `crisis_templates`

    id UUID PRIMARY KEY,
    language_variant VARCHAR(20),    -- "en", "hi", "hinglish_casual", "hinglish_formal", "neutral"
    content TEXT,
    version INT,
    approved_by JSONB,               -- [{approver_id, approved_at}, {approver_id, approved_at}] -- requires 2
    active BOOLEAN DEFAULT FALSE,    -- only one active per language_variant
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
    -- RLS: SELECT for all authenticated service roles. INSERT/UPDATE requires admin role only.
    

### Table: `static_fallback_templates`

    id UUID PRIMARY KEY,
    mode VARCHAR(50),                -- "companion", "active_listener", "recovery_check"
    language_variant VARCHAR(20),
    content TEXT,
    template_index INT,              -- 0-5, for random selection
    active BOOLEAN DEFAULT TRUE
    

* * *

0.4 Fallback Routing Logic (Global Rule — Applied Everywhere)
-------------------------------------------------------------

    For urgency = 0 (Companion mode, routine):
      Primary: Azure OpenAI GPT-4o
      Fallback 1: GLM-4-Flash (free)
      Fallback 2: Static template (mode=companion, random index)
    
    For urgency = 1-2 (Active Listener, elevated distress):
      Primary: Azure OpenAI GPT-4o
      Fallback 1: Groq Llama 3.3 70B
      Fallback 2: Static template (mode=active_listener)
      NEVER: GLM at urgency > 0
    
    For urgency = 3 (Crisis):
      ONLY: Crisis template from Supabase
      NEVER: Any LLM call
    
    For signal extraction (Groq primary task):
      Primary: Groq Llama 3.1 8B (structured output)
      Fallback: Gemini 1.5 Flash free
      Fallback 2: Rule-based heuristics (keyword matching, no affect vector)
    
    For session summarisation (async, session end):
      Primary: Gemini 1.5 Flash free API
      Fallback: Groq Llama 3.1 8B
    
    For semantic fact extraction (async, session end):
      Primary: Groq Llama 3.1 8B (structured output)
      Fallback: Gemini 1.5 Flash free
    

**Fallback trigger conditions:** - Azure: HTTP 429 (rate limit) OR HTTP 5xx OR timeout > 8 seconds - Groq: HTTP 429 OR timeout > 4 seconds - Gemini: HTTP 429 OR timeout > 6 seconds - All fallbacks: Log to audit\_logs with event\_type="llm\_fallback"

* * *

0.5 Embedding Model Decision
----------------------------

**Model:** `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions) **Runs on:** Railway CPU (included in Hobby/Pro plan) **Latency:** ~15ms per embedding on Railway CPU **Caching:** Embed each text once, cache in Redis with key `emb:{sha256(text)[:16]}` TTL=1 hour **When used:** 1. Session start: embed current session's recent turns summary for retrieval (pre-computed once, reused) 2. Message-level: embed current user message for dual-channel retrieval 3. Session end: embed full session summary for episodic write to Qdrant

**Not used for:** Signal extraction (that goes to Groq). Only used for vector operations.

* * *

0.6 Cultural Frame Definitions (Expanded for 18–30 Indian Young Adults)
-----------------------------------------------------------------------

Five frames (v2 had 4, v3 adds working professional frame):

    FRAME_1: "iit_pressure"
      Applies to: Engineering/medical college students (IIT/NIT/BITS/AIIMS tier)
      Core stressors: JEE identity, rank anxiety, parental sacrifice narrative, peer comparison,
                      placement pressure, "log kya kahenge" in professional context
      Tone adjustment: Higher directness tolerance, technical metaphors OK
    
    FRAME_2: "working_professional"  ← NEW for 18-30 expansion
      Applies to: Working adults 22-30 in corporate/startup/govt jobs
      Core stressors: Work-life balance, manager relationships, career growth anxiety,
                      relationship pressure (marriage expectations), EMI stress, city loneliness
      Tone adjustment: Less "student" language, more peer-to-peer adult framing
    
    FRAME_3: "first_gen_aspirant"
      Applies to: First-generation college students, small city to metro transitions
      Core stressors: Imposter syndrome, family financial pressure, inability to show struggle,
                      code-switching between home identity and college identity
      Tone adjustment: More Hinglish, less elite-college assumptions
    
    FRAME_4: "metro_social"
      Applies to: Urban 22-28 in metros (Mumbai/Delhi/Bengaluru/Hyderabad)
      Core stressors: Loneliness despite crowds, expensive city anxiety, dating/relationship complexity,
                      hustle culture pressure, FOMO from social media
      Tone adjustment: More English-comfortable, faster pace
    
    FRAME_5: "small_town_adult"
      Applies to: 18-25 in Tier 2/3 cities, not in top colleges
      Core stressors: Limited opportunities, family watchfulness, social comparison with peers
                      who "went to the city", marriage pressure, career uncertainty
      Tone adjustment: Higher Hindi ratio, more warmth, slower pace
    

**Frame selection logic:** - Seeded at onboarding from: occupation, city, region fields - Updated by semantic extraction: if working professional language patterns detected for 3+ sessions, re-evaluate frame - Stored in `user_semantic_profiles.cultural_frame_id` - One frame per user at a time (not a blend — cleaner prompting)

* * *

TASK 1: FULL INPUT-OUTPUT FIELD AUDIT
=====================================

The Core Problem I Found In v2
------------------------------

**Every field must have exactly one producer and at least one consumer. No orphaned fields. No fields consumed without a producer. This audit fixes all such issues.**

* * *

Layer-by-Layer Field Audit
--------------------------

### LAYER 1: User Input Ingestion

**Inputs (producers = frontend/client):**

    raw_message: str            → produced by: React frontend, WebSocket send
    user_id: str                → produced by: Supabase auth JWT, decoded in FastAPI middleware  
    session_id: str             → produced by: Frontend sends active session_id OR "new"
    timestamp: ISO str          → produced by: Server-side assignment (never trust client timestamp)
    device_locale: str          → produced by: Browser navigator.language header
    

**Processing (what this layer does):**

    1. Unicode NFC normalisation on raw_message
    2. PII detection + redaction: phone numbers (\d{10}), emails, Aadhaar patterns (\d{4}\s\d{4}\s\d{4})
       → pii_detected: bool (consumed by: audit_log)
       → pii_redacted_message: str (replaces raw_message for all downstream processing)
    3. Language hint detection: script analysis → "hi" | "en" | "hinglish" | "other_indic"
       → language_hint: str (consumed by: Signal Extraction, Prompt Builder)
    4. Session resolution:
       → If session_id == "new" OR no active_session in Redis → create new session
       → If session_id exists in Redis AND not expired → resume session
       → resolved_session_id: str (consumed by: all subsequent layers)
    5. Session TTL reset in Redis (25 min)
    

**Outputs (all consumed downstream):**

    normalised_message: str     → consumed by: Signal Extraction (primary input)
    language_hint: str          → consumed by: Signal Extraction, Prompt Builder (cultural frame confirm)
    session_id: str             → consumed by: all layers (session key)
    user_id: str                → consumed by: all layers (data retrieval key)
    pii_detected: bool          → consumed by: audit_log write at delivery layer
    server_timestamp: ISO str   → consumed by: session turn object, audit log
    is_new_session: bool        → consumed by: State Orchestrator (different startup logic)
    

**Bug fixed:** `pii_detected` was produced but never written to audit log in v2. Now explicitly consumed.

* * *

### LAYER 2: Signal Extraction

**What runs here:** Groq Llama 3.1 8B with structured JSON output schema enforcement.

**Inputs:**

    normalised_message: str           → from Layer 1
    language_hint: str                → from Layer 1
    affect_history: list[dict]        → from Redis session object
      → specifically: last 5 turns' {valence, arousal, urgency}
      → WHY: rolling window for urgency cascade, not just current message
    recent_turns: list[str]           → from Redis session object, last 6 turns (user messages only)
      → WHY: sarcasm detection ("haan sab theek hai" after 5 distress turns)
    user_baseline_affect: dict        → from user_semantic_profiles.language_baseline
      → {code_mix_mean, formality_mean} used to detect deviation from baseline
    longitudinal_risk_flag: bool      → from user_longitudinal_trajectory (loaded at session start)
      → WHY: if True, urgency threshold is lowered by 0.15 equivalent
    

**Groq call — single structured output:**

    {
      "affect_vector": {
        "valence": float,      // -1.0 to 1.0 (negative=bad, positive=good)
        "arousal": float,      // 0.0 to 1.0 (calm to agitated)
        "dominance": float     // 0.0 to 1.0 (helpless to in-control)
      },
      "urgency_score": int,    // 0, 1, 2, 3
      "language_register": str, // "formal" | "semi_formal" | "casual" | "slang"
      "code_mix_ratio": float, // 0.0 to 1.0 (0=pure English, 1=pure Hindi)
      "sarcasm_detected": bool,
      "implicit_distress_signals": list[str], // e.g. ["farewell_pattern", "hopelessness_indirect"]
      "topic_keywords": list[str]  // 2-4 keywords for episodic retrieval
    }
    

**Urgency score adjustment logic (applied AFTER Groq returns, in Python):**

    # Not left to LLM — deterministic post-processing:
    if longitudinal_risk_flag and urgency_score >= 1:
        urgency_score = min(3, urgency_score + 1)  # escalate one tier if on downward trajectory
    
    # Passive monitor contribution (also computed here, not separate layer):
    passive_signals = check_passive_signals(recent_turns, affect_history)
    # passive_signals: {hopelessness_count, farewell_detected, sudden_shutdown, topic_drop}
    if passive_signals["farewell_detected"] and urgency_score < 2:
        urgency_score = max(urgency_score, 2)
    if passive_signals["hopelessness_count"] >= 3:
        urgency_score = max(urgency_score, 2)
    
    # Update rolling urgency history in session object
    session["urgency_history"].append(urgency_score)
    if len(session["urgency_history"]) > 10:
        session["urgency_history"].pop(0)
    

**Outputs (all consumed):**

    affect_vector: dict          → consumed by: State Orchestrator (mode decision)
                                                Memory Retrieval (affect-channel of dual retrieval)
                                                Delivery layer (appended to session affect_history)
                                                Session object write (affect_history update)
    urgency_score: int           → consumed by: Crisis Bypass check (immediately after this layer)
                                                State Orchestrator (mode + memory gate)
                                                Audit log
    language_register: str       → consumed by: Prompt Builder (tone template)
    code_mix_ratio: float        → consumed by: Prompt Builder (tone template)
                                                Procedural profile EMA update (session end)
    sarcasm_detected: bool       → consumed by: State Orchestrator (adjusts affect_vector interpretation)
                                                If True: reduce confidence of affect_vector by 0.3
    implicit_distress_signals: list → consumed by: Passive monitor logic (above), audit log
    topic_keywords: list[str]    → consumed by: Memory Retrieval (topic-channel of dual retrieval)
    updated_urgency_history: list → consumed by: State Orchestrator (trend detection)
    

**Bug fixed in v2:** `sarcasm_detected` was produced but had no consumer. Now: if sarcasm\_detected=True, the State Orchestrator reduces urgency by 1 (floor 0) and uses affect\_vector with 30% reduced confidence weight. This prevents over-escalation on "haha everything is fine" sarcasm being missed.

**Bug fixed in v2:** `topic_keywords` was produced by Groq for retrieval but never written to the session object. Now: also written to `session["current_topic_keywords"]` for use by State Orchestrator in mode-switch reasoning.

* * *

### LAYER 2B: CRISIS BYPASS CHECK (Between Signal and Orchestrator)

This is a synchronous check that runs immediately after Signal Extraction returns. It is NOT part of the Orchestrator — it runs before the Orchestrator.

    async def crisis_bypass_check(urgency_score: int, user_id: str, session_id: str,
                                   code_mix_ratio: float) -> Optional[CrisisResponse]:
        if urgency_score != 3:
            return None  # proceed to orchestrator
    
        # Select language variant
        variant = select_crisis_template_variant(code_mix_ratio)
        # 0.0-0.2 → "en", 0.2-0.5 → "hinglish_formal", 0.5-0.8 → "hinglish_casual", 0.8-1.0 → "hi"
    
        # Fetch from Supabase (this is a simple SELECT, < 5ms)
        template = await supabase.table("crisis_templates")
            .select("content")
            .eq("language_variant", variant)
            .eq("active", True)
            .single()
    
        # Write audit log (async, non-blocking)
        asyncio.create_task(write_audit_log(
            session_id=session_id,
            user_id=user_id,
            event_type="tier3_trigger",
            urgency_score=3,
            mode="crisis_bypass",
            memory_used=False,
            tokens_used=0,
            llm_used="none",
            safety_flags={"tier3": True}
        ))
    
        # Return immediately — skip ALL remaining layers
        return CrisisResponse(
            content=template["content"],
            crisis_numbers=["iCall: 9152987821", "Vandrevala: 1860-2662-345"],
            bypassed_llm=True
        )
    

**If crisis\_bypass\_check returns a response:** It is sent directly to the delivery layer. State Orchestrator, Memory Retrieval, Prompt Builder, LLM Core, Output Safety Gate — ALL skipped. Session peak\_urgency updated to 3.

**Critical implementation note:** The middleware check happens at the FastAPI route handler entry, reading `session["urgency_history"][-1]` from Redis. If the last stored urgency was 3 (from a previous turn where the user continued talking), the bypass fires before Signal Extraction even runs.

* * *

### LAYER 3: STATE ORCHESTRATOR

**This is where the "recent 6–10 messages" question is answered.**

**Why the Orchestrator needs recent messages directly:**

Signal Extraction gives us the current affect vector and urgency score. But the Orchestrator makes mode decisions based on _conversational trajectory_ — is the user warming up or shutting down? Is the mode shift justified or is it a one-off? A user who says "lol whatever" might have: - Low urgency (sarcasm\_detected=True) → stay in Companion mode - A previous 5 turns of progressive withdrawal → the "lol whatever" is a shutdown signal → switch to Active Listener

The Orchestrator cannot make this call from the affect\_vector alone. It needs the recent turn text.

**Inputs:**

    affect_vector: dict                → from Signal Extraction
    urgency_score: int                 → from Signal Extraction (already passive-monitor-adjusted)
    urgency_history: list[int]         → from session object (last 10 urgency scores)
    sarcasm_detected: bool             → from Signal Extraction
    affect_history: list[dict]         → from session object (all turns this session)
    recent_turns: list[dict]           → from session object
      → EXACTLY: last 8 turns [{role, content, timestamp}]
      → WHY 8: enough to see a conversational arc (3-4 user turns + 3-4 agent turns)
      → NOT the full transcript — that goes to Prompt Builder only
    current_mode: str                  → from session object
    mode_history: list[dict]           → from session object [{mode, turn_number, reason}]
    turn_count: int                    → from session object
    semantic_profile: dict             → from Supabase (loaded at session start, cached)
    procedural_profile: dict           → from Redis (loaded at session start)
    dependency_risk_counter: int       → from procedural_profile
    longitudinal_risk_flag: bool       → from session object (loaded at session start)
    is_new_session: bool               → from Layer 1
    topic_keywords: list[str]          → from Signal Extraction (current topics)
    

**Orchestrator decisions (in order):**

**Decision 1: Mode selection**

    Mode options: "companion" | "active_listener" | "recovery_check" | "referral_bridge"
                  "psychoeducation" | "skill_coach"  ← Phase 2 only, not in MVP
    
    Mode transition rules:
    1. Mode CANNOT change if turn_count < 2 (minimum 2 turns before first switch)
    2. Once in active_listener: minimum 3-turn hold before switching back
    3. Mode transitions require BOTH current affect AND trajectory confirmation:
       - Switch TO active_listener: urgency >= 1 for current turn AND (urgency_history[-3:] has ≥ 1 score >= 1)
       - Switch FROM active_listener: urgency == 0 for 3 consecutive turns AND sarcasm_detected=False
    4. recovery_check mode: triggered when is_new_session=True AND previous session peak_urgency >= 2
       (previous session data available in semantic_profile: last_session_peak_urgency)
    5. referral_bridge: triggered when urgency >= 2 sustained for 4+ consecutive turns
    
    Mode selection output: selected_mode (str), mode_change_reason (str for audit)
    

**Decision 2: Memory gate**

    memory_gate: bool (open=True, closed=False)
    open if ALL of:
      - selected_mode in ["companion", "active_listener", "recovery_check"]
      - turn_count >= 2  (not the very first turn of a session)
      - NOT (urgency_score == 3)  (crisis always closed)
      - episodic memories exist for this user (semantic_profile.total_sessions >= 2)
    
    memory_gate_strength: "full" | "light"
      full: retrieve up to 2 episodic memories
      light: retrieve at most 1, only if score > 0.78
      → light when: urgency_score == 2 (user is distressed, memory surfacing can feel intrusive)
    

**Decision 3: Tone parameters**

    tone_params: dict  (8 dimensions, all float 0.0-1.0)
      → Start from procedural_profile.style_vector (learned baseline)
      → Adjust for current affect:
        if urgency >= 1: warmth += 0.15 (floor 1.0), sentence_length -= 0.2, directness -= 0.1
        if sarcasm_detected: humour_tolerance += 0.1 (user uses humour as coping)
        if code_mix_ratio > 0.6: enforce code_mix in tone_params to match (±0.1 band)
      → Adjust for mode:
        active_listener: directness = min(0.3, directness), humour_tolerance = 0.0
        recovery_check: warmth = max(0.8, warmth)
      → Output tone_params: dict consumed by Prompt Builder
    

**Decision 4: Cultural frame confirmation**

    cultural_frame_id: str → from semantic_profile (already selected at onboarding)
      → Orchestrator does NOT re-select frame every turn
      → Only flag if: language_register shifts dramatically from baseline for 3+ turns
      → If flag: add frame_uncertainty=True to orchestrator output
      → frame_uncertainty consumed by Prompt Builder: adds softer cultural framing
    

**Decision 5: Max response length**

    max_response_tokens: int
      companion mode, urgency 0: 150 tokens
      companion mode, urgency 1: 100 tokens (shorter = more present)
      active_listener mode: 80 tokens (very short, pure reflection)
      recovery_check mode: 120 tokens
      referral_bridge mode: 180 tokens (warm, needs more room)
    

**Decision 6: Anti-dependency routing**

    dependency_flag: bool
      True if: dependency_risk_counter >= 7 AND procedural_profile.social_mentions_count < 3
      → consumed by Prompt Builder: adds social normalisation micro-instruction to mode instruction block
      → NOT visible to user as any change in UX
    

**Outputs (all consumed):**

    selected_mode: str               → Prompt Builder (mode instruction block)
                                       Session object write (mode_history update)
                                       Audit log
    mode_change_reason: str          → Session object write, audit log
    memory_gate: bool                → Memory Retrieval layer
    memory_gate_strength: str        → Memory Retrieval layer
    tone_params: dict                → Prompt Builder (tone template block)
    cultural_frame_id: str           → Prompt Builder (cultural frame block)
    frame_uncertainty: bool          → Prompt Builder
    max_response_tokens: int         → LLM Core (generation parameter)
    dependency_flag: bool            → Prompt Builder (mode instruction modifier)
    affect_for_retrieval: dict       → Memory Retrieval (current affect for affect-channel)
    topic_keywords_for_retrieval: list → Memory Retrieval (for topic-channel)
    

**Bug fixed:** In v2, the Orchestrator received affect\_vector but the Memory Retrieval layer had to re-derive the affect for its dual-channel retrieval. Now Orchestrator explicitly passes `affect_for_retrieval` and `topic_keywords_for_retrieval` as named outputs consumed by Memory Retrieval.

* * *

### LAYER 4: MEMORY RETRIEVAL

**Runs in parallel with State Orchestrator? YES — see Task 3 for concurrency design.**

Actually: Memory Retrieval starts with a dependency on Orchestrator's `memory_gate` and `affect_for_retrieval`. BUT we can pre-fetch the user's embedding cache and warm the Qdrant connection while Orchestrator runs. The actual retrieval query fires as soon as Orchestrator returns.

**Inputs:**

    user_id: str                     → from session object
    memory_gate: bool                → from Orchestrator (if False, skip entirely)
    memory_gate_strength: str        → from Orchestrator ("full" or "light")
    current_message_embedding: float[384]  → computed in Layer 1 (pre-computed, cached)
    topic_keywords: list[str]        → from Orchestrator (passed through from Signal Extraction)
    affect_for_retrieval: dict       → from Orchestrator {valence, arousal}
    semantic_profile: dict           → from Supabase (session-start cache)
    procedural_profile: dict         → from Redis (session-start cache)
    

**Dual-channel retrieval:**

    CHANNEL 1 — Topic similarity:
      query_vector = embed(normalised_message)  // already computed, cache hit
      qdrant.search(
        collection="episodic_memories",
        query_vector=query_vector,
        query_filter={"user_id": user_id},
        limit=5,
        with_payload=True
      )
      → Returns: list of (memory, topic_score) pairs
    
    CHANNEL 2 — Affect distance:
      For each returned memory from Channel 1:
        affect_distance = euclidean(
          [affect_for_retrieval.valence, affect_for_retrieval.arousal],
          [memory.payload.affect_mean.valence, memory.payload.affect_mean.arousal]
        )
        affect_similarity = 1.0 - min(affect_distance / 2.0, 1.0)  // normalise to 0-1
    
    COMBINED SCORE:
      harmonic_score = 2 * (topic_score * affect_similarity) / (topic_score + affect_similarity + 0.001)
    
      Threshold:
        memory_gate_strength == "full": retrieve top 2 where harmonic_score > 0.62
        memory_gate_strength == "light": retrieve top 1 where harmonic_score > 0.75
    
    SEMANTIC PROFILE injection (always, no gate):
      relevant_facts = extract_relevant_semantic_facts(semantic_profile, topic_keywords)
      // Extract: name, recurring themes matching current topics, relationship_map entries matching named entities
      // Limit: 80 tokens worth of facts
      // NOT the full profile — only what's relevant to this turn
    

**Outputs:**

    episodic_memories: list[dict]    → Prompt Builder (memory injection block)
      each: {summary_text, relative_date, ending_affect, named_entities}
      → relative_date: not ISO — "3 days ago", "last week", "a few weeks ago"
    semantic_facts_injection: str    → Prompt Builder (80-100 token string)
      → Natural language: "They've mentioned their friend Priya before. They study engineering."
    retrieval_scores: dict           → Audit log (for threshold calibration)
      {episodic_count: int, top_score: float, affect_similarity: float}
    memory_retrieved: bool           → Prompt Builder, Audit log
    

**Bug fixed:** In v2, retrieval\_scores were computed but never written anywhere. Now explicitly consumed by audit\_log for monthly threshold calibration review.

* * *

### LAYER 5: DYNAMIC PROMPT CONSTRUCTION

**Inputs (7 blocks, all explicitly tracked):**

    Block 1 — System identity (~600 tokens, static):
      source: config file (not DB, not dynamic)
      consumed_by: LLM Core only
      changes: only on version bump, requires manual deploy
    
    Block 2 — Tone template (~150 tokens):
      source: tone_params from Orchestrator
      format: "Write in this style: [code_mix_ratio*100]% Hindi-English mix. 
               Sentence length: [short|medium|long]. Warmth: [low|medium|high].
               [if urgency>=1: Never offer solutions unless explicitly asked. ]
               [if humour_tolerance > 0.5: Light humour acceptable if user initiates. ]"
      consumed_by: LLM Core
    
    Block 3 — Memory injection (~200 tokens max):
      source: episodic_memories + semantic_facts_injection from Memory Retrieval
      format: Natural language paragraph
      example: "A few days ago, you spoke about exam pressure and feeling like 
                 you're letting your parents down. You seemed a little more grounded 
                 by the end. Your friend Priya has come up before."
      IF no memories: block is empty (0 tokens)
      consumed_by: LLM Core
    
    Block 4 — Cultural frame (~180 tokens):
      source: cultural_frame_id from Orchestrator
      → one of 5 static text blocks (not LLM-generated)
      → if frame_uncertainty=True: softer framing, drop culture-specific assumptions
      consumed_by: LLM Core
    
    Block 5 — Mode instruction (~200 tokens):
      source: selected_mode from Orchestrator
      format: explicit DO and DO NOT instructions
      example (active_listener): "Your only job right now is to make this person feel heard.
        DO: Reflect what they've said. Ask one open question.
        DO NOT: Offer advice. Suggest resources yet. Use clinical language. Reframe their experience.
        [if dependency_flag: Naturally reference that connection with others matters, if it fits.]"
      consumed_by: LLM Core
    
    Block 6 — Anti-sycophancy frame (~80 tokens, always present):
      source: static text (never dynamic)
      content: "Do not validate cognitive distortions or catastrophising. You can validate 
                the emotion without affirming the distorted belief. If they say 'nothing will 
                ever get better', reflect the pain without agreeing."
      consumed_by: LLM Core
    
    Block 7 — Working memory (conversation history, variable tokens):
      source: session.turns from Redis
      format: full turns array formatted as chat history
      truncation strategy:
        ALWAYS include: first 2 turns (scene-setting)
        ALWAYS include: last 8 turns (recency)
        TRUNCATE: middle turns if total > 6000 tokens
        → middle turn compression: summarise to 1-line per turn using Python (no LLM call)
        → "Turn N: User talked about [first 5 words...]. Agent responded warmly."
      consumed_by: LLM Core
    

**Token budget enforcement (Python, before LLM call):**

    MAX_TOTAL_TOKENS = 8000  # hard ceiling for Azure cost control
    estimated = count_tokens(all_blocks)
    if estimated > MAX_TOTAL_TOKENS:
        # Trim Block 7 (working memory) first
        compress_middle_turns(session.turns)
        # Then trim Block 3 (memory injection) to 1 summary only
        # Then trim Block 4 (cultural frame) to 100 tokens
        # Never trim Block 1 (system identity) or Block 6 (anti-sycophancy)
        # Never trim Block 5 (mode instruction) below 100 tokens
    

**Outputs:**

    full_prompt: str                 → LLM Core (primary input)
    prompt_token_count: int          → LLM Core (cost tracking), Audit log
    prompt_version_hash: str         → Audit log (MD5 of Block 1, for version tracking)
    blocks_used: dict                → Audit log {block_id: token_count for each block}
    

**Bug fixed:** `blocks_used` was not tracked in v2. Now written to audit log — essential for understanding which blocks are consuming budget in production.

* * *

### LAYER 6: LLM INFERENCE CORE

**Inputs:**

    full_prompt: str                 → from Prompt Builder
    max_response_tokens: int         → from Orchestrator
    temperature: float               → derived from selected_mode:
      companion: 0.82
      active_listener: 0.65
      recovery_check: 0.72
      referral_bridge: 0.60
      psychoeducation: 0.50 (Phase 2)
      skill_coach: 0.50 (Phase 2)
    llm_routing_decision: str        → from fallback routing logic (urgency-based)
    stream: bool = True              → always streaming for perceived responsiveness
    

**Azure OpenAI call:**

    model: "gpt-4o"
    messages: [constructed from full_prompt as system + user format]
    max_tokens: max_response_tokens
    temperature: temperature
    stream: True
    stop: ["\n\n\n"]  // prevent run-on responses
    

**Streaming implementation:**

    Tokens stream via WebSocket to frontend as they arrive.
    The Output Safety Gate runs AFTER full response received (not mid-stream).
    Frontend shows typing indicator until first token, then streams text.
    If safety gate fails: frontend receives a "replace" event with the corrected/fallback response.
    

**Outputs:**

    raw_response: str                → Output Safety Gate (primary input)
    tokens_used: dict                → {prompt_tokens, completion_tokens, total}
      → consumed by: Session object (llm_tokens_used update), Audit log, Cost tracking
    finish_reason: str               → "stop" | "length" | "content_filter"
      → consumed by: Output Safety Gate (if "content_filter": immediate fallback)
    llm_used: str                    → "azure_gpt4o" | "groq_llama70b" | "glm4flash"
      → consumed by: Audit log, Session object (llm_primary_used)
    latency_ms: int                  → consumed by: Monitoring (Posthog event)
    

**Bug fixed:** `finish_reason="content_filter"` from Azure was unhandled in v2. Now: if finish\_reason is content\_filter, skip Output Safety Gate and go directly to static fallback template for the current mode. Log as audit event\_type="azure\_content\_filter".

* * *

### LAYER 7: OUTPUT SAFETY GATE

**All 5 checks run sequentially (not parallel — each check informs the next).**

**Inputs:**

    raw_response: str                → from LLM Core
    selected_mode: str               → from Orchestrator
    urgency_score: int               → from Signal Extraction
    finish_reason: str               → from LLM Core
    tone_params: dict                → from Orchestrator (for conformance check)
    max_response_tokens: int         → from Orchestrator (for length check)
    knowledge_base_context: str      → from Phase 2 KB RAG (None in MVP)
    

**Check 1 — Harm classifier:**

    Tool: Groq Llama 3.1 8B structured output (same model as signal extraction, reuse connection)
    Prompt: Classify this response for: self-harm facilitation, diagnostic language,
            advice contradicting safe messaging, reproduction of private information.
    Output: {harm: bool, harm_category: str|None}
    
    If harm=True:
      → Discard raw_response
      → Regenerate with lower temperature (temp - 0.15) and explicit "do not" instruction
      → Max 2 retries
      → After 2 retries: use static_fallback_templates for current mode
      → Log: audit_logs with event_type="harm_flag"
    

**Check 2 — Sycophancy classifier:**

    Tool: Groq Llama 3.1 8B (same call as Check 1 — batch both checks in one Groq call)
    Prompt addition: Also classify: does this response validate a cognitive distortion,
                     amplify catastrophising, or agree that a situation is hopeless?
    Output addition: {sycophancy: bool, sycophancy_type: str|None}
    
    If sycophancy=True:
      → Do NOT discard — regenerate with explicit anti-sycophancy instruction prepended
      → "The previous response over-validated. Rewrite to reflect the emotion without affirming the distortion."
      → 1 retry only
      → Log: audit_logs event_type="sycophancy_flag"
    
    IMPLEMENTATION NOTE: Checks 1 and 2 are ONE Groq call with combined output schema.
    This saves ~150ms vs two separate calls.
    Combined output:
    {
      "harm": bool,
      "harm_category": str | null,
      "sycophancy": bool,
      "sycophancy_type": str | null
    }
    

**Check 3 — Semantic hallucination check (MVP: only when knowledge\_base used = Phase 2):**

    In MVP: this check is SKIPPED (no psychoeducation mode)
    In Phase 2:
      embed(any_factual_claim_in_response)
      cosine_similarity(claim_embedding, nearest_KB_embedding)
      if similarity < 0.60: flag as hallucination, regenerate with "stay in KB" instruction
    

**Check 4 — Tone conformance:**

    Tool: Python rule-based (no LLM call)
    Checks:
      1. Code-mix ratio: count Hindi tokens / total tokens
         if abs(actual - tone_params.code_mix) > 0.25: flag
      2. Sentence length: avg words per sentence
         if outside target range by > 40%: flag
      3. If active_listener mode: check no question count > 1
         (Active Listener asks at most one question per turn)
      4. If active_listener mode: check no solution language
         keywords: "try", "you should", "have you considered", "maybe you could"
    
    Conformance_score: float 0.0-1.0
    If conformance_score < 0.65:
      → Add tone correction instruction, regenerate
      → 1 retry only
      → Log conformance_score to audit
    

**Check 5 — Length check:**

    Tool: Python (len(response.split()) or token count)
    If response > max_response_tokens * 1.2:
      → Truncate at last sentence boundary (not mid-sentence)
      → No regeneration needed — truncation is sufficient
    If response < 10 tokens:
      → Likely error — use static fallback
    

**Outputs:**

    approved_response: str           → Delivery layer (primary consumer)
    safety_check_result: dict        → Audit log
      {harm: bool, sycophancy: bool, conformance_score: float, length_ok: bool,
       retries_used: int, final_source: "llm"|"fallback_template"}
    response_source: str             → "llm_primary" | "llm_retry" | "static_fallback"
      → consumed by: Session turn write (important: tag which turns were fallbacks)
    

**Bug fixed:** In v2, `response_source` was not tracked. Now: every session turn stored in Redis tags whether it was from LLM or static fallback. This is critical for quality analysis — you need to know what % of turns are falling back.

* * *

### LAYER 8: RESPONSE DELIVERY + SESSION WRITE + ASYNC MEMORY WRITE-BACK

**This layer has two parts: synchronous (response delivery) and async (memory writes).**

**SYNC — Response delivery:**

    Inputs:
      approved_response: str         → from Output Safety Gate
      response_source: str           → from Output Safety Gate
      session_id: str                → from Layer 1
      user_id: str                   → from Layer 1
    
    Actions:
      1. Send via WebSocket to frontend (streaming already delivered, this confirms completion)
      2. Append to session.turns in Redis:
         {role: "assistant", content: approved_response, timestamp: ISO,
          source: response_source, safety_flags: safety_check_result}
      3. Update session metadata in Redis:
         {last_activity: now, turn_count: +1, llm_tokens_used: +tokens_used}
      4. Write single audit log entry (async task, non-blocking):
         All fields from audit schema above
    

**ASYNC — Session-end memory write-back (triggered when session ends):**

Session end triggers: 25-min Redis TTL expiry (via Redis keyspace notifications) OR explicit close event.

    async def session_end_pipeline(session_id: str, user_id: str):
        # Load full session object before Redis purges it
        session = await redis.get(f"session:{user_id}:{session_id}")
    
        # These 5 tasks run CONCURRENTLY (asyncio.gather):
        await asyncio.gather(
            write_session_record(session),        # Task A
            generate_episodic_memory(session),    # Task B
            extract_semantic_facts(session),      # Task C
            update_procedural_profile(session),   # Task D
            update_longitudinal_trajectory(session)  # Task E
        )
    
        # After all complete: update total_sessions counter
        await supabase.rpc("increment_session_count", {"user_id": user_id})
    

**Task A — Write session record:**

    INSERT into sessions table: id, user_id, started_at, ended_at, turn_count,
    peak_urgency, mode_sequence, final_affect, episodic_memory_written=False, tokens_used
    

**Task B — Generate episodic memory (Gemini free API):**

    Input: full session transcript + affect_history
    Gemini prompt: "Summarise this conversation in 80-120 words from the perspective of a
                   supportive friend who wants to remember: emotional arc, what was weighing
                   on them, any names mentioned, how it ended, techniques or topics discussed."
    Output: summary_text (str)
    
    Embed summary_text with local MiniLM
    Qdrant upsert: new point with all payload fields
    
    After upsert: UPDATE sessions SET episodic_memory_written=True
    
    Fallback (Gemini down): Groq Llama 3.1 8B same prompt
    

**Task C — Extract semantic facts (Groq structured output):**

    Input: full session transcript
    Groq prompt (structured JSON schema):
    {
      "new_names_mentioned": list[{name, relation, context}],
      "new_themes_detected": list[{theme, strength: 0-1}],
      "updated_comfort_topics": list[str],
      "user_corrected_anything": bool,  // user corrected agent's assumption
      "occupation_detail_revealed": str|null,
      "city_revealed": str|null
    }
    
    Then: Supabase upsert to user_semantic_profiles
      - APPEND new names to relationship_map (don't overwrite existing)
      - MERGE new themes into recurring_themes (weighted average with existing)
      - ADD new comfort/discomfort topics
      - If user_corrected_anything=True: flag for human review (rare but important)
    

**Task D — Update procedural profile (EMA, Python — no LLM call):**

    Compute session_style from session data:
      code_mix_ratio: average over all turns this session
      formality: derived from language_register history this session
      sentence_length: average response engagement length (do users respond longer to longer agent messages?)
      warmth: fixed from tone_params used
    
    EMA update: new_value = 0.3 * session_value + 0.7 * stored_value
    Cap: no dimension changes > 0.12
    
    Clinical floor enforcement:
      warmth >= 0.45 (hard)
      harm_validation = 0.0 always (not a style vector dimension — hardcoded in system prompt)
    
    Dependency risk update:
      if session had 0 social mentions: dependency_risk_counter += 1
      if session had >= 2 social mentions: dependency_risk_counter = max(0, counter - 1)
      sessions_this_week: increment (reset to 0 on Monday 00:00 IST)
    
    Supabase upsert: user_procedural_profiles
    Redis invalidate and re-cache: procedural:{user_id}
    

**Task E — Update longitudinal trajectory (Python — no LLM call):**

    Compute session affect mean:
      valence_mean = mean([t.valence for t in session.affect_history])
      arousal_mean = mean([t.arousal for t in session.affect_history])
    
    Supabase transaction:
      1. Load current affect_series array
      2. Append {date: today, valence_mean, arousal_mean, peak_urgency}
      3. If len > 30: drop oldest entry
      4. Run slope detection:
         if len >= 7:
           last_7_valence = [e.valence_mean for e in affect_series[-7:]]
           slope = linear_regression_slope(last_7_valence)
           longitudinal_risk_flag = (slope < -0.022)  // 0.15 drop over 7 sessions
         else:
           longitudinal_risk_flag = False (not enough data)
      5. UPDATE user_longitudinal_trajectory:
         {affect_series, longitudinal_risk_flag, last_slope: slope, last_computed_at: now}
      6. Also UPDATE users table or cache: longitudinal_risk_flag (for fast session-start access)
    

**PHQ-2 naturalised check (every 3rd session, part of Task B trigger):**

    if session.session_number % 3 == 0:
      The PHQ-2 equivalent is NOT a background task — it is built into the session's
      closing exchange as a natural conversation turn. The mode instruction block for the
      final 2 turns of a 3rd session includes: "As the conversation naturally winds down,
      gently ask how they've been sleeping and their general mood over the past week."
      The agent's response is not a form — it is conversational.
    
      The SCORING of user responses happens in Task C (semantic fact extraction):
      Groq extracts: {phq2_sleep_score: 0-3, phq2_mood_score: 0-3} from user's natural language
      response. These are written to user_longitudinal_trajectory.phq2_scores.
    

* * *

TASK 2: LLM CALL AUDIT — EVERY CALL, EVERY OUTPUT FIELD JUSTIFIED
=================================================================

Complete LLM Call Inventory
---------------------------

Call

Tool

When

Input

Output Fields

All fields consumed?

Signal extraction

Groq 3.1 8B

Every turn

Last 8 turns + current message

affect\_vector, urgency\_score, language\_register, code\_mix\_ratio, sarcasm\_detected, implicit\_distress\_signals, topic\_keywords

✅ All consumed

Combined safety check

Groq 3.1 8B

Every turn (post-gen)

Raw response

harm, harm\_category, sycophancy, sycophancy\_type

✅ All consumed

Main response generation

Azure GPT-4o

Every turn

Full prompt

raw\_response, tokens\_used, finish\_reason

✅ All consumed

Session summarisation

Gemini free

Session end (async)

Full transcript

summary\_text

✅ → Qdrant

Semantic fact extraction

Groq 3.1 8B

Session end (async)

Full transcript

new\_names, themes, comfort\_topics, etc.

✅ → Supabase

Fields That Were Orphaned in v2 (Now Fixed)
-------------------------------------------

Field

Was produced by

Was consumed by (v2)

Now consumed by (v3)

sarcasm\_detected

Signal Extraction

Nothing

Orchestrator mode decision, urgency adjustment

implicit\_distress\_signals

Signal Extraction

Nothing

Passive monitor logic in Signal layer, audit log

retrieval\_scores

Memory Retrieval

Nothing

Audit log for monthly threshold calibration

pii\_detected

Layer 1

Nothing

Audit log

response\_source

Output Safety Gate

Nothing

Session turn write, quality analysis

blocks\_used

Prompt Builder

Nothing

Audit log for token budget analysis

finish\_reason

LLM Core

Nothing

Safety gate (content\_filter handling)

conformance\_score

Safety Gate Check 4

Nothing

Audit log

llm\_used

LLM Core

Nothing

Audit log, session record

topic\_keywords

Signal Extraction

Only retrieval

Also: session object, Orchestrator mode reasoning

mode\_change\_reason

Orchestrator

Nothing

Session object, audit log

dependency\_flag

Orchestrator

Nothing

Prompt Builder Block 5 modifier

frame\_uncertainty

Orchestrator

Nothing

Prompt Builder Block 4 modifier

* * *

MHA Implementation Spec — Part 2
================================

Task 3: Concurrency & Parallelism Design
========================================

Task 4: Session Startup Flow
============================

Task 5: Per-Turn Pipeline (Full Async Design)
=============================================

* * *

TASK 3: CONCURRENCY & PARALLELISM — FULL DESIGN
===============================================

Research Basis
--------------

For LLM applications at scale, the critical insight (validated across production systems at Notion, Intercom, Character.AI) is:

1.  **I/O-bound operations dominate latency.** LLM API calls, DB reads, Redis reads — all are I/O-bound. Python asyncio is optimal. No threading needed for correctness; use it only for CPU-bound embedding computation.
    
2.  **The critical path is: user message → response streaming begins.** Every millisecond saved on the critical path is directly perceived by the user. Background operations (memory writes, fact extraction) are never on the critical path.
    
3.  **Pre-loading at session start eliminates per-turn DB reads.** Loading semantic + procedural profiles once at session open and caching in Redis means the per-turn pipeline touches Redis only (fast), not Supabase (slower).
    
4.  **Grouping Groq calls.** Signal Extraction and Safety Check both use Groq. These are NOT concurrent within a turn (Safety Check needs the LLM response first). But they use the same Groq client, same model — so the connection pool is shared and both benefit from warm connections.
    

* * *

Session Start: What Loads in Parallel
-------------------------------------

When a user sends the first message of a new session (or resumes):

    async def session_startup(user_id: str) -> SessionContext:
        # These 4 loads run fully in parallel:
        semantic_profile, procedural_profile, longitudinal_data, previous_session_data = \
            await asyncio.gather(
                load_semantic_profile(user_id),      # Supabase SELECT
                load_procedural_profile(user_id),    # Redis GET (or Supabase if cache miss)
                load_longitudinal_flag(user_id),     # Supabase SELECT (single field)
                load_previous_session_summary(user_id)  # Qdrant: most recent episodic memory
            )
    
        # Build session object in Redis
        session = build_session_object(
            user_id=user_id,
            semantic_profile=semantic_profile,
            procedural_profile=procedural_profile,
            longitudinal_risk_flag=longitudinal_data.risk_flag,
            is_new_session=True
        )
    
        await redis.setex(f"session:{user_id}:{session.id}", 1500, session.to_json())
        await redis.setex(f"active_session:{user_id}", 1500, session.id)
    
        return SessionContext(session, semantic_profile, procedural_profile, longitudinal_data)
    

**Latency budget for session startup:** < 150ms total (all 4 loads in parallel).

**Previous session data loading:** If previous session peak\_urgency >= 2, the most recent episodic memory is pre-fetched so the Orchestrator can detect `recovery_check` mode without waiting for Memory Retrieval to run.

* * *

Per-Turn Pipeline: Critical Path vs Background
----------------------------------------------

### Full Per-Turn Timeline

    T=0ms:    User message arrives via WebSocket
    T=0ms:    Layer 1: Input ingestion (sync, <5ms, Python-only — no I/O)
    T=5ms:    [Crisis check from session urgency_history — Redis read, 1ms]
               If urgency_history[-1] == 3: bypass fires immediately, T=~10ms total
    T=5ms:    [PARALLEL BLOCK A starts] — 3 concurrent operations:
               A1: Signal Extraction (Groq API call, ~400-800ms)
               A2: Session data read from Redis (get full session object, ~2ms)
               A3: Embedding computation for current message (local MiniLM, ~15ms CPU)
    
    T=20ms:   A2 + A3 complete. Session object available. Embedding ready.
    T=20ms:   [Pre-warm: open Qdrant connection while waiting for A1]
    
    T=~500ms: A1 complete (Signal Extraction returns).
    T=500ms:  Crisis bypass check 2 (urgency_score==3 from Groq?): 
               If yes → Supabase crisis template fetch → stream to user → done.
    
    T=500ms:  [PARALLEL BLOCK B starts] — 2 concurrent operations:
               B1: State Orchestrator (pure Python computation, ~5ms — NO I/O)
               B2: Memory pre-fetch begins (Qdrant warming, ~20ms connection)
               [B1 and B2 start together because B2 only needs user_id and embedding
                which are already available. B2 waits for memory_gate from B1
                before firing the actual Qdrant query.]
    
    T=505ms:  B1 (Orchestrator) completes. memory_gate + tone_params + mode ready.
    T=505ms:  [PARALLEL BLOCK C starts]:
               C1: Memory Retrieval fires (Qdrant query, ~50-100ms)
               C2: Prompt Builder starts (can build Blocks 1,2,4,5,6 while waiting for C1)
               [Blocks 1,2,4,5,6 don't need memory. Block 3 and 7 are inserted after C1 returns.]
    
    T=600ms:  C1 (Memory Retrieval) completes. Prompt Builder inserts Block 3.
    T=600ms:  Block 7 (working memory from session object) inserted.
    T=605ms:  Full prompt ready. Token budget enforced (Python, <2ms).
    
    T=605ms:  [LLM Core call starts — Azure GPT-4o, streaming]
    T=700ms:  First token arrives → frontend shows first character (TTFT ~700ms)
    T=1800ms: Full response received (estimated, 150 tokens at ~100 tokens/sec)
    
    T=1800ms: [PARALLEL BLOCK D starts — Output Safety Gate]:
               The safety gate runs AFTER full response, but BEFORE "confirmed complete" signal.
               Frontend shows the streamed text. Safety gate checks in background.
               If safety gate passes (~300ms for Groq check): send "confirmed" signal.
               If safety gate fails: send "replace" event with corrected/fallback response.
    
    T=2100ms: Safety gate complete. "confirmed" or "replace" sent to frontend.
    
    T=2100ms: [ASYNC BLOCK E — non-critical, fire-and-forget]:
               E1: Write turn to Redis session object
               E2: Write audit log to Supabase
               E3: Update session metadata in Redis
               [These run as asyncio.create_task — they don't block the next user message]
    

**Target perceived latency:** First character on screen in ~700ms. This is industry-standard for LLM chat applications.

* * *

Concurrency Implementation: FastAPI + asyncio
---------------------------------------------

### Main Route Handler Structure

    @app.websocket("/ws/chat/{user_id}")
    async def chat_websocket(websocket: WebSocket, user_id: str):
        await websocket.accept()
    
        # Authenticate user from JWT in first WebSocket message
        auth_result = await authenticate_ws(websocket, user_id)
        if not auth_result.valid:
            await websocket.close(code=4001)
            return
    
        # Load or create session (parallel loads)
        session_ctx = await session_startup(user_id)
    
        try:
            while True:
                # Receive message
                data = await websocket.receive_json()
                message = data["message"]
    
                # Process turn (critical path)
                response = await process_turn(
                    message=message,
                    user_id=user_id,
                    session_ctx=session_ctx,
                    websocket=websocket
                )
    
                # Non-critical writes (fire and forget)
                asyncio.create_task(post_turn_writes(response, session_ctx))
    
        except WebSocketDisconnect:
            asyncio.create_task(handle_session_end(session_ctx))
    

### Process Turn (Critical Path)

    async def process_turn(message: str, user_id: str, session_ctx: SessionContext,
                           websocket: WebSocket) -> TurnResult:
        # Layer 1: Input ingestion (sync, no await needed, <5ms)
        ingested = ingest_input(message, user_id, session_ctx.session_id)
    
        # Fast crisis check from history (Redis already loaded)
        if session_ctx.session.urgency_history and session_ctx.session.urgency_history[-1] == 3:
            crisis_resp = await crisis_bypass_check(3, user_id, session_ctx.session_id,
                                                     session_ctx.session.code_mix_ratio)
            await stream_response(websocket, crisis_resp.content)
            return TurnResult(response=crisis_resp.content, source="crisis_template",
                              urgency=3, mode="crisis_bypass")
    
        # PARALLEL BLOCK A: Signal extraction + embedding
        signal_task = asyncio.create_task(
            extract_signals(ingested.normalised_message, session_ctx)
        )
        embed_task = asyncio.create_task(
            get_or_compute_embedding(ingested.normalised_message)
        )
    
        # Wait for both (signal is the bottleneck)
        signals, current_embedding = await asyncio.gather(signal_task, embed_task)
    
        # Post-processing: passive monitor adjustments (sync, <1ms)
        signals = apply_passive_monitor(signals, session_ctx.session)
    
        # Crisis check on fresh urgency score
        if signals.urgency_score == 3:
            crisis_resp = await crisis_bypass_check(signals.urgency_score, user_id,
                                                    session_ctx.session_id,
                                                    signals.code_mix_ratio)
            await stream_response(websocket, crisis_resp.content)
            asyncio.create_task(write_audit_log_crisis(signals, session_ctx))
            return TurnResult(response=crisis_resp.content, source="crisis_template", urgency=3)
    
        # Orchestrator (pure Python, no I/O, instant)
        orch_result = run_orchestrator(signals, session_ctx)
    
        # PARALLEL BLOCK C: Memory retrieval + prompt pre-build
        if orch_result.memory_gate:
            memory_task = asyncio.create_task(
                retrieve_memories(user_id, current_embedding, signals.topic_keywords,
                                  signals.affect_vector, orch_result.memory_gate_strength)
            )
        else:
            memory_task = None
    
        # Build blocks 1,2,4,5,6 while memory retrieval runs
        partial_prompt = build_prompt_blocks_1_2_4_5_6(orch_result, signals, session_ctx)
    
        # Wait for memory if gate was open
        if memory_task:
            memory_result = await memory_task
        else:
            memory_result = MemoryResult.empty()
    
        # Complete prompt with blocks 3 and 7
        full_prompt = complete_prompt(partial_prompt, memory_result, session_ctx.session.turns)
        full_prompt = enforce_token_budget(full_prompt)
    
        # LLM Core (streaming)
        raw_response, llm_meta = await generate_response_streaming(
            full_prompt, orch_result, websocket
        )
    
        # Output Safety Gate (Groq call — not on streaming critical path)
        safety_result = await run_safety_gate(raw_response, orch_result, signals)
    
        final_response = safety_result.approved_response
        if not safety_result.approved:
            # Replace streamed content with corrected/fallback
            await websocket.send_json({"type": "replace", "content": final_response})
        else:
            await websocket.send_json({"type": "confirmed"})
    
        return TurnResult(
            response=final_response,
            source=safety_result.response_source,
            urgency=signals.urgency_score,
            mode=orch_result.selected_mode,
            signals=signals,
            orch_result=orch_result,
            memory_result=memory_result,
            llm_meta=llm_meta,
            safety_result=safety_result
        )
    

* * *

Session End Pipeline: Concurrency
---------------------------------

    async def handle_session_end(session_ctx: SessionContext):
        """Triggered by: WebSocket disconnect OR Redis TTL expiry via keyspace notification."""
    
        session = session_ctx.session
    
        # Guard: don't run if session had < 2 turns (not worth summarising)
        if session.turn_count < 2:
            await mark_session_ended(session)
            return
    
        # All 5 tasks run concurrently
        results = await asyncio.gather(
            write_session_record(session),
            generate_and_write_episodic_memory(session),
            extract_and_update_semantic_facts(session),
            update_procedural_profile_ema(session),
            update_longitudinal_trajectory(session),
            return_exceptions=True  # don't fail everything if one task fails
        )
    
        # Log any failures (don't raise — session end must not crash)
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Session end task {i} failed: {result}", 
                            extra={"session_id": session.session_id, "user_id": session.user_id})
    

### Redis Keyspace Notifications for Session Expiry

To detect session end from TTL expiry (user just closed app, no WebSocket disconnect event):

    Redis config: notify-keyspace-events "Ex"  (enable expired key notifications)
    
    FastAPI startup: subscribe to Redis keyspace channel __keyevent@0__:expired
    Pattern: session:{user_id}:{session_id} → triggers handle_session_end
    
    Implementation: Use redis-py async pubsub in a background task at FastAPI startup.
    

* * *

Embedding Computation: Thread Pool for CPU Work
-----------------------------------------------

    from concurrent.futures import ThreadPoolExecutor
    import asyncio
    
    embedding_executor = ThreadPoolExecutor(max_workers=2)
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    async def compute_embedding(text: str) -> list[float]:
        # Run CPU-bound embedding in thread pool to not block event loop
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            embedding_executor,
            lambda: embedding_model.encode(text).tolist()
        )
        return embedding
    
    async def get_or_compute_embedding(text: str) -> list[float]:
        cache_key = f"emb:{hashlib.sha256(text.encode()).hexdigest()[:16]}"
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
        embedding = await compute_embedding(text)
        await redis.setex(cache_key, 3600, json.dumps(embedding))  # 1 hour TTL
        return embedding
    

* * *

Connection Pool Configuration
-----------------------------

    # Redis: single async connection pool
    redis_pool = aioredis.ConnectionPool.from_url(
        REDIS_URL, max_connections=20, decode_responses=True
    )
    redis = aioredis.Redis(connection_pool=redis_pool)
    
    # Supabase: using supabase-py async client
    # For heavy read operations: use Supabase's connection pooler (PgBouncer) URL
    
    # Qdrant: single async client
    qdrant_client = AsyncQdrantClient(QDRANT_URL, api_key=QDRANT_API_KEY)
    
    # Groq: single async client, reused across all Groq calls
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    
    # Azure OpenAI: async client with timeout
    azure_client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        api_version="2024-02-01",
        timeout=8.0  # 8 second timeout before fallback
    )
    
    # Gemini: used only for async session-end tasks
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    

* * *

TASK 4: SESSION STARTUP — FULL FLOW
===================================

New Session Creation
--------------------

    1. User opens app and sends first message
    2. Frontend: checks localStorage for active_session_id
       - If found and < 25min old: sends existing session_id
       - If not found or expired: sends "new"
    3. FastAPI WebSocket handler:
       - If "new": generate new UUID session_id
       - If existing: validate against Redis active_session:{user_id}
         - If Redis has it: resume session (skip startup pipeline)
         - If Redis doesn't (expired TTL): treat as new session
    
    4. For NEW session:
       a. Parallel load (asyncio.gather):
          - semantic_profile from Supabase
          - procedural_profile from Redis (cache) or Supabase (miss)
          - longitudinal_flag from Supabase (single boolean read)
          - most_recent_episodic_summary from Qdrant
            (filter: user_id, sort by session_date DESC, limit 1)
    
       b. Build initial session object:
          - is_new_session = True
          - current_mode = determine_starting_mode(previous_session_data, longitudinal_flag)
            * if previous session peak_urgency >= 2: start in "recovery_check"
            * else: start in "companion"
          - cultural_frame_id from semantic_profile
          - longitudinal_risk_flag from longitudinal_data
          - style_vector from procedural_profile (sets initial tone)
    
       c. Write to Redis:
          - session:{user_id}:{session_id} with TTL=1500s
          - active_session:{user_id} = session_id with TTL=1500s
    
       d. Send "session_ready" event to frontend with session_id
    

Returning User — Same Session Resume
------------------------------------

    1. User returns within 25 minutes (app reopen, screen unlock)
    2. Frontend sends existing session_id
    3. FastAPI validates against Redis → found → session continues
    4. Redis TTL resets to 1500s
    5. No DB loads needed — everything already in Redis
    6. session.is_new_session = False (critical: no recovery_check mode for quick returns)
    

Session Metadata Tracking For Orchestrator
------------------------------------------

At session start, the Orchestrator needs `previous_session_peak_urgency` to decide if `recovery_check` mode is appropriate. This comes from the most recent episodic memory's `peak_urgency` payload field in Qdrant. This is why the Qdrant pre-fetch at session startup is important.

* * *

TASK 5: FULL SYSTEM DATA FLOW DIAGRAM (Text)
============================================

Per Turn: Complete Data Flow
----------------------------

    [User Message]
          │
          ▼
    [Layer 1: Input Ingestion]
      - Unicode NFC normalisation
      - PII detection + redaction
      - Language hint detection
      - Session resolution (Redis lookup)
      - Outputs: normalised_message, language_hint, session_id, pii_detected, is_new_session
          │
          ├──────────────────────────────────────────────────────┐
          │ [Crisis pre-check from urgency_history in Redis]     │
          │  urgency_history[-1] == 3? → Crisis Bypass → END    │
          │                                                       │
          ▼ (if no pre-existing crisis)                          │
    [PARALLEL GROUP A]                                           │
      ├── Signal Extraction (Groq)     ←── Redis: session object │
      │   + Passive Monitor (Python)   ←── session.affect_history│
      └── Embedding computation (CPU)  ←── local MiniLM         │
          │                                                       │
          ▼ (both complete)                                       │
    [Crisis check on fresh urgency_score]                        │
      urgency == 3? → Crisis Bypass → Audit Log → END ──────────┘
          │
          ▼ (urgency < 3)
    [State Orchestrator — pure Python, no I/O, <5ms]
      ← affect_vector, urgency_score, sarcasm_detected
      ← urgency_history, affect_history, recent_turns (8 turns from session)
      ← current_mode, mode_history, turn_count
      ← semantic_profile (session-start cached)
      ← procedural_profile (session-start cached)
      ← dependency_risk_counter, longitudinal_risk_flag
      → selected_mode, tone_params, memory_gate, memory_gate_strength
      → max_response_tokens, dependency_flag, cultural_frame_id
      → affect_for_retrieval, topic_keywords_for_retrieval
          │
          ├──────────────────────────────────────────────────────┐
          ▼                                                       ▼
    [Memory Retrieval]                             [Prompt Builder: Blocks 1,2,4,5,6]
      ← user_id, current_embedding                  ← tone_params, selected_mode
      ← memory_gate, memory_gate_strength            ← cultural_frame_id, dependency_flag
      ← topic_keywords, affect_for_retrieval         ← anti-sycophancy (static)
      ← semantic_profile (session cache)             Built while memory retrieval runs
      → episodic_memories (0-2)                      ↓
      → semantic_facts_injection                [Blocks 3 + 7 inserted after memory returns]
      → retrieval_scores                           ← episodic_memories
          │                                        ← session.turns (full history, Block 7)
          └──────────────────► [Full Prompt]
                                    │ token budget enforcement
                                    ▼
                         [LLM Core: Azure GPT-4o]
                           ← full_prompt, temperature, max_tokens
                           → raw_response (streaming to frontend)
                           → tokens_used, finish_reason, llm_used
                                    │
                                    ▼
                         [Output Safety Gate]
                           Check 1+2: Groq (combined call)
                             ← raw_response
                             → harm bool, sycophancy bool
                           Check 3: Phase 2 only
                           Check 4: Python rule-based
                             ← raw_response, tone_params
                             → conformance_score
                           Check 5: Python length check
                             → approved_response OR retry/fallback
                                    │
                         ┌──────────┴──────────┐
                         ▼ (pass)              ▼ (fail)
                   [Confirmed]          [Replace / Fallback]
                   to frontend          to frontend
                         │
                         ▼
            [Response Delivery: sync]
              - WebSocket confirmed event
              - Redis: append turn to session.turns
              - Redis: update session metadata
                         │
                         ▼
            [Async tasks: asyncio.create_task]
              - Audit log write (Supabase)
              [Session continues — next turn]
    

* * *

TASK 6: WHAT IS NOT LLM AND WHAT IS LLM — JUSTIFIED
===================================================

Every LLM Use Justified
-----------------------

### 1\. Signal Extraction (Groq, every turn) ✅ JUSTIFIED

**Why LLM and not a classifier?** Indian code-mixed mental health text cannot be handled by rule-based systems or even standard classifiers. "Yaar sab kuch khatam ho gaya" (everything is over) — the word "khatam" can be casual ("finished") or deeply distressing depending on context. "Haha koi baat nahi" after a distress statement is deflection. A fine-tuned LLM handles this contextual interpretation. Groq's Llama 3.1 8B with structured output JSON schema is fast enough (<800ms) and cost-free on the free tier.

**Alternative considered:** IndicBERT fine-tuned classifier. Rejected for MVP because: (1) no annotated Hindi-English mental health dataset of sufficient quality exists, (2) model hosting on Railway CPU adds latency and memory pressure, (3) Groq free tier is sufficient and more flexible.

### 2\. Main Response Generation (Azure GPT-4o, every turn) ✅ JUSTIFIED

Core product. No alternative.

### 3\. Combined Safety Check (Groq, every turn) ✅ JUSTIFIED

**Why LLM and not rule-based?** Harm detection: keyword matching fails because harmful advice can be phrased in ways that avoid flagged words. "You should probably figure out what makes it worth continuing" is harmful if someone is suicidal — no keyword catches it. Sycophancy detection: "That sounds really tough and I completely understand why you feel like nothing will ever get better" — sycophancy requires semantic understanding, not pattern matching.

**Groq is the right choice:** Same model, same client, batched into one call with combined output schema. Adds ~200-300ms latency after LLM response, acceptable since it runs post-streaming.

### 4\. Session Summarisation (Gemini free, session end) ✅ JUSTIFIED

Summary quality directly determines episodic memory quality, which determines how well the agent "remembers" users. A rule-based summary would miss emotional arc and key disclosures. Gemini free tier (1M tokens/day) is sufficient for years at MVP scale.

### 5\. Semantic Fact Extraction (Groq, session end) ✅ JUSTIFIED

Extracting "Priya = friend, context = roommate conflict" from a conversation requires language understanding. Named entity recognition alone is insufficient for the relational context. Structured JSON schema enforcement via Groq ensures clean data writes.

Operations That Are NOT LLM (All Justified)
-------------------------------------------

Operation

Method

Why Not LLM

PII detection

Regex patterns

Deterministic, fast, no false negatives from hallucination

Language hint detection

Unicode block analysis

Deterministic, Python only

Session object management

Redis operations

Pure data

Orchestrator mode selection

Python rule engine

Deterministic rules must not be "interpreted"

EMA tone convergence

Python math

Deterministic

Longitudinal slope detection

Linear regression (numpy)

Deterministic

Token budget enforcement

tiktoken library

Deterministic

Embedding computation

local MiniLM

Embedding model, not generation model

Tone conformance check

Python rules

Deterministic

Length check

Python len()

Deterministic

PHQ-2 scoring

Part of Groq semantic extraction

Already a Groq call

Cultural frame selection

Lookup from semantic\_profile

Deterministic

Passive monitor

Python rules on affect\_history

Deterministic

Dependency risk counter

Python arithmetic

Deterministic

Crisis template selection

Supabase SELECT

Deterministic

Fallback routing

Python if/else

Deterministic

* * *

TASK 7: AUDIENCE EXPANSION — 18-30 INDIAN YOUNG ADULTS
======================================================

What Changes From College-Student-Only Design
---------------------------------------------

### Stressor Profiles Added

**Working professional (22-28):** - Work stress: manager relationships, performance reviews, toxic workplace, WFH isolation - Financial: EMI pressure, rent in metro cities, "supporting parents" burden starting - Relationship: marriage pressure from family intensifies post-22, partner conflicts, breakups with higher stakes - Identity: "Is this the right career?", startup vs stability dilemma, comparison with peers who "made it" - Language pattern: more English-dominant, faster-paced messages, messages during work breaks (lunch, late evening)

**Tier 2/3 city young adult (18-25):** - Aspiration vs reality gap: watching peers in metros on Instagram - Family watchfulness: less privacy, social surveillance - Fewer support structures: no campus counsellor equivalent, limited awareness of mental health resources - Language: higher Hindi ratio, more cautious with emotional disclosure initially

### Cultural Frame Additions for Non-Student Context

Existing frames (iit\_pressure, first\_gen\_aspirant, metro\_social, small\_town\_adult) remain.

New frame added: `working_professional` (specified in Task 0).

**Onboarding question for frame selection:** At onboarding (3 questions total, conversational not form-based): 1. "What do you do these days?" → determines student/working/other 2. "Which city are you in?" → metro/tier2/tier3 signal 3. "How are things going in general?" → baseline affect seed

From these 3 answers, Groq does a one-time semantic classification to assign `cultural_frame_id`. Not rule-based — LLM-based because the answers are free-text.

### Mode Calibration for Working Professionals

Working professional users show different conversation patterns: - Sessions tend to be shorter (break-time usage): max\_response\_tokens reduced by 20% - More likely to use the app late night (stress after work): `preferred_time_slots` in procedural profile - Less likely to disclose emotional content in first 2-3 sessions: Companion mode default warmth starts slightly lower, builds faster - Recovery check mode less relevant (they may not be using app daily)

These are encoded in the cultural frame's tone adjustment layer, not hardcoded.

* * *

TASK 8: ANTI-DEPENDENCY SYSTEM — FULL DESIGN
============================================

Detection Signals (All in Procedural Profile)
---------------------------------------------

    dependency_risk_counter: int (increments/decrements per session)
      +1 if session has 0 mentions of real people (friends, family, colleagues)
      +1 if user explicitly says agent is their only outlet ("only you understand")
      +2 if session frequency this week >= 7 AND sessions are high urgency
      -1 if session has ≥ 2 social mentions
      -1 if user reports positive real-world interaction
    
    social_mentions_count: int (count of named person mentions in last 10 sessions)
    sessions_this_week: int (resets Monday 00:00 IST)
    app_open_times: list[int] (hour of day, last 20 sessions — for time pattern detection)
    

Response Shaping When Flag Is Active
------------------------------------

    dependency_flag = True when:
      dependency_risk_counter >= 7 AND social_mentions_count < 3
    
    Effect on Prompt Builder Block 5 (mode instruction):
      For Companion mode only:
      Add to mode instruction: "If it fits naturally, show genuine interest in their relationships
      with others. Celebrate any mention of connecting with a friend or family member.
      Gently reference that having people around matters — not as advice, as curiosity."
    
    This is NOT abrupt. NOT a warning. NOT visible to the user.
    It shapes 1-2 sentences across the session naturally.
    
    Duration: 3-5 sessions of gradual shaping before dependency_risk_counter is re-evaluated.
    

When Dependency Counter Exceeds Critical Threshold
--------------------------------------------------

    dependency_risk_counter >= 15 AND high_urgency_sessions >= 3:
      → Referral Bridge mode activates more readily (lower urgency threshold)
      → Agent naturally introduces: "Have you ever talked to someone outside of this?
         A friend, or even a counsellor? Not because I'm going anywhere — just curious."
      → This is ONE conversation, not every session.
    

* * *

TASK 9: GRACEFUL DEGRADATION — COMPLETE DESIGN
==============================================

Static Template Store Design
----------------------------

    Table: static_fallback_templates
    Modes covered: "companion", "active_listener", "recovery_check", "referral_bridge"
    Language variants: "en", "hinglish_casual", "hinglish_formal"
    6 templates per mode per language variant = 72 total templates
    
    Template selection: random integer 0-5, seeded by hash(session_id + turn_count)
    (Deterministic randomness — same session gets same template on same turn, but variety across sessions)
    

Fallback Decision Tree
----------------------

    Azure API call fails (timeout/5xx):
      urgency == 0: try GLM → if fail: static_fallback_template (companion)
      urgency >= 1: try Groq 70B → if fail: static_fallback_template (active_listener)
      urgency == 3: crisis_template (always, never LLM anyway)
    
    Groq API call fails (signal extraction):
      Use last known affect from urgency_history
      Set urgency = urgency_history[-1] if available, else 0
      Set affect_vector = {valence: 0.0, arousal: 0.3, dominance: 0.5} (neutral fallback)
      Proceed with degraded signals — log as "signal_extraction_failed"
    
    Qdrant fails (memory retrieval):
      memory_gate = False (skip retrieval entirely)
      Log as "memory_retrieval_failed"
      Proceed with prompt without Block 3 (memory injection)
      semantic_profile still available (from session-start cache)
    
    Supabase fails (session-start load):
      Load from Redis cache (procedural_profile cached in Redis)
      semantic_profile: use empty defaults
      cultural_frame: use "metro_social" (most general)
      Log as "supabase_unavailable"
    
    Redis fails (catastrophic):
      Create in-memory session object (Python dict)
      No memory persistence this session
      Log as "redis_unavailable"
      Serve session from memory, write to Supabase at session end directly
    

* * *

TASK 10: MONITORING & OBSERVABILITY
===================================

What to Track in Posthog (Product Analytics)
--------------------------------------------

    # Every turn:
    posthog.capture(user_id, "turn_completed", {
        "session_id": session_id,
        "mode": selected_mode,
        "urgency": urgency_score,
        "memory_retrieved": memory_retrieved,
        "tokens_used": tokens_used,
        "llm_used": llm_used,
        "response_source": response_source,  # llm vs fallback
        "latency_ttft_ms": ttft_ms,          # time to first token
        "latency_total_ms": total_ms,
        "safety_flags": safety_flags,
        "code_mix_ratio": code_mix_ratio,
        "turn_count": turn_count
    })
    
    # Session end:
    posthog.capture(user_id, "session_ended", {
        "session_id": session_id,
        "duration_minutes": duration,
        "turn_count": turn_count,
        "peak_urgency": peak_urgency,
        "mode_sequence": mode_sequence,
        "episodic_memory_written": True/False,
        "phq2_collected": True/False
    })
    

Alerts to Set Up (BetterStack Free)
-----------------------------------

    - Azure token burn rate > 80% of daily budget: alert
    - Any Tier 3 trigger: alert (within 5 minutes)
    - Signal extraction failure rate > 5% in 10 minutes: alert
    - Average TTFT > 2000ms for 5 consecutive turns: alert
    - Railway memory usage > 80%: alert
    - Supabase connection errors > 0: alert
    

Monthly Reviews (Manual)
------------------------

    - Review all Tier 3 audit log entries (clinical team)
    - Check memory retrieval threshold performance:
      retrieval_scores from audit logs → is 0.62 optimal?
    - Review sycophancy flag rate: should be < 5% of turns
    - Review fallback template usage rate: should be < 2% of turns
    - Review false positive crisis rate: survey 10 randomly sampled users who triggered Tier 1+
    

* * *

TASK 11: DEPENDENCY STACK — NO VERSION CONFLICTS
================================================

Python Dependencies (requirements.txt)
--------------------------------------

    fastapi==0.111.0
    uvicorn[standard]==0.29.0
    websockets==12.0
    pydantic==2.7.0
    
    # Redis
    redis[asyncio]==5.0.4
    aioredis==2.0.1  # NOT needed if using redis>=5 with asyncio support
    
    # Supabase
    supabase==2.4.2
    postgrest==0.16.5
    
    # Qdrant
    qdrant-client==1.9.1
    
    # Embeddings (CPU-only, no GPU needed on Railway)
    sentence-transformers==3.0.1
    torch==2.3.0+cpu  # CPU-only build, smaller footprint
    # In Railway: set TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
    
    # LLM clients
    openai==1.30.0        # Azure OpenAI uses openai client
    groq==0.9.0
    google-generativeai==0.7.0
    
    # Utilities
    python-dotenv==1.0.1
    tiktoken==0.7.0       # Token counting for Azure/OpenAI models
    numpy==1.26.4         # For slope detection, affect distance computation
    httpx==0.27.0         # Async HTTP for GLM fallback
    pydantic-settings==2.2.1
    
    # Monitoring
    sentry-sdk[fastapi]==2.5.1
    posthog==3.5.0
    
    # Security
    python-jose[cryptography]==3.3.0  # JWT decode
    passlib[bcrypt]==1.7.4
    

Environment Variables Required
------------------------------

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT=https://{your-resource}.openai.azure.com/
    AZURE_OPENAI_API_KEY=...
    AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
    
    # Groq
    GROQ_API_KEY=...
    
    # Gemini
    GEMINI_API_KEY=...
    
    # GLM fallback
    GLM_API_KEY=...
    GLM_API_BASE=https://open.bigmodel.cn/api/paas/v4/
    
    # Supabase
    SUPABASE_URL=https://{your-project}.supabase.co
    SUPABASE_SERVICE_KEY=...  # Service role key for backend — NOT anon key
    SUPABASE_DB_URL=postgresql://...  # For direct Postgres access if needed
    
    # Redis (Railway plugin)
    REDIS_URL=redis://...
    
    # Qdrant (Railway plugin or Qdrant Cloud)
    QDRANT_URL=http://...
    QDRANT_API_KEY=...  # If Qdrant Cloud
    
    # App config
    SESSION_TTL_SECONDS=1500
    MAX_TOKENS_PER_TURN=8000
    DAILY_AZURE_TOKEN_BUDGET=5000000
    SECRET_KEY=...  # For JWT signing
    
    # Monitoring
    SENTRY_DSN=...
    POSTHOG_API_KEY=...
    
    # Feature flags
    PSYCHOEDUCATION_MODE_ENABLED=false  # Phase 2
    SKILL_COACH_MODE_ENABLED=false      # Phase 2
    COUNSELLOR_DASHBOARD_ENABLED=false  # Phase 2
    

* * *

TASK 12: ANSWER TO "WHY RECENT 6-10 MESSAGES IN ORCHESTRATOR?"
==============================================================

The Complete Answer
-------------------

The State Orchestrator in v2 architecture only received: - `affect_vector` (current turn's affect) - `urgency_score` (current) - `affect_history` (array of past affect vectors)

**The bug:** The Orchestrator was making mode decisions (companion → active\_listener) based only on numerical affect scores, not on the actual conversational content. This fails in these cases:

**Case 1: Sarcasm not propagating correctly** User says "haha sab theek hai lol" → Signal Extraction marks sarcasm\_detected=True and reduces urgency. But the Orchestrator doesn't know WHY urgency was reduced — it just sees urgency=0 and stays in Companion mode even though the 5 previous turns were progressively withdrawing. The Orchestrator needs the recent turn text to cross-reference the sarcasm flag.

**Case 2: Topic continuity for mode hold** A user was talking about a breakup (high distress). They then send a one-line message about something unrelated. Affect score drops. Should the agent switch to Companion mode? Only if the topic actually shifted. The Orchestrator needs the turn text to see if the topic genuinely changed or if the user just sent a brief distraction message.

**Case 3: Mode transition damping requires content** The minimum 2-turn hold before mode switching is numerical, but "was the mode shift justified" requires seeing what the user said in those turns.

The Fix (Already in v3 Spec)
----------------------------

    Orchestrator receives: recent_turns: list[dict]
      → EXACTLY last 8 turns [{role, content, timestamp}]
      → From: session.turns (Redis) — already loaded at session start
      → NOT full transcript (that's only for Prompt Builder Block 7)
      → 8 turns = ~4 user messages + 4 agent responses = sufficient conversational arc
    

The Orchestrator uses `recent_turns` for: 1. Validating sarcasm\_detected flag (does the turn history support this reading?) 2. Topic continuity check for mode transitions 3. Detecting conversation shutdown patterns (shorter messages, one-word responses) 4. Recovery check mode: is the user opening with something related to the previous session's difficult content?

The Orchestrator does NOT call an LLM for this — it uses rule-based pattern matching on the recent turn text (Python string operations: message length trend, question presence, topic keyword overlap with session topics). This keeps the Orchestrator computation-only (<5ms) with no I/O.

* * *

TASK 13: ONBOARDING FLOW SPECIFICATION
======================================

Onboarding is critical — it seeds the semantic profile, cultural frame, and initial style vector. It must feel like a conversation, not a form.

3-Turn Onboarding Conversation
------------------------------

    Turn 1 — Agent (pre-scripted, not LLM):
    "Hey! Glad you're here. What's your name, if you'd like to share?"
    → User responds → extract name (optional), store in semantic_profile.display_name
    
    Turn 2 — Agent (pre-scripted):
    "Nice to meet you [name / "you"]. What do you do these days — student, working, something else?"
    → User responds (free text) → Groq one-time classification:
      {occupation: "student" | "working" | "other", occupation_detail: str}
      Combine with city (from profile creation) → assign cultural_frame_id
    
    Turn 3 — Agent (pre-scripted):
    "And how's life treating you these days? No pressure to be specific."
    → User responds → Groq one-time affect extraction:
      {baseline_valence: float, baseline_arousal: float}
      → seeds longitudinal_trajectory with a "day 0" baseline
      → seeds semantic_profile language_baseline from this response's code_mix_ratio
    
    After Turn 3: onboarding_complete = True
    Agent: "Got it. I'm here whenever you want to talk — about anything."
    → Transition to Companion mode for the actual first conversation
    

What Onboarding Does NOT Do
---------------------------

*   Does NOT ask about mental health history
*   Does NOT ask about diagnosis
*   Does NOT ask about therapy history
*   Does NOT ask about emergency contacts
*   Does NOT make clinical assessments

Onboarding seeds the technical profile only. The agent learns everything else from conversation.

* * *

TASK 14: SUPABASE AUTH ARCHITECTURE
===================================

Auth Flow
---------

    Frontend: Supabase JS client handles auth directly
      - Email + OTP (magic link) — no passwords to manage
      - Phone + OTP (for Indian users who prefer WhatsApp-like auth)
    
    Backend: Does NOT proxy auth. Frontend authenticates directly with Supabase Auth.
    
    JWT flow:
      - Supabase Auth issues JWT on login
      - Frontend sends JWT in WebSocket connection header
      - FastAPI middleware decodes JWT using Supabase JWT secret
      - Extracts user_id (Supabase auth UUID)
      - All subsequent operations use user_id
    
    Row-Level Security on all Supabase tables:
      - users: SELECT/UPDATE where auth.uid() == auth_id
      - user_semantic_profiles: SELECT/UPDATE where user_id == (SELECT id FROM users WHERE auth_id == auth.uid())
      - crisis_templates: SELECT for service_role only, no user access
      - audit_logs: no user access (service_role only)
    

Why Frontend Auth + Backend JWT Decode (Not Backend Proxy)
----------------------------------------------------------

This is the standard Supabase architecture. The frontend does auth, gets a JWT, and the backend validates it. This means: - No password storage anywhere in your backend - Supabase handles OTP, rate limiting, session management - Your FastAPI only ever sees validated user\_ids, never credentials - One less attack surface

* * *

TASK 15: CRISIS TEMPLATE GOVERNANCE PROCESS
===========================================

Implementation of "2 Clinical Approvals Required"
-------------------------------------------------

Supabase RLS cannot enforce a two-approver policy natively. Implementation:

    -- crisis_templates table has:
    pending_content TEXT,         -- proposed new content (not yet active)
    approval_1_by UUID,           -- first approver user_id (admin role)
    approval_1_at TIMESTAMPTZ,
    approval_2_by UUID,           -- second approver (must be different from approval_1_by)
    approval_2_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT FALSE
    
    -- A Supabase Edge Function or FastAPI admin endpoint:
    -- "approve_crisis_template(template_id, approver_id)"
    -- Checks: approval_1_by IS SET, approver_id != approval_1_by
    -- If both conditions met: SET active = TRUE, content = pending_content
    -- This is the "2 approver" enforcement in application code
    

This is simpler than trying to enforce it in DB constraints and works reliably.

* * *

SUMMARY: FULL LAYER SEQUENCE, LATENCY BUDGET, CONCURRENCY
=========================================================

    LAYER                    TOOL           LATENCY    CONCURRENT WITH
    ─────────────────────────────────────────────────────────────────
    Input Ingestion          Python         ~3ms        Nothing (must run first)
    Redis Session Load       Redis          ~2ms        Runs during Groq warmup
    Signal Extraction        Groq           ~600ms      Embedding computation (CPU)
    Embedding (MiniLM)       CPU ThreadPool ~15ms       Signal extraction
    ─────────────────────────────────────────────────────────────────
    Crisis Check             Python         ~1ms        Nothing (sync gate)
    ─────────────────────────────────────────────────────────────────
    State Orchestrator       Python         ~4ms        Qdrant connection warmup
    ─────────────────────────────────────────────────────────────────
    Memory Retrieval         Qdrant         ~60ms       Prompt blocks 1,2,4,5,6 build
    Prompt Blocks 1,2,4,5,6  Python         ~5ms        Memory retrieval
    ─────────────────────────────────────────────────────────────────
    Prompt completion        Python         ~2ms        Nothing (needs memory result)
    Token budget enforcement Python         ~1ms        Nothing
    ─────────────────────────────────────────────────────────────────
    LLM Core (TTFT)          Azure GPT-4o   ~700ms      Nothing (blocking for stream)
    LLM Core (full response) Azure GPT-4o   ~1100ms     Nothing (streaming to client)
    ─────────────────────────────────────────────────────────────────
    Output Safety Gate       Groq (batched) ~250ms      Nothing (post-response)
    ─────────────────────────────────────────────────────────────────
    TOTAL CRITICAL PATH      ~700ms TTFT, ~2100ms full turn
    
    SESSION-END ASYNC (non-blocking, all concurrent):
    Write session record     Supabase       ~50ms
    Episodic memory gen      Gemini         ~2000ms
    Semantic fact extract    Groq           ~800ms
    Procedural EMA update    Supabase       ~30ms
    Longitudinal update      Supabase       ~40ms
    

**Total per-turn Azure spend (at 8000 token budget):** ~6000 tokens prompt + ~150 tokens completion = ~6150 tokens × $0.0000025/token = ~$0.015/turn At 8 turns/session, 500 DAU = $0.015 × 8 × 500 = $60/day = ~₹5,000/day Azure student credits typically $150-300 = 25-50 days of 500 DAU usage.

**Apply for Azure for Startups:** startups.microsoft.com → up to $150,000 in Azure credits. This single grant covers Phase 1 entirely.