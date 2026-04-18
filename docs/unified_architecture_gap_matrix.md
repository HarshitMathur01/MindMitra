# Unified Architecture Gap Matrix (PDF vs Code)

This matrix maps each non-negotiable requirement from `chatbotAgent/detailedArchitecture/MindMitra_Unified_Architecture.pdf` to the **current implementation** and the **required change** to align “ditto”.

## COMPASS — Lifecycle & routing

| PDF requirement | Current implementation | Gap / required change | Primary files |
|---|---|---|---|
| Stage 1 runs **CrisisSentinel + MEMOIR retrieval + ArcReader in parallel** | Stage 1 runs **arc + cross-session trend** in parallel; MEMOIR retrieval happens **after** cognitive layer | Reorder & refactor orchestrator to run MEMOIR retrieval in Stage 1B (parallel) and feed its output into stage-3 assembler | `chatbotAgent/app/pipeline/pipeline_orchestrator.py` |
| CognitiveLayer model is **Groq/Qwen-32b**, temp=0.1, max_tokens=256 | Orchestrator initializes CognitiveLayer with model default `"llama-3.1-8b-instant"` | Switch to Qwen-32b per PDF; ensure params + timeout & fallback behavior match | `chatbotAgent/app/pipeline/pipeline_orchestrator.py`, `chatbotAgent/app/core/cognitive_layer.py` |
| “No flags. No dual-mode. No legacy paths.” IntentRouter/AnalysisEngine/mem0 removed | IntentRouter exists (disabled); mem0 exists & is used as Qdrant substrate; mem0.add exists gated by config; numerous debug env toggles | Remove unused legacy modules/paths or make them unreachable; replace mem0 dependency with direct Qdrant client usage where needed | `chatbotAgent/app/pipeline/pipeline_orchestrator.py`, `chatbotAgent/app/agents/memory_store.py` |
| Path D uses **static crisis templates** in `app/core/crisis_templates.py`; ResponseGenerator not called | Orchestrator uses `core/crisis_templates.build_warm_crisis_response` (good), but duplicate crisis templates also live in prompts | Remove duplicate crisis templates from prompts (or ensure unused); align languages/severities count | `chatbotAgent/app/core/crisis_templates.py`, `chatbotAgent/app/core/prompts.py` |
| System prompt v2 is sole active prompt template | Prompt exists; OK, but other prompts remain and style constraints can be violated by fallback message | Fix fallback response to not violate system prompt “never start with I hear you…” | `chatbotAgent/app/core/prompts.py`, `chatbotAgent/app/agents/response_agent.py` |
| LLM stream begins at Stage 4 and SSE contract is consistent | `/chat/stream` emits deltas then re-sends full text again; emits `avatar_ready`; docstring references other events | Align SSE event contract to single consistent delta stream + completion; remove duplicate final message emit if not required | `chatbotAgent/app/api/chat.py` |

## MEMOIR — Taxonomy & storage

| PDF requirement | Current implementation | Gap / required change | Primary files |
|---|---|---|---|
| Memory taxonomy uses **5 types**: identity, preference, behavioral, emotional, contextual | Mixed taxonomy: `semantic/episodic/affective/procedural`, plus `pipeline_memory_type` | Refactor candidate types, DB mapping, and scorer to the 5-type taxonomy | `chatbotAgent/app/core/memory_pipeline_types.py`, `chatbotAgent/app/core/memory_crud.py`, `chatbotAgent/app/core/memoir_scorer.py`, `chatbotAgent/app/agents/memory_retriever.py` |
| Qdrant embedding model is **BAAI/bge-m3 1024d**, query prefix on `is_query=True` | Embedding service supports BGE prefix and defaults to bge-m3; BUT `MemoryStore` imports constants `EMBEDDING_MODEL/EMBEDDING_DIMS` and may still reflect older env defaults depending on load order | Remove frozen constants usage; ensure runtime config uses env-backed `embedding_settings` consistently; verify Qdrant collection dims match | `chatbotAgent/app/core/embedder.py`, `chatbotAgent/app/core/embedding_settings.py`, `chatbotAgent/app/agents/memory_store.py` |
| Supabase `memory_metadata` mirrors payload with rich fields (importance, decay, resolved, etc.) | Present; migration adds lexical+governance fields; `MemoryCRUD.insert` writes a subset and collapses `memory_type` to semantic/procedural | Update `MemoryCRUD` to store correct `type` + fields per 5-type taxonomy; avoid collapsing types | `chatbotAgent/app/core/memory_crud.py`, migrations |

