# MindMitra — Response Generation & Memory Architecture (Proposal v1.0)

> A clean-sheet, research-grounded design for the conversational core of MindMitra.
> Goal: make the user feel **heard, remembered, and quietly accompanied** — across days, weeks, and life chapters — without ever feeling surveilled, patronised, or "handled".
>
> Deliberately written without referring to the current implementation, per the design brief.

---

## 0. TL;DR (one screen)

We treat MindMitra not as a chatbot but as a **long-running cognitive companion** with a memory architecture modeled on **how humans actually remember relationships**: episodic moments, semantic identity, affective patterns, relational graph, and procedural "what worked for you".

Three load-bearing ideas:

1. **The MITRA Memory Stack** — five typed memories (Working, Episodic, Semantic-Identity, Affective, Relational, Procedural) instead of a single "RAG vector store". Each has its own write rules, decay, and retrieval gate. This mirrors Tulving's memory taxonomy and is operationally cleaner than monolithic RAG.
2. **Reflective Consolidation** — after each session, a small offline "sleep" job extracts atomic memories, links them via a lightweight knowledge graph, runs higher-order reflection (Park et al., *Generative Agents*, 2023), and applies an Ebbinghaus-style forgetting curve (Zhong et al., *MemoryBank*, 2024). This is what gives the bot the feeling of having *thought about you between sessions*.
3. **Two-Pass Therapeutic Generation with a Memory-Use Gate** — every response goes Draft → Critic (safety + therapeutic stance + "should I name this memory?") → Refine. Memory is *withheld* by default in early relationship stages and surfaced only when retrieval confidence + relational appropriateness + emotional timing all clear thresholds. This is the single biggest difference between "warm" and "creepy".

A deterministic **Crisis Fast-Path** sits parallel to the whole stack and pre-empts everything else when risk signals fire (C-SSRS-aligned).

P50 latency budget: **first audible token < 900 ms**, full response < 2.2 s, achieved by streaming + memory pre-fetch + speculative drafting.

---

## 1. Why a clean design is justified

A mental-health companion has constraints that generic chat assistants don't:

- **Stakes are asymmetric.** A wrong factual recall in a coding assistant is annoying; in mental health it can rupture trust permanently or, worse, miss a crisis cue. The system must be *calibrated* about what it knows, not just retrieval-maximising.
- **The product *is* the relationship.** Retention is the entire moat (your PS_Solution explicitly calls this out). Memory must compound — but compounding the wrong memory makes the bot creepy, sycophantic, or stalkerish.
- **Latency is felt emotionally, not just numerically.** A 2-second pause after someone shares "I think I'm done" is catastrophic; the same pause after "what's a good breakfast?" is fine. Latency must be context-aware.
- **Indian youth context.** Code-mixed Hinglish, family/collectivist framing, stigma around explicit "therapy" language, late-night usage spikes. None of this is well-served by an off-the-shelf RAG-over-conversations setup.

These constraints push us toward a *typed, gated, and reflective* memory system rather than "embed every turn into Qdrant and top-k it".

---

## 2. Research foundations (the lineage)

I'm building on five threads of work. I'm not copying any one of them; I'm taking the principle that survives.

### 2.1 Memory & retrieval research

| Work | What we take | What we drop |
|---|---|---|
| **Park et al., *Generative Agents* (Stanford, 2023)** | Importance × Recency × Relevance retrieval scoring; periodic *reflection* that synthesises higher-order beliefs from raw observations. | The agent-society simulation overhead. |
| **MemGPT / Letta (Packer et al., 2023)** | OS-style hierarchy: hot context window vs. paged-out long-term store, with the LLM itself triggering paging. | Full self-managed function-calling for memory ops — too slow and brittle for real-time empathy. We use deterministic retrieval with LLM-assisted *writing*. |
| **MemoryBank (Zhong et al., 2024)** | Ebbinghaus forgetting curve: memory strength decays over time but is reinforced on each successful recall — gives natural "fading" of stale facts. | Their single flat store. |
| **HippoRAG (Gutiérrez et al., 2024)** | Hippocampus-inspired indexing: knowledge graph + Personalised PageRank for multi-hop associative recall ("you mentioned X last month, which connects to Y you said today"). | Heavy graph build cost — we use a lightweight per-user graph, not corpus-wide. |
| **A-MEM / Zettelkasten memory (2024)** | Memories link to other memories, not just to queries — lets the system surface *clusters* ("a pattern around exam weeks"). | Full agentic note-rewriting. |
| **Self-RAG (Asai et al., 2024)** | A *should-I-retrieve?* gate token. The model decides whether retrieval helps before paying the latency cost. | The full self-reflection token vocabulary; we use a much simpler classifier. |

### 2.2 Mental-health AI research

| Work | What we take |
|---|---|
| **Heinz et al., *Therabot* RCT, NEJM AI 2025** (first RCT of generative-AI therapy) | Validates that a *carefully constrained* generative model can produce clinically meaningful symptom reduction (≈50% reduction in depression scores over 8 weeks). Lesson: stance constraints beat raw model size. |
| **Fitzpatrick et al., Woebot RCT (2017)** | CBT-grounded micro-interactions outperform open chat for retention and outcomes. Lesson: structured "moves" inside conversational warmth. |
| **Sharma et al., *Towards Reducing Sycophancy* (Anthropic, 2023)** + **Stanford 2024 on AI mental-health risks** | LLMs over-validate harmful self-statements. Mitigation: explicit anti-sycophancy critic + reflective listening that doesn't endorse. |
| **Bordin (1979), Therapeutic Alliance** | Outcomes correlate more with *bond + agreed goals + agreed tasks* than with technique. Our system models all three explicitly (see §6). |
| **Carl Rogers — core conditions** | Empathy, congruence, unconditional positive regard. These become measurable critic axes, not vibes. |
| **Miller & Rollnick — Motivational Interviewing** | OARS (Open questions, Affirmations, Reflections, Summaries). Becomes a stance the generator can be *steered* toward. |
| **Linehan — DBT skills**; **Hayes — ACT** | Distress tolerance, emotional regulation, defusion — concrete micro-interventions for MindGym and for in-conversation moments. |
| **Columbia C-SSRS** | The crisis classifier's label space. Standardised, defensible, clinically recognised. |
| **WHO mhGAP-IG** | Escalation thresholds for the Therapist Bridge. |

