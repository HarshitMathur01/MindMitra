# AI Operating Instructions for MindMitra

## Role
You are assisting with a production-grade mental health AI application. Favor correctness, safety, and maintainability over speed.

## Source-of-Truth Priority
Before coding, read in this order:
1. /docs/README.md
2. /docs/api_contracts.md
3. /docs/architecture.md
4. /docs/MEMORY.md
5. /docs/therapist_bridge.md
6. /README.md

If any old document conflicts with these files, treat /docs and /README as authoritative.

## Coding Rules
- Preserve crisis-safety behavior and never bypass crisis checks.
- Do not alter API contracts without updating /docs/api_contracts.md.
- Do not alter memory behavior without updating /docs/MEMORY.md and/or /docs/backend/MEMORY_ARCHITECTURE.md.
- Keep orchestration and presentation concerns separated.
- Prefer small, auditable changes over broad rewrites.
- Keep fallback behavior intact for external provider failures.
- Avoid introducing hidden state or implicit side effects.

## Architecture Rules
- Client handles UI/avatar playback concerns.
- Backend handles routing, safety, retrieval, and generation.
- Memory retrieval must remain deterministic and scored.
- Background jobs must remain non-blocking for request path latency.

## Change Management Rules
When touching these areas, update docs in the same change:
- API route or schema change -> /docs/api_contracts.md
- Retrieval or memory trigger/scoring change -> /docs/MEMORY.md and /docs/backend/MEMORY_ARCHITECTURE.md
- System flow change -> /docs/architecture.md
- Therapist clinical metric or profile definition change -> /docs/therapist_bridge.md
- Setup or developer workflow change -> /README.md

## Quality Bar
- No undocumented behavior changes.
- No stale endpoint names in docs.
- Maintain backward compatibility unless explicitly approved.
- Add/update tests when changing API behavior or critical orchestration logic.

## Safety and Compliance
- This application operates in a mental health context.
- Prefer conservative behavior on ambiguity and provider failures.
- Preserve escalation pathways and supportive fallback messaging.

## Definition of Done for AI Changes
- Code compiles and/or runs in current environment.
- Contracts and architecture docs remain aligned.
- No unresolved drift between implementation and docs.
