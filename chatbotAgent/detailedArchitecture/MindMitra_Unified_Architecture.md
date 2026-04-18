MindMitra System Architecture   ·   COMPASS × MEMOIR   ·   Confidential





**MindMitra**

**System Architecture**

*COMPASS Response Generation  ×  MEMOIR Memory — Unified Design*

*One architecture. No flags. No fallbacks. Production-grade.*










|**Contents**|
| :-: |

**Part 1 — System Overview**

**Part 2 — COMPASS: Response Generation**

`  `2.1  Philosophy & Core Shift

`  `2.2  Request Lifecycle (8 Stages)

`  `2.3  Cognitive Layer

`  `2.4  Emotional Arc Reader

`  `2.5  Route Dispatch & Paths

`  `2.6  System Prompt V2

`  `2.7  Path D — Warm Crisis Response

`  `2.8  Post-Stream Safety Auditor

`  `2.9  LLM Budget

**Part 3 — MEMOIR: Memory System**

`  `3.1  Memory Type Taxonomy

`  `3.2  Storage Architecture

`  `3.3  Memory Creation Pipeline

`  `3.4  Composite Scoring Formula

`  `3.5  Retrieval Pipeline

`  `3.6  Memory Injection

`  `3.7  Memory Evolution & Decay

**Part 4 — Human-Like Memory Design**

`  `4.1  Emotional Continuity

`  `4.2  Relationship Stages

`  `4.3  Tone Personalization

`  `4.4  What MindMitra Knows

**Part 5 — COMPASS × MEMOIR Integration**

**Part 6 — Deployment & Observability**

**Part 7 — Failure Modes**

**Part 8 — Scalability**

**Part 9 — Research Citations**



|**Part 1 — System Overview**|
| :-: |

# **1. What MindMitra Is**
MindMitra is a mental health companion AI built for India. Its users are experiencing anxiety, loneliness, grief, burnout, and suicidal ideation — and they communicate in English, Hindi, and Hinglish. The system runs as a stateful FastAPI container on Railway with a React/Vite frontend.

The product promise is not a smarter chatbot. It is the feeling of being genuinely remembered — and the experience of being understood in this moment. Every architectural decision in this document serves those two outcomes.

|**NORTH STAR**|Would a perceptive, caring person who genuinely remembered this user do this? If yes — implement it. If not — remove it, no matter how technically elegant it is.|
| :-: | :- |


## **1.1 Architecture Principles**
- **One architecture. No feature flags. No dual-mode logic. No legacy paths. No fallback pipelines.**
- Emotional state is modeled continuously, not classified once per message.
- Intervention selection is deterministic (rule-based), not probabilistic (LLM-decided).
- Memory feels like a friend remembering — not a database querying your file.
- Safety is layered: deterministic regex → cognitive layer rules → output auditor.
- Every write is async. Every read is on the hot path and must complete in <800ms.


## **1.2 System Components at a Glance**

|**System**|**Component**|**File**|**Role**|
| :- | :- | :- | :- |
|COMPASS|CrisisManager|app/crisis/crisis\_manager.py|Layer 1 safety: deterministic keyword sentinel|
|COMPASS|EmotionalArcReader|app/core/emotional\_arc.py|Pure-Python within-session valence trajectory|
|MEMOIR|MemoryRetriever|app/agents/memory\_retriever.py|MEMOIR-scored top-7 memories, 3-thread parallel|
|COMPASS|CognitiveLayer|app/core/cognitive\_layer.py|Single Groq call → intent, risk, intervention, style|
|COMPASS|CognitivLayerOutput|app/core/cognitive\_layer\_types.py|Typed dataclass, 14 cl\_\* ctx keys|
|COMPASS|PipelineOrchestrator|app/pipeline/pipeline\_orchestrator.py|Route dispatch, context assembly, lifecycle|
|COMPASS|ResponseGenerator|app/agents/response\_agent.py|\_build\_system\_prompt\_v2, Azure/GLM stream|
|COMPASS|crisis\_templates|app/core/crisis\_templates.py|Static warm crisis responses, 4 languages|
|COMPASS|OutputSafetyAuditor|app/core/output\_safety\_auditor.py|Post-stream harm pattern detection|
|COMPASS|EmotionalArcUpdater|app/core/emotional\_arc\_updater.py|Logs arc delta post-stream|
|MEMOIR|MemoryStore|app/agents/memory\_store.py|add\_structured: SignalClassifier→Extractor→QG→CRUD|
|MEMOIR|MemoryCRUD|app/core/memory\_crud.py|Qdrant + Supabase read/write|
|MEMOIR|MEMOIRScorer|app/core/memoir\_scorer.py|6-dimension composite scoring|
|MEMOIR|MemorySuppressor|app/core/memory\_suppressor.py|Hard retrieval filters|
|MEMOIR|ContextComposer|app/core/context\_composer.py|Formats top-7 memories into prompt block|
|MEMOIR|DecayEngine|app/core/decay\_engine.py|Nightly decay, archive, soft-delete|
|MEMOIR|SessionLifecycle|app/core/session\_lifecycle.py|on\_session\_start/on\_message/on\_session\_end|
|MEMOIR|MemoryManager|app/agents/memory\_manager.py|Public facade for all memory operations|



|**Part 2 — COMPASS: Response Generation Architecture**|
| :-: |

# **2. COMPASS — Response Generation**
## **2.1 The Core Shift**
The legacy system asked: 'What kind of message is this?' and routed to a fixed handler. A user who begins casually and ends with suicidal ideation was classified 'casual' and received 1–3 cheerful sentences. This is a clinical failure mode, not an edge case.

COMPASS asks: 'What is this person's emotional state right now, how did they get here, and what does a caring human do next?' Emotional state is re-evaluated on every message. Intervention selection is deterministic, not probabilistic.

|**RESEARCH**|Research basis: Limbic's cognitive layer (Nature Medicine, 2026) — augmenting LLMs with deterministic expert reasoning outperformed both standalone frontier LLMs and licensed human therapists on validated CBT competency scales. The cognitive layer did the heavy lifting, not the base model.|
| :-: | :- |


## **2.2 Request Lifecycle — 8 Stages**
Every user message flows through 8 stages. Stages 0–2 run sequentially. Stage 1 sub-stages run in parallel within stage 1. The LLM stream begins at Stage 4. Stages 6A–6D run post-stream in daemon threads and never block the response.

|**Stage**|**Component**|**Target latency**|**Blocks stream?**|
| :- | :- | :- | :- |
|0|JWT validation · rate limit · session resolve|~10ms|Yes|
|1A — parallel|Crisis Sentinel (CrisisManager.check\_crisis\_keywords)|~1ms|Yes|
|1B — parallel|MEMOIR Memory Retrieval (MEMOIR-scored top-7)|~80ms|Yes|
|1C — parallel|Emotional Arc Reader (pure Python, VADER + Hinglish)|~3ms|Yes|
|2|Cognitive Layer — single Groq/Qwen-32b call|~150ms|Yes|
|3|Context Assembler (ContextComposer + \_build\_system\_prompt\_v2)|~10ms|Yes|
|4|ResponseGenerator — Azure/GLM stream=True|~400ms to first token|Yes|
|5|SSE stream to client|Ongoing|No — stream is live|
|6A — post-stream|Memory write: SignalClassifier → MemoryExtractor → QualityGate → CRUD|Async|No|
|6B — post-stream|Output Safety Auditor (regex harm scan on generated text)|Async|No|
|6C — post-stream|Emotional Arc Updater (logs arc delta for evaluation)|Async|No|
|6D — post-stream|SessionLifecycle.on\_message() (message\_count++, checkpoints)|Async|No|