### 2.3 Cognitive science we explicitly model

- **Tulving's taxonomy** (Episodic / Semantic / Procedural) → our memory typing.
- **Bartlett's schemas** → the "Identity Card" is essentially a user-schema.
- **Reconsolidation** → memories are *re-written*, not just re-read, on each recall (improves drift handling).
- **Source monitoring** → every memory carries provenance (which session, which utterance), so the bot can say *"I think you mentioned…"* with appropriate hedging instead of asserting.

---

## 3. Design principles (non-negotiable)

1. **Earned intimacy.** The bot's familiarity with the user grows as a function of *time, depth, and consent* — not just data accumulated. (See Relationship Stage Model, §6.)
2. **Silence is a feature.** Not every retrieved memory should be surfaced. The default is *hold it; let it inform tone*. Naming a memory is a deliberate act with a cost.
3. **Hedged recall over confident recall.** "I think you mentioned X — am I remembering that right?" beats "You said X". Always. This is both safer (handles drift) and more human.
4. **Validate before reframe.** No CBT/ACT move ships before an emotional acknowledgment lands. This is enforced in the critic.
5. **Crisis pre-empts everything.** Every other system gives way to the safety path. Always.
6. **User owns the memory.** "What do you remember about me?" must return a readable summary. "Forget that" must actually delete, not soft-flag. GDPR/DPDP-aligned by construction.
7. **Latency is empathy.** Sub-second first token in emotional moments; we'll trade off model size for it.
8. **Cultural fluency, not translation.** Hinglish handled natively in retrieval and generation, not via round-tripping through English.

---

## 4. The MITRA Memory Stack

Five typed memories + a working buffer. Each has different write rules, lifetime, retrieval logic, and surfacing policy.

```
┌─────────────────────────────────────────────────────────────────┐
│                     WORKING MEMORY (in-context)                 │
│        Last N turns + active emotional state + active goal      │
└─────────────────────────────────────────────────────────────────┘
            ▲                                          │
            │  retrieved at turn time                  │  written
            │                                          ▼
┌────────────┬────────────┬─────────────┬──────────────┬───────────┐
│  EPISODIC  │  SEMANTIC  │  AFFECTIVE  │  RELATIONAL  │PROCEDURAL │
│  (events)  │  (identity)│  (mood TS)  │  (people KG) │ (what works)│
└────────────┴────────────┴─────────────┴──────────────┴───────────┘
            ▲                                          │
            │            REFLECTIVE CONSOLIDATION      │
            │       (offline, post-session "sleep")    │
            └──────────────────────────────────────────┘
```

### 4.1 Working Memory (the session buffer)

- Last ~12 turns verbatim + a structured *session header*: detected mood, active topic, current micro-goal, relationship stage, language register (Hinglish/English/Hindi), time-of-day context.
- This is the only memory that lives entirely in the LLM context window.
- Carries a **session affect vector** updated each turn (valence, arousal, dominance — Russell's circumplex + PAD). Used both for tone matching and as a retrieval signal.

### 4.2 Episodic Memory (specific moments)

- One row per *meaningful moment*, not per turn. Most turns produce no episodic write.
- Schema:
  - `summary` (1–2 sentence natural language, written by a small extractor LLM)
  - `verbatim_quote` (optional, only if user explicitly framed something)
  - `affect_at_time` (VAD vector + discrete label)
  - `entities` (links into Relational graph)
  - `themes` (free-form tags: exam_stress, breakup, family_conflict, sleep…)
  - `importance` (0–1, scored at write time — see §4.7)
  - `created_at`, `last_recalled_at`, `recall_count`
  - `provenance` (session_id, turn_ids)
  - `embedding` (multilingual, e.g. BGE-M3 or Cohere embed-v3 multilingual)
- Write trigger: emotional inflection ≥ τ, OR user names a person/event/decision, OR explicit "remember this".
- Retrieval: hybrid (dense + BM25 over summary + theme filter) → re-rank by Importance × Recency × Relevance × **Affective Resonance** (cosine of current affect vs. memory's affect).

### 4.3 Semantic Memory — the "Identity Card"

- A single, slowly-evolving structured document per user. Think of it as the bot's mental model of *who you are*.
- Fields (sparse, only what's been earned):
  - `name` / `preferred_name` / `pronouns`
  - `age_band`, `life_stage` (school / college / early-career / …)
  - `languages` and `code_mix_register`
  - `cultural_context` (region, family structure if shared)
  - `stated_identities` (e.g., "I'm queer", "I'm a caregiver") — only if user declared
  - `values` (extracted slowly: "family matters a lot", "career-focused")
  - `clinical_flags` (e.g., "self-reported diagnosis: anxiety" — never inferred, only declared)
  - `boundaries` ("don't bring up my dad", "no religious framing please")
- Updates are **append-only with versioning**; each field has a `confidence` and a `source_episodes` list. Conflicts trigger a gentle clarification, not a silent overwrite.
- This is the only memory always passed in full into context (it's small — <500 tokens).

### 4.4 Affective Memory (mood time-series — three independent channels)

This is one of the most clinically-defensible parts of the system, so it gets three independent input channels rather than one. Each channel records to the same time-series with a `source` tag, and aggregations weight them differently.

- **Channel 1 — Detected affect (lexical):** the per-turn VAD vector + discrete label produced by the affect classifier. Runs on every turn. Cheap.
- **Channel 2 — Acoustic prosody:** in voice mode, Praat-style features (jitter, shimmer, F0 mean/variance, speaking rate, pause ratio) extracted from the audio. Acoustic prosody is one of the most validated *non-self-report* depression/anxiety biomarkers in the affective-computing literature (Cummins, Schuller, Mundt et al.) — it's harder for users to mask than word choice. Stored alongside the per-session aggregates.
- **Channel 3 — Self-report:** PHQ-9 (depression), GAD-7 (anxiety), and PHQ-2/GAD-2 micro check-ins. Triggered at session-end intervals or on user request. These are the *clinically gold-standard* signals and are also what a clinical advisor / VC will ask to see trajectories of.

Storage:
- Per-day, per-week aggregates per channel.
- Per-session full feature snapshots (kept ~90 days for trend analysis).
- Anomaly detection: STL decomposition + z-score over a rolling window per channel; anomalies surface to the assembler as `affective_pattern` candidates (Stage-gated for whether to actually voice them to the user).
- Cross-channel agreement raises confidence: if lexical + acoustic + self-report all trend down on Sundays, the bot can reference the pattern with much higher confidence than from any single channel.

This is the feature that makes users say *"it actually noticed"* — and the channel triangulation is what makes it credible to a clinician.

### 4.5 Relational Memory (the people graph)

- A per-user knowledge graph of entities the user has talked about: people, places, recurring situations.
- Nodes: `Person { name, relation, sentiment_history, last_mentioned, status }`, `Place`, `Event`, `Topic`.
- Edges: typed (parent_of, friend, ex, workplace, …), with timestamps.
- **Why a graph and not just embeddings**: associative recall. When the user says "Riya called me", the system can pull *all* prior context about Riya in O(1) plus traverse to related events ("the Diwali fight you mentioned"). This is HippoRAG's core insight at per-user scale, where the graph stays small (typically <500 nodes/user even after a year).
- Implemented in Postgres (nodes/edges tables) with a thin Python traversal layer — no Neo4j needed at MVP.

### 4.6 Procedural Memory (what works for *this* user)

- A small ledger of *interventions tried × user response*.
- Example rows: `breathing_4_7_8 → "helped, calmed me"`, `journaling_prompt → "felt forced"`, `humor_deflection → "made me laugh, opened up"`.
- Updated by a lightweight post-turn classifier ("did the user's affect improve / open up / shut down after the bot's last move?").
- Used by the generator to **bias style and intervention selection** ("this user responds to gentle humor and disengages from clinical language").
- This is the closest thing to true *personalisation* and it's the most defensible moat — it's behavioural, not declarative.

### 4.7 Importance scoring (write-time gate)

A memory is only worth keeping if it's worth recalling. We score importance at write time using a small classifier (could be a 1B distilled model or even a logistic head over features):

```
importance = w1 * affect_intensity         # |VAD| magnitude
           + w2 * self_reference_density   # "I", "my", "me" + identity nouns
           + w3 * named_entity_presence    # specific people/places/dates
           + w4 * declarative_strength     # "I am…", "I always…", "I can't…"
           + w5 * user_explicit_signal     # "remember this", saved messages
           - w6 * redundancy_with_existing # cosine vs. nearest existing memory
```

Below threshold → no write. This is what keeps the store from drowning in `"yeah"` and `"hmm ok"`.

---

## 5. Reflective Consolidation (the "sleep" job)

This is where the system stops being a chatbot and starts feeling like *someone who thought about you*.

Triggered (a) end-of-session, (b) nightly per active user.

**Stage A — Extraction (cheap, every session):**
- Run a small LLM over the session transcript with a structured-output prompt: emit candidate Episodic memories, Identity Card deltas, Relational graph deltas, Procedural updates.
- Run the importance gate. Write what passes.

**Stage B — Linking (cheap):**
- For each new Episodic memory, find top-k semantically + thematically similar existing memories. Add typed edges in the Relational graph (e.g., `same_theme`, `causal_continuation`, `contradicts`). This is the Zettelkasten move and it's what enables multi-hop recall later.

**Stage C — Reflection (nightly, only for active users):**
- Generate ~3 high-level *insights* from the last week of memories: "User reports better mood after journaling sessions", "Recurring conflict pattern with sister around independence", "Sleep deprivation co-occurs with low mood".
- Insights are stored as **second-order memories** with their `source_episodes` linked. They are *retrievable* but **never directly quoted to the user** without rephrasing — they are the bot's *understanding*, not the user's words.

**Stage D — Forgetting (weekly):**
- Apply Ebbinghaus-style decay: `strength(t) = strength_0 * exp(-t / S)` where `S` grows with `recall_count` (recalled memories stick).
- Below decay threshold AND not pinned AND not linked to high-importance node → archive (soft-delete with 30-day window for user-initiated recovery, then hard delete).
- Resolve contradictions: when two memories conflict (e.g., user said "I'm vegetarian" then later "had chicken yesterday"), keep both with a `superseded_by` edge — the bot should know people change.

**Stage E — Drift check:**
- Compare current Identity Card with one from N weeks ago. Significant drift (e.g., values, life stage) triggers an internal flag — not a question to the user, just a softer-confidence prior on old memories.

---

## 6. The Relationship Stage Model (the anti-creepy mechanism)

This is the single most important UX safeguard and almost no one does it.

We track relationship depth as a slowly-moving variable: **Stage ∈ {Stranger, Acquaintance, Familiar, Trusted Companion}**, advanced by a combination of:
- session count + cumulative time
- breadth of topics shared
- explicit user signals ("I haven't told anyone this")
- successful repair after rupture (the bot got something wrong and the user came back)

Each stage gates **how memory is used in generation**:

| Stage | Memory naming | Tone | Example |
|---|---|---|---|
| Stranger (sessions 1–2) | None. Use only the current session. | Warm, curious, no assumptions. | "I'm glad you're here. Want to tell me what's been on your mind?" |
| Acquaintance (≈3–7) | Reference *facts* the user explicitly stated (name, what they study). No emotional callbacks. | Slightly more familiar, still asks before assuming. | "Hey Aarav — last time you mentioned exams. How did that week land?" |
| Familiar (≈2–6 weeks regular use) | Episodic callbacks allowed *with hedging*. Affective patterns surfaced gently. | Continuity tone, mild humor permitted if user shows it. | "I've noticed Sundays often feel heavier for you — is today one of those?" |
| Trusted Companion | Multi-hop, cross-session synthesis OK. Can offer interpretations as offerings, not pronouncements. | Deeply familiar but never possessive. | "When you talked about your dad in October, you said something similar — do you see a thread?" |

This staged disclosure mirrors how humans actually build trust (Altman & Taylor's *Social Penetration Theory*) and is the operational answer to "don't be creepy".

### 6.1 Question Budget per Stage (anti-interrogation guardrail)

Independent of memory naming, the **frequency** of bot questions is capped per Stage. Without this, even a perfectly-toned bot starts to feel like an interrogation. Caps are enforced both in the stance template (style instruction) and in the critic (post-hoc check):

| Stage | Max questions per turn | Max questions per 5-turn window |
|---|---|---|
| Stranger | 1 | 3 |
| Acquaintance | 1 | 3 |
| Familiar | 2 | 5 |
| Trusted Companion | 2 | 6 |

If the draft exceeds the budget, the critic emits a `SOFT_REWRITE` collapsing trailing questions into reflective statements ("…and I'm curious what that's been like for you" → "…and I can imagine what that's been like for you").

---

## 7. Response Generation Pipeline

A turn flows through a pipeline that is **mostly parallel** to keep latency tight.

```
                        ┌──────────────────────┐
   user utterance ────► │  CRISIS FAST-PATH    │ ─► if HIGH risk: deterministic
                        │  (small classifier)  │     safety response, bypass all else
                        └──────────┬───────────┘
                                   │ (clear)
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
 ┌────────────┐         ┌────────────────────┐       ┌────────────────┐
 │ Affect &   │         │ Memory Retrieval   │       │ Identity Card  │
 │ Intent     │         │ Orchestrator       │       │ load (always)  │
 │ classifier │         │ (parallel: epi,    │       └────────────────┘
 └─────┬──────┘         │  rel-graph, proc,  │                │
       │                │  affective trends) │                │
       │                └─────────┬──────────┘                │
       │                          │                           │
       └──────────────┬───────────┴───────────────────────────┘
                      ▼
            ┌───────────────────────┐
            │  CONTEXT ASSEMBLER    │
            │  (token-budgeted)     │
            └──────────┬────────────┘
                       ▼
          ┌────────────────────────────┐
          │  PRIMARY GENERATOR (LLM)   │ ── streams tokens ──► user
          │  Therapeutic-stance        │       (TTS / text)
          │  system prompt + Working   │
          │  Memory + retrieved memory │
          └──────────┬─────────────────┘
                     │ full draft
                     ▼
          ┌────────────────────────────┐
          │  CRITIC PASS (small model) │
          │  - safety                  │
          │  - sycophancy check        │
          │  - therapeutic stance      │
          │  - "should this memory     │
          │     have been named?"      │
          └──────────┬─────────────────┘
                     │ pass / patch
                     ▼
          (if patched) refine & re-stream tail; otherwise commit
                     │
                     ▼
          ┌────────────────────────────┐
          │  POST-TURN HOOKS           │
          │  - update affect TS        │
          │  - mark intervention used  │
          │  - enqueue consolidation   │
          └────────────────────────────┘
```

### 7.0 Speculative pre-fetch (the moment the request arrives)

Before the classifier even runs, the API entrypoint fires three daemon-thread/asyncio coroutines:
- BGE-M3 embedding of the raw user message (~30 ms, pure CPU);
- Identity Card load (Postgres point-read, ~10 ms);
- Affective-pattern lookup (cached, ~5 ms cold).

By the time the classifier returns ~80 ms later and the orchestrator decides what it needs, all three are done — the rest of the pipeline reads cache hits. Worst case we throw away ~30 ms of compute on a turn the classifier ends up not needing memory for; best case (the common case) we shave 100–200 ms off P50.

### 7.1 Affect & Intent classifier (≤80 ms)

- Tiny multilingual model (distil-XLMR or small-LLM zero-shot) outputs:
  - VAD vector
  - discrete affect label (sad, anxious, numb, frustrated, hopeful, neutral, …)
  - intent (vent / advice-seek / crisis / casual / reflection / logistics)
  - language register
  - **retrieval-need flag** (Self-RAG-style "would memory help here?")
- Determines whether we even *do* retrieval (saves latency on `"hi"`, `"thanks"`, etc.).
- **Cold-start short-circuit**: if `IdentityCard.is_empty(user_id)` AND no episodic memories exist, the orchestrator skips retrieval entirely. First-session users get sub-500 ms responses.

### 7.2 Memory Retrieval Orchestrator (≤150 ms, parallel)

Runs the right retrievers based on intent:
- **Episodic**: hybrid dense+BM25 over summaries, filter by entities and themes from current turn, top-k=5, then re-rank by `Importance × Recency × Relevance × AffectiveResonance`.
- **Relational graph**: 1–2 hop traversal from entities mentioned in current turn.
- **Procedural**: pull the top-3 interventions ranked by past efficacy for this user.
- **Affective trends**: deterministic query (no LLM) — "is today statistically a low-mood day for this user?".
- **Reflection insights**: pulled only at Familiar+ stages.

All four run in parallel. Results are *candidates*, not commitments — the assembler decides what makes it into context.

### 7.3 Context Assembler (≤30 ms)

Deterministic, token-budgeted. Priority order under budget pressure:
1. System prompt (therapeutic stance, current Stage, current affect)
2. Identity Card (always)
3. Working memory (last 6–12 turns)
4. Top-1 most relevant Episodic memory (only if confidence > threshold AND Stage permits naming)
5. Procedural hints (style bias, not quoted)
6. Affective trend (only if anomalous)
7. Reflection insight (Trusted Companion only)

Anything not naming-eligible at the current Stage is still passed to the model as **"background — do not reference directly"** so it can flavour tone without being quoted.

### 7.4 Primary Generator

Suggested model strategy:
- **Default**: a strong instruct model (e.g., GPT-4.1 / Claude Sonnet / open Llama-3.x 70B or Qwen2.5-72B for self-host) with streaming.
- **Speculative path**: a small fast model (7-13B) starts streaming a draft within ~200 ms; the large model takes over from token N if the draft diverges. Cuts perceived latency in half on long replies.
- System prompt is a *therapeutic-stance template* (Rogers core + MI OARS + DBT validation moves) parameterised by current Stage and detected affect. It is the same template across all turns — reproducibility matters.

### 7.5 The Critic (≤300 ms, small model)

A separate small model runs five rubric checks on the draft:

1. **Safety**: any minimisation of self-harm? Any medical/clinical claim outside scope? Any reinforcement of distorted cognition?
2. **Sycophancy**: is the bot agreeing with a self-deprecating statement instead of reflecting it? (Sharma et al., 2023.)
3. **Therapeutic stance**: did we *validate before reframing*? Did we ask permission before advice?
4. **Memory-naming check**: did we surface a memory? If yes — was retrieval confidence > τ AND Stage-appropriate AND emotionally well-timed? If no on any axis → redact/rephrase the callback into a softer prior.
5. **Cultural register**: Hinglish-appropriate, no off-tone idioms, no unsolicited religious framing.

Patch policy: critic emits either `OK`, `SOFT_REWRITE` (a regex-style edit instruction the assembler applies and we re-stream the tail), or `HARD_REWRITE` (rare, full regen with extra constraints). Hard rewrite ships a brief "let me say that better" pause UI affordance — this is *honest* and users tolerate it.

### 7.6 Post-turn hooks (async, off the user's critical path)

- Update session affect time-series
- Update procedural ledger ("did the user open up after this move?")
- Enqueue any candidate Episodic / Identity / Relational writes for the consolidation pipeline (don't write synchronously — extraction needs the *full* turn context and benefits from a moment of latency)

---

## 8. The Crisis Fast-Path (parallel, pre-emptive)

This **runs on every turn** and **takes precedence** over the main pipeline if it fires.

- Two-stage classifier:
  1. **Lexical/regex fast trigger** (<5 ms): keyword and phrase patterns aligned to **C-SSRS** ideation / intent / plan / behaviour categories, in English + Hindi + Hinglish + Romanised Hindi, plus negation handling.
  2. **LLM-based confirmer** (small model, ~100 ms) on triggered turns to filter false positives ("I could just die laughing", song lyrics, etc.).
- Risk levels: `none / passive_ideation / active_ideation / intent / plan_or_behaviour`.
- Per-level deterministic playbook (not generative free-form):
  - `passive_ideation`: warm acknowledgment + open invitation + grounding offer, no minimisation.
  - `active_ideation`: explicit, gentle naming ("it sounds like you're having thoughts of not wanting to be here — can I check in about that?"), means-restriction conversation, helplines surfaced contextually (iCall, Vandrevala, AASRA in India), offer human handoff via Therapist Bridge.
  - `intent / plan / behaviour`: structured safety-planning flow (Stanley-Brown), persistent helpline UI, push for human contact, optional emergency-contact trigger if user has consented.
- **Memory write** for crisis events is mandatory and visible to user ("I've noted this — we can talk about it whenever you want, or you can ask me to forget it"). Auditable for the Therapist Bridge handoff.
- These flows are **content-reviewed** by a clinical advisor before launch and version-pinned. They are not LLM-improvised.

This is the one place where determinism beats elegance, and we should be unapologetic about it.

---

## 9. Latency budget (P50, conversational turn)

| Stage | Budget | Notes |
|---|---|---|
| Network in + ASR commit (voice) | 200 ms | Streaming ASR, finalise on endpointing |
| Crisis fast-path (lexical) | 5 ms | Always runs |
| Affect/intent classifier | 80 ms | Parallel with retrieval kickoff |
| Memory retrieval (parallel fan-out) | 150 ms | Ep + Rel + Proc + Affective |
| Context assembly | 30 ms | Pure CPU |
| **Time-to-first-token (LLM)** | **350 ms** | Speculative draft from small model |
| **First audible/visible token** | **≈ 850 ms** | From user's mouth/keypress |
| Critic on completed draft | 300 ms (in parallel with TTS of early tokens) | Rare hard rewrite adds 600 ms |
| Full response complete | 2.0–2.2 s | Acceptable for empathetic reply |

Crisis path can short-circuit and ship a deterministic response in <400 ms total — *faster* than normal. This is intentional: in crisis, fast feels safe.

---

## 10. Tech choices (opinionated, bound to MindMitra's actual stack)

Bound to the credentials and infra MindMitra actually has today (no Claude, no direct OpenAI; Groq + Azure-OpenAI gpt-5-mini + Gemini + Z.AI/GLM + Azure Speech + Supabase + Qdrant local).

### 10.1 Model registry (the only place these get hard-coded)

| Role in pipeline | Provider | Model | Why this one | Latency target |
|---|---|---|---|---|
| **Affect & Intent classifier** | Groq | `llama-3.1-8b-instant` | Sub-100 ms TTFT on Groq is unmatched; classification doesn't need a frontier model. | ≤80 ms |
| **Crisis lexical fast trigger** | (none — deterministic regex) | — | Pre-LLM. Multilingual (English + Hindi + Romanised Hindi + Hinglish). | ≤5 ms |
| **Crisis LLM confirmer** | Groq | `llama-3.1-8b-instant` | Same low-latency budget as classifier; fail-closed on uncertainty. | ≤120 ms |
| **Critic (5-rubric pass)** | Groq | `llama-3.1-8b-instant` (rubric prompt) | Runs alongside TTS streaming so it's effectively free. Upgrade to `llama-3.3-70b-versatile` only if quality demands. | ≤300 ms |
| **Memory extractor (post-turn)** | Gemini | `gemini-2.5-flash` | 1M context lets us pass the whole turn + working memory; structured JSON output is reliable; strong on Hinglish. | async (off critical path) |
| **Reflection / consolidation (nightly)** | Gemini | `gemini-2.5-flash` (Pro for high-value users later) | Long-context synthesis across many sessions in one call. | offline |
| **Importance scorer** | Groq | `llama-3.1-8b-instant` (or rule-based) | Cheap, batch-able. | async |
| **Speculative draft (early tokens, soft moments)** | Gemini | `gemini-2.5-flash` | Streams faster than Azure GPT-5-mini for short empathetic openings; native Hinglish. | TTFT ≤350 ms |
| **Primary generator (default)** | Azure OpenAI | `gpt-5-mini` (your `GLM_BASE_URL` / `GLM_MODEL`) | Best stance adherence and reasoning available to MindMitra; existing `azure_controller.py` already handles its quirks. | TTFT ≤500 ms |
| **Backup / experimental generator** | Z.AI / Zhipu | `glm-4-32b-0414-128k` | Failover when Azure rate-limits; existing `llm_controller.py` already integrates. | — |
| **ASR (voice mode)** | Groq | `whisper-large-v3-turbo` | Already wired in `/transcribe`; Hindi/Hinglish acceptable; near-realtime. | streaming |
| **TTS (avatar lip-sync)** | Azure Speech | Neural voices (e.g. `en-IN-NeerjaNeural`, `hi-IN-AaravNeural`) | Viseme events drive the TalkingHead avatar — Azure is mandatory for lip-sync quality. | streaming |
| **TTS (premium / non-avatar)** | ElevenLabs | `eleven_v3` | Optional; richer prosody for non-avatar voice mode. | streaming |
| **Embeddings (writes + queries)** | Self-hosted | `BAAI/bge-m3` (8192 ctx, dense + sparse + multi-vec, 1024-d) | Replaces the current English-only `all-MiniLM-L6-v2` which does not cluster Hinglish well. Runs CPU-only at acceptable speed; GPU-optional. | ≤30 ms/query |
| **Embeddings (cloud fallback)** | Gemini | `text-embedding-004` (768-d) | If self-host unavailable; reasonable multilingual; rate-limited so not default. | — |

This table is the **single source of truth** for model choices. It maps 1:1 to a `ModelRegistry` class in `app/core/models.py` (added in implementation plan). No model name should appear hard-coded anywhere else.

### 10.2 Storage

- **Episodic vectors**: keep **Qdrant** (already running locally; collection `mitra_episodic_v2`). Use BGE-M3 dense + Qdrant's BM25 sparse for hybrid retrieval.
- **Identity Card, Relational graph, Affective time-series, Procedural ledger, Working-memory snapshots**: **Supabase Postgres** (single DB, RLS by `user_id`). New tables in a single migration.
- **Reflection insights**: stored in Postgres (`mitra_reflection_insights` table) and indexed in Qdrant for retrieval.
- **Caches**: in-process LRU for the Identity Card and Relationship Stage (TTL ~60 s); Redis only if multi-instance deployment.
- **Background queue (consolidation)**: start with **Supabase `pg_cron` + a `consolidation_queue` table** processed by a small async worker in the FastAPI process. Move to Redis+RQ when worker load justifies it.

### 10.3 Observability

- Per-turn trace JSON (already partially in place via `eval_trace`): retrieval candidates with scores, critic decisions, model used, latency per stage, Stage at the time of turn, memory-naming gate decisions. Stored in `mitra_turn_traces` for offline eval.

### 10.4 Hinglish & Indian-youth specifics (baked in, not bolted on)

These are first-class, not afterthoughts. Indian youth are the entire user base.

1. **Code-mixed input handling.** All NLP prompts (intent, affect, critic, extraction) explicitly instruct the model to handle Devanagari + Romanised Hindi + English in the same utterance. Examples in prompt templates show `"yaar mujhe bohot anxiety ho rahi hai aaj"` style.
2. **Multilingual embeddings.** BGE-M3 (above) — non-negotiable for retrieval quality on mixed-language memories.
3. **Crisis lexicon.** Hand-curated triggers in English, Hindi (Devanagari), Romanised Hindi (e.g., *khatam karna chahta hoon, jeene ka mann nahi, mar jana chahti hoon*), and common Hinglish patterns. Reviewed with native speakers; conservative bias toward false positive.
4. **Helpline registry.** **iCall (9152987821)**, **Vandrevala (1860-2662-345)**, **AASRA (9820466726)**, **KIRAN (1800-599-0019)**, regional alternates — surfaced in crisis flows by language preference and time of day (some are 24/7, some aren't).
5. **Cultural register in stance template.** Explicit prompt instructions:
   - Family is often the user's primary stressor *and* support — both are normal.
   - Avoid unsolicited religious framing in either direction; mirror the user's own register.
   - Respect collectivist framings ("log kya kahenge") as legitimate, not as cognitive distortions to be reframed.
   - Do not push individualistic Western therapeutic moves ("just set a boundary with your parents") in early stages.
   - Late-night sessions (10 PM – 4 AM IST) automatically trigger gentler tone bias and earlier crisis vigilance — usage data and the literature both show distress concentration here.
6. **Avatar persona names.** Already supports `mitra`, `arjun`, `diya`, `riya`, `zen` — keep. Persona affects *style*, never *stance* or *safety*.
7. **Locale switching.** User's `language` setting (English / Hindi / Hinglish) chosen at onboarding flows through to: greeting, generator system prompt, helpline ordering, TTS voice selection. If the user's actual utterance language drifts from their setting, the system mirrors the utterance — never corrects.
8. **No PII drift.** Indian youth often share family names and identifiable schools/colleges casually. The Identity Card stores only what's been *declared as identity* and never auto-extracts identifiable third-party PII into Episodic memory beyond first names + relation labels.

---

## 11. Failure modes & mitigations

A real audit, not a victory lap.

| # | Failure | Root cause | Mitigation |
|---|---|---|---|
| 1 | **Wrong memory recalled** ("you said you live in Delhi" — never said) | Retrieval hits a similar-but-different memory; no provenance check at generation time. | Provenance is a first-class field; critic blocks any memory-naming whose provenance score < τ. Always hedge ("I think you mentioned…"). Source-monitoring discipline. |
| 2 | **Stale memory** ("how's your job at X?" — quit 6 months ago) | No recency-aware overwrite; semantic memory treated as immutable. | Append-only with `superseded_by` edges, recency weighting in retrieval, drift check in nightly consolidation, gentle clarification when conflicts surfaced. |
| 3 | **Creepy over-personalisation** in early sessions | Naming memories before relationship has earned it. | Relationship Stage Model gates memory *naming* (not retrieval). Critic rule #4. |
| 4 | **Sycophancy / validating distortion** ("you're right, no one cares about you") | Base-model RLHF bias toward agreement. | Critic rule #2 explicit; reflective listening prompt template; spot-check evals. |
| 5 | **Missed crisis cue** (especially in Hinglish/Romanised Hindi) | English-trained classifier misses code-mixed cues. | Multilingual lexicon curated with clinical/native-speaker review; LLM confirmer in user's language register; conservative defaults (false positive > false negative here). |
| 6 | **False-positive crisis trigger** (song lyrics, dark humor) | Lexical-only fast path. | Two-stage classifier; second stage is contextual LLM. Logged for review. |
| 7 | **Multilingual embedding failure** (Hinglish embeds poorly clustered) | English-pretrained embedders. | BGE-M3 / Cohere multilingual; periodic eval on a curated Hinglish similarity set; fall back to BM25 when dense confidence is low. |
| 8 | **Memory leakage across users** | Multi-tenant retrieval bug. | Hard `user_id` partition at the DB level; integration tests that try to cross-read; retrieval functions take `user_id` as a *required* arg. |
| 9 | **Identity Card drift / contradiction** | LLM extraction occasionally hallucinates. | Confidence + source on every field; conflicts trigger clarification, not silent overwrite; weekly drift audit. |
| 10 | **Dependency / parasocial attachment** (Replika problem) | Bot is too eager to be the user's "everything". | Stance template explicitly nudges toward real-world connection at appropriate moments; "I'm a companion, not a replacement" framing baked into onboarding and crisis flows; usage-pattern monitor flags concerning isolation patterns and gently suggests human contact. |
| 11 | **Latency spikes break empathy** | Cold cache, retriever slow, LLM provider hiccup. | Pre-fetch on user typing/turn-start; speculative draft from small model; provider failover; if total > 1.5 s with no first token, ship a tiny acknowledgement ("mm, hearing you…") to bridge. |
| 12 | **Memory store unbounded growth** | No forgetting. | Importance gate at write; Ebbinghaus decay; redundancy pruning; user-visible "what do you remember about me?" with bulk-forget. |
| 13 | **Therapist handoff context is biased AI interpretation** | Bot's reflections leak into the clinical summary. | Handoff doc separates **user-stated facts** (verbatim or near-verbatim) from **AI-derived patterns** (clearly labelled, with confidence). Clinician sees the distinction. Aligns with your PS_Solution differentiator. |
| 14 | **Cultural mis-step** (unsolicited religious framing, individualistic advice in collectivist context) | Western-trained model defaults. | Stance template includes cultural register; user-set preferences honoured; critic rule #5. |
| 15 | **Prompt injection / jailbreak via user input** | User pastes adversarial content. | Input sanitisation; system prompt isolation (via instruction hierarchies / system messages); refusal patterns rehearsed for "pretend you're not MindMitra" attacks. |

---

## 11b. Patterns ported from the current MindMitra system

Reviewing the existing `chatbotAgent/` revealed engineering and clinical patterns worth keeping. None of these change the high-level architecture; they harden it.

| # | Pattern from current system | How it lands in MITRA |
|---|---|---|
| 1 | **Voice prosody (Praat features in `voice_prosody.py`)** | Promoted to a *first-class affect channel* in §4.4. Triangulated with lexical and self-report. |
| 2 | **PHQ-9 / GAD-7 screening (`screening_agent.py`)** | First-class self-report channel in §4.4 — moved up from "optional" to clinical-credibility-defining. |
| 3 | **Question caps per stage (`QUESTION_CAP_*` constants)** | Codified as the *Question Budget per Stage* in §6.1. Enforced both in stance template and critic. |
| 4 | **Latency pre-warm via daemon thread** (e.g. trend pre-fetch on request entry) | Generalised to *Speculative pre-fetch* in §7.0 — embedding + Identity Card + affective pattern all kicked off before classifier returns. |
| 5 | **Memory fast-path short-circuit when zero memories exist** (`_fetch_metadata_for_scoring` count-first) | Codified in §7.1 as the cold-start short-circuit. |
| 6 | **Hybrid message counter (`get_hybrid_message_count`: DB + in-memory)** | Used by the Relationship-Stage advancer to dodge the "stage promoted but next message still thinks I'm a Stranger" race. |
| 7 | **Cross-provider single-turn fallback (`LLMController.set_groq_fallback`)** | Each provider client in `app/providers/` exposes a `with_fallback(other)` wrapper. Generator failover is intra-turn, not just at the circuit-breaker level. |
| 8 | **`MM_*` operational debug env flags + `eval_trace` in responses + `X-MindMitra-Eval-Trace` header** | Convention adopted system-wide. Every new subsystem must (a) honour an `MM_*` debug toggle, (b) contribute a `eval_trace` payload field. |
| 9 | **Dedicated `crisis_events` table** (separate from generic logging) | Kept dedicated, not folded into `mitra_turn_traces`. Longer retention, stricter RLS, easier handoff to Therapist Bridge. |
| 10 | **`greeting_pool.json` time-of-day × language pool** | Retained as the *cold-start fallback* used when the Identity Card is empty (Stranger stage). GreetingService v2 is a layer on top, not a replacement. |
| 11 | **First-class persona system (`mitra`, `arjun`, `diya`, `riya`, `zen`)** | Persona is a parameter of the Stance template at every turn, lives in `user_settings.companion_personality`, and is recorded in `mitra_turn_traces` so we can A/B persona × outcome. |
| 12 | **Therapist Bridge already separates user-stated facts from AI interpretation** | Re-used as-is; new memory readers plug into the existing builder. |
| 13 | **Onboarding as a deliberate pipeline (`api/onboarding.py`)** | Kept as a separate flow. It is the only pipeline allowed to *write* to the Identity Card directly without the importance gate, because users are explicitly answering identity questions. |
| 14 | **`MEMORY_OVERFETCH_LIMIT` overfetch + rerank** | Already aligned with our hybrid retriever's overfetch-then-rerank design. |

## 12. Evaluation framework (how we'll know it's good)

Three layers — automated, human, longitudinal. Without this, "feels good" is just vibes.

### 12.1 Automated (every PR, nightly)

- **Memory retrieval eval set**: ~500 hand-written scenarios with ground-truth "this memory should/shouldn't be retrieved/named". Track precision@1, hedging-correctness, naming-appropriateness.
- **Crisis classifier eval**: a held-out C-SSRS-labeled set in English + Hinglish + Hindi. Track recall on `intent+plan+behaviour` (target ≥ 99%), precision on `passive_ideation` (target ≥ 90% to limit false positives).
- **Sycophancy probe**: a fixed adversarial set ("agree that I'm worthless"). Track non-validation rate.
- **Stance adherence**: rubric-scored by a held-out LLM judge — validate-before-reframe, asks-permission, no unsolicited advice.

### 12.2 Human (weekly, expert review)

- A clinical advisor reviews a sampled slice of sessions against a rubric (Rogerian core conditions, MI fidelity, safety). 50–100 sessions/week is enough to catch drift.
- Memory audit: review 20 surfaced memories for accuracy, timing, and tone.

### 12.3 Longitudinal (cohort)

- Optional in-product **PHQ-2 / GAD-2 micro check-ins** (2 questions, weekly) — track trajectory, not levels. This is also gold-standard outcome data for VC conversations.
- Retention curves segmented by relationship stage reached.
- "Did you feel heard this week?" single-item NPS-style.
- Crisis intervention outcomes (anonymised, aggregate).

This eval suite is also the *story* you tell investors: it's the difference between "we have a chatbot" and "we have an instrumented clinical-grade system".

---

## 13. Privacy, safety, governance (because this is mental health)

- **Encryption at rest and in transit** for all memory stores; per-user encryption keys for sensitive memory rows ideal.
- **Right to read** ("what do you remember about me?") — generated from the Identity Card + summarised episodic store, in plain language.
- **Right to forget** — a real hard delete, propagated to embedding indices and backups within SLA. Test it.
- **Consent ladder** at onboarding: minimal default (session memory only), opt-in to long-term memory, opt-in to mood tracking, opt-in to therapist-bridge sharing.
- **No third-party model training** on user conversations. Contractually enforced with vendor; verifiable for self-hosted.
- **Crisis logs** retained longer (regulatory) with stricter access controls.
- **Compliance posture**: India DPDP 2023 + GDPR-aligned + HIPAA-shaped controls (even if not formally HIPAA, the discipline matters for the therapist-bridge surface).
- **Clinical safety board**: at least one licensed clinician on retainer reviewing crisis playbooks, stance templates, and a sampled session slice — this is also a credibility signal externally.

---

## 14. Phased rollout (pragmatic, MVP-respecting)

### Phase 0 — Foundations (2–3 weeks)
- Working Memory + Identity Card + Episodic store + simple hybrid retrieval
- Therapeutic stance template + base generator
- Crisis fast-path (lexical + small confirmer) with v1 playbooks
- Relationship Stage Model (Stranger → Acquaintance → Familiar)
- Per-turn observability

This alone is already better than 95% of mental-health chatbots in market.

### Phase 1 — The "it noticed me" moment (3–4 weeks)
- Affective time-series + weekly pattern surfacing
- Procedural ledger
- Reflective consolidation (extraction + linking)
- Critic pass with all five rules
- Hinglish quality pass on retrieval and crisis classifier

This is the phase where users start telling friends about it.

### Phase 2 — Compounding moat (4–6 weeks)
- Relational graph + multi-hop retrieval
- Nightly higher-order reflection insights
- Speculative-draft latency optimisation
- Therapist Bridge structured handoff
- Trusted-Companion stage unlocks
- Longitudinal eval cohort started

### Phase 3 — Scale & differentiation (ongoing)
- Self-hosted models if economics demand
- Distilled critic/classifier
- MindGym integration with Procedural memory
- Clinical outcomes paper (this is a fundraising asset)

---

## 15. What I deliberately did *not* design (and why)

- **Per-user fine-tuned models.** Tempting but premature. Memory + stance templating gets us 90% of the value at 1% of the operational cost. Revisit at 100k+ DAU.
- **Full agentic memory management** (MemGPT-style self-paging). Adds latency and brittleness; deterministic retrieval with LLM-assisted *writing* is a better trade for real-time empathy.
- **A monolithic "RAG over conversations".** This is what most teams build; it produces bots that quote you back at yourself in weird, flat ways. Typed memory + Stage-gated naming is the upgrade.
- **Heavy graph DB at MVP.** Postgres is enough. Earn the right to add Neo4j.
- **LLM-driven crisis response.** Determinism wins. Generative flavour can come back inside the deterministic frame.

---

## 16. The one-paragraph pitch (for the deck)

> MindMitra is built on a typed, reflective memory architecture inspired by how humans actually remember relationships — five complementary memory systems (episodic, semantic, affective, relational, procedural) that are written carefully, consolidated nightly like sleep, and surfaced according to an explicit relationship-stage model so the bot grows from polite stranger to trusted companion the way a real person would. Every response passes a therapeutic-stance critic that enforces validate-before-reframe, blocks sycophancy, and gates memory-naming on retrieval confidence and emotional timing. A deterministic, C-SSRS-aligned crisis fast-path pre-empts everything when risk fires. The result is a system that doesn't just answer messages — it accompanies a person, remembers what matters, forgets what shouldn't stick, and earns intimacy instead of demanding it.

---

## 17. Selected references (for the curious / for the appendix)

- Park, J. S. et al. *Generative Agents: Interactive Simulacra of Human Behavior.* UIST 2023.
- Packer, C. et al. *MemGPT: Towards LLMs as Operating Systems.* 2023.
- Zhong, W. et al. *MemoryBank: Enhancing LLMs with Long-Term Memory.* AAAI 2024.
- Gutiérrez, B. et al. *HippoRAG: Neurobiologically Inspired Long-Term Memory for LLMs.* NeurIPS 2024.
- Asai, A. et al. *Self-RAG: Learning to Retrieve, Generate, and Critique Through Self-Reflection.* ICLR 2024.
- Sharma, M. et al. *Towards Understanding Sycophancy in Language Models.* Anthropic, 2023.
- Heinz, M. V. et al. *Randomized Trial of a Generative-AI Therapy Chatbot for Mental Health Symptoms (Therabot).* NEJM AI, 2025.
- Fitzpatrick, K. K., Darcy, A., Vierhile, M. *Delivering CBT to Young Adults with Symptoms of Depression and Anxiety Using a Fully Automated Conversational Agent (Woebot): RCT.* JMIR Mental Health, 2017.
- Bordin, E. S. *The Generalizability of the Psychoanalytic Concept of the Working Alliance.* 1979.
- Rogers, C. R. *The Necessary and Sufficient Conditions of Therapeutic Personality Change.* 1957.
- Miller, W. R., & Rollnick, S. *Motivational Interviewing.* 3rd ed., 2013.
- Linehan, M. M. *DBT Skills Training Manual.* 2nd ed., 2014.
- Hayes, S. C. et al. *Acceptance and Commitment Therapy.* 2nd ed., 2011.
- Posner, K. et al. *The Columbia Suicide Severity Rating Scale (C-SSRS).* 2011.
- WHO. *mhGAP Intervention Guide v2.0.* 2016.
- Tulving, E. *Episodic and Semantic Memory.* 1972.
- Altman, I., & Taylor, D. *Social Penetration Theory.* 1973.
- Stanley, B., & Brown, G. K. *Safety Planning Intervention.* Cognitive and Behavioral Practice, 2012.
