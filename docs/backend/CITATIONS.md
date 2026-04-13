# Research & architecture references

**TL;DR:** Academic / product precedents for **composite memory scoring**, **reflections**, **CoE-style reasoning**, **screening**, and **persona**. **Code mapping** points to the real modules (memory is split across `memory_store`, `memory_retriever`, `memory_reflection` — not only `memory_manager.py`).

---

## Memory & retrieval

| Topic | Reference | Used in MindMitra | Code (authoritative) |
|-------|-----------|-------------------|----------------------|
| Composite score (relevance + importance + recency) | Park et al., *Generative Agents*, UIST 2023 ([arXiv:2304.03442](https://arxiv.org/abs/2304.03442)) | Linear blend before intent caps | `memory_retriever.py` — scoring + filter |
| Reflection synthesis | Park et al. §5.3 | Periodic meta-insights → mem0 | `memory_reflection.py` — `generate_reflections` |
| Episodic vs procedural | Tulving (1972) | Procedural bucket + synthesis | `memory_reflection.py` — `synthesize_procedural_memory` |
| LLM importance at write | Park et al. §5.1 | 1–10 on extract | `memory_store.py` — `_score_importance_batch` |
| Recency decay | Ebbinghaus; formalized in Park et al. | `RECENCY_DECAY_RATE ** hours` | `memory_retriever.py` |
| Affective trajectory | Picard (1997) — concept | Cross-session trend string | `memory_reflection.py` — `get_emotional_trend` |
| mem0 + Qdrant | [mem0](https://github.com/mem0ai/mem0), [Qdrant](https://qdrant.tech/) | Extraction + vector IO | `memory_store.py` + mem0 config |

---

## Response generation

| Topic | Reference | Used in MindMitra | Code |
|-------|-----------|-------------------|------|
| CoE / empathy reasoning | Lee et al., *Chain of Empathy* ([arXiv:2311.04915](https://arxiv.org/abs/2311.04915)) | Intervention → short “lens” line in system prompt; strip `<think>` if emitted | `response_agent.py` — `_build_system_prompt`, `_clean` |
| Retrieval + instruction + persona | Zheng et al. RAISE pattern ([arXiv:2308.11584](https://arxiv.org/abs/2308.11584)) | Identity + memory block + strategy | Same — prompt slots |
| Routed “agents” | Wang et al. survey ([arXiv:2308.11432](https://arxiv.org/abs/2308.11432)) | Intent → path A/B/C/D | `workflow.py`, `pipeline_orchestrator.py` |
| Persona fidelity | Wang et al., *InCharacter* ([arXiv:2310.17976](https://arxiv.org/abs/2310.17976)) | Per-companion blocks | `response_agent.py` — personality instructions |
| Cultural / social context | Zhou et al., *SOTOPIA* ([arXiv:2404.04204](https://arxiv.org/abs/2404.04204)) | `cultural_pressure` etc. in Path B analysis | `workflow.py` + `response_agent.py` |

**CoE intervention → lens (summary):** `validate` → presence; `reframe` → CBT-style invite; `ground` → DBT-style anchor; `problem-solve` → small step; `refer` → handoff; `psychoeducation` → normalize. Full mapping lives in code comments next to `COE_REASONING` / directives.

---

## Screening

| Tool | Reference | Used in MindMitra | Code |
|------|-----------|-------------------|------|
| PHQ-9 | Kroenke et al. (2001) | Session-level JSON scores | `screening_agent.py` |
| GAD-7 | Spitzer et al. (2006) | Same | `screening_agent.py` |
| EMA | — | `ema = α·raw + (1-α)·prev` (`SCREENING_EMA_ALPHA` in `constants.py`) | Screening persistence via `supabase_service` |

Severities feed **screening hint** into `IntentRouter.classify` (orchestrator) when PHQ-9 / GAD-7 crosses configured thresholds.

---

## Therapeutic frames (product, not diagnoses)

| Frame | Typical use |
|-------|----------------|
| PCT-style validation | `validate` |
| CBT reframe | `reframe` |
| DBT grounding | `ground` |
| Agency / next step | `problem-solve` |
| Professional referral | `refer` / Path D |
| Normalize + educate | `psychoeducation` |

---

## Safety & latency (design constraints)

- Crisis: keyword layer + optional LLM + Path D templates; **helplines in** `crisis_manager.py`.
- Latency order-of-magnitude: A < B < C; D template-only.

---

## Stale markers

If a paper row’s **Code** cell disagrees with grep, **code wins** — open a PR to fix this table only.
