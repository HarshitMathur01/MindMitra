/**
 * Single source of truth for crisis & support helplines surfaced anywhere
 * in the product (chat safety rail, Presence Mode safety overlay, the
 * ErrorBoundary fallback, etc.).
 *
 * Why a module:
 *   - Numbers, hours, and tagline copy must agree across surfaces. A user
 *     who taps "Call iCall" in chat and sees a different number in the
 *     safety overlay loses trust at the worst moment.
 *   - When we onboard new partners (Vandrevala, AASRA, etc.) we change
 *     them in one place.
 *   - Numbers are stored unformatted so `tel:` links work reliably across
 *     dialers (some Android dialers reject `+` or whitespace).
 *
 * IMPORTANT: every entry here is a *vetted, current* Indian helpline.
 * Do not add numbers without verifying they are operational. Removing or
 * downgrading an entry has user-safety implications — coordinate with
 * the product / clinical lead.
 */

export type HelplineTier = "primary" | "secondary";

export interface Helpline {
    /** Stable id for analytics + tests. */
    id: string;
    /** Operator name shown to the user. */
    name: string;
    /** Digits-only number suitable for a `tel:` link. */
    phone: string;
    /** Pre-formatted display string for UIs that show the digits. */
    display: string;
    /** Short, calm description (no marketing copy). */
    description: string;
    /** Hours of operation, in IST. */
    hours: string;
    /** primary = always-shown; secondary = revealed under "More options". */
    tier: HelplineTier;
}

export const HELPLINES: Helpline[] = [
    {
        id: "icall",
        name: "iCall",
        phone: "9152987821",
        display: "9152987821",
        description: "Free, confidential, in your language.",
        hours: "Mon–Sat, 8am–10pm IST",
        tier: "primary",
    },
    {
        id: "kiran",
        name: "KIRAN",
        phone: "18005990019",
        display: "1800-599-0019",
        description: "Government of India — toll-free.",
        hours: "24 / 7",
        tier: "primary",
    },
    {
        id: "vandrevala",
        name: "Vandrevala Foundation",
        phone: "18602662345",
        display: "1860-266-2345",
        description: "Round-the-clock counselling.",
        hours: "24 / 7",
        tier: "secondary",
    },
];

/** Convenience: the *primary* helpline a single-CTA surface should call. */
export const PRIMARY_HELPLINE: Helpline =
    HELPLINES.find((h) => h.id === "icall") ?? HELPLINES[0];

/** Convenience: the *primary* 24/7 line for moments where availability matters. */
export const ROUND_THE_CLOCK_HELPLINE: Helpline =
    HELPLINES.find((h) => h.id === "kiran") ?? HELPLINES[0];

/** Build a `tel:` href from a Helpline. Centralised so call-out formatting
 * stays consistent and dialer-compatible (no `+`, no spaces). */
export const helplineHref = (h: Helpline): string => `tel:${h.phone}`;