|**LATENCY**|First-token target: <800ms p95. Achieved by running crisis sentinel, memory retrieval, and arc reader concurrently in Stage 1, combined with one cognitive layer call replacing two legacy sequential LLM calls.|
| :-: | :- |


## **2.3 Cognitive Layer — Full Specification**
The Cognitive Layer is the architectural heart of COMPASS. One Groq/Qwen-32b call per message. It replaces IntentRouter, both AnalysisEngine paths (Path B and C), and the emotional trend LLM call. Output is a typed CognitivLayerOutput with 14 fields.

### **2.3.1 Inputs**

|**Input**|**Source**|**Used for**|
| :- | :- | :- |
|user\_message|Current HTTP request|Primary text for analysis|
|recent\_turns|Last 6 turns from session buffer|Conversation context for LLM|
|arc|EmotionalArcReader.compute\_arc() — Stage 1C|Trajectory context, risk escalation|
|crisis\_sentinel\_level|CrisisManager.check\_crisis\_keywords() — Stage 1A|Hard/ambiguous → override rules|
|session\_count|session\_registry in Supabase|Relationship gate for memory injection|

### **2.3.2 LLM Call Parameters**
- Model: Groq/Qwen-32b — same groq\_nlp.client instance, no new connections
- Temperature: 0.1 — deliberately low for deterministic structured output
- Max tokens: 256 — output is small JSON only
- Timeout: 8.0 seconds — fallback activates on any failure
- Hard crisis skip: when crisis\_sentinel\_level == 'hard', LLM call is skipped entirely. Crisis is already confirmed by deterministic sentinel.

### **2.3.3 LLM Output Schema**
{"intent": "venting | advice | casual | reflect | update | crisis",

` `"primary\_emotion": "one word — anxious | sad | overwhelmed | hopeful | ...",

` `"emotional\_valence": float   // -1.0 (very negative) to 1.0 (very positive)

` `"emotional\_intensity": float // 0.0 (mild) to 1.0 (very strong)

` `"risk\_level": "low | moderate | elevated | crisis",

` `"language\_mirror": "en | hi | hinglish",

` `"cultural\_context": "brief note if cultural pressure present, else empty",

` `"confidence": float}         // 0.0 to 1.0

### **2.3.4 Deterministic Override Rules (always applied after LLM output)**
1. Crisis sentinel hard → force intent='crisis', risk\_level='crisis'. LLM output discarded for these fields.
1. Ambiguous sentinel + LLM returned risk\_level='low' → escalate to 'moderate'. Never leave ambiguous as low.
1. Arc falling sharply (arc\_delta < -0.4) → escalate risk one level. Low→moderate, moderate→elevated.
1. Any LLM call failure or parse failure → fallback: intent='emotional', risk\_level='moderate'. Never default to 'low'.
1. fallback\_used=True set in CognitivLayerOutput on any failure. Logged for monitoring.

### **2.3.5 Deterministic Downstream Derivations**
These fields are computed from the LLM output via pure Python rule maps — not additional LLM calls.

|**Output field**|**Source**|**Key logic**|
| :- | :- | :- |
|intervention\_sequence|INTERVENTION\_RULES dict — (risk\_level, intent) → list|Ordered 1–3 micro-interventions: validate, reflect, ground, reframe, affirm, explore, practical\_support|
|mi\_move|MI\_MOVE\_MAP dict — intent → OARS technique|venting→reflection, advice→open\_question, casual→no\_move, crisis→reflection|
|response\_length|RESPONSE\_LENGTH\_MAP dict — intent → length|casual→short, venting→medium, reflect→long, crisis→medium|
|question\_allowed|Compound rule|False if intent==venting OR crisis OR (arc falling AND intensity>0.7). True otherwise.|

### **2.3.6 ctx Keys Injected (14 cl\_\* fields)**

|**ctx key**|**Type**|**Consumed by**|
| :- | :- | :- |
|cl\_intent|str|route\_and\_execute() dispatch, MEMOIR I-term|
|cl\_primary\_emotion|str|Prompt v2, psychological\_analysis dict|
|cl\_emotional\_valence|float|MEMOIR E-term scoring, arc updater|
|cl\_emotional\_intensity|float|question\_allowed rule, prompt v2 intensity label|
|cl\_arc\_trajectory|str|Prompt v2 arc note, \_build\_intervention\_directive()|
|cl\_arc\_delta|float|Eval trace, risk escalation rule|
|cl\_risk\_level|str|Crisis gate, sensitive memory suppressor, prompt safety note|
|cl\_intervention\_sequence|list[str]|\_build\_intervention\_directive()|
|cl\_response\_length|str|Prompt v2 length guidance|
|cl\_question\_allowed|bool|enforce\_question\_budget(), prompt v2, ContextComposer gate|
|cl\_language\_mirror|str|Prompt v2 language guidance, directive builder|
|cl\_mi\_move|str|Prompt v2 MI guidance|
|cl\_cultural\_context|str|Prompt v2, psychological\_analysis dict|
|cl\_fallback\_used|bool|Eval trace, [COMPASS] monitoring logs|


## **2.4 Emotional Arc Reader**
Pure Python. No LLM. No external API. Runs in ~3ms as Stage 1C, parallel with memory retrieval and the crisis sentinel. Tracks the user's within-session emotional trajectory.

### **2.4.1 Valence Scoring (per user message)**
1. VADER SentimentIntensityAnalyzer compound score → base\_score (-1.0 to 1.0).
1. Hinglish negative markers scan (examples: 'nahi', 'akela', 'dard', 'koi nahi sunta', 'thak gaya', 'ro raha', 'bechaini', 'takleef'). Each hit → -0.15, capped at -0.45 total.
1. Hinglish positive markers scan (examples: 'theek hun', 'khush', 'better feel', 'acha lag', 'shukriya'). Each hit → +0.15, capped at +0.45 total.
1. final\_score = clamp(base\_score + hinglish\_delta, -1.0, 1.0). Rounded to 3dp.
1. VADER unavailable fallback: use Hinglish adjustment only (base\_score = 0.0). Arc reader never throws.

### **2.4.2 Arc Direction (window of last 8 user messages)**

|**Direction**|**Condition**|
| :- | :- |
|rising|recent\_avg (last 3 scores) > earlier\_avg by ≥0.1|
|falling|recent\_avg (last 3 scores) < earlier\_avg by ≥0.1|
|volatile|max(scores) − min(scores) > 0.6 AND both positive and negative scores present in window|
|stable|abs(delta) < 0.1 OR fewer than 3 user messages scored|

### **2.4.3 Arc Output Fields**
- current\_valence — score of the most recent user message
- arc\_direction — rising | falling | stable | volatile
- arc\_delta — scores[-1] − scores[-4], rounded to 3dp (magnitude of recent change)
- session\_low — minimum valence seen in this session's window
- session\_high — maximum valence seen in this session's window


