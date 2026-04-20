-- ============================================================================
-- Mitra Cognition Loop — Stage Engine v2
-- Adds the structural transition gates the Stage Engine evaluates:
--    user_initiated_disclosures (count of times the user opened up first)
--    unresolved_ruptures        (blocks promotion until repaired)
--    last_disclosure_at         (recency of self-disclosure)
-- ============================================================================

ALTER TABLE public.mitra_relationship_state
    ADD COLUMN IF NOT EXISTS user_initiated_disclosures int DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unresolved_ruptures        int DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_disclosure_at         timestamptz;

COMMENT ON COLUMN public.mitra_relationship_state.user_initiated_disclosures IS
    'Stage Engine gate — number of self-disclosures the USER initiated (not bot-prompted).';
COMMENT ON COLUMN public.mitra_relationship_state.unresolved_ruptures IS
    'Stage Engine gate — outstanding misalignments / failed turns; blocks promotion.';
