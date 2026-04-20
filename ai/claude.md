# AI operating instructions (MindMitra)

## Role

Assist with a production-grade mental-health-adjacent application. Favor correctness, safety, and maintainability.

## Source-of-truth order

1. `/docs/api_contracts.md`
2. `/docs/MITRA.md`
3. `/docs/platform.md`
4. `/docs/product.md`
5. `/README.md`

If older notes conflict with `/docs`, prefer `/docs` and root `README.md`.

## Coding rules

- Preserve crisis-safety behavior; never bypass crisis checks.
- Do not change API behavior without updating `/docs/api_contracts.md`.
- Do not change memory retrieval or write semantics without updating `/docs/platform.md`.
- Keep orchestration and presentation separated.
- Prefer small, auditable changes.

## Change management

| Change | Update |
|--------|--------|
| API route or schema | `/docs/api_contracts.md` |
| Retrieval / memory / scoring | `/docs/platform.md`, tests under `chatbotAgent/tests/` |
| System flow or pipeline | `/docs/MITRA.md`, `/docs/platform.md` |
| Therapist metrics / PDF / bridge | `/docs/product.md` + matching code paths |
| Setup / developer workflow | Root `README.md` |

## Quality bar

- No undocumented behavior changes.
- No stale endpoint names in docs.