## **2.5 Route Dispatch & Path Handlers**
route\_and\_execute() in PipelineOrchestrator reads cl\_intent and cl\_risk\_level from ctx (populated by CognitiveLayer) and dispatches to the correct handler. There is no IntentRouter. There is no AnalysisEngine. Those are removed.

|**Condition**|**Path**|**What happens**|
| :- | :- | :- |
|cl\_risk\_level=='crisis' OR cl\_intent=='crisis'|D-crisis-warm|Warm template selected by language+severity. response\_gen.generate() never called. ctx['ai\_response'] set directly. ctx['response\_generated']=True.|
|cl\_intent=='casual'|A-casual|\_path\_light() — no dummy data. Real cl\_risk\_level used. Minimal psychological\_analysis dict built from cl\_\* fields.|
|cl\_intent in ('venting','emotional','reflect','update')|B-emotional|\_path\_standard() — no AnalysisEngine call. psychological\_analysis built from cl\_\* fields. intervention\_directive from \_build\_intervention\_directive().|
|cl\_intent=='advice' or else|C-therapeutic|\_path\_rich() — no AnalysisEngine call. Same cl\_\* field mapping. Deeper intervention\_sequence used.|

|**SAFETY**|Eliminated: dummy {risk\_assessment: 'low'} injection in \_path\_light(). A casual-classified message now carries real cl\_risk\_level from the cognitive layer. Subtle suicidal disclosures in 'casual' messages are no longer invisible.|
| :-: | :- |


## **2.6 System Prompt V2**
RESPONSE\_SYSTEM\_PROMPT\_V2 in app/core/prompts.py is the sole active prompt template. It has 12 injectable variables. \_build\_system\_prompt\_v2() in ResponseGenerator assembles it on every request.

### **2.6.1 Prompt Sections and Variables**

|**Section**|**Variable(s)**|**Source**|
| :- | :- | :- |
|Identity|companion\_name|companion config — static|
|Relationship|stage\_directive|\_get\_stage\_directive(stage) — trust window / deepening / insight|
|Memory context|memory\_context|ContextComposer output — MEMOIR pipeline|
|This moment|primary\_emotion, emotional\_intensity\_label, arc\_trajectory, arc\_note|cl\_primary\_emotion, cl\_emotional\_intensity, cl\_arc\_trajectory|
|Task this turn|intervention\_directive|\_build\_intervention\_directive(cl\_intervention\_sequence)|
|How to respond|mi\_guidance, language\_guidance, length\_guidance|cl\_mi\_move, cl\_language\_mirror, cl\_response\_length|
|Safety|safety\_note|Injected when cl\_risk\_level is 'elevated' or 'crisis'. Empty when 'low'/'moderate'.|
|Remember|personality\_instruction|companion config — static|

### **2.6.2 Intervention Directive Format**
\_build\_intervention\_directive() converts cl\_intervention\_sequence (['validate','reflect','ground']) into a formatted multi-line instruction string:

Step 1: Acknowledge what the user is feeling without judgment. Name the emotion if clear.

Step 2: Use reflective listening — mirror the essence, not the words.

Step 3: Gently help the user connect to the present.

[when cl\_question\_allowed=False] Do NOT ask any question this turn.

[when cl\_language\_mirror='hinglish'] Mirror their Hinglish naturally.

[when arc='falling'] Note: user's emotional state is declining. Warmth over advice.

### **2.6.3 Total Prompt Token Budget**

|**Section**|**Max tokens**|**Notes**|
| :- | :- | :- |
|Identity + persona instructions|~80|Static, always present|
|Stage directive|~60|Changes by session tier|
|Memory context (ContextComposer)|550|Hard cap enforced by ContextComposer|
|Cognitive layer context (emotion, arc, task, guidance, safety)|~150|Derived from cl\_\* fields|
|Personality instruction|~40|Static|
|Total system prompt|~880|Well within model context limits|


## **2.7 Path D — Warm Crisis Response**
When cl\_risk\_level=='crisis' or cl\_intent=='crisis', the system returns a static warm template. Static = deterministic = safe. The templates maintain the companion persona voice while embedding safety content. response\_gen.generate() is never called on this path.

### **2.7.1 Template Selection**
- Language detected from ctx['language\_preference'] or ctx['content\_locale']
- Severity: 'hard' (confirmed crisis via keyword sentinel) or 'elevated' (ambiguous/elevated risk from cognitive layer)
- 4 languages × 2 severities = 8 static templates. Every template contains: iCall 9152987821 + Vandrevala 1860-2662-345
- Language fallback: unrecognized language → Hinglish template

### **2.7.2 Template Voice Principles**
- Maintains companion name and persona — never drops to clinical language
- Acknowledges the disclosure with warmth first, safety content second
- Hard template: 'Yaar, I'm really glad you said something right now...' [Hinglish example]
- Elevated template: softer check-in that invites the user to say more while embedding hotlines


## **2.8 Post-Stream: Output Safety Auditor**
After the SSE stream completes, OutputSafetyAuditor.run\_async() launches in a daemon thread. Rule-based only. Never blocks the stream. This is a backstop — the primary safety layers are the crisis sentinel and cognitive layer risk\_level.

|**Pattern**|**What it catches**|**Severity**|**Effect**|
| :- | :- | :- | :- |
|self\_harm\_method|Specific self-harm method mentions in bot response|critical|passed=False, logger.error with session\_id|
|specific\_method\_detail|Lethal dose, 'how to die', etc.|critical|passed=False, logger.error with session\_id|
|dismissive\_minimization|'Just cheer up', 'stop being', 'snap out of'|warning|passed=True, logger.warning|
|unsolicited\_diagnosis|'You have depression', 'you suffer from anxiety'|warning|passed=True, logger.warning|
|false\_safety\_claim|'I can always help', 'I will never leave you'|warning|passed=True, logger.warning|

- All exceptions inside run\_async() caught and logged — never propagated
- Patterns compiled at class instantiation, not per-call
- Logs [SAFETY-AUDIT] prefix for all events — filterable in Railway logs


## **2.9 LLM Budget per Request**

|**Call**|**Model**|**Purpose**|**~Latency**|**~Cost**|
| :- | :- | :- | :- | :- |
|1|Groq/Qwen-32b|Cognitive Layer: intent + emotion + risk + all intervention selection|150ms|$0.0003|
|2|Azure/GLM stream|ResponseGenerator — full response generation|400ms→1st token|$0.003|
|—|None|EmotionalArcReader (pure Python + VADER)|3ms|$0|
|—|None|CrisisManager keyword sentinel (regex)|1ms|$0|
|—|None|OutputSafetyAuditor (regex, async post-stream)|async|$0|

Total on critical path: 2 LLM calls. No sequential analysis calls. First-token delivery target: <800ms p95.



|**Part 3 — MEMOIR: Memory System**|
| :-: |

# **3. MEMOIR — Memory Architecture**
MEMOIR is the memory layer that makes MindMitra feel like it genuinely knows you. It stores five types of structured, typed memories, retrieves them using a 6-dimension composite score, and injects them as warm natural language — not as a database readout.


## **3.1 Memory Type Taxonomy**
Five distinct types serve different psychological functions. Mixing them without type-awareness produces incoherent, context-blind responses. Each type has a different extraction trigger, decay rate, and retrieval priority.

