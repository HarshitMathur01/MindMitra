# MindMitra System Architecture

## Purpose
This document describes the production architecture at a system level. It is intentionally implementation-agnostic and avoids code-level details.

## System Overview
MindMitra is a two-tier AI mental health platform:
- Frontend: web client for chat, onboarding, voice input, therapeutic games, and 3D avatar playback
- Backend: API and orchestration layer for routing, safety, memory retrieval, and response generation

External systems provide authentication, persistence, vector search, and model inference.

## Core Components
- Client application: user interaction, auth flow, session UX, voice capture, avatar playback
- API service: request validation, auth checks, orchestration, streaming responses
- AI orchestration: intent routing, safety gating, modality selection, response generation
- Memory subsystem: semantic retrieval, scoring, synthesis, cross-session continuity
- Data subsystem: transactional user/session/activity data with access control
- Model providers: separate models for routing, therapeutic generation, summaries, and speech fallback

## High-Level Data Flow
1. User submits text or voice.
2. Client sends request with auth token.
3. API validates auth and builds context.
4. Orchestration performs intent and safety checks.
5. Memory retrieval enriches context.
6. Generation model returns response.
7. API returns message plus avatar metadata.
8. Client renders text and drives avatar expression/speech.

## Streaming Flow
1. Client opens server-sent events stream.
2. Backend starts orchestration and emits text deltas.
3. Backend emits final text and avatar metadata.
4. Backend emits completion or error event.

## Safety Architecture
- Multi-layer crisis detection precedes or overrides normal routing.
- Crisis path prioritizes immediate safe response behavior.
- Escalation can occur before or during deeper analysis.

## Architecture Boundaries
- Client handles presentation and avatar speech playback.
- Backend handles orchestration, safety, and memory logic.
- Persistence and vector search are delegated to managed infrastructure.

## External Services
- Auth + relational data service
- Vector database service
- LLM providers for routing, therapeutic output, summarization, and analysis
- Speech-to-text fallback provider

## Implementation Status
- Overall layered architecture: Implemented
- Streaming response architecture: Implemented
- Safety-first crisis gate: Implemented
- Separation of orchestration and memory subsystems: Implemented
- Formal rate-limiting and traffic shaping: Planned
