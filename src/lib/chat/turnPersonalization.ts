/**
 * Per-turn personalization signals received from the v3 backend.
 *
 * Mirrors a subset of `OrchestratorOutput` + `Signals.affect_vector` from
 * `chatbotAgent/app/models/signals.py`. Pure parsing + crisis-safe gating
 * lives here so the React layer stays declarative.
 *
 * Crisis-supremacy invariant: on `urgency >= 2` every personalization
 * derivation collapses to `CALM_DEFAULT`. This is defense-in-depth — the
 * backend already suppresses suggestions on crisis, but the frontend must
 * yield independently so a stale meta payload can never decorate a
 * crisis-class turn.
 */

export type TurnMode =
    | "companion"
    | "active_listener"
    | "recovery_check"
    | "referral_bridge"
    | "psychoeducation"
    | "skill_coach";

export interface ToneParams {
    formality: number;
    code_mix: number;
    sentence_length: number;
    warmth: number;
    emoji_use: number;
    directness: number;
    humour_tolerance: number;
    pace: number;
}

export interface AffectVector {
    valence: number;
    arousal: number;
    dominance: number;
}

export interface TurnMeta {
    mode: TurnMode;
    urgency: number;
    tone: ToneParams;
    affect: AffectVector;
    culturalFrameId: string | null;
}

/**
 * Calm-clinical defaults applied on crisis turns or when the wire is
 * missing fields. Warmth is at the orchestrator's hard floor (0.45) to
 * stay safety-compliant; pace is slow; directness is low.
 */
export const CALM_DEFAULT: TurnMeta = {
    mode: "active_listener",
    urgency: 0,
    tone: {
        formality: 0.4,
        code_mix: 0.5,
        sentence_length: 0.5,
        warmth: 0.7,
        emoji_use: 0.0,
        directness: 0.3,
        humour_tolerance: 0.0,
        pace: 0.3,
    },
    affect: { valence: 0, arousal: 0.4, dominance: 0.5 },
    culturalFrameId: null,
};

const VALID_MODES: ReadonlySet<TurnMode> = new Set([
    "companion",
    "active_listener",
    "recovery_check",
    "referral_bridge",
    "psychoeducation",
    "skill_coach",
]);

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return (lo + hi) / 2;
    return Math.max(lo, Math.min(hi, n));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTone(raw: unknown): ToneParams {
    if (!isPlainObject(raw)) return CALM_DEFAULT.tone;
    const numeric = (k: string, fallback: number, lo = 0, hi = 1) =>
        clamp(Number(raw[k]), lo, hi) || (Number.isFinite(Number(raw[k])) ? Number(raw[k]) : fallback);
    return {
        formality: numeric("formality", 0.4),
        code_mix: numeric("code_mix", 0.5),
        sentence_length: numeric("sentence_length", 0.5),
        warmth: numeric("warmth", 0.7, 0.45, 1),
        emoji_use: numeric("emoji_use", 0.2),
        directness: numeric("directness", 0.5),
        humour_tolerance: numeric("humour_tolerance", 0.4),
        pace: numeric("pace", 0.5),
    };
}

function parseAffect(raw: unknown): AffectVector {
    if (!isPlainObject(raw)) return CALM_DEFAULT.affect;
    return {
        valence: clamp(Number(raw.valence) || 0, -1, 1),
        arousal: clamp(Number(raw.arousal) || 0.4, 0, 1),
        dominance: clamp(Number(raw.dominance) || 0.5, 0, 1),
    };
}

function parseMode(raw: unknown): TurnMode {
    if (typeof raw === "string" && VALID_MODES.has(raw as TurnMode)) {
        return raw as TurnMode;
    }
    return CALM_DEFAULT.mode;
}

/**
 * Parse the `meta` blob from the v3 chat HTTP response plus the top-level
 * `urgency`. Returns CALM_DEFAULT for crisis turns (urgency >= 2) — the
 * single chokepoint for the crisis-safe yield invariant.
 */
export function parseTurnMeta(
    meta: Record<string, unknown> | undefined,
    urgency: number,
    options?: { longitudinalRisk?: boolean },
): TurnMeta {
    const safeUrgency = Number.isFinite(urgency) ? Math.max(0, Math.floor(urgency)) : 0;

    if (safeUrgency >= 2) {
        return { ...CALM_DEFAULT, urgency: safeUrgency };
    }
    if (safeUrgency === 1 && options?.longitudinalRisk) {
        return { ...CALM_DEFAULT, urgency: safeUrgency };
    }

    const safeMeta = meta ?? {};
    return {
        mode: parseMode(safeMeta.mode),
        urgency: safeUrgency,
        tone: parseTone(safeMeta.tone_params),
        affect: parseAffect(safeMeta.affect_vector),
        culturalFrameId:
            typeof safeMeta.cultural_frame_id === "string"
                ? safeMeta.cultural_frame_id
                : null,
    };
}

export function isCrisisActive(turn: TurnMeta | null): boolean {
    return !!turn && turn.urgency >= 2;
}

// ── Derived UI values ────────────────────────────────────────────────────

/**
 * Map warmth (0.45-1.0) to a spring config for bubble entry.
 * Higher warmth → softer landing (more damping, slightly less stiffness).
 * Lower warmth → tighter, more precise.
 *
 * Imperceptible per-bubble; cumulative over a session.
 */
export function springForWarmth(warmth: number): {
    type: "spring";
    stiffness: number;
    damping: number;
    mass: number;
} {
    const w = clamp(warmth, 0.45, 1);
    // warmth 0.45 → stiff 420, damp 28; warmth 1.0 → stiff 360, damp 38
    const stiffness = Math.round(420 - (w - 0.45) * (60 / 0.55));
    const damping = Math.round(28 + (w - 0.45) * (10 / 0.55));
    return { type: "spring", stiffness, damping, mass: 0.85 };
}

/**
 * Mode → typing indicator copy. Same calm-default phrase falls through on
 * crisis (parseTurnMeta has already swapped to active_listener).
 */
export function loadingCopyForMode(mode: TurnMode): string[] {
    switch (mode) {
        case "active_listener":
            return ["Listening", "Sitting with this", "Holding space"];
        case "psychoeducation":
            return ["Putting this together", "Thinking it through", "Drafting carefully"];
        case "skill_coach":
            return ["Thinking through a step", "Picking the right tool", "Almost there"];
        case "recovery_check":
            return ["Glad you came back", "Thinking with you", "Just a moment"];
        case "referral_bridge":
            return ["Looking at what could help", "Thinking carefully", "One moment"];
        case "companion":
        default:
            return ["Thinking with you", "Reading this with care", "Putting it into words"];
    }
}

/**
 * Affect vector → ambient style overlay for the chat root.
 *
 * Critical invariant: this function moves toward calm, never toward
 * distress. The output range is "neutral to comforting" — when affect is
 * negative-valence/high-arousal we slightly lower paper warmth and
 * desaturate; we never crank red/alarm hues.
 */
export function ambientStyleForAffect(affect: AffectVector): {
    paperWarmth: number;
    accentTilt: "warm" | "cool" | "neutral";
} {
    // Low arousal + neutral/positive valence → warmer presence
    // High arousal + negative valence → cooler, slower
    if (affect.arousal < 0.4 && affect.valence >= -0.1) {
        return { paperWarmth: 1.0, accentTilt: "warm" };
    }
    if (affect.arousal >= 0.65 && affect.valence <= -0.2) {
        return { paperWarmth: 0.7, accentTilt: "cool" };
    }
    return { paperWarmth: 0.85, accentTilt: "neutral" };
}
