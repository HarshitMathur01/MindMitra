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

## MindGym (Therapeutic Practices)
MindGym is an **offline practices toolkit** inside the web client.

- Hub route: `/mindgym`
- Tool route: `/mindgym/:toolId` (lazy-loaded)

MindGym tracks XP/streak/badges in browser localStorage and runs its own client-side crisis overlay UI.
For implementation details, see `docs/mindgym.md`.

## Architecture Boundaries
- Client handles presentation and avatar speech playback.
- Backend handles orchestration, safety, and memory logic.
- Persistence and vector search are delegated to managed infrastructure.

## External Services
- Auth + relational data service
- Vector database service
- LLM providers for routing, therapeutic output, summarization, and analysis
- Speech-to-text fallback provider
- Azure Cognitive Services — Speech SDK (browser-side, primary TTS with real word-boundary timestamps for lipsync)
- Azure Cognitive Services — TTS REST API (browser-side, fallback when SDK unavailable)
- Web Speech API (browser built-in, last-resort fallback when no TTS keys configured)

## Avatar / TTS Speech Flow
1. After full LLM response arrives the client sends the complete text to the avatar iframe.
2. The avatar iframe splits the text into sentences and synthesises via Azure Speech SDK.
3. The SDK fires `wordBoundary` events with exact per-word audio offsets (100-ns ticks).
4. All sentence audio buffers are concatenated into a single AudioBuffer.
5. TalkingHead.speakAudio() is called exactly once with the combined buffer and real word timestamps.
6. This produces continuous gap-free audio with lipsync anchored to actual phoneme positions.
7. If the SDK fails, the REST API path is used with linear-interpolation word timings as fallback.

## Therapist Bridge (clinician handoff)
- **Purpose:** Build a consent-scoped, provenance-aware brief from relational data (`user_activities`, `session_summaries`, `crisis_events`, screening scores in `user_contexts`) and optional guarded LLM narrative — exposed as FastAPI routes under `/therapist-bridge/*`.
- **Persistence:** `therapist_profile_snapshots` and `therapist_referrals` (Supabase) store immutable snapshots and opaque `clinician_view_token` for brief retrieval.
- **Client:** The web app calls the same backend as chat via `VITE_BACKEND_URL`; MindGym completions can be mirrored into `user_activities` when `privacy_therapist_share` is enabled.
- **Safety:** Crisis rows remain without user message text; narrative layer forbids diagnostic labels and requires evidence refs validated against Layer A/B.

## Implementation Status
- Overall layered architecture: Implemented
- Streaming response architecture: Implemented
- Safety-first crisis gate: Implemented
- Separation of orchestration and memory subsystems: Implemented
- Therapist Bridge snapshot + referral API: Implemented
- Formal rate-limiting and traffic shaping: Planned
