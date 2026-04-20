"""
app/memory — MITRA v2 typed memory stack.

Five typed stores per architecture §4:
    - identity_card      (slowly-evolving structured user profile)
    - episodic           (specific moments; vectors in Qdrant, meta in Postgres)
    - affective          (three-channel time series: lexical | acoustic | self_report)
    - relational         (Phase 3) — entities + edges
    - procedural         (Phase 3) — intervention × outcome ledger

Plus:
    - working            (in-memory session buffer; not persisted)
    - importance         (write-time gate)
    - consolidation      (Phase 4 — nightly reflection + Ebbinghaus decay)

All public APIs accept dependency-injected Supabase + Qdrant + embedding
clients so they're unit-testable offline.
"""
