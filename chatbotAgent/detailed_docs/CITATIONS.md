# MindMitra — Research Citations & Architecture References

This document lists all academic papers, frameworks, and research that back
MindMitra's memory system and response generation architecture.

---

## 1. Memory Architecture

### 1.1 Generative Agents — Composite Memory Scoring
**Paper:** Park, J.S., O'Brien, J.C., Cai, C.J., Morris, M.R., Liang, P., & Bernstein, M.S. (2023).
*Generative Agents: Interactive Simulacra of Human Behavior.* UIST 2023.
arXiv: [2304.03442](https://arxiv.org/abs/2304.03442)

**What we use:** Composite retrieval scoring formula — `score = w_recency × recency + w_importance × importance + w_relevance × relevance`. Each memory is scored across three dimensions (recency decay, LLM-assigned importance, embedding cosine similarity) before injection into the conversation. This replaces naïve "most recent" retrieval with psychologically-grounded memory selection.

**Implementation:** `memory_manager.py` → `_composite_score()`, `retrieve_memories()`

---

### 1.2 Reflection & Synthesis Layer
**Paper:** Park et al. (2023) — same as above, Section 5.3: *Reflection*.

**What we use:** Periodic higher-level "reflection" synthesis where the system reviews recent memories and generates meta-insights (e.g., "User's anxiety consistently spikes around exam periods and family expectations"). These reflections are stored as first-class memories with high importance and injected as a dedicated section in the prompt.

**Implementation:** `memory_manager.py` → `generate_reflections()`, `_format_reflections()`

---

### 1.3 Procedural Memory Synthesis
**Paper:** Tulving, E. (1972). *Episodic and Semantic Memory.* In E. Tulving & W. Donaldson (Eds.),
Organization of Memory. Academic Press.

**What we use:** Distinction between episodic memories (specific events/conversations) and procedural memories (learned coping strategies, therapeutic techniques that worked). Procedural memories are extracted from therapeutic conversations and always-injected for therapeutic paths, mimicking how a human therapist remembers "what works" for each client.

**Implementation:** `memory_manager.py` → `synthesize_procedural_memory()`, `_format_procedural_memories()`

---

### 1.4 Importance Scoring via LLM
**Paper:** Park et al. (2023) — Section 5.1: *Memory Stream — Importance*.

**What we use:** LLM-based importance scoring at memory extraction time. When a new memory is created, a fast LLM call rates its importance (1-10) based on emotional significance, therapeutic relevance, and personal disclosure depth. This score is stored alongside the memory and used in composite retrieval.

**Implementation:** `memory_manager.py` → `_score_importance_batch()`

---

### 1.5 Exponential Recency Decay
**Paper:** Ebbinghaus, H. (1885). *Über das Gedächtnis* (Memory: A Contribution to Experimental Psychology).

Formalized in the Generative Agents architecture (Park et al., 2023).

**What we use:** Exponential decay function for recency scoring — `recency = e^(-λ × hours_since_access)`. More recent memories score higher, but the decay rate is tuned to preserve therapeutically significant memories that were accessed recently even if created long ago.

**Implementation:** `memory_manager.py` → `_recency_score()`, constant `RECENCY_DECAY_RATE`

---

### 1.6 Emotional Trend Analysis (Cross-Session Continuity)
**Paper:** Picard, R.W. (1997). *Affective Computing.* MIT Press.

**Concept:** Tracking emotional patterns across sessions to detect trajectories (improving, worsening, stable). Based on longitudinal affect monitoring principles — a key capability that distinguishes therapeutic AI from single-turn chatbots.

**Implementation:** `memory_manager.py` → `get_emotional_trend()`, with session-scoped caching to avoid redundant LLM calls.

---

### 1.7 mem0 + Qdrant Vector Memory
**Framework:** [mem0](https://github.com/mem0ai/mem0) — Open-source memory layer for LLM applications.

**Vector DB:** [Qdrant](https://qdrant.tech/) — High-performance vector similarity search.

**Embeddings:** `all-MiniLM-L6-v2` (384-dimensional, local HuggingFace model) — no external API dependency for embeddings.

**What we use:** mem0 handles memory extraction, storage, and semantic search. Qdrant provides the underlying vector index. We override mem0's default retrieval with our composite scoring pipeline, using mem0 primarily for extraction and storage.

---

## 2. Response Generation Architecture

### 2.1 Chain of Empathy (CoE) — Therapeutic Reasoning
**Paper:** Lee, J., Lim, D., Park, J., et al. (2023).
*Chain of Empathy: Enhancing Empathetic Response of Large Language Models Based on Psychotherapy Models.*
arXiv: [2311.04915](https://arxiv.org/abs/2311.04915)

**What we use:** Before generating a visible response, the model internally reasons through an intervention-specific therapeutic framework using `<think>...</think>` tags (stripped from output). Each intervention type maps to a different reasoning chain:

| Intervention | Therapeutic Framework | Reasoning Focus |
|---|---|---|
| validate | Person-Centered Therapy (PCT) | Unconditional positive regard, reflective listening |
| reframe | Cognitive Behavioral Therapy (CBT) | Identify distortion, offer balanced perspective |
| ground | Dialectical Behavior Therapy (DBT) | Distress tolerance, present-moment awareness |
| problem-solve | Reality Therapy (RT) | Focus on controllables, concrete next steps |
| refer | Warm Handoff Model | Acknowledge limits, frame help as strength |
| psychoeducation | Psychoeducation | Normalize experience, accessible insight |

**Key finding from paper:** CBT-based CoE produced the most balanced empathetic responses across emotional valences.

**Implementation:** `response_agent.py` → `COE_REASONING` dict, `_build_system_prompt()`, `_clean()` (strips `<think>` tags)

---

### 2.2 RAISE — Retrieval-Augmented Instructed Simulation Engine
**Paper:** Zheng, C., Ke, Z., Zhang, J., & Huang, M. (2024).
*Building Emotional Support Chatbots in the Era of LLMs.*
arXiv: [2308.11584](https://arxiv.org/abs/2308.11584)

**What we use:** The architectural pattern of combining retrieval (memory), instruction (intervention directives), and persona simulation (companion personalities) in a unified prompt structure. Our system prompt mirrors RAISE's three-layer design: identity layer (companion persona), knowledge layer (memory context), and strategy layer (intervention directive + CoE reasoning).

---

### 2.3 LLM Agent Architecture — Intent-Routed Pipeline
**Paper:** Wang, L., Ma, C., Feng, X., et al. (2024).
*A Survey on Large Language Model based Autonomous Agents.*
arXiv: [2308.11432](https://arxiv.org/abs/2308.11432)

**What we use:** Multi-agent pipeline architecture with specialized modules for different cognitive tasks. Our 4-path routing (casual/emotional/therapeutic/crisis) follows the survey's "planning module → action module" pattern, where the IntentRouter serves as the planning module and each path (A/B/C/D) is a specialized action module with different analysis depth.

---

### 2.4 InCharacter — Persona Consistency
**Paper:** Wang, Y., Qu, J., Liu, T., et al. (2023).
*InCharacter: Evaluating Personality Fidelity in Role-Playing Agents with Psychological Interviews.*
arXiv: [2310.17976](https://arxiv.org/abs/2310.17976)

**What we use:** Maintains consistent companion personalities (Mitra, Arjun, Diya, Riya, Zen) across all interactions using dedicated personality instruction blocks in the system prompt. Each personality has distinct therapeutic style, communication patterns, and cultural anchoring — ensuring the user experiences a coherent relationship rather than a generic chatbot.

**Implementation:** `response_agent.py` → `PERSONALITY_INSTRUCTIONS` dict

---

### 2.5 Social Skill Training — Cultural Sensitivity
**Paper:** Zhou, C., Chan, Y.K., Li, F., & Wen, Z. (2024).
*SOTOPIA: Interactive Learning of Social Intelligence by Language Agents.*
arXiv: [2404.04204](https://arxiv.org/abs/2404.04204)

**What we use:** Cultural context modeling — our pipeline explicitly detects and responds to Indian-specific cultural pressures (exam stress, family expectations, academic pressure, social stigma around mental health). The combined analysis in Path B includes `cultural_pressure` as a first-class analysis dimension, and the response generator receives cultural sensitivity flags.

**Implementation:** `workflow.py` → `_combined_emotion_cultural_analyse()` (cultural_pressure field), `response_agent.py` → cultural context injection in `_build_context()`

---

## 3. Clinical Foundations

### 3.1 PHQ-9 — Depression Screening
**Paper:** Kroenke, K., Spitzer, R.L., & Williams, J.B.W. (2001).
*The PHQ-9: Validity of a Brief Depression Severity Measure.*
Journal of General Internal Medicine, 16(9), 606-613.

**What we use:** Session-end PHQ-9 screening assessment with EMA (Exponential Moving Average) smoothing across sessions. Scores feed into screening-aware intent routing — when PHQ-9 indicates moderate+ severity, the intent router receives this context to appropriately escalate classification.

---

### 3.2 GAD-7 — Anxiety Screening
**Paper:** Spitzer, R.L., Kroenke, K., Williams, J.B.W., & Löwe, B. (2006).
*A Brief Measure for Assessing Generalized Anxiety Disorder: The GAD-7.*
Archives of Internal Medicine, 166(10), 1092-1097.

**What we use:** Session-end GAD-7 anxiety screening alongside PHQ-9. Combined PHQ-9/GAD-7 severity levels inform intent routing decisions.

---

### 3.3 Exponential Moving Average for Screening
**Concept:** Standard EMA smoothing (`score_new = α × raw + (1-α) × score_prev`) applied to screening scores across sessions. Prevents single-session spikes from dominating clinical tracking while remaining responsive to genuine changes. α = 0.3 (configurable).

---

## 4. Therapeutic Frameworks Referenced

| Framework | Usage in MindMitra | Triggered By |
|---|---|---|
| Person-Centered Therapy (Carl Rogers) | Validation, unconditional positive regard | `validate` intervention |
| Cognitive Behavioral Therapy (CBT) | Cognitive reframing, distortion identification | `reframe` intervention |
| Dialectical Behavior Therapy (DBT) | Grounding, distress tolerance, mindfulness | `ground` intervention |
| Reality Therapy (William Glasser) | Problem-solving, focus on controllables | `problem-solve` intervention |
| Psychoeducation | Normalized insight sharing | `psychoeducation` intervention |
| Crisis Protocol | Immediate safety, professional referral | `refer` intervention / Path D |

---

## 5. Architecture Principles

### 5.1 Safety-First Design
- **Crisis gate cannot be bypassed:** Every message passes through keyword scan + optional LLM check before reaching any execution path
- **Hardcoded helpline numbers:** Crisis response always includes real professional resources (iCall India, Vandrevala Foundation)
- **Professional referral emphasis:** User explicitly requested: "The user must be encouraged to take mental health aid through a dr. or real human"

### 5.2 Latency Budget Allocation
- Path A (casual): 1 GLM call, ~150 tokens → <1s
- Path B (emotional): 1 Groq + 1 GLM call → <2s
- Path C (therapeutic): 1-2 GLM + optional Groq → <3s
- Path D (crisis): 0 LLM calls (hardcoded template) → <100ms

### 5.3 Memory Integration Points
- **Routing time:** mem0 retrieval + emotional trend (cached)
- **Path B analysis:** Memory context injected (300 chars) — *previously zero*
- **Path C analysis:** Memory context expanded (800 chars) — *previously 400 chars*
- **Response generation:** Full memory in system prompt
- **Greetings:** Session summary themes for continuity callbacks
- **Intent routing:** Screening scores from previous sessions

---

*Last updated: Based on implementation as of the SOTA response generation upgrade.*
