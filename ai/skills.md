# AI Skills and Change Permissions

## Purpose
Define what AI can change autonomously and what requires explicit human approval.

## Allowed Without Additional Permission
- Internal refactors that do not change public API behavior
- Bug fixes with clear root cause and low blast radius
- Test additions and test maintenance
- Documentation updates that align with already-implemented behavior
- Logging/observability improvements without sensitive data exposure
- Non-breaking developer experience improvements

## Requires Explicit Permission
- Any breaking API contract change
- Crisis and safety policy changes
- Authentication/authorization model changes
- Database schema changes and destructive migrations
- Model provider switching or major prompt-policy rewrites
- Production deployment configuration changes
- Memory scoring formula changes
- Data retention/privacy behavior changes

## Requires Approval + Rollout Plan
- Changes affecting user-visible therapeutic behavior
- Changes to streaming semantics/event names
- Changes to routing path semantics
- Changes to onboarding crisis logic

## Mandatory Review Checklist for Sensitive Changes
- Safety impact assessed
- Contract changes documented
- Migration and rollback plan defined
- Monitoring and alerting updates included
- Backward compatibility validated

## Task Playbooks

### Add API Endpoint
1. Define request/response schema
2. Implement route and auth behavior
3. Add tests
4. Update /docs/api_contracts.md

### Change Memory Logic
1. Define retrieval/write impact
2. Validate safety and latency impact
3. Update /docs/rag.md and /docs/memory.md
4. Add regression checks

### Provider/Model Changes
1. Document rationale and fallback path
2. Validate config and secrets impact
3. Run behavior and cost checks
4. Update /docs/architecture.md and /README.md

## Non-Negotiables
- Do not silently change contracts.
- Do not remove safety gates.
- Do not ship undocumented behavior.