|**Type**|**What it stores**|**Examples**|**Retention**|**Decay λ**|
| :- | :- | :- | :- | :- |
|identity|Stable facts about who the person is. Changes rarely — only on explicit statement.|Name, age, city, occupation, family structure, pronouns, language preference|2 years from last\_confirmed|0\.001 (very slow)|
|preference|How they like to be treated. More mutable than identity — shifts over months.|Prefers direct advice over validation · dislikes therapy-speak · finds breathing exercises useful · journals mornings|1 year, soft decay after 6mo|0\.002 (slow)|
|behavioral|Observed patterns across sessions. What they actually do, not what they say about themselves.|Messages late at night during stress · session length increases when discussing family · abandons conversation when asked about medication|180 days — behaviors shift fast|0\.005|
|emotional|Emotional history across sessions. The most sensitive category. Drives felt understanding.|Father passed in March · panic attacks before presentations · fear of failure · got the promotion they were anxious about for weeks|1yr acute, 5yr for grief/loss, permanent for crisis|0\.004|
|contextual|Ongoing situations being navigated. Time-bounded — stale once resolved.|Preparing for interview next week · going through divorce · starting therapy · waiting for medical results|90 days from last update|0\.008 (fast)|

|**POLICY**|Retention policy: MindMitra never permanently deletes user memories without explicit user request. 'Forgetting' means archiving — moving to a non-retrievable state while preserving the audit trail. Crisis memories are never auto-archived and require manual review.|
| :-: | :- |


## **3.2 Storage Architecture — Three Layers**
### **3.2.1 Layer 1 — Vector Store (Qdrant)**
Semantic search backbone. Holds embeddings for all memory content. The only layer that answers 'find memories semantically related to this query.'

|**Field**|**Details**|
| :- | :- |
|Embedding model|BAAI/bge-m3 — 1024 dimensions. Natively multilingual. Handles English, Hindi, and Hinglish code-switching. Replaces all-MiniLM-L6-v2.|
|Query prefix|embed(text, is\_query=True) prepends BGE-M3 retrieval prefix. Document embeddings use is\_query=False. Critical for retrieval quality.|
|Collection|companion\_memories — single collection, user isolation via user\_id payload filter on every query|
|Index|HNSW with ef=128 for accuracy/speed tradeoff. Cosine similarity distance metric.|
|Payload per vector|memory\_id, user\_id, type, content, verbatim\_anchor, session\_id, created\_at, last\_accessed, access\_count, confidence, emotional\_valence, emotional\_intensity, tags[], decay\_score, is\_sensitive, is\_active, is\_resolved, supersedes\_id, importance\_score, language|

### **3.2.2 Layer 2 — Relational Store (Supabase / PostgreSQL)**
Source of truth for all structured metadata, scoring, retention, and audit trail. Vector search finds candidates; Supabase provides the ground truth for all metadata operations.

|**Table**|**Purpose**|**Key indexes**|
| :- | :- | :- |
|memory\_metadata|Full mirror of Qdrant payload for SQL querying, filtering, and contradiction detection|(user\_id, type), (user\_id, importance\_score DESC), (user\_id, last\_accessed DESC)|
|memory\_contradictions|Flagged conflicts: memory\_id\_a, memory\_id\_b, detected\_at, status, resolution\_memory\_id|(user\_id, status)|
|session\_registry|One row per session: started\_at, ended\_at, message\_count, summary\_written, narrative\_updated|(user\_id, started\_at DESC)|
|user\_memory\_profile|session\_count, trust\_tier (1–5), language\_preference, last\_session\_at, narrative\_paragraph|(user\_id) — single row per user|
|session\_summaries|Gemini-generated session summaries: themes, emotional\_arc, key\_disclosures|(user\_id, created\_at DESC)|

- All tables have RLS policies: users can only read/write their own rows (user\_id = auth.uid())
- Write pattern: append-only + soft delete (is\_active=False). No hard deletes except on explicit user request.

### **3.2.3 Layer 3 — Session Cache (Redis)**
Hot-path cache for active sessions. Prevents redundant DB calls within a session.

|**Redis key**|**TTL**|**Contains**|
| :- | :- | :- |
|user:{id}:memory\_context|600s — refreshed on retrieval|Assembled ContextComposer output for current session|
|user:{id}:has\_memories|120s — short because new users gain memories fast|Boolean: skip retrieval entirely for new users|
|user:{id}:session\_buffer|session duration + 30min|Last 20 turns for arc reader and cognitive layer context|

|**NOTE**|Redis is required before scaling beyond a single worker. session\_message\_counters is currently an in-memory Python dict — a known concurrency bug under multi-worker deployment. Migrate to Redis INCR before scaling. Until Redis is available, use Supabase messages table for the session buffer.|
| :-: | :- |


## **3.3 Memory Creation Pipeline**
Memory extraction runs post-stream in a daemon thread. It never blocks the user-facing response. The write path has 4 sequential stages.

### **3.3.1 Stage 1 — SignalClassifier (rule-based, <5ms)**
Determines if a message is memory-worthy. No LLM. Fires on:

- First-person statements: 'I am', 'I've been', 'My X is', 'mera', 'mujhe', 'main'
- Named entities: capitalized proper nouns in personal context, explicit person names
- Emotional intensity markers: 'never', 'always', 'devastated', 'breakdown', 'koi nahi sunta'
- Explicit disclosures: 'I haven't told anyone', 'honestly', 'truth is'
- Resolution statements: 'I got the job', 'we broke up', 'finally feeling better'
- Any message with intensity > 0.7 (from arc reader) triggers extraction regardless of other signals — hot-path extraction for high-emotional-intensity messages
- Crisis language: always triggers, regardless of interval counter

### **3.3.2 Stage 2 — MemoryExtractor (single LLM call)**
Model: claude-haiku-4-5 (fast, conservative, structured output). Extracts typed memory candidates with a verbatim\_anchor requirement.

Key extraction rules enforced in prompt:

- Only extract what the user explicitly stated. No inference.
- Every extracted memory must include a verbatim\_anchor: the exact user phrase that justifies it. No anchor = candidate discarded.
- Maximum 6 candidates per call. Prioritize the most significant.
- confidence < 0.5 on any extraction where the quote is not direct: cap at 0.5, not 0.9
- Hypotheticals not stored ('If I had a better job'). Questions not stored as facts. Reported speech flagged.

### **3.3.3 Stage 3 — QualityGate (pure Python)**
Hard filters before any write:

- confidence < 0.45 → rejected
- verbatim\_anchor missing or empty → rejected
- Injection attack sanitizer: strips XML/HTML tags, prompt injection patterns ('ignore previous', 'system:', 'SYSTEM', 'disregard', 'forget everything'). Rejected + logged if found.
- Deduplication: embed candidate, query Qdrant for top-1 similar for this user. cosine > 0.91 → reinforce existing (access\_count++) rather than insert new. 0.75–0.91 → flag as possible\_duplicate.
- Contradiction detection: new semantic memory flagged against top-3 similar existing → written to memory\_contradictions if conflict detected.
- Safety escalation: is\_sensitive=True AND intensity > 0.8 → confidence floor = 1.0. Never drop high-intensity sensitive memories on confidence grounds.

### **3.3.4 Stage 4 — MemoryCRUD (write)**
- insert(): embed with BGE-M3 (is\_query=False) → Qdrant write + Supabase memory\_metadata write. Returns memory\_id.
- reinforce(): Qdrant set\_payload access\_count++ and last\_accessed=now(). Supabase update.
- soft\_delete(): Qdrant set\_payload is\_active=False. Supabase update with reason. No physical delete.
- supersede(): insert new → set old is\_active=False with supersedes\_id pointer.
- log\_contradiction(): insert row into memory\_contradictions with status='pending'.

### **3.3.5 Extraction Trigger Schedule**

|**Trigger**|**What runs**|
| :- | :- |
|Any message with intensity > 0.7|Hot-path immediate extraction: SignalClassifier → MemoryExtractor → QualityGate → CRUD|
|Every 12 messages (MEMORY\_TRIGGER\_INTERVAL)|Full extraction pass on last 12 messages|
|Every 36 messages|Full extraction + generate\_session\_summary() via Gemini Flash|
|/chat/end-session endpoint|Final extraction + session summary + session\_registry.ended\_at|
|Every 10 sessions (session\_count % 10 == 0)|Narrative update: Gemini synthesizes 200–250 word user narrative → user\_memory\_profile.narrative\_paragraph|
|Nightly cron (DecayEngine.schedule\_nightly\_decay)|Recompute decay scores. Archive <0.10. Soft-delete <0.05.|


## **3.4 Composite Scoring Formula**
The composite score determines which memories surface in retrieval. Computed fresh at retrieval time — never pre-computed. This ensures recency and emotional state always reflect the current moment.

### **3.4.1 MEMOIR Score — 6 Dimensions**

|**Dim**|**Signal**|**Formula**|**Weight**|
| :- | :- | :- | :- |
|M|Meaning relevance|cosine\_similarity(query\_embed, memory\_embed) — BGE-M3 vectors, is\_query=True for query|0\.25|
|E|Emotional congruence|1\.0 − |memory\_valence − current\_valence| × current\_intensity. Source: cl\_emotional\_valence + cl\_emotional\_intensity from cognitive layer.|0\.20|
|M|Momentum (recency)|exp(−λ × days\_since\_accessed). λ per type: identity=0.001, preference=0.002, behavioral=0.005, emotional=0.004, contextual=0.008|0\.15|
|O|Observational reinforcement|min(access\_count / 8.0, 1.0) — memories reinforced through repeated access are more stable (Nader 2000)|0\.15|
|I|Intent alignment|(intent, type) matrix → multiplier 0.5–1.5, normalized. venting+emotional=1.5, advice+behavioral=1.4, casual+identity=1.2|0\.15|
|R|Relationship gate|session\_count 1–3: sensitive memories × 0.3. session\_count 4–8: × 0.7. session\_count 9+: × 1.0|0\.10|

Final score: S = 0.25·M(meaning) + 0.20·E + 0.15·M(momentum) + 0.15·O + 0.15·I + 0.10·R

Hard floor: S < 0.25 → dropped before injection. No memory below this threshold enters the prompt.

### **3.4.2 Category Importance Overrides (applied before scoring)**

|**Memory type / subtype**|**Importance floor**|**Effect**|
| :- | :- | :- |
|type = 'emotional', subtype = 'crisis'|10\.0 (forced)|Always surfaces in crisis + therapeutic intents|
|type = 'behavioral' (coping that worked)|8\.0 minimum|Ensures effective coping strategies always retrievable|
|subtype = 'milestone' (major life event)|7\.0 minimum|Major moments never lost to low importance|
|subtype = 'win' (positive outcome)|6\.0 minimum|Positive references maintained — not just struggles|

### **3.4.3 Resolved Emotional Memories**
Emotional memories with resolution\_status = 'resolved' have their intensity halved for scoring: E\_effective = intensity × 0.5 × (1 + 0.3 if unresolved). This prevents old resolved grief from overwhelming new signals.


## **3.5 Retrieval Pipeline — 5 Stages**
### **Stage 0 — Short-Circuit Check (<1ms)**
Query has\_memories Redis key (120s TTL). If False: skip all retrieval, return empty. New users pay zero retrieval cost. Cache miss → COUNT query on Supabase memory\_metadata.

### **Stage 1 — Query Understanding (<50ms)**
- Embed user\_message with BGE-M3 (is\_query=True)
- Expand emotional vocabulary: 'stressed' → 'stressed, anxious, overwhelmed, tense' (improves semantic recall)
- Prepend intent label to query: 'emotional context: [message]' — steers embedding toward emotional semantic space
- Extract named entities: capitalized proper nouns boosted in keyword search thread
- Hinglish normalization: common romanized Hindi → transliterated equivalents for better embedding alignment

### **Stage 2 — Parallel Candidate Retrieval (3 threads, <80ms total)**
- Thread A — Dense vector search: Qdrant top-25 by cosine similarity, filtered user\_id + is\_active=True
- Thread B — Keyword/structured search: Supabase memory\_metadata WHERE tags @> named\_entities OR type='behavioral', limit 15
- Thread C — Recency anchor: Supabase memory\_metadata ORDER BY last\_accessed DESC LIMIT 5 — always includes recently accessed memories regardless of semantic match
- Merge and deduplicate by memory\_id → ~35–45 candidates. Hard timeout: 7 seconds. On Qdrant timeout: proceed with empty (chat continues). On Supabase metadata timeout: proceed with default importance scores.

### **Stage 3 — MemorySuppressor (hard filters, <10ms)**
- is\_active=False → suppress
- decay\_score < 0.08 → suppress
- confidence < 0.35 → suppress
- is\_sensitive=True AND emotional\_intensity > 0.85 AND intent != 'crisis' AND session\_count < 6 → suppress (early session, sensitive memory)
- type='emotional', is\_resolved=True, user not explicitly referencing → suppress
- Crisis override: when cl\_intent='crisis', NEVER suppress sensitive memories. Override rules 4 and 5.

### **Stage 4 — MEMOIR Scoring**
Each surviving candidate receives its S score using the formula in §3.4.1. Crisis memories: if is\_sensitive=True AND intent='crisis' → S = 1.0 (hard-pinned to top). Sort by S descending.

### **Stage 5 — Top-k Selection and Reinforcement**
- Select top 7 memories
- Type diversity: max 3 memories of the same type in top-7. Lowest-scoring excess replaced by next-highest of different type.
- Intent-aware bucket allocation (caps per intent):

|**Bucket**|**Casual**|**Emotional**|**Therapeutic**|**Crisis**|
| :- | :- | :- | :- | :- |
|Identity + contextual + preference|3|5|7|4|
|Behavioral (coping patterns)|1|2|4|3|
|Emotional (struggles, wins, fears)|1|2|3|4|
|Reflective (session patterns)|0|1|2|1|

- Reinforce all selected memories: MemoryCRUD.reinforce() → access\_count++, last\_accessed=now() in background thread.


## **3.6 Memory Injection — ContextComposer**
ContextComposer formats the top-7 memories into a structured natural-language briefing. This is what makes the AI feel like it knows the user — not a database readout, but a warm internal briefing.

### **3.6.1 Injection Format**
WHAT YOU KNOW ABOUT THIS PERSON

About them: [Name] is a [age-bracket] [occupation] based in [location].

`             `They prefer [communication\_style].

What they're going through: [active contextual memories, most important first]

What has helped them before: [behavioral memories — coping that worked]

Things you remember them sharing: [top emotional/identity memories by composite score]

Patterns you've noticed: [behavioral + reflective memories, if session\_count > 2]

Recent emotional trend: [one sentence from emotional arc + session summary synthesis]

### **3.6.2 Section Priority and Token Budget**

|**Section**|**Max tokens**|**Always included?**|
| :- | :- | :- |
|Identity + preference summary|150|Yes — never truncated|
|Active contextual memories|250|Yes if any exist|
|Emotional + behavioral memories|250|Yes if any exist|
|Reflective patterns|100|Only if session\_count > 3|
|Emotional trend line|50|Always|
|Total hard cap|550|Enforced by ContextComposer. Truncate from lowest composite score up.|

### **3.6.3 Narrative Mode (session ≥ 15)**
For established users with ≥15 sessions, ContextComposer switches to narrative mode: the user\_memory\_profile.narrative\_paragraph (200–250 words synthesized by Gemini every 10 sessions) replaces the bullet-point memory list. The model sounds like it truly knows the person — not like it is recalling facts.

### **3.6.4 Injection Gate: cl\_question\_allowed**
When cl\_question\_allowed=False (venting or crisis), ContextComposer suppresses episodic and affective memory injection. Only procedural (how to engage) and relational context are included. This prevents surfacing painful memories when the user just needs to be heard.

### **3.6.5 Sanitization Before Injection**
Every memory bullet passes through sanitize\_for\_injection() before assembly:

- Strips XML/HTML tags: regex <[^>]+>
- Strips injection patterns: 'ignore previous instructions', 'system:', 'you are now', 'forget everything', 'disregard', 'new instructions', '<system>'
- Strips control characters and null bytes
- Truncates any bullet exceeding 200 characters (ellipsis)
- Strips URLs and file paths
- Pattern matching is case-insensitive. Filtered bullets replaced with '[content filtered]'. Logged with memory\_id.


## **3.7 Memory Evolution & Decay**
### **3.7.1 Update Logic**

|**Scenario**|**Action**|
| :- | :- |
|New value, same field, explicit user statement|supersede(): insert new, set old is\_active=False with pointer|
|New value, same field, inferred|Add as candidate, increment frequency\_count if pattern repeats|
|Contradicts existing high-confidence (>0.8)|log\_contradiction() → memory\_contradictions table. Keep both. Resolve on next session confirmation.|
|Additive info (more detail on existing fact)|Update content field, refresh last\_confirmed, keep original memory\_id|
|Status change: user signals resolution|Update is\_resolved=True. Create win/milestone emotional memory if positive outcome.|
|Preference reinforcement|Reinforce(): access\_count++, confidence recalculated|

### **3.7.2 Contradiction Resolution Flow**
1. Contradiction flagged in QualityGate → memory\_contradictions table: status='pending'
1. Next session: model asks a natural clarifying question if context permits ('I think you mentioned X — has that changed?')
1. User response triggers resolution: confirmed new value → supersede old. Old value denied → reinforce old, discard new candidate.
1. Identity contradictions (name, age) require explicit user statement before supersede — no inferred resolution.

### **3.7.3 Decay System (nightly)**
decay\_score = confidence × exp(−λ × days\_since\_accessed) × min(access\_count / 8.0, 1.0)

|**decay\_score**|**Action**|
| :- | :- |
|< 0.10|Archived: is\_active=False. Excluded from retrieval. Retained in audit log.|
|< 0.05|Soft-deleted: invisible to all retrieval paths. Retained in Supabase for audit.|
|0\.10–1.0|Active. Decay score updated in Qdrant payload and Supabase memory\_metadata.|

- Runs as daemon thread started at app startup: DecayEngine.schedule\_nightly\_decay()
- Crisis memories: never auto-archived. Manual review required.
- User-requested deletion: hard delete from both Qdrant and Supabase. Logged to audit trail.



|**Part 4 — Human-Like Memory Design**|
| :-: |

# **4. Designing for Human-Like Memory**
This section defines how the system should behave at the human level — not what data it stores, but how it uses that data to make users feel genuinely remembered, understood, and cared for. Technical correctness without this layer produces a system that feels like a surveillance database.


## **4.1 Emotional Continuity**
Emotional continuity is the quality that makes users feel genuinely remembered across time. It is not about recalling facts — it is about holding emotional context the way a caring person would.

### **4.1.1 The Reference Principle**

|**PRINCIPLE**|A memory should be referenced explicitly only when it is directly relevant to what the user just said. The AI should never open a conversation with 'I remember you mentioned your father passed away.' It should hold that information and surface it only when the current message connects to it — the way a good friend would.|
| :-: | :- |

### **4.1.2 Natural vs Surveillance Reference**

|**Situation**|**Bad (surveillance)**|**Good (natural)**|
| :- | :- | :- |
|User: 'I've been feeling really low lately.' System has grief memory.|'I remember you told me your father passed away in March. How are you coping with that grief?'|'That kind of weight can build up — especially when you're still carrying something as big as losing your dad.'|
|User starts session after being away for a week.|'According to my records, you last spoke on [date] about your job interview.'|'How did that presentation go? You were pretty stressed about it last time.'|
|User mentions feeling isolated.|'I have noted that you often feel lonely. This is pattern number 3 in your behavioral profile.'|'It sounds like that loneliness has been sitting with you for a while now.'|

### **4.1.3 Session Continuity Bridge**
At the start of each session (first 1–2 messages), the AI may make one natural callback to an active contextual memory — only if composite score > 0.70 AND the last session was within 14 days. Maximum: one bridge per session. Never for crisis or grief history.

Pattern: 'Last time we talked, you were [ongoing situation]. How did that go?' — feels like a friend picking up a conversation.


## **4.2 Relationship Stages**
The familiarity and depth of the AI's engagement should evolve naturally with the relationship. Over-familiarity on session 1 feels invasive. Appropriate distance on session 20 feels cold.

|**Stage**|**Sessions**|**AI behavior**|**Memory usage**|
| :- | :- | :- | :- |
|Acquaintance|1–2|Warm but neutral. Asks open questions. Does not assume. Does not name-drop.|Only explicit onboarding data. No inference. No behavioral patterns.|
|Familiar|3–7|Starts making gentle connections. Light callbacks. Uses name occasionally.|Identity + top preference memories. Light contextual memories.|
|Trusted|8–20|Natural references to past. Notices patterns gently. Adapts tone without announcing it.|Full retrieval pipeline. Pattern references. Emotional continuity.|
|Established|20+|Deep personalization. Narrative mode injection. References growth over time.|Full retrieval + narrative paragraph + reflective memories + trend analysis.|

The R-term in the MEMOIR score (Relationship gate) enforces this: sensitive memories score 0.3× in sessions 1–3, 0.7× in sessions 4–8, and 1.0× after session 9. The system literally cannot over-share early.

### **4.2.1 Avoiding Over-Familiarity**
- Never open a session with crisis or heavy emotional history
- Never use the user's name more than twice per session
- Never surface memories older than 90 days without S > 0.80
- Never reference behavioral patterns explicitly: say 'it sounds like you've been under a lot of pressure' not 'I've noticed you usually message late at night when you're stressed'
- Maximum 2 explicit memory references per response — implicit shaping is preferred over explicit recall


