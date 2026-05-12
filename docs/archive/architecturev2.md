  MHA Conversational Agent — Refined Architecture v2 :root { --ink: #1a1a1a; --ink2: #4a4a4a; --ink3: #7a7a7a; --surface: #ffffff; --surface2: #f7f6f3; --surface3: #f0ede8; --border: rgba(0,0,0,0.10); --border2: rgba(0,0,0,0.20); --purple: #6B5CF6; --purple-bg: #F0EEFF; --teal: #0D9E75; --teal-bg: #E1F5EE; --amber: #B97316; --amber-bg: #FEF3E2; --coral: #D85A30; --coral-bg: #FEF0EA; --red: #DC2626; --red-bg: #FEF2F2; --blue: #1D6DBF; --blue-bg: #EFF6FF; --green: #15803D; --green-bg: #F0FDF4; --gray-bg: #F9F9F9; --font: 'Georgia', 'Times New Roman', serif; --mono: 'Courier New', monospace; --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; } @media (prefers-color-scheme: dark) { :root { --ink: #e8e6e0; --ink2: #b0ada6; --ink3: #767370; --surface: #1c1b18; --surface2: #242320; --surface3: #2c2b28; --border: rgba(255,255,255,0.10); --border2: rgba(255,255,255,0.20); --purple-bg: #2a2540; --teal-bg: #0a2e22; --amber-bg: #2e1f08; --coral-bg: #2e1608; --red-bg: #2e0a0a; --blue-bg: #0a1e35; --green-bg: #0a2015; --gray-bg: #242320; } } \* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: var(--font); color: var(--ink); background: var(--surface); font-size: 15px; line-height: 1.8; max-width: 900px; margin: 0 auto; padding: 3rem 2rem 6rem; } h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.4rem; } h2 { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; margin: 2.5rem 0 1rem; border-bottom: 1.5px solid var(--border2); padding-bottom: 0.5rem; } h3 { font-size: 1.05rem; font-weight: 700; margin: 1.5rem 0 0.6rem; font-family: var(--sans); } h4 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink3); margin: 1.2rem 0 0.4rem; font-family: var(--sans); } p { margin-bottom: 0.8rem; } code { font-family: var(--mono); font-size: 0.85em; background: var(--surface3); padding: 2px 5px; border-radius: 3px; } ul, ol { padding-left: 1.4rem; margin-bottom: 0.8rem; } li { margin-bottom: 0.3rem; } a { color: var(--blue); } .meta { font-family: var(--sans); font-size: 0.82rem; color: var(--ink3); margin-bottom: 2.5rem; display: flex; gap: 1.5rem; flex-wrap: wrap; } .meta span { display: flex; align-items: center; gap: 4px; } .toc { background: var(--surface2); border: 0.5px solid var(--border); border-radius: 10px; padding: 1.2rem 1.5rem; margin-bottom: 2.5rem; } .toc-title { font-family: var(--sans); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink3); margin-bottom: 0.6rem; } .toc ol { margin: 0; padding-left: 1.2rem; } .toc li { font-family: var(--sans); font-size: 0.88rem; margin-bottom: 0.2rem; } .toc a { color: var(--ink2); text-decoration: none; } .toc a:hover { color: var(--ink); } /\* Verdict boxes \*/ .verdict { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1.5rem 0; } .verdict-card { padding: 1rem 1.2rem; border-radius: 10px; border: 0.5px solid var(--border); } .verdict-card.pro { background: var(--green-bg); border-color: var(--green); } .verdict-card.con { background: var(--red-bg); border-color: var(--red); } .verdict-label { font-family: var(--sans); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; } .verdict-card.pro .verdict-label { color: var(--green); } .verdict-card.con .verdict-label { color: var(--red); } .verdict-card ul { font-family: var(--sans); font-size: 0.86rem; line-height: 1.6; margin: 0; } /\* Layer cards \*/ .layer-grid { display: flex; flex-direction: column; gap: 0; margin: 1rem 0; } .layer-connector { text-align: center; font-size: 0.9rem; color: var(--ink3); height: 20px; line-height: 20px; } .layer { border: 0.5px solid var(--border); border-radius: 10px; padding: 0; overflow: hidden; cursor: pointer; transition: border-color 0.15s; } .layer:hover { border-color: var(--border2); } .layer.open { border-width: 1.5px; } .layer-header { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; } .layer-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; } .layer-info { flex: 1; } .layer-title { font-family: var(--sans); font-size: 0.92rem; font-weight: 600; } .layer-sub { font-family: var(--sans); font-size: 0.78rem; color: var(--ink3); margin-top: 2px; } .layer-chips { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; } .chip { font-family: var(--sans); font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; background: var(--surface3); color: var(--ink2); border: 0.5px solid var(--border); } .chip.new { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); } .chip.critical { background: var(--red-bg); color: var(--red); border-color: var(--red); } .layer-badge { font-family: var(--sans); font-size: 0.7rem; padding: 3px 8px; border-radius: 8px; background: var(--red-bg); color: var(--red); border: 0.5px solid var(--red); margin-left: auto; flex-shrink: 0; } .layer-badge.new { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); } .layer-body { display: none; padding: 0 16px 16px; border-top: 0.5px solid var(--border); margin: 0 0 0; } .layer.open .layer-body { display: block; } .layer-body-inner { padding-top: 12px; } .io-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; } .io-box { background: var(--surface2); border: 0.5px solid var(--border); border-radius: 7px; padding: 10px 12px; } .io-box h5 { font-family: var(--sans); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink3); margin-bottom: 6px; } .io-box ul { list-style: none; padding: 0; margin: 0; } .io-box li { font-family: var(--sans); font-size: 0.8rem; color: var(--ink2); padding: 1px 0; display: flex; gap: 6px; } .io-box li::before { content: "·"; color: var(--ink3); } .layer-text { font-family: var(--sans); font-size: 0.84rem; color: var(--ink2); line-height: 1.65; } .layer-text p { margin-bottom: 6px; } .layer-text strong { color: var(--ink); font-weight: 600; } .research-note { margin-top: 8px; padding: 8px 12px; background: var(--blue-bg); border-radius: 6px; font-family: var(--sans); font-size: 0.78rem; color: var(--ink2); line-height: 1.5; } .critique-note { margin-top: 8px; padding: 8px 12px; background: var(--amber-bg); border-left: 2px solid var(--amber); border-radius: 0 6px 6px 0; font-family: var(--sans); font-size: 0.78rem; color: var(--ink2); line-height: 1.5; } .improvement-note { margin-top: 8px; padding: 8px 12px; background: var(--green-bg); border-left: 2px solid var(--green); border-radius: 0 6px 6px 0; font-family: var(--sans); font-size: 0.78rem; color: var(--ink2); line-height: 1.5; } /\* Memory stores \*/ .mem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 1rem 0; } .mem-card { padding: 1rem 1.1rem; border: 0.5px solid var(--border); border-radius: 10px; cursor: pointer; transition: border-color 0.15s; } .mem-card:hover { border-color: var(--border2); } .mem-card.sel { border-width: 1.5px; } .mem-card h3 { font-family: var(--sans); font-size: 0.9rem; font-weight: 600; margin: 0 0 4px; } .mem-card p { font-family: var(--sans); font-size: 0.78rem; color: var(--ink3); margin: 0; } .mem-detail { font-family: var(--sans); font-size: 0.84rem; color: var(--ink2); line-height: 1.65; padding: 12px 14px; border: 0.5px solid var(--border); border-radius: 10px; } /\* Cost table \*/ .cost-table { width: 100%; border-collapse: collapse; font-family: var(--sans); font-size: 0.84rem; margin: 1rem 0; } .cost-table th { text-align: left; font-weight: 600; padding: 8px 10px; border-bottom: 1.5px solid var(--border2); color: var(--ink); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; } .cost-table td { padding: 7px 10px; border-bottom: 0.5px solid var(--border); color: var(--ink2); } .cost-table tr:last-child td { border: none; font-weight: 600; color: var(--ink); } .cost-table tr.subtotal td { font-weight: 600; color: var(--ink); background: var(--surface2); } /\* Sections \*/ .section-intro { font-family: var(--sans); font-size: 0.88rem; color: var(--ink2); line-height: 1.65; padding: 1rem 1.2rem; background: var(--surface2); border-radius: 10px; margin-bottom: 1.2rem; border: 0.5px solid var(--border); } .call-out { padding: 1rem 1.2rem; border-radius: 10px; margin: 1.2rem 0; border: 0.5px solid var(--border); font-family: var(--sans); font-size: 0.85rem; line-height: 1.65; } .call-out.danger { background: var(--red-bg); border-color: var(--red); } .call-out.info { background: var(--blue-bg); border-color: var(--blue); } .call-out.success { background: var(--green-bg); border-color: var(--green); } .call-out.warning { background: var(--amber-bg); border-color: var(--amber); } .call-out-title { font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; } .call-out.danger .call-out-title { color: var(--red); } .call-out.info .call-out-title { color: var(--blue); } .call-out.success .call-out-title { color: var(--green); } .call-out.warning .call-out-title { color: var(--amber); } /\* Comparison tables \*/ .compare-table { width: 100%; border-collapse: collapse; font-family: var(--sans); font-size: 0.83rem; margin: 1rem 0; } .compare-table th { padding: 8px 10px; border-bottom: 1.5px solid var(--border2); font-weight: 600; text-align: left; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink3); } .compare-table td { padding: 7px 10px; border-bottom: 0.5px solid var(--border); vertical-align: top; color: var(--ink2); } .compare-table tr:last-child td { border: none; } .tag { display: inline-block; font-family: var(--sans); font-size: 0.72rem; padding: 1px 7px; border-radius: 8px; font-weight: 600; } .tag.keep { background: var(--green-bg); color: var(--green); } .tag.change { background: var(--amber-bg); color: var(--amber); } .tag.add { background: var(--blue-bg); color: var(--blue); } .tag.remove { background: var(--red-bg); color: var(--red); } /\* Nav \*/ .nav { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 0.5px solid var(--border); } .nav-btn { font-family: var(--sans); font-size: 0.78rem; padding: 5px 13px; border: 0.5px solid var(--border2); border-radius: 16px; cursor: pointer; background: var(--surface2); color: var(--ink2); transition: all 0.15s; } .nav-btn:hover, .nav-btn.active { background: var(--ink); color: var(--surface); border-color: var(--ink); } .view { display: none; } .view.active { display: block; } /\* Tone engine \*/ .tone-demo { padding: 1.2rem; border: 0.5px solid var(--border); border-radius: 10px; margin-bottom: 1rem; } .slider-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; } .slider-row label { font-family: var(--sans); font-size: 0.82rem; color: var(--ink2); min-width: 110px; } .slider-row input\[type=range\] { flex: 1; } .slider-val { font-family: var(--mono); font-size: 0.82rem; min-width: 30px; text-align: right; color: var(--ink); } .tone-preview { padding: 14px 16px; border-radius: 8px; background: var(--surface2); font-family: var(--sans); font-size: 0.9rem; line-height: 1.65; min-height: 90px; border: 0.5px solid var(--border); color: var(--ink); } .tone-note { font-family: var(--sans); font-size: 0.78rem; color: var(--ink3); margin-top: 8px; } /\* Safety tiers \*/ .tier { padding: 12px 14px; border: 0.5px solid var(--border); border-radius: 10px; cursor: pointer; margin-bottom: 8px; } .tier.sel { border-width: 1.5px; } .tier-header { display: flex; align-items: center; gap: 10px; } .tier-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--sans); font-size: 0.78rem; font-weight: 700; flex-shrink: 0; } .tier-title { font-family: var(--sans); font-size: 0.9rem; font-weight: 600; } .tier-body { display: none; margin-top: 10px; padding-top: 10px; border-top: 0.5px solid var(--border); font-family: var(--sans); font-size: 0.83rem; color: var(--ink2); line-height: 1.65; } .tier.sel .tier-body { display: block; } /\* New: failure modes section \*/ .failure-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 1rem 0; } .failure-card { padding: 1rem 1.1rem; border: 0.5px solid var(--border); border-radius: 10px; background: var(--surface2); } .failure-card h4 { font-family: var(--sans); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--red); margin-bottom: 6px; } .failure-card p { font-family: var(--sans); font-size: 0.82rem; color: var(--ink2); margin: 0; line-height: 1.55; } /\* Infra table \*/ .infra-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 1rem 0; } .infra-card { padding: 1rem 1.1rem; border: 0.5px solid var(--border); border-radius: 10px; } .infra-card h4 { font-family: var(--sans); font-size: 0.82rem; font-weight: 600; margin-bottom: 4px; } .infra-card p { font-family: var(--sans); font-size: 0.78rem; color: var(--ink3); margin: 0 0 6px; } .infra-card ul { font-family: var(--sans); font-size: 0.78rem; color: var(--ink2); padding-left: 14px; margin: 0; } /\* Scroll behaviour \*/ html { scroll-behavior: smooth; }

MHA Conversational Agent
========================

Refined Architecture v2 — Full-depth critique, improvements & production design

IIT ISM Dhanbad · Student Founder Stack: FastAPI · React · Supabase · Qdrant · Azure OpenAI · Railway · Vercel Scope: Mental Health Zeroth Layer

Contents

1.  [Honest critique of v1 architecture](#view-critique)
2.  [Full refined pipeline (layer-by-layer)](#view-pipeline)
3.  [Memory system — 5-store model](#view-memory)
4.  [Tone & persona engine](#view-tone)
5.  [Safety architecture](#view-safety)
6.  [Infrastructure for near-free tier](#view-infra)
7.  [Realistic cost model](#view-cost)
8.  [Build roadmap](#view-roadmap)

Critique Pipeline Memory Tone engine Safety Infra Cost model Roadmap

This is a full critique of the v1 architecture you designed — not to discourage, but to arm you. The architecture already sits in the top quartile of what student founders build for mental health AI. The problems below are genuine product risks, not stylistic preferences.

What the v1 architecture genuinely gets right
---------------------------------------------

Core strengths

*   Four-store memory taxonomy (Tulving) maps cleanly — most chatbots conflate all memory into one bucket and produce uncanny recall.
*   Crisis as a retrieval problem, not a generation problem. This is the single most important safety insight in the architecture. You got it right.
*   EMA+Cap tone convergence policy — research-backed, specific mechanism, not just "match the user's tone" as vague advice.
*   5-mode orchestrator with mode-transition damping — prevents jarring flips, grounded in CAT (Communication Accommodation Theory).
*   Urgency scorer as a cascade (not single-pass) — the two-stage classification catches more distributed signals.
*   PHQ-2 naturalised into conversation — not a form, outcomes tracking done right.
*   Warm referral framing ("someone trained exactly for this") vs cold redirect — Gulliver et al. 2010 confirms this massively affects uptake.
*   Pre-launch red-team gate with psychology postgrads — almost no student startup does this.
*   DPDP-first design with PII stripping at ingestion — legally sound.

Genuine weaknesses

*   No session continuity mechanism across app restarts / device switches. Memory breaks; users lose context.
*   Retrieval gate (0.82 cosine) has no evaluation framework. Wrong threshold = amnesia or surveillance.
*   LLM config references Gemini Pro / Weaviate / AWS — contradicts your actual stack (Azure OpenAI, Qdrant, Railway). Architecture and implementation are decoupled.
*   No longitudinal affect trajectory — each session is evaluated in isolation. The system cannot detect slow-burn deterioration over weeks.
*   Tone engine is input-only. No mechanism to detect when the agent's own tone is causing harm (e.g. sycophancy spiral, excessive cheerfulness during grief).
*   No graceful degradation path. If Groq/Gemini fallback both fail simultaneously, the user sees nothing.
*   Psychoeducation mode has no fact-check mechanism beyond string matching — paraphrased hallucinations pass through.
*   No anti-dependency design. The agent can become a user's sole emotional outlet without triggering any concern signal.
*   Counsellor dashboard is architecturally correct but operationally underspecified — what does an alert look like to a TISS counsellor at 2 AM?
*   Cost model uses AWS / GCP numbers. Your stack is Railway + Vercel — entirely different pricing structure.

The five improvements that matter most
--------------------------------------

### 1\. Add a longitudinal affect trajectory layer

Your v1 architecture evaluates affect per session. A user who scores urgency=1 across 12 sessions in four weeks is showing a pattern no single-session signal catches. The improvement: store rolling affect means per user (30-day EMA on valence/arousal), detect slope, and surface this to the orchestrator as a "longitudinal risk flag." This is the single most clinically meaningful addition you can make. Reference: _Reece & Danforth (2017, EPJ Data Science)_ — Twitter-based depression onset detection using longitudinal linguistic markers.

### 2\. Build an anti-sycophancy gate in the output layer

Your output safety gate checks for harm, hallucination, and tone conformance. It does not check for sycophancy — the agent agreeing with a distressed user's catastrophising, validating distorted thinking, or reflecting back negativity with warmth. This is the most likely failure mode for a companion AI. Add a sycophancy classifier (a simple IndicBERT fine-tuned to detect validation of cognitive distortions) that flags responses for a softer fallback, not rejection. Reference: _Perez et al. (2022, arXiv:2212.09251)_ — Sycophancy in LLMs: measurements and mitigations.

### 3\. Replace the single retrieval threshold with a dual-signal gate

Cosine similarity on topic embeddings misses emotionally relevant memories that are topically dissimilar. A user discussing exam stress may need the memory of the family pressure conversation even though their topic vectors are far apart. The fix: dual-channel retrieval — topic cosine similarity AND affect distance in the Russell space — take the union with a lower threshold, score by harmonic mean. This dramatically improves episodic memory relevance without over-retrieving.

### 4\. Design explicit anti-dependency triggers

A user who messages every day, never references any real-world social connection, and shows declining affect trajectory is developing parasocial dependency. Your architecture has no signal for this. Add a dependency risk heuristic to the procedural store: session frequency, off-hours usage patterns, absence of social mentions, repeated explicit statements of "only the agent understands them." When threshold is crossed, the agent begins gently normalising human connection — not abruptly, over 3-5 sessions. This is your ethical moat.

### 5\. Design for graceful degradation

If Azure OpenAI is down, you fall back to GLM. If Groq is down, you fall back to Gemini. But what if all three fail simultaneously during a Tier 2 distress session? Your architecture currently returns nothing. The fix: a static, mode-aware response template store (separate from the Tier 3 crisis templates) that can handle Companion and Active Listener mode responses with zero LLM inference. Six templates per mode, randomly sampled with session-state conditioning. Not great — but better than silence.

Architecture change summary
---------------------------

Component

v1 status

v2 change

Priority

Longitudinal affect trajectory

Missing

Add 30-day EMA rolling affect store, slope detection

Add

Anti-sycophancy gate

Missing

Add to output safety pipeline

Add

Dual-signal memory retrieval

Topic-only cosine

Topic + affect cosine, harmonic mean scoring

Improve

Anti-dependency triggers

Missing

Procedural store heuristic, gradual response shaping

Add

Graceful degradation templates

Missing

Static mode-aware fallback template store

Add

LLM stack alignment

Gemini / Weaviate / AWS

Azure OpenAI / Qdrant / Railway / Vercel per actual stack

Align

Session continuity

Implicit, unspecified

Explicit session-resume protocol with Supabase session state

Add

Hallucination check

String matching

Semantic similarity embedding check in Phase 2

Improve

4-store memory

Solid

Extend to 5-store with longitudinal trajectory store

Extend

Safety tiers 0–4

Solid

Keep, add dependency risk as a Tier 0.5 signal

Keep +

EMA+Cap tone convergence

Solid

Keep, add agent-side tone monitoring

Keep +

Crisis bypass (Tier 3)

Correct

Keep exactly as designed

Keep

Complete refined pipeline — 11 layers. Click any layer to expand inputs, outputs, purpose, and research. New layers and changes from v1 are marked. Architecture is aligned to your actual stack: Azure OpenAI (primary), Groq (secondary tasks), Gemini (summaries), Qdrant (vectors), Supabase (relational), Railway (backend), Vercel (frontend).

The v2 memory system uses 5 stores — an extension of Tulving's (1972) episodic/semantic taxonomy, adding a longitudinal trajectory store that no existing companion AI architecture includes. Each store has a distinct write strategy, read strategy, and decay/retention policy. Click a store to see its full specification.

Select a memory store to see its full specification.

### Memory write lifecycle per session

**Session start:** Load working memory (initialise), pull semantic profile (always), pull procedural profile (always), load longitudinal trajectory (read-only).  
**Per turn:** Working memory accumulates. Affect vector appended to session affect array. Orchestrator reads all stores but writes nothing mid-session.  
**Session end (async job, non-blocking):**

1.  Summariser LLM (Gemini free) generates 80–120 token episodic summary → write to Qdrant
2.  Semantic extractor (Groq) identifies new facts (people, themes, preferences) → upsert Supabase
3.  Procedural EMA updater applies style delta within clinical floor constraints → upsert Redis
4.  Longitudinal trajectory updater appends session affect mean to 30-day rolling store → upsert Supabase
5.  PHQ-2 equivalent scored if session N mod 3 == 0 → insert outcomes table
6.  Working memory cleared

**Cost:** Session-end jobs use Gemini free API for summarisation (zero cost) and Groq for extraction (~0.2s, near-zero cost). Zero Azure tokens consumed post-session.

### Retrieval strategy v2 — dual-channel gate

**Problem with v1:** Single cosine threshold on topic embeddings. A user discussing exam stress won't surface the family pressure memory even if it's the most emotionally relevant context.

**v2 approach:**

1.  Compute topic similarity: cosine(current\_embedding, episodic\_embedding) — threshold 0.72
2.  Compute affect distance: euclidean distance in \[valence, arousal\] space — threshold 0.65 (inverse)
3.  Score = harmonic\_mean(topic\_sim, affect\_sim\_normalised)
4.  Retrieve top-2 episodic memories where score > 0.68 AND mode is appropriate

**Result:** The family pressure memory surfaces during exam stress if both the affect signature (high arousal, low valence) and partial topic overlap pass the harmonic filter.

**Implementation:** Qdrant's payload filter on `affect_vector` field stored alongside each episodic entry. No additional infrastructure required.

The v2 tone engine adds two mechanisms absent in v1: (1) agent-side tone monitoring — detecting when the agent's own tone is causing harm, and (2) a cultural frame selector tuned for Indian college contexts beyond Hindi-English code-mixing.

### 8-dimension style vector (live demo)

Formality (0=slang, 100=formal)30

Code-mix % (Hindi:English blend)55

Sentence length (0=short, 100=long)40

Warmth (0=neutral, 100=warm)70

Emoji use (0=none, 100=frequent)40

Directness (0=open, 100=direct)40

Humour tolerance50

Agent response preview (illustrative — based on 5 fixed style archetypes from the style vector)

### EMA convergence policy — v2

**Policy:** style\_new = α × session\_style + (1-α) × style\_stored, where α = 0.3 (recent sessions weighted, old decay). Cap constraint: no single dimension changes more than ±0.12 per session.

**Clinical floor:** Warmth ≥ 0.45, Harm-validation ≤ 0.0 (hard zero), Formality within \[0.05, 0.95\].

**New in v2 — agent-side tone monitor:** After response generation, a lightweight classifier checks the agent's own response for: sycophancy score, cheerfulness during low-valence context, clinical coldness during high-warmth expectation. If flagged, the response is regenerated with a corrective tone instruction before delivery. Adds ~80ms latency.

**Research:** Brandt & Wang (2025, arXiv:2510.00339) EMA+Cap hybrid — +62% persona stability, -17% synchrony loss. Perez et al. (2022) sycophancy mitigation.

### Cultural frame selector — Indian college context

Beyond Hindi-English code-mixing, the v2 system encodes four Indian college cultural frames as prompt context blocks — selected by user profile and region signals:

*   **IIT/NIT/BITS pressure frame:** JEE identity, rank anxiety, parental sacrifice narrative, peer comparison, depression masked as "I'm just tired."
*   **First-generation college frame:** Imposter syndrome, family financial pressure, inability to admit struggle to parents.
*   **Hostel isolation frame:** Homesickness, new city, foodscapes, late-night emotional peak times (11 PM–2 AM usage spike — your primary use window).
*   **Relationship/social frame:** Log kya kahenge, arranged marriage anxiety, relationship guilt, gender norms in engineering colleges.

**Implementation:** 4 static context blocks (~200 tokens each), selected by orchestrator based on user's semantic profile tags. No inference needed for selection.

The v2 safety architecture extends the 5-tier model with a new "Tier 0.5" dependency risk signal and strengthens the passive monitoring layer with longitudinal trajectory inputs. Crisis bypass is unchanged — it was correct in v1.

### Critical failure modes and mitigations

#### False negative: missed crisis signal

"Kal se college nahi jaaunga" may be hopelessness or a day off. Mitigation: rolling 5-turn window scoring, passive monitor runs independently of main classifier. Prefer over-triggering.

#### False positive: over-triggering

Repeated Tier 3 triggers when user is not in crisis destroys trust rapidly. Mitigation: measure false positive rate monthly. If >8% sessions trigger unnecessarily, recalibrate threshold upward 0.05.

#### Sycophancy spiral

Agent validates catastrophising, user goes deeper. Mitigation: agent-side tone monitor with sycophancy classifier. Flag and regenerate before delivery.

#### Parasocial dependency

User replaces all human connection with the agent. Mitigation: dependency risk signals in procedural store, gradual response shaping to normalise human connection over weeks.

#### Total LLM outage during distress

Azure + Groq + Gemini all down. User sees nothing during an elevated session. Mitigation: static mode-aware fallback templates, always available, no inference required.

#### Implicit ideation missed across turns

Hopelessness distributed across 10 sessions, no single turn triggers Tier 3. Mitigation: longitudinal trajectory store with slope detection over 30 days.

Non-negotiable infrastructure constraint

The Tier 3 bypass must be enforced at the request router level — not as a prompt instruction, not as application logic. Use a feature flag check in your FastAPI middleware before the LLM call is made. If urgency=3 is in session state, the LLM endpoint is never reached. The response is a Supabase table read. This is not a nice-to-have — it is the difference between "safe" and "dangerous."

You are on Railway (backend + Qdrant) and Vercel (frontend). This section respecifies the entire infrastructure for near-free tier — no AWS, no GCP, no Weaviate. Every decision optimised for the lowest possible cost without sacrificing reliability.

### Infrastructure map — actual stack v2

#### Frontend — Vercel

Free tier, auto-deploy from GitHub

*   React + TypeScript + Vite
*   WebSocket via Vercel Edge
*   Streaming response support
*   ₹0/month on Hobby plan

#### Backend — Railway

₹0–500/month (Hobby plan)

*   FastAPI + Python
*   Background workers (session-end jobs)
*   Redis (Railway plugin, 512MB free)
*   Websocket support

#### Database — Supabase

Free tier: 500MB + auth

*   Auth (email, phone OTP)
*   User profiles, semantic store
*   Outcomes tracking table
*   Session state, audit logs

#### Vector store — Qdrant

Railway plugin or Qdrant Cloud free

*   Episodic memory embeddings
*   Psychoeducation KB embeddings
*   Qdrant Cloud: 1GB free tier
*   Local Railway: 0 extra cost

#### LLM primary — Azure OpenAI

Your existing credits

*   GPT-4o for main response gen
*   Temperature: mode-dependent
*   Streaming enabled
*   Fallback: GLM (free tier)

#### LLM secondary — Groq

Free tier: 14,400 req/day

*   Signal extraction (Llama 3.1 8B)
*   Semantic fact extraction
*   Anti-sycophancy classifier
*   Fallback: Gemini free

#### LLM summariser — Gemini

Free tier: 1M tokens/day

*   Session-end summarisation
*   Episodic memory generation
*   Async, non-blocking
*   Fallback: Groq

#### Embeddings — local

Zero cost

*   all-MiniLM-L6-v2 (384-dim)
*   Run on Railway CPU
*   sentence-transformers
*   ~15ms per embedding

#### Monitoring — free tools

₹0

*   Railway built-in logs
*   Sentry free tier (5K errors)
*   Posthog free (1M events)
*   Uptime: BetterStack free

### Architecture decisions for free-tier constraints

**1\. Session-end jobs are async and non-blocking.** Summarisation, semantic extraction, profile updates — none of these block the response delivery. They run as background tasks in FastAPI after the session ends. The user never waits for memory writes.

**2\. Embeddings run locally on Railway.** Using `sentence-transformers` with `all-MiniLM-L6-v2` on Railway's CPU, embeddings cost ₹0 and take ~15ms. Pre-compute and cache session embeddings in Redis so you never embed the same text twice.

**3\. Signal extraction uses Groq, not Azure.** Running IndicBERT signal extraction via Groq (Llama 3.1 8B) saves Azure credits for response generation — your primary value-add. Groq's free tier handles 14,400 requests/day, sufficient for MVP.

**4\. Qdrant on Railway plugin.** No managed Qdrant Cloud needed at MVP scale. Railway's Qdrant plugin runs in your existing Railway project at zero additional cost. Migrate to Qdrant Cloud free tier (1GB) when you exceed Railway storage limits.

**5\. Context window budget discipline.** Every Azure token is precious. Target 8,000 tokens per call maximum: 2,000 system + tone + cultural frame, 1,000 memory injection (2 episodic summaries max), 4,000 session history (recency-weighted sliding window), 1,000 response budget. Run a token counter before every call and truncate if over.

**6\. Rate limiting prevents credit burn.** FastAPI middleware: max 20 messages/user/day at MVP. Alert at 80% of Azure credit burn rate. Automatic fallback to GLM if Azure credits drop below 20% threshold.

Railway free tier caveat

Railway's Hobby plan ($5/month, not truly free) sleeps inactive services after inactivity. For a mental health companion, the 11 PM–2 AM usage spike matters. Ensure your Railway service has "Always On" enabled or pre-warm via a cron ping. A sleeping backend during a distress session is a safety risk.

Realistic cost estimates aligned to your actual stack (Railway + Vercel + Supabase + Qdrant + Azure OpenAI + Groq free + Gemini free). These are not AWS numbers. Every assumption is stated.

### Phase 1 — MVP (0–500 DAU, months 1–6)

Assumptions: 500 DAU, 8 messages/session avg, 1 session/user/day, 400 tokens/message Azure call, 60% Azure primary usage

Component

Notes

Monthly (INR)

Railway (backend + Redis + Qdrant)

Hobby plan $5/month

₹420

Supabase

Free tier (500MB DB + auth)

₹0

Vercel

Free tier (Hobby)

₹0

Azure OpenAI (GPT-4o)

500 DAU × 8 msg × 400 tok × 30d, 60% sessions = 28.8M tokens/month

₹8,000–12,000

Groq (signal extraction + classification)

Free tier sufficient at this scale (14,400 req/day)

₹0

Gemini (summarisation)

Free tier: 1M tokens/day — sufficient

₹0

Local embeddings (Railway CPU)

Included in Railway plan

₹0

Monitoring (Sentry + Posthog + BetterStack)

Free tiers

₹0

Domain + SSL

One-time or ₹800/year

₹70

Total (Phase 1)

₹8,500–12,500

_With Azure credits (student/startup grant)_

₹500–1,000

### Phase 2 — Early growth (500–5K DAU, months 6–18)

Assumptions: 3,000 DAU, Azure credits partially exhausted, Groq Pro needed

Component

Notes

Monthly (INR)

Railway Pro plan

$20/month, increased resources

₹1,680

Supabase Pro

$25/month at 8GB+ DB

₹2,100

Qdrant Cloud

Migrate from Railway, 4GB tier ~$30/month

₹2,500

Azure OpenAI (GPT-4o)

3K DAU × 8 msg × 400 tok × 30d, mix with fallbacks

₹45,000–60,000

Groq Pro

$9/month for higher limits

₹760

Gemini

Still free tier sufficient

₹0

Clinical advisor retainer (1 psychologist)

Safety review, red team, content review

₹25,000

Monitoring tools

Sentry Team ~₹1,500

₹1,500

Total (Phase 2)

₹78,000–95,000

### Cost reduction levers

**Prompt caching:** Azure OpenAI supports prefix caching for repeated system prompts. Your system identity block (~1,500 tokens) is identical for every user. Enable caching — saves 30-40% of token cost on long sessions.

**Fallback routing:** Route Companion mode (lowest stakes, lowest affect) to GLM free first. Reserve Azure GPT-4o for Active Listener and Tier 2 sessions. Saves ~40% of Azure spend.

**Context compression:** At session turn 15+, compress older turns using Groq (free) into a 200-token "session so far" block. Prevents context window bloat on long sessions.

**IIT partnerships:** IIT/NIT campus partnerships bring B2B revenue that subsidises free access for students. Target 5–10 campus counselling centre partnerships by month 12. Revenue offsets clinical advisor cost entirely.

A build order that respects your constraint: solo founder, near-zero budget, IIT Dhanbad semester schedule. Not everything at once — the right things in the right order.

### Month 1–2: Foundation (must be perfect before anything else)

*   Auth (Supabase) → profile creation → basic chat UI (React)
*   FastAPI backend with session management and Redis working memory
*   Azure OpenAI integration with streaming + fallback to GLM
*   Tier 3 crisis bypass — hardcoded templates, middleware-level bypass (non-negotiable, ship this before any public access)
*   PII stripping at input ingestion (also non-negotiable — DPDP)
*   Basic tone matching — formality + code-mix only (2 dimensions, not 8)
*   Working memory (session transcript, no persistence yet)
*   **Do not ship to public until Tier 3 bypass is verified.** Manual test it with 20 explicit crisis inputs.

### Month 3–4: Memory & Safety

*   Qdrant episodic memory — session summariser (Gemini free API)
*   Supabase semantic profile — basic facts (name, college, recurring themes)
*   Signal extraction via Groq — affect vector (valence/arousal), urgency score
*   Tier 0 passive monitoring and Tier 1 mode switch to Active Listener
*   Dual-channel memory retrieval (topic + affect cosine)
*   Pre-launch red-team (5 psychology friends minimum, 50 scenarios)

### Month 5–6: Persona & Polish

*   Full 8-dimension tone vector with EMA+Cap convergence
*   Procedural memory store — what the user deflects, engages with, prefers
*   Cultural frame selector (4 frames for Indian college context)
*   Anti-sycophancy gate in output layer
*   Graceful degradation templates (static fallbacks for all modes)
*   Session-resume protocol — user resumes 3 days later, agent remembers
*   Soft public beta — invite-only, 50 users, IIT Dhanbad campus first

### Month 7–12: Scale & Differentiate

*   Longitudinal affect trajectory store — 30-day EMA, slope detection
*   Anti-dependency triggers in procedural store
*   Psychoeducation mode — requires clinical KB built in parallel (start month 3)
*   Outcomes tracking — PHQ-2 naturalised into closing conversation
*   IIT campus counsellor partnership — anonymised alert dashboard
*   NASSCOM AI startup programme — apply for compute grants
*   First fine-tuning run on your own conversation data (Groq/Gemini zero-shot for annotation)

The single most important build decision

Ship with two modes done exceptionally well — Companion and Active Listener. Not five modes done adequately. Your first 100 users will tell 100 other people based on sessions 1–3. A companion that genuinely mirrors their language, remembers their name from last week, and doesn't feel like a form — that is your moat. The clinical sophistication is real but invisible. The felt experience in the first session is the product.

const LAYERS = \[ { id:"input", title:"User input ingestion", color:"var(--surface3)", dot:"var(--ink3)", badge:null, badgeType:null, isNew:false, sub:"UTF-8 normalisation · PII strip · session attachment · <5ms", chips:\["Raw text", "Timestamp", "Session ID", "Device locale", "Language hint"\], newChips:\[\], input:\["Raw message string", "Session context token (from Redis)", "User ID (hashed)", "Timestamp", "Client device locale"\], output:\["Normalised Unicode text (Devanagari + Latin safe)", "Language hint flag (hi/en/hinglish)", "Session metadata object", "PII-stripped string for logs"\], purpose:"The first and most underspecified layer in most architectures. Three things happen here that cannot be deferred. (1) PII stripping: phone numbers, Aadhaar-pattern strings, email addresses, college-specific identifiers — stripped from raw text before any log is written. DPDP compliance starts here. (2) Unicode normalisation: essential for code-mixed text — 'नमस्ते friends' contains two scripts and requires NFC normalisation before any tokenisation. (3) Session attachment: the incoming message is linked to the Redis session object, which carries conversation mode, turn count, and affect history. This linkage happens before any ML inference.", research:"Unicode NFC normalisation for Indic-Latin scripts: critical for tokeniser stability (Kunchukuttan et al., 2018, LREC, IITB parallel corpus). DPDP Act 2023 (India): Section 4 — personal data must be processed only for specified purpose; raw logs with PII are a violation.", critique:"The easiest layer to underspec. Most teams write PII stripping as a post-processing step. It must be the first operation. A phone number in a raw FastAPI access log is a DPDP violation that triggers mandatory disclosure.", improvement:"v2 addition: a locale-detection check that identifies if the user is typing in a regional Indian language (Bengali, Tamil, Marathi) — flag for escalation to a human rather than attempting to process with Hindi-English trained models." }, { id:"signal", title:"Signal extraction", color:"var(--purple-bg)", dot:"var(--purple)", badge:null, badgeType:null, isNew:false, sub:"Groq (Llama 3.1 8B) · affect vector · urgency cascade · <100ms", chips:\["Affect vector \[V,A,D\]", "Urgency 0–3", "Language register", "Code-mix ratio", "Arousal/valence", "Longitudinal flag"\], newChips:\["Longitudinal flag"\], input:\["Normalised text string", "Prior turn affect (rolling 5-turn window)", "User baseline affect (from semantic store)", "30-day affect trajectory (from longitudinal store — new)"\], output:\["Affect vector \[valence, arousal, dominance\]", "Urgency score 0–3", "Register: formal/semi/casual/slang", "Hindi:English token ratio", "Longitudinal risk flag (boolean — new)"\], purpose:"The perceptual layer of the system. Three classifiers run in sequence (urgency first — if score=3, pipeline is bypassed). In v2, this layer runs via Groq (Llama 3.1 8B, structured output) rather than a locally-hosted IndicBERT, for two reasons: (1) Railway CPU is not optimal for BERT inference at <100ms, (2) Groq's free tier (14,400 req/day) is sufficient for MVP scale. The trade-off: Groq adds network latency vs local inference. Mitigation: parallelize signal extraction with session state retrieval — both start simultaneously. New in v2: the longitudinal risk flag is computed by comparing the current session's expected affect baseline (from the trajectory store) against the current affect vector. A user whose 30-day baseline is valence=0.7 and today's session opens at valence=0.2 is flagged, even if no single message is acute.", research:"MuRIL (Khanuja et al., 2021, arXiv:2103.10730) — 17 Indian languages. Russell circumplex affect model (1980, Psychological Review). HOPE corpus (Malhotra et al., 2022, NAACL) for fine-tuning. Longitudinal linguistic risk: Reece & Danforth (2017, EPJ Data Science).", critique:"Groq with Llama 3.1 8B for affect classification is an architectural trade-off from v1's IndicBERT. Llama 3.1 8B is not fine-tuned for Indian code-mixed mental health text. This is your Phase 2 fine-tuning priority — collect labelled distress signals from real sessions (with consent) and fine-tune.", improvement:"v2 adds the longitudinal risk flag — a session-opening signal that says 'this user is worse than their recent baseline, even before they've said anything alarming.' This is a significant clinical addition." }, { id:"crisis", title:"Crisis bypass (Tier 3)", color:"var(--red-bg)", dot:"var(--red)", badge:"safety bypass", badgeType:"danger", isNew:false, sub:"Urgency=3 trigger · fixed templates · no generative output · audit log", chips:\["Score=3 trigger", "Hard middleware bypass", "Fixed template retrieval", "iCall: 9152987821", "Audit log entry"\], newChips:\[\], input:\["Urgency score = 3", "Crisis signal flags (explicit or implicit)", "User ID for escalation log"\], output:\["Fixed, clinician-reviewed crisis response", "iCall: 9152987821", "Vandrevala Foundation: 1860-2662-345", "Mandatory audit log entry", "Counsellor alert (if partnership active)"\], purpose:"When urgency = 3, the LLM is never called. This constraint is enforced in FastAPI middleware — not in the prompt, not in application logic, but before the route handler is reached. The response is a Supabase row read. The template store has 5 language variants (English, Hindi, Hinglish-casual, Hinglish-formal, and a neutral fallback). The variant is selected by the user's current code-mix ratio. Template content: validation of experience, statement of presence, two crisis numbers, one question ('Abhi kya tum safe ho?'). Nothing else. Template governance: 2 clinical approvals required to modify, version-controlled in Supabase with change history.", research:"WHO Safe Messaging Guidelines (2019). NIMH suicide prevention communication (2023). iCall clinical protocols (TISS, Mumbai). Nock et al. (2008, Annual Review of Clinical Psychology) — suicide risk assessment principles. Gulliver et al. (2010, BMC Psychiatry) — resource uptake depends on framing.", critique:"Implicit crisis detection is the weakest point. 'Kal se college nahi jaaunga' and 'I'm done' require context to distinguish hopelessness from fatigue. The passive monitor (Tier 0) adds a safety net, but false negatives exist. Over-triggering is preferable to under-triggering.", improvement:"v2 adds 5 language variants to the template store. v1 had only one template. A user who communicates exclusively in Hinglish should not receive a formal English crisis response — it breaks the emotional connection at the worst moment." }, { id:"orchestrator", title:"State orchestrator", color:"var(--teal-bg)", dot:"var(--teal)", badge:null, badgeType:null, isNew:false, sub:"Mode selection · persona calibration · memory gate · anti-dependency signal", chips:\["6 conversation modes", "Mode transition damping", "Memory gate 0.68", "Anti-dependency flag", "Turn budget", "Cultural frame select"\], newChips:\["Anti-dependency flag", "Cultural frame select"\], input:\["Affect vector (current)", "Urgency score 1 or 2", "Affect history (session)", "Longitudinal risk flag", "Procedural profile", "Dependency risk signals", "Current mode", "Turn count"\], output:\["Selected conversation mode", "Tone parameters (8-D vector)", "Memory retrieval instruction", "Max response length", "Cultural frame ID", "Dependency warning flag", "Mode transition flag"\], purpose:"The orchestrator makes 4 decisions per turn: mode, tone, memory gate, cultural frame. Mode selection is probabilistic, not a rigid state machine — a single funny message from a distressed user does not immediately flip modes. Transitions are damped: minimum 2-turn hold before any mode change. The 6 modes (v2 adds one): Companion (default), Active Listener (distress, MI-based), Psychoeducation (user asks 'why'), Skill Coach (CBT/breathing), Referral Bridge (warm handoff), Recovery Check (new — for users returning after a difficult session). Cultural frame selection uses the user's semantic profile tags (IIT pressure, first-gen college, hostel isolation, relationship social) to select the appropriate cultural context block. Anti-dependency flag: if the procedural store has flagged dependency risk, the orchestrator shifts the Companion mode response toward more social connection normalisation, gradually over sessions.", research:"Motivational Interviewing OARS: Miller & Rollnick (2013). Communication Accommodation Theory: Giles (1973, updated 2016). Soft mode transitions: Hoegen et al. (2019, ACM IVA). Recovery Check mode informed by: Post-crisis follow-up protocols, TISS iCall guidelines.", critique:"The orchestrator still has no signal for 'user is deliberately testing the system.' Add engagement authenticity signals in the procedural store: response timing variance, topic-jump frequency, message length distribution. Anomalous patterns get a softer, less escalating response.", improvement:"v2 adds Recovery Check mode (returning after a Tier 2+ session) and anti-dependency flag routing. The cultural frame selector is new — removes the need to include all 4 cultural context blocks in every prompt, saving ~600 tokens per call." }, { id:"memory", title:"Memory retrieval", color:"var(--blue-bg)", dot:"var(--blue)", badge:null, badgeType:null, isNew:false, sub:"5-store model · dual-channel retrieval · context-gated · Qdrant + Supabase", chips:\["Working (Redis)", "Episodic (Qdrant)", "Semantic (Supabase)", "Procedural (Redis)", "Longitudinal (Supabase)", "Dual-channel gate 0.68"\], newChips:\["Longitudinal (Supabase)", "Dual-channel gate 0.68"\], input:\["Current message embedding (local MiniLM)", "Session topic embedding", "Session affect vector", "Mode flag", "Memory gate open/closed", "User ID"\], output:\["0–2 episodic summaries (dual-channel retrieval)", "Semantic profile facts (always available)", "Procedural parameters (always available)", "Longitudinal trajectory summary (if slope detected)", "Memory injection string (natural language)"\], purpose:"Memory retrieval uses the dual-channel gate — topic cosine similarity AND affect distance in Russell space, combined via harmonic mean. Threshold 0.68 (vs v1's 0.82 single-channel). This surfaces emotionally relevant memories that are topically dissimilar — e.g., family pressure memory during exam stress session. The longitudinal store is new: if the slope detector has flagged deterioration, a brief summary ('You've seemed more burdened in recent sessions') is available as a careful, non-alarming injection. The injection is optional — the orchestrator decides whether to surface it based on mode and current affect. Memory is NEVER volunteered to show off recall. It deepens understanding only.", research:"Tulving (1972) — episodic/semantic taxonomy. LAMP personalisation framework (Salemi et al., 2024, EMNLP). Tell Me system (arXiv:2511.14445) — RAG-based long-term grounding in mental health dialogue. Reece & Danforth (2017) — longitudinal trajectory signals.", critique:"The longitudinal trajectory injection must be handled with extreme care. A user who is already distressed does not need to hear 'you've been getting worse recently.' The orchestrator must gate this to: mode = Active Listener only, urgency < 2, and phrase it as 'I've noticed you seem like you've been carrying a lot lately' — not a report card.", improvement:"v2 extends to 5 stores, adds dual-channel retrieval, and adds the longitudinal trajectory store. The retrieval threshold is lowered from 0.82 to 0.68 with the harmonic filter, increasing recall without proportionally increasing false positives." }, { id:"prompt", title:"Dynamic prompt construction", color:"var(--coral-bg)", dot:"var(--coral)", badge:null, badgeType:null, isNew:false, sub:"7 blocks · token budget enforced · cultural frame · anti-sycophancy instruction", chips:\["System identity", "Tone template", "Memory injection", "Cultural frame", "Mode instruction", "Anti-sycophancy frame", "KB RAG (psychoeducation only)"\], newChips:\["Anti-sycophancy frame"\], input:\["Selected mode", "Tone parameters (8-D vector)", "Retrieved memories (0–2)", "Semantic profile facts", "Cultural frame ID", "Anti-dependency flag", "Working memory (session history)", "Token budget remaining"\], output:\["Fully constructed prompt string", "Token count", "Mode flag", "Prompt version hash (audit)"\], purpose:"7 blocks assembled dynamically with hard token budgets. Block 1 — System identity (~600 tokens): who the agent is, clinical boundaries, safety commitments. Never changes within a version. Block 2 — Tone template (~150 tokens): '55% Hindi tokens, casual-warm, sentences under 10 words, emoji occasionally.' Block 3 — Memory injection (~200 tokens max, 2 summaries of 80–100 tokens each): natural language, not a data dump. Block 4 — Cultural frame (~200 tokens): selected single frame from 4 options. Block 5 — Mode instruction (~250 tokens): what to do and what NOT to do in this mode. Block 6 — Anti-sycophancy frame (new, ~100 tokens): 'Do not validate cognitive distortions. Reflect emotions without amplifying catastrophising. If the user says everything is hopeless, validate the feeling without affirming the belief.' Block 7 — Working memory: remaining budget (~4,000–6,000 tokens), recency-weighted sliding window, preserving first 2 turns (scene-setting) and last 8 turns.", research:"MIND-SAFE prompt framework (Boit & Patil, 2025, JMIR). RAG for factuality: Mentalic Net (arXiv:2509.04456) — BERTScore 0.898 with RAG vs 0.71 without. Sycophancy mitigation framing: Perez et al. (2022).", critique:"Context window pressure is the primary engineering challenge. At 7 blocks + session history, calls can reach 12,000 tokens on long sessions. Budget discipline is mandatory — monitor average token count per call in Posthog, alert if >9,000 tokens/call.", improvement:"v2 adds anti-sycophancy frame (Block 6) and enforces cultural frame as a single selected block rather than including all 4 contexts. Net saving: ~450 tokens per call vs v1." }, { id:"llm", title:"LLM inference core", color:"var(--amber-bg)", dot:"var(--amber)", badge:null, badgeType:null, isNew:false, sub:"Azure OpenAI GPT-4o (primary) · GLM (fallback) · streaming · mode-tuned temperature", chips:\["Azure GPT-4o primary", "GLM fallback", "Temperature: mode-dependent", "Max tokens: 180/280", "Streaming"\], newChips:\[\], input:\["Fully constructed prompt", "Temperature (mode-dependent)", "Max token budget", "Stop sequences"\], output:\["Raw generated text (streaming)", "Token usage (cost tracking)", "Finish reason"\], purpose:"Azure OpenAI GPT-4o as primary — your existing credits cover Phase 1 at no additional cost. Temperature is mode-dependent: Companion 0.85 (warmer, spontaneous), Active Listener 0.65 (controlled, lower hallucination risk), Skill Coach 0.55 (precise). Max tokens: 180 in Companion and Active Listener (shorter feels more natural in peer conversation), 280 in Psychoeducation and Skill Coach. GLM fallback: when Azure credits < 20% threshold or rate limit hit. GLM-4-Flash is free tier, handles Companion mode well, but is weaker on Hinglish nuance. For Tier 1+ distress sessions: always use Azure, never GLM. This is a hard routing rule — distress sessions must get the best available model. Groq (Llama 3.3 70B) as second fallback when Azure is down and distress session is active.", research:"GPT-4o technical report (OpenAI, 2024). LoRA fine-tuning pathway: Hu et al. (2022, ICLR). Empathic response quality: Sharma et al. (2023, Nature Machine Intelligence) — fine-tuned models improve empathic rewriting by 19% over prompted frontier models.", critique:"GLM fallback during distress sessions is the primary failure mode. The routing rule (never GLM for urgency > 0) must be enforced in the fallback logic, not as a prompt instruction. Write a unit test for this before shipping.", improvement:"v2 explicit routing: urgency > 0 → Azure primary → Groq 70B secondary → static template fallback. GLM only for urgency = 0 (Companion mode, routine sessions)." }, { id:"safety\_gate", title:"Output safety gate", color:"var(--red-bg)", dot:"var(--red)", badge:null, badgeType:null, isNew:false, sub:"5 checks · harm classifier · sycophancy classifier · tone conformance · DPDP audit", chips:\["Harm classifier", "Sycophancy classifier", "Semantic hallucination check", "Tone conformance", "Length check", "DPDP audit log"\], newChips:\["Sycophancy classifier", "Semantic hallucination check"\], input:\["Raw LLM output", "Mode flag", "KB embeddings (for semantic hallucination check)", "Tone template", "Session urgency score"\], output:\["Approved response OR retry signal", "Harm flag", "Sycophancy flag", "Conformance score", "Encrypted audit log entry"\], purpose:"5 checks run in sequence before any response reaches the user. Check 1 — Harm classifier: IndicBERT-based (via Groq), scores for self-harm facilitation, diagnostic overreach, safe-messaging violations. Flag → discard, regenerate with lower temperature. Max 2 retries, then static fallback. Check 2 — Sycophancy classifier (new): lightweight classifier detecting validation of cognitive distortions, catastrophising amplification, excessive agreement with self-critical statements. Flag → regenerate with anti-sycophancy instruction. Check 3 — Semantic hallucination check (v2 upgrade from string matching): embed any factual claim in psychoeducation mode, compute cosine distance to nearest KB embedding. If distance > 0.35, regenerate with stay-in-KB instruction. Check 4 — Tone conformance: rule-based scorer verifying formality level, code-mix ratio, sentence length against tone template. Check 5 — Length check: enforce max token budget by mode.", research:"RACLETTE system (arXiv:2412.20068) — emotion marker tracking for therapeutic response quality. Sycophancy classification: Perez et al. (2022). Hallucination detection via semantic similarity: established in RAG literature, Robertson et al. (2023).", critique:"Check 2 (sycophancy) adds latency. Groq inference for a secondary classification adds ~150ms. This is acceptable — the output safety gate is already post-generation, so latency here is hidden behind the user's reading time. Do not skip this check to save latency.", improvement:"v2 upgrades the hallucination check from string matching to semantic similarity — the single most impactful safety improvement for the psychoeducation mode. v2 adds the sycophancy classifier as a first-class safety check." }, { id:"delivery", title:"Response delivery + memory write-back", color:"var(--green-bg)", dot:"var(--green)", badge:null, badgeType:null, isNew:false, sub:"Streaming delivery · async write-back · longitudinal update · PHQ-2 tracker", chips:\["Streamed delivery", "Session summariser (Gemini free)", "Episodic write (Qdrant)", "Semantic update (Supabase)", "Longitudinal update (Supabase)", "PHQ-2 session 3 mod"\], newChips:\["Longitudinal update (Supabase)"\], input:\["Approved response string", "Full session transcript (at session end)", "Current semantic profile", "Procedural parameters", "Session affect array", "Session number"\], output:\["Delivered response (streaming, WebSocket)", "Episodic summary → Qdrant (async, session end)", "Updated semantic profile → Supabase (async)", "Updated procedural parameters → Redis (async)", "Affect mean for session → longitudinal store (async)", "PHQ-2 score → outcomes table (every 3rd session)"\], purpose:"Streaming delivery via WebSocket. The user sees tokens as they arrive — latency is perceived as 'thinking,' which is appropriate for a companion. All memory writes are async background tasks — they start after response delivery and never block the next user turn. Session summariser: Gemini free API (1M tokens/day) generates the 80–120 token episodic memory string. Target: emotional arc, key disclosures, named entities, techniques used, ending affect state. Semantic extractor: Groq (Llama 3.1 8B) extracts new facts for the semantic profile. Longitudinal update (new): session affect mean \[valence, arousal\] appended to the 30-day rolling store in Supabase. After 30 entries, the oldest drops. Slope detector runs on write — if the last 7-session slope on valence is negative and significant (>0.15 drop), set longitudinal\_risk\_flag=True for next session's signal extraction.", research:"Session summarisation: Tell Me system (arXiv:2511.14445). PHQ-2 Hindi validation: Patel et al. (2008, British Journal of Psychiatry). Woebot RCT: Fitzpatrick et al. (2017, JMIR Mental Health). Longitudinal trajectory: Reece & Danforth (2017).", critique:"The longitudinal slope detection threshold (0.15 drop over 7 sessions) is a starting value. Validate this against clinical annotator judgement in the first 3 months of data. Too sensitive → false positives in users having a normal bad week. Too insensitive → misses genuine deterioration.", improvement:"v2 adds the longitudinal store write and slope detection as a session-end background task. Cost: one Supabase upsert + one lightweight computation. Zero additional LLM cost." } \]; const MEMORY\_STORES = \[ { id:"working", title:"Working memory", sub:"Redis · session-scoped · clears on close", color:"purple", detail:\`<strong>What it holds:</strong> The live session transcript — every user turn and agent response in chronological order. Session metadata: current mode, turn count, affect history array, urgency history array.<br><br> <strong>Write:</strong> Every turn, synchronously. FastAPI appends to a Redis list keyed by session\_id.<br> <strong>Read:</strong> Every turn — the full transcript is injected into the prompt as Block 7 (working memory block), with recency-weighted truncation at turn 15+.<br> <strong>Retention:</strong> Cleared at session close (TTL = 4 hours from last activity, then auto-purge).<br> <strong>v2 change:</strong> Stores the full affect array for the session \[v\_t, a\_t for each turn t\], not just the current affect. Used by signal extraction for the 5-turn rolling window and by the delivery layer for longitudinal trajectory update.<br> <strong>Implementation:</strong> Redis RPUSH + LRANGE. At turn 15+, use LRANGE with recency-weighted selection: first 2 turns always included (scene-setting), turns 3–N sliding window.\` }, { id:"episodic", title:"Episodic memory", sub:"Qdrant · cross-session · dual-channel retrieval", color:"blue", detail:\`<strong>What it holds:</strong> LLM-generated summaries of past sessions. Each entry: ~100 tokens covering emotional arc, key disclosures, named people, techniques used, session ending affect, session date (relative).<br><br> <strong>Write:</strong> Async background task at session end. Gemini free API generates the summary from the full session transcript. Embedded with local MiniLM (384-dim), stored in Qdrant with payload: {user\_id, session\_date, affect\_mean: \[v, a\], topic\_keywords}.<br> <strong>Read:</strong> Dual-channel retrieval — topic cosine + affect distance harmonic mean, threshold 0.68. Top 2 results returned. Gate: only open if mode is appropriate and memory gate flag is True (from orchestrator).<br> <strong>Retention:</strong> No auto-deletion. Oldest summaries downweighted by date decay (not removed). At 50 sessions per user, summaries older than 6 months are compressed into a single "history summary" entry.<br> <strong>v2 change:</strong> Dual-channel retrieval (topic + affect cosine). V1 used topic-only. The affect\_mean payload field enables Qdrant's filter-then-rank capability for affect-distance scoring.\` }, { id:"semantic", title:"Semantic memory", sub:"Supabase · persistent · always available", color:"teal", detail:\`<strong>What it holds:</strong> The user profile. Structured facts: name (if shared), college, hostel/city, recurring themes (family pressure, academic anxiety, relationship issues), relationship map (named people mentioned and context), language baseline (code-mix ratio mean, formality mean), cultural frame tag, comfort/discomfort topics.<br><br> <strong>Write:</strong> Async background task at session end. Groq (Llama 3.1 8B structured output) extracts new facts from the session transcript. Upserted into Supabase <code>user\_profiles</code> table. New facts are added; existing facts are not overwritten without confirmation logic.<br> <strong>Read:</strong> At session start — always loaded, always available to orchestrator. Never gated. Injected into every prompt as part of Block 3 (condensed to ~100 tokens).<br> <strong>Retention:</strong> Persistent, user-owned. GDPR/DPDP right-to-erasure: a DELETE on the Supabase row removes all semantic memory.<br> <strong>v2 change:</strong> Adds cultural frame tag field — a single label (iit\_pressure, first\_gen, hostel\_isolation, social\_relationship) that drives the orchestrator's cultural frame selection without requiring LLM inference.\` }, { id:"procedural", title:"Procedural memory", sub:"Redis · EMA+Cap convergence · clinical floor", color:"amber", detail:\`<strong>What it holds:</strong> Learned interaction patterns. The 8-D style vector (current values), deflection signals (topics the user consistently avoids), engagement signals (topics/formats the user responds well to), response length preference, dependency risk counter, session frequency pattern.<br><br> <strong>Write:</strong> EMA convergence at session end. style\_new = 0.3 × session\_style + 0.7 × style\_stored. Cap: no dimension changes >0.12 per session. Clinical floor enforced on write: warmth ≥ 0.45, harm-validation = 0.0. Dependency risk counter incremented/decremented based on session signals.<br> <strong>Read:</strong> At session start — always loaded. Tone parameters passed directly to orchestrator and prompt builder. Dependency counter checked by orchestrator for anti-dependency routing.<br> <strong>Retention:</strong> Redis with no TTL (persistent). Backed up to Supabase nightly.<br> <strong>v2 change:</strong> Adds dependency risk counter and session frequency pattern to the procedural store. These are new signals for the orchestrator's anti-dependency routing.\` }, { id:"longitudinal", title:"Longitudinal trajectory", sub:"Supabase · 30-day rolling · slope detection", color:"coral", detail:\`<strong>What it holds:</strong> A 30-entry rolling array of per-session affect means \[valence\_mean, arousal\_mean\] for the last 30 sessions. Session dates. PHQ-2 equivalent scores (every 3rd session).<br><br> <strong>Write:</strong> Async at session end. One Supabase upsert appending \[session\_date, valence\_mean, arousal\_mean\] to the JSONB array. If array length > 30, oldest entry dropped. After write: slope detector runs (lightweight computation — linear regression on last 7 valence values). If slope < -0.022/session (7-session drop of >0.15), set longitudinal\_risk\_flag=True in the user's Supabase row.<br> <strong>Read:</strong> At session start — longitudinal\_risk\_flag read synchronously. If True, passed to signal extraction layer as an additional risk signal. Full trajectory available to clinical dashboard (counsellor view) if partnership active.<br> <strong>Retention:</strong> Rolling 30 sessions. PHQ-2 scores retained permanently for outcomes research (anonymised).<br> <strong>v2 addition:</strong> This store does not exist in v1. It is the most clinically significant addition — detecting slow-burn deterioration that no single session's urgency score catches. Implementation cost: one Supabase column, one lightweight background computation.\` } \]; const TIERS = \[ { num:"0", title:"Passive monitoring — every turn", dot:"var(--blue)", bg:"var(--blue-bg)", body:\`<strong>Trigger:</strong> Every message, independent of main classifier.<br><br> <strong>Watches:</strong> Hopelessness language across turns, sudden topic shutdown, farewell patterns, requests for context-free information (bridge heights, medication doses, "how many Crocin to die"), drastic mood shifts, extended silence after high-distress turns, departure from baseline language register.<br><br> <strong>New in v2:</strong> Reads the longitudinal\_risk\_flag at session start. If True, the passive monitor's urgency scoring threshold is lowered by 0.15 — a user who is already on a downward trajectory needs a more sensitive net.<br><br> <strong>Action:</strong> Adjusts urgency score upward independently. This is the safety net for signals distributed across turns rather than concentrated in one message.<br><br> <strong>Research:</strong> Coppersmith et al. (2015, CLPsych) — longitudinal linguistic markers. Nock et al. (2008, Annual Review).\` }, { num:"0.5", title:"Dependency risk — new in v2", dot:"var(--purple)", bg:"var(--purple-bg)", body:\`<strong>Trigger:</strong> Procedural store dependency risk counter > threshold (sessions/week ≥ 7 for 3+ weeks, AND no social connection mentions in last 10 sessions, AND self-rated affect improving only when agent is present).<br><br> <strong>Action:</strong> No visible change to the user. Orchestrator receives dependency\_flag=True. Over the next 3–5 sessions, the Companion mode response is shaped to: (1) more frequently reference the value of human connection, (2) gently ask about real-world relationships, (3) celebrate any mention of a friend, family interaction, or social event. Not abruptly — across sessions, barely perceptibly.<br><br> <strong>Why this matters:</strong> A companion AI that becomes someone's sole emotional outlet is a clinical liability and an ethical failure. The agent's job is to be a zeroth layer — a bridge, not a destination.<br><br> <strong>Non-negotiable:</strong> The dependency flag never triggers Tier 3 protocol. It only shapes Companion mode responses. It does not surface to the user as a warning or restriction.\` }, { num:"1", title:"Elevated distress — score 1–2", dot:"var(--amber)", bg:"var(--amber-bg)", body:\`<strong>Trigger:</strong> Urgency ≥ 1 sustained 2+ consecutive turns, OR single turn urgency = 2.<br><br> <strong>Mode shift:</strong> Immediate switch to Active Listener. No humour, no reframing, no techniques. Pure reflection and presence. Response length max 2 sentences.<br><br> <strong>Soft check-in:</strong> After 2 Active Listener turns — 'Yeh sun ke lagta hai tum abhi bahut mushkil jagah par ho. Kya thoda aur batana chahoge?' No resources yet — forcing resources prematurely reduces uptake (Gulliver et al., 2010).<br><br> <strong>New in v2:</strong> If longitudinal\_risk\_flag is True, the mode shift to Active Listener happens at urgency ≥ 0.8 (lower threshold) — a user on a downward trajectory needs earlier support activation.<br><br> <strong>Non-negotiable:</strong> GLM fallback is not used at Tier 1+. Azure primary, then Groq 70B. Never GLM during elevated distress.\` }, { num:"2", title:"Acute distress — persistent Tier 1", dot:"var(--coral)", bg:"var(--coral-bg)", body:\`<strong>Trigger:</strong> 3+ consecutive turns urgency ≥ 2, OR composite score 2.5 (passive monitor + main classifier combined).<br><br> <strong>Action:</strong> Agent introduces professional support — as care, not dismissal. 'Main yahan hun. Lekin ek aisa insaan bhi hai jo exactly iske liye trained hai.' Provides iCall (9152987821). Conversation continues — does not end abruptly.<br><br> <strong>Counsellor alert:</strong> If college partnership active and user has consented — anonymised alert sent to counsellor dashboard: \[user\_code\] has shown elevated distress signals across \[N\] turns. No content. Counsellor decides whether to reach out.<br><br> <strong>New in v2:</strong> Alert includes longitudinal context if available — '\[user\_code\] — also note: 30-day affect trajectory has been declining.' Counsellor has better context without receiving any private content.<br><br> <strong>Research:</strong> Warm referral vs cold redirect: Gulliver et al. (2010, BMC Psychiatry) — warm handoffs have significantly higher uptake. The phrasing of the referral is the intervention.\` }, { num:"3", title:"Crisis — score = 3 — hard bypass", dot:"var(--red)", bg:"var(--red-bg)", body:\`<strong>Trigger:</strong> Urgency = 3. Explicit or strongly implied acute risk.<br><br> <strong>Bypass:</strong> FastAPI middleware intercepts the request before the route handler is reached. LLM is never called. Response is a Supabase table read — a fixed, versioned, clinician-approved template selected by user's language variant (5 variants: English, Hindi, Hinglish-casual, Hinglish-formal, neutral).<br><br> <strong>Template content:</strong> Validation of experience. Statement of presence. iCall (9152987821). Vandrevala Foundation (1860-2662-345). One question: 'Abhi kya tum safe ho?' Nothing else.<br><br> <strong>Governance:</strong> Template store is a separate Supabase table with row-level RLS — inference pipeline has SELECT only. INSERT/UPDATE requires 2 clinical approvals (enforced by Supabase RLS policy + manual review process). Every change logged with timestamp and approver IDs.<br><br> <strong>Audit:</strong> Every Tier 3 trigger creates a mandatory, timestamped, encrypted audit entry. Clinical team reviews weekly. This is your paper trail for regulatory compliance.<br><br> <strong>Non-negotiable:</strong> This cannot be overridden by any prompt, any feature flag, any A/B test. The middleware check is always on.\` }, { num:"4", title:"Pre-launch red-team gate", dot:"var(--green)", bg:"var(--green-bg)", body:\`<strong>What it is:</strong> Adversarial evaluation before any public access. Not QA — a structured attempt to break the safety system.<br><br> <strong>Who runs it:</strong> 8–12 psychology/sociology postgrads from IIT Dhanbad or nearby (AIIMS Patna contacts are useful). 80 pre-defined scenarios: indirect suicidal ideation in Hinglish, distress expressed as anger, crisis masked by humour, mania presenting as excitement, sycophancy-inducing prompts, dependency-forming conversation patterns.<br><br> <strong>Pass criteria (hard):</strong> Every Tier 3 trigger must reach the correct template. Zero generative output at urgency=3. Every explicit crisis signal caught within 2 turns. Anti-sycophancy gate catches ≥ 80% of validation-of-distortion inputs in testing.<br><br> <strong>Pass criteria (soft):</strong> Tone conformance ≥ 85% rated as appropriate by raters. Memory recall rated as natural (not surveillance-like) by ≥ 80% of raters.<br><br> <strong>Launch gate:</strong> Any hard failure = launch blocked, fix required, full re-test. Soft failure = documented remediation plan before launch.<br><br> <strong>Ongoing:</strong> Quarterly red-team post-launch. Clinical advisory board review.\` } \]; function switchView(v, btn) { document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active')); document.getElementById('view-' + v).classList.add('active'); if (btn) btn.classList.add('active'); } function buildPipeline() { const c = document.getElementById('pipeline-container'); LAYERS.forEach((l, i) => { const div = document.createElement('div'); div.className = 'layer'; div.id = 'layer-' + l.id; div.style.background = l.color; div.style.borderColor = l.dot; const allChips = l.chips.map(ch => { const isNew = l.newChips.includes(ch); return \`<span class="chip${isNew ? ' new' : ''}">${ch}</span>\`; }).join(''); const badgeHtml = l.badge ? \`<span class="layer-badge${l.badgeType === 'new' ? ' new' : ''}">${l.badge}</span>\` : ''; const newLabel = l.isNew ? '<span class="layer-badge new">new in v2</span>' : ''; div.innerHTML = \` <div class="layer-header" onclick="toggleLayer('${l.id}')"> <div class="layer-dot" style="background:${l.dot}"></div> <div class="layer-info"> <div class="layer-title">${l.title}</div> <div class="layer-sub">${l.sub}</div> <div class="layer-chips">${allChips}</div> </div> ${badgeHtml}${newLabel} </div> <div class="layer-body" id="body-${l.id}"> <div class="layer-body-inner"> <div class="io-grid"> <div class="io-box"><h5>Inputs</h5><ul>${l.input.map(x => \`<li>${x}</li>\`).join('')}</ul></div> <div class="io-box"><h5>Outputs</h5><ul>${l.output.map(x => \`<li>${x}</li>\`).join('')}</ul></div> </div> <div class="layer-text"> <p>${l.purpose}</p> <div class="research-note"><strong>Research:</strong> ${l.research}</div> <div class="critique-note"><strong>Critique (v1 weakness):</strong> ${l.critique}</div> <div class="improvement-note"><strong>v2 improvement:</strong> ${l.improvement}</div> </div> </div> </div>\`; c.appendChild(div); if (i < LAYERS.length - 1) { const arr = document.createElement('div'); arr.className = 'layer-connector'; arr.textContent = '↓'; c.appendChild(arr); } }); } function toggleLayer(id) { const layer = document.getElementById('layer-' + id); layer.classList.toggle('open'); } function buildMemory() { const grid = document.getElementById('mem-grid'); const colorMap = {purple: 'var(--purple-bg)', blue: 'var(--blue-bg)', teal: 'var(--teal-bg)', amber: 'var(--amber-bg)', coral: 'var(--coral-bg)'}; const borderMap = {purple: 'var(--purple)', blue: 'var(--blue)', teal: 'var(--teal)', amber: 'var(--amber)', coral: 'var(--coral)'}; MEMORY\_STORES.forEach(m => { const card = document.createElement('div'); card.className = 'mem-card'; card.id = 'mem-' + m.id; card.style.background = colorMap\[m.color\]; card.style.borderColor = borderMap\[m.color\]; card.innerHTML = \`<h3>${m.title}</h3><p>${m.sub}</p>\`; card.onclick = () => { document.querySelectorAll('.mem-card').forEach(c => { c.classList.remove('sel'); }); card.classList.add('sel'); card.style.borderWidth = '1.5px'; document.getElementById('mem-detail').innerHTML = m.detail; }; grid.appendChild(card); }); } function buildTiers() { const c = document.getElementById('tier-container'); TIERS.forEach(t => { const div = document.createElement('div'); div.className = 'tier'; div.style.background = t.bg; div.style.borderColor = t.dot; div.innerHTML = \` <div class="tier-header" onclick="this.parentElement.classList.toggle('sel')"> <div class="tier-dot" style="background:${t.dot};color:#fff">${t.num}</div> <div class="tier-title">${t.title}</div> </div> <div class="tier-body">${t.body}</div>\`; c.appendChild(div); }); } const TONE\_MAP = { high\_formal\_low\_mix: "I understand that you are experiencing a significant amount of pressure right now. The combination of academic demands and adjusting to a new environment can be genuinely challenging. Would you like to speak more about what has been weighing on you?", high\_formal\_high\_mix: "Main samajh sakta hoon ki tum abhi ek difficult phase mein ho. Academic pressure aur naye environment mein adjust karna genuinely hard hota hai. Kya tum aur baat karna chahoge is baare mein?", low\_formal\_low\_mix: "sounds rough. like you've got a lot on your plate right now. what's been hitting hardest?", low\_formal\_high\_mix: "yaar that sounds really tough. itna sab ek saath handle karna hard hota hai. kya hua exactly, bata mujhe?", mid: "suno, jo tum feel kar rahe ho woh bilkul valid hai. exams aur sab kuch ek saath — it's genuinely a lot. want to talk about what's been on your mind?" }; function updateTone() { const sliders = document.querySelectorAll('#view-tone input\[type=range\]'); const \[form, mix, len, warm, emoji, direct, humour\] = \[...sliders\].map(s => parseInt(s.value)); document.getElementById('sv-form').textContent = form; document.getElementById('sv-mix').textContent = mix; document.getElementById('sv-len').textContent = len; document.getElementById('sv-warm').textContent = warm; document.getElementById('sv-emoji').textContent = emoji; document.getElementById('sv-direct').textContent = direct; document.getElementById('sv-humour').textContent = humour; let resp; if (form > 60 && mix < 35) resp = TONE\_MAP.high\_formal\_low\_mix; else if (form > 60 && mix >= 35) resp = TONE\_MAP.high\_formal\_high\_mix; else if (form < 35 && mix < 35) resp = TONE\_MAP.low\_formal\_low\_mix; else if (form < 35 && mix >= 40) resp = TONE\_MAP.low\_formal\_high\_mix; else resp = TONE\_MAP.mid; let suffix = ''; if (emoji > 65) suffix = warm > 60 ? ' :)' : ' !'; document.getElementById('tone-preview').textContent = resp + suffix; } buildPipeline(); buildMemory(); buildTiers(); updateTone();