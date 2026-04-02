# MindMitra Memory System

## Purpose
This document defines memory behavior used for continuity and personalization across sessions.

## Memory Types
- Semantic memory: user facts and stable preferences
- Procedural memory: coping approaches and what has helped
- Reflection memory: synthesized cross-session insights
- Crisis memory: high-importance crisis-related records

## Memory Storage
- Vector storage for retrieval-oriented memory entries
- Relational metadata for importance, type, and access timestamps
- Session summaries for cross-session context continuity

## Write Logic

### Triggered Writes
- Periodic extraction from recent conversation windows
- Session-end summarization jobs
- Procedural synthesis when coping/strategy signals are present
- Reflection generation on interval-based cadence
- Crisis-specific memory write on high-risk events

### Write Mode
- Non-blocking background execution for post-response jobs
- Best-effort with fallback behavior when providers are unavailable

## Read Logic

### Retrieval Path
1. Retrieve candidate memories for a user query.
2. Join metadata for scoring.
3. Compute composite score.
4. Select memories by intent-aware limits.
5. Format context for generation.

### Scoring Dimensions
- Relevance: similarity to current query
- Importance: model-assigned metadata score
- Recency: decay-based freshness factor

## Context Assembly
- Semantic memories for personal continuity
- Procedural memories for practical support continuity
- Reflection memories for deeper pattern continuity
- Emotional trend summary for trajectory awareness

## Lifecycle and Operations
- Access timestamps updated on retrieval
- Metadata continuously updated after extraction
- Reflection and trend generation use cached and periodic strategies

## Implementation Status
- Multi-type memory model: Implemented
- Composite retrieval scoring: Implemented
- Background write pipeline: Implemented
- Cross-session summary and trend continuity: Implemented
- Human-reviewed memory curation workflow: Planned