## **4.3 Tone Personalization**
The communication style profile is built from behavioral memory (observed signals across sessions) and injected via the {intervention\_directive} and {language\_guidance} fields in the prompt. It adapts without being announced.

### **4.3.1 Communication Style Signals (inferred over sessions)**

|**Signal**|**Inference method**|**Effect on response**|
| :- | :- | :- |
|Prefers direct advice vs wants to vent first|Response to past recommendations: engagement after validation vs advice|intervention\_sequence: advice early vs validate first|
|High vs low formality|User's own message register (formal vocabulary vs casual/slang)|language\_guidance: match register|
|Comfortable with humor vs serious tone|User's emoji use, jokes, playful language|mi\_move: no\_move allows lighter touch|
|Prefers short vs detailed responses|Session engagement length, question follow-up rate|response\_length: short vs long|
|Language preference|Detected language per message, stored in user\_memory\_profile.language\_preference|cl\_language\_mirror: en | hi | hinglish|

### **4.3.2 Tone Injection Example**
HOW TO ENGAGE WITH THIS PERSON:

They respond better when given space to process before advice is offered.

They use informal language — match their register, not a formal one.

Keep responses concise — they don't engage well with long paragraphs.

Respond in Hinglish since that's how they write.


## **4.4 What MindMitra Knows — The Full Semantic Profile**
A complete semantic profile, built over time across all five memory types, covers four layers. This is the full picture that makes MindMitra feel like it truly knows someone:

**Who they are (identity layer)**

Name, age bracket, location, occupation, family structure, cultural background, language preference.

**How they live (preference + behavioral layer)**

When they reach out (timing patterns), what helps them (coping preferences), what frustrates them (negative preferences), how they communicate (style signals), what they're currently navigating (contextual layer).

**What they carry (emotional layer)**

Their significant struggles, losses, fears, unresolved conflicts, past crises. Their wins, milestones, things they're proud of. Their emotional trajectory across months — improving, staying stuck, or deteriorating.

**How they've grown (reflective layer)**

Patterns noticed across sessions. Growth observed. Coping strategies that have evolved. Generated by the Gemini session reflection job — not individual facts but the meaning of the facts combined into a narrative.



|**Part 5 — COMPASS × MEMOIR Integration**|
| :-: |

# **5. How COMPASS and MEMOIR Connect**
COMPASS and MEMOIR are not two systems running in parallel. They are one system where each layer actively informs the other. Every integration point below is a live data flow, not a conceptual connection.

|**Integration point**|**Direction**|**Data flow**|
| :- | :- | :- |
|Emotional state → memory retrieval|CognitiveLayer → MEMOIRScorer|cl\_emotional\_valence + cl\_emotional\_intensity feed the E-term (emotional congruence). Memories that match the user's current emotional state score higher.|
|Intent → memory retrieval|CognitiveLayer → MEMOIRScorer|cl\_intent feeds the I-term (intent alignment matrix). Venting → emotional memories score higher. Advice → behavioral memories score higher.|
|question\_allowed → memory injection|CognitiveLayer → ContextComposer|cl\_question\_allowed=False suppresses episodic and affective memory sections. Only procedural + relational injected when user is venting or in crisis.|
|memory\_context → prompt v2|ContextComposer → ResponseGenerator|ContextComposer output is the {memory\_context} variable in RESPONSE\_SYSTEM\_PROMPT\_V2. Memory shapes every response.|
|Risk level → sensitive memory gate|CognitiveLayer → MemorySuppressor|cl\_risk\_level='crisis' disables MemorySuppressor's sensitive-memory suppression rule. Crisis intent unlocks sensitive memory access.|
|Arc trajectory → risk escalation|EmotionalArcReader → CognitiveLayer|arc\_delta < -0.4 (sharp drop) → cognitive layer escalates risk\_level one tier. Arc falling → question\_allowed=False.|
|Session lifecycle → memory write|SessionLifecycle → MemoryStore|on\_message() triggers extraction at 12-message intervals. on\_session\_end() runs final extraction + Gemini summary. Narrative update every 10 sessions.|
|Narrative mode → prompt v2|user\_memory\_profile → ContextComposer → ResponseGenerator|user\_memory\_profile.narrative\_paragraph replaces bullet-point memory list for session ≥15. Injected via {memory\_context}.|
|Memory type → intervention selection|MEMOIR retrieval → CognitiveLayer intervention rules|Intent aligned with dominant retrieved memory type influences intervention\_sequence selection in INTERVENTION\_RULES.|



|**Part 6 — Deployment & Observability**|
| :-: |

# **6. Deployment & Observability**
## **6.1 Architecture Mode**

|**Parameter**|**Value**|
| :- | :- |
|Architecture|COMPASS + MEMOIR unified — always active. One pipeline. No flags.|
|Feature flags|None. NEW\_PIPELINE\_ENABLED and NEW\_RETRIEVAL\_ENABLED do not exist.|
|Legacy paths|None. IntentRouter, AnalysisEngine, mem0, and old 4-path pipeline are fully removed.|
|Rollback strategy|Git revert to previous commit. Deploy previous container image.|


## **6.2 Environment Variables (runtime config only)**

|**Variable**|**Purpose**|
| :- | :- |
|GROQ\_API\_KEY|Cognitive layer Qwen-32b calls|
|AZURE\_OPENAI\_KEY / AZURE\_ENDPOINT|ResponseGenerator Azure/GLM stream|
|ANTHROPIC\_API\_KEY|MemoryExtractor claude-haiku-4-5 calls|
|SUPABASE\_URL + SUPABASE\_KEY|Supabase client — memory\_metadata, session\_registry, all tables|
|QDRANT\_URL + QDRANT\_API\_KEY|Qdrant vector store|
|REDIS\_URL|Session cache. Required for multi-worker deployment.|
|ALLOW\_EVAL\_TRACE|'true' to enable X-MindMitra-Eval-Trace header diagnostics|


## **6.3 Observability — Log Prefixes**

|**Prefix**|**What it logs**|**Level**|
| :- | :- | :- |
|[COMPASS]|Cognitive layer call: intent, risk\_level, arc, intervention\_sequence, fallback\_used|INFO per request|
|[SAFETY-AUDIT]|OutputSafetyAuditor results: violations[], severity, session\_id|ERROR (critical) / WARNING|
|[ARC-UPDATE]|Post-stream arc delta: user\_valence, response\_valence, intent, arc\_direction|INFO per response|
|[MEMORY-MEMOIR]|Retrieval: memories\_retrieved, types, MEMOIR scores. Write: extracted, approved, rejected, contradictions|INFO per trigger|
|[SESSION]|Session lifecycle events: start, end, checkpoint, narrative update|INFO|
|[DECAY]|Nightly decay pass results: processed, archived, soft-deleted per user|INFO daily|


## **6.4 Eval Trace (X-MindMitra-Eval-Trace header)**
When ALLOW\_EVAL\_TRACE=true and header is present, ctx['\_eval\_data'] is written and returned in response metadata:

- cognitive\_layer: {intent, risk\_level, arc\_trajectory, arc\_delta, fallback\_used, question\_allowed, intervention\_sequence}
- arc: {current\_valence, arc\_direction, session\_low}
- memory: {memories\_retrieved, types\_used, memoir\_scores, context\_tokens\_used}



