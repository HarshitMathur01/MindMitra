# MindMitra Retrieval-Augmented Generation (RAG)

## Scope
MindMitra currently implements memory-centric RAG, not document knowledge-base RAG.

## RAG Type
- Implemented: Conversation-memory RAG (user-specific memory retrieval)
- Planned: General document ingestion RAG (PDF/docs/wiki sources)

## Pipeline Stages

### 1. Document Ingestion
- Implemented: Ingestion of conversation-derived memory units from chat history
- Planned: Ingestion of external documents and enterprise knowledge sources

### 2. Chunking Strategy
- Implemented: Message-window chunking and memory extraction from recent conversation batches
- Planned: Token-aware semantic chunking for external documents

### 3. Embeddings
- Implemented: Local sentence embeddings for memory vectors
- Planned: Optional pluggable embedding backends

### 4. Vector Storage
- Implemented: Vector database storage for user memory items
- Planned: Multi-collection strategy for tenant/workspace separation at scale

### 5. Retrieval
- Implemented: Query-time memory retrieval with composite scoring
  - relevance
  - importance
  - recency
- Implemented: Intent-aware retrieval limits
- Planned: Hybrid retrieval (dense + sparse lexical)

### 6. Prompt Enrichment
- Implemented: Retrieved memory context injected into generation prompt
- Implemented: Emotional trend and reflection context enrichment
- Planned: Retrieval trace metadata returned to clients for explainability

### 7. Answer Generation
- Implemented: Model-generated responses conditioned on retrieved memory and routing path
- Implemented: Safety routing that can bypass normal generation for crisis cases
- Planned: Confidence-calibrated answer gating with abstain behavior

## Current Gaps
- No external document ingestion pipeline
- No document parser/chunker stack
- No first-class knowledge-base governance layer

## Production Notes
Current system quality is heavily dependent on conversation-memory freshness and scoring quality, not external corpus coverage.
