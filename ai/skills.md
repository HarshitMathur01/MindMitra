# AI skills and change permissions

## Allowed without additional permission

- Internal refactors that do not change public API behavior
- Bug fixes with clear root cause and low blast radius
- Test additions and test maintenance
- Documentation updates that align with implemented behavior
- Logging/observability improvements without sensitive data exposure
- Non-breaking developer experience improvements

## Requires explicit permission

- Breaking API contract changes
- Crisis and safety policy changes
- Authentication/authorization model changes
- Database schema changes and destructive migrations
- Model provider switching or major prompt-policy rewrites
- Production deployment configuration changes
- Memory scoring formula changes
- Data retention/privacy behavior changes

## Requires approval + rollout plan

- Changes affecting user-visible therapeutic behavior
- Therapist Profile Builder metrics or PDF exporter formatting
- Streaming semantics/event names
- Routing path semantics
- Onboarding crisis logic

## Task playbooks

### Add API endpoint

1. Define request/response schema
2. Implement route and auth
3. Add tests
4. Update `/docs/api_contracts.md`

### Change memory logic

1. Define retrieval/write impact
2. Validate safety and latency
3. Update `/docs/platform.md` and relevant tests

### Provider/model changes

1. Document rationale and fallbacks
2. Validate config and secrets
3. Update `/docs/platform.md` and `/README.md` if workflow changes

### Clinical profile metrics or PDF output

1. Align Python (`therapist_profile_builder.py`), frontend types, and `exportClinicalPDF.ts`
2. Update `/docs/product.md`

## Non-negotiables

- Do not silently change contracts.
- Do not remove safety gates.
- Do not ship undocumented behavior.