## MEMOIR — Retrieval pipeline

| PDF requirement | Current implementation | Gap / required change | Primary files |
|---|---|---|---|
| Stage 0 short-circuit uses Redis key `user:{id}:has_memories` TTL 120s | In-process `_has_memories_cache` (dict) + Supabase count; Redis key contract not implemented here | Implement Redis key contract for has_memories/memory_context/session_buffer or route through existing redis layer | `chatbotAgent/app/agents/memory_retriever.py`, `chatbotAgent/app/core/redis_working_memory.py` |
| Stage 2 candidate retrieval is exactly **3 threads** (dense + keyword/structured + recency) | Uses 5 futures: dense, keyword rows, recency, lexical rpc, session summaries | Remove or rework lexical + session summaries to match PDF “ditto” (likely: remove from hot path) | `chatbotAgent/app/agents/memory_retriever.py` |
| Suppressor rules include decay/confidence thresholds and session_count sensitive gating | MemorySuppressor exists; rules may differ in thresholds and type mapping | Align suppressor thresholds & crisis overrides exactly | `chatbotAgent/app/core/memory_suppressor.py` |
| Scoring uses 6-dim formula with **hard floor S<0.25 drop** and resolved emotional intensity halving | Scorer rounds 0..1; no explicit hard floor drop; no resolved intensity adjustment | Implement hard floor and resolved adjustment; implement intent bucket allocation caps for top-7 | `chatbotAgent/app/core/memoir_scorer.py`, `chatbotAgent/app/agents/memory_retriever.py` |
| Reinforce all selected memories async | Reinforce scheduled per memory via daemon threads (good) | Ensure reinforce is executed for all selected, and uses correct access_count/last_accessed fields | `chatbotAgent/app/agents/memory_retriever.py`, `chatbotAgent/app/core/memory_crud.py` |

## MEMOIR — Injection (ContextComposer)

| PDF requirement | Current implementation | Gap / required change | Primary files |
|---|---|---|---|
| Output format must match “WHAT YOU KNOW ABOUT THIS PERSON” sections and token caps | Composer exists but format/sections likely differ; narrative mode needs verification | Update format to exact sections; enforce 550 token cap; narrative mode session>=15 | `chatbotAgent/app/core/context_composer.py` |
| Gate: when `cl_question_allowed=False`, suppress episodic/affective injection | Current composer gate needs verification; memory_reference_allowed is used elsewhere | Implement suppression exactly per PDF and taxonomy | `chatbotAgent/app/core/context_composer.py` |

## Memory write pipeline (post-stream)

| PDF requirement | Current implementation | Gap / required change | Primary files |
|---|---|---|---|
| Extraction model is **claude-haiku-4-5** | Structured extraction provider is built from Groq client | Switch extraction provider to Anthropic `claude-haiku-4-5`; keep Groq only for CognitiveLayer | `chatbotAgent/app/core/memory_extraction_providers.py`, `chatbotAgent/app/agents/memory_store.py` |
| Hot-path extraction triggers when intensity>0.7 | SignalClassifier has rules; coupling to arc intensity needs enforcement | Wire arc intensity into trigger policy; ensure immediate extraction path exists | `chatbotAgent/app/core/signal_classifier.py`, `chatbotAgent/app/core/session_lifecycle.py`, `chatbotAgent/app/api/chat.py` |
| Trigger schedule: every 12 messages; every 36 + Gemini summary; every 10 sessions narrative update; nightly decay | SessionLifecycle exists; verify exact intervals and narrative update logic | Align exact intervals and job triggering; ensure nightly decay scheduler exists and behaves per PDF | `chatbotAgent/app/core/session_lifecycle.py`, `chatbotAgent/app/core/decay_engine.py` |