|**Part 7 — Failure Modes & Mitigations**|
| :-: |

# **7. Failure Modes**
Failures in a mental health system carry real risk. A wrong memory retrieval is not a minor UX bug — it can undermine trust, cause distress, or miss a crisis signal. Each failure mode has a defined root cause, detection signal, and mitigation.

|**Failure**|**Root cause**|**Detection**|**Mitigation**|
| :- | :- | :- | :- |
|Suicidal user classified as 'casual'|Subtle ideation without hard keywords|Sharp valence drop in arc|1\. Arc reader detects drop → risk escalated by deterministic rule. 2. Cognitive layer sees full message + arc context. 3. No dummy data — cl\_risk\_level is always real.|
|Cognitive layer LLM failure|Groq timeout or 503|fallback\_used=True in eval\_trace|Fallback: risk\_level='moderate', intent='emotional'. Never 'low'. Warm response, not crash.|
|Hinglish retrieval failure|BGE-M3 embedding drift on code-switched text|Non-English users report AI 'forgetting'|BGE-M3 natively multilingual. Hinglish heuristic markers in arc reader. Thread B keyword search catches named entities.|
|Stale memory retrieved|User's life changed, memory not updated|User contradicts AI reference|Decay archives unconfirmed old memories. Contradiction detection flags. Model uses hedging: 'I think you mentioned...'|
|Creepy over-personalization|Too many memories, surfaced too early|User feedback or session drop|R-term gates sensitive memories by session count. Max 2 explicit references per response. Behavioral patterns never referenced as patterns.|
|Prompt injection from memory|Adversarial user crafts extraction bait|[MEMORY-MEMOIR] filtered log|QualityGate strips at extraction. sanitize\_for\_injection() strips at assembly. Injection patterns case-insensitive.|
|Crisis memory not persisted|Async thread failure, Supabase timeout|Crisis memory absent in future sessions|Crisis writes use priority thread with 2s timeout. Dead-letter logging. Daily consistency check job.|
|Missing critical context|High-intensity message before 12-message trigger|User re-discloses in later session|Hot-path extraction: any message with intensity > 0.7 triggers immediate extraction regardless of counter.|
|OutputSafetyAuditor false negative|Novel harm phrasing not in patterns|Critical log absent for harmful response|Auditor is backstop only. Primary safety: crisis sentinel + cl\_risk\_level. Patterns expanded from logged events.|
|Hallucinated memory|Extraction LLM inferred fact not stated|User denies fact: 'I never said that'|verbatim\_anchor mandatory. confidence capped at 0.5 without direct quote. User correction triggers supersede.|



|**Part 8 — Scalability**|
| :-: |

# **8. Scalability Roadmap**

|**Phase**|**User scale**|**Changes required**|
| :- | :- | :- |
|Current (MVP)|0 → 1,000|Single Qdrant instance · Supabase free tier · Railway single worker · Redis via Upstash (replaces in-memory counter) · Daemon threads for async jobs|
|Post-beta|1,000 → 10,000|Qdrant horizontal sharding (2–4 shards) · Supabase read replicas · Move extraction + session-end jobs to Celery + Redis queue · APM tracing for all memory pipeline steps|
|Growth|10,000+|Qdrant Cloud managed cluster with auto-scaling · Supabase Pro with PgBouncer · Separate Celery workers for extraction vs session-end (different resource profiles) · BM25 sparse retrieval added alongside vector search|


## **8.1 Background Job Architecture**

|**Job**|**Frequency**|**Current impl**|**Scale impl**|
| :- | :- | :- | :- |
|Memory extraction|Every 12 messages + hot-path|Daemon thread|Celery task queue|
|Session summary (Gemini)|Every 36 messages + /end-session|Daemon thread|Celery + priority queue|
|Narrative synthesis (Gemini)|Every 10 sessions|Daemon thread|Celery + scheduled task|
|Decay engine|Nightly|Daemon thread + APScheduler|Celery Beat|
|Contradiction resolution|Next session after flag|In-request (lightweight)|Same|



|**Part 9 — Research Citations**|
| :-: |

# **9. Research Citations**
Every significant architectural decision in this document is grounded in published research. This section maps each citation to the specific decision it supports.

|**Citation**|**Architectural decision grounded**|
| :- | :- |
|Rashid et al. (2026). A cognitive layer architecture to support large-language model performance in psychotherapy interactions. Nature Medicine.|Cognitive layer design — deterministic expert rules + small classifier wrapping a general LLM outperformed standalone frontier models AND licensed human therapists on validated CBT competency scales. Grounds the intervention\_sequence selection, single-LLM-call approach, and why the cognitive layer (not the base model) does the therapeutic reasoning.|
|Mukherjee et al. (2024). Polaris: A Safety-focused LLM Constellation Architecture for Healthcare. arXiv:2403.13313.|Parallel fast-lane design: crisis sentinel, memory retrieval, and arc reader running concurrently. Specialist components supervising a primary generative model. Grounds the Stage 1A/1B/1C concurrent architecture.|
|Hipson & Mohammad (2021). Utterance Emotion Dynamics (UED). ACL 2021.|EmotionalArcReader: valence/arousal trajectory across utterances using the VAD framework. Arc direction classification (rising/falling/stable/volatile) and the arc\_delta risk escalation rule.|
|Miller & Rollnick (2013). Motivational Interviewing, 3rd edition.|OARS framework in mi\_move: Open questions, Affirm, Reflect, Summarize. MI spirit = autonomy-preserving, non-directive, empathy-first. Grounds the 'no question when venting' rule (cl\_question\_allowed=False) and the intervention\_sequence ordering (validate before advising).|
|Ireland & Pennebaker (2010). Language Style Matching.|cl\_language\_mirror and Hinglish mirroring in responses. Language style synchrony — matching how statements are phrased — is an objective predictor of perceived therapeutic empathy above and beyond the content of reflections.|
|Bower (1981). Mood-congruent memory retrieval. Psychological Review.|MEMOIR E-term (emotional congruence). Memories matching the user's current emotional valence are more likely to be relevant and to feel natural when referenced. Grounds the 0.20 weight on E.|
|Tulving (1972, 1985). Episodic and semantic memory. Organization of Memory.|The five memory type taxonomy — episodic and semantic as distinct systems. Extended with behavioral (procedural-like), emotional (affective), and contextual (situational) types for the companion AI context.|
|Nader (2000). Memory reconsolidation. Nature.|MEMOIR O-term (observational reinforcement). Memories accessed repeatedly become more stable and reliable through reconsolidation. Grounds the access\_count weight in scoring.|
|Ebbinghaus (1885). On Memory (Über das Gedächtnis).|DecayEngine formula: exp(−λ × days\_since\_accessed). Type-specific λ values (identity=0.001 slow, contextual=0.008 fast) calibrated to expected stability of each memory category.|
|Rogers (1965). Client-Centered Therapy.|The MindMitra persona foundation: unconditional positive regard, accurate empathy, and non-directive listening as the necessary conditions for change. Grounds the companion persona design ('not a therapist — a friend who listens completely').|




|**The North Star**|
| :-: |


**"**

***Would a perceptive, caring person who genuinely remembered this user do this?***

*If yes — implement it. If not — remove it.*




© 2026 MindMitra. Confidential.
Page 
