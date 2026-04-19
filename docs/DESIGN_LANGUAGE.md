# MindMitra — Design Language ("Quiet Companion")

A one-page reference for the redesigned marketing + core app surfaces.
This document is the source of truth when reviewing UI work; if a
proposed change conflicts with what's here, the change loses unless
the language itself is being updated.

## Direction

**Calm, confident, editorial.** Warm cream paper by default, deep
charcoal in dark mode. Color earns attention; whitespace does the
heavy lifting. No mascots, no glassy maximalism, no decorative AI
gradients. Trust is built through restraint and reachable safety.

## Tokens

All visual tokens live in [src/index.css](../src/index.css) ("Sanctuary v4").
Behavior tokens live in [src/lib/redesign/tokens.ts](../src/lib/redesign/tokens.ts).

| Token | Use | Token name |
|-------|-----|------------|
| Page background | warm cream / deep charcoal | `--background`, `--ink-0` |
| Surfaces | panels, cards, hover beds | `--ink-1`, `--ink-2`, `--ink-3` |
| Hairlines | dividers, card borders | `--ink-4` |
| Text | heading / body / muted | `--ink-8`, `--ink-7`, `--ink-6` |
| Primary accent | sage; CTAs, focused states | `--accent-500` |
| Warmth | emotional moments only | `--warmth-300..500` |
| Danger | crisis only | `--bad-500` |
| Elevation | flat -> raised | `--e0..--e3` |

## Type

- **Display**: DM Sans, weight 400-600, letter-spacing -0.02em.
- **Body**: Inter, 16px, line-height 1.65.
- **Serif (rare)**: DM Serif Display — pull-quotes and one feature
  article opener only. Never as nav, button, or label.

Class helpers already exist: `.font-display`, `.font-display-soft`,
`.font-mono`, `.tabular`.

## Surfaces

- Cards are flat with `--e1`. `--e2` only on hover or focused state.
- Glassmorphism is restricted to the global header
  ([src/components/layout/Header.tsx](../src/components/layout/Header.tsx))
  and to sheet/drawer overlays.
- Border radius scale is `--radius` (12px), `--radius-lg` (16px),
  `--radius-xl` (24px), `--radius-2xl` (32px). Don't free-style values.

## Pulse — the signature presence mark

The single motion identity of the product. Used across landing hero,
auth focal point, dashboard greeting, chat empty state, and as the
"thinking" indicator.

Component: [src/components/identity/Pulse.tsx](../src/components/identity/Pulse.tsx).

Props:
- `size` (px, default 160) — diameter of the orb.
- `state` — `idle | listening | thinking | warm`. Drives breathing
  period (~10s idle, ~7s listening, ~4.5s thinking) and warm tone.
- `intensity` (0..1) — fade decorative rings; reduce on dense pages.
- `interactive` + `label` — set when Pulse is the focal element with
  semantic meaning.

Rules:
- Only one Pulse per visible viewport. It is brand presence, not a
  decorative spinner.
- Don't recolor with custom hex; use `state="warm"` for emotional
  emphasis (e.g., article opener) and otherwise the sage default.
- Honors `prefers-reduced-motion` automatically (collapses to a
  static halo via the global rule in `index.css`).

## Motion

- Default ease: `cubic-bezier(0.16, 1, 0.3, 1)` (`EASE.outExpo`).
- Page-level entrance: `DURATION.long` (380-600ms).
- Micro-feedback (hover/press): `DURATION.micro` (150ms).
- Springs are intentionally restricted to Mind Gym tools
  (`.mindgym-root`); Sanctuary surfaces stay on bezier curves.
- Never animate properties that trigger layout (`width`/`height` on
  scroll); prefer `transform` and `opacity`.

## Spacing rhythm

Use [PageShell](../src/components/layout/PageShell.tsx) on every
redesigned route. Inside, prefer `SECTION_SPACING` from the tokens
module:

- `tight` — between closely-related groups.
- `base` — default rhythm between major bands (most cases).
- `hero` — first band on a page.

## Crisis surface invariants

- The crisis card in
  [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx)
  is non-negotiable on every public page.
- Authenticated surfaces must keep a reachable crisis affordance
  (FAB on Mind Gym hub, helpline link in chat menu, etc.).
- Crisis copy is owned by
  [chatbotAgent/app/pipeline/crisis_manager.py](../chatbotAgent/app/pipeline/crisis_manager.py).
  Frontend never paraphrases it.

## Don'ts

- No new hex literals on redesigned surfaces. Use
  `hsl(var(--*))` or Tailwind semantic colors.
- No new heavy animation libraries; framer-motion + the built-in
  CSS keyframes cover everything we need.
- No copy that overpromises clinical outcomes (e.g., "we cure",
  "we diagnose", "AI therapist").
- No "Powered by AI" framing on user-facing surfaces. Talk about
  presence, not models.

## When to update this doc

Anytime the Pulse contract, the type ramp, or the spacing rhythm
changes. Token additions in `index.css` should be reflected here in
the table. Treat this file like a tiny changelog: bump it in the
same PR as the change.
