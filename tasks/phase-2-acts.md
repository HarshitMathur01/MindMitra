# Phase 2: Core Onboarding Acts

Build these components. Each accepts: onComplete, onSkip, tier, language props.

## Act 0: PatternInterrupt.tsx
- Full-screen black → "Breathe." → "You made it here." → "That matters." → transition
- Lite tier: CSS transitions only, no Framer Motion
- Full/standard: AnimatePresence with opacity+y animations
- Phase durations: 1200ms → 2200ms → 2000ms → 2000ms → 600ms
- ActSkip visible throughout

## Act 1: AuthenticVulnerability.tsx
- Avatar appears (full tier) / 2D image (standard) / emoji (lite)
- TTS plays vulnerability script (full/standard) / text displays (lite)
- Single "Yes" button appears after speech ends
- ActSkip: "Not right now"

## Act 2: TheOneQuestion.tsx
- Single free-text question: "Right now — what's the heaviest thing on your mind?"
- Cycling placeholder every 3s with fade
- Crisis detection on keystroke (debounced 500ms) using crisisDetection.ts
- Pre-fetch mirror response after 3s typing inactivity (tier !== 'lite', text.length > 10)
- "Only your AI companion sees this." subtext
- Submit button appears when text.length > 0
- ActSkip: "I'd rather not say yet"

## Act 3: MirrorAndProof.tsx
- If user submitted text: avatar "thinks" 2-3s → LLM mirror response via TTS + typewriter
- If user skipped: "That's okay. You don't have to share anything you're not ready for."
- Then: social proof card with REAL numbers from platform_stats table
- If count < 10: qualitative fallback "Students across India..."
- 2 anonymous peer quotes (labeled as representative)
- Action affirmation: "Showing up here — that's a meaningful step."
- ActSkip: "Continue"

## Act 4: PersonalizationSteps.tsx
- 3 questions, one at a time, full screen each:
  1. "What should I call you?" (text input)
  2. "What brings the most pressure?" (multi-select chips, 8 options)
  3. "How do you prefer support?" (single-select cards, 4 options → maps to companion)
- Each step has its own ActSkip with contextual label
- Returns collected data object

## Act 5: CompanionRevealAndClose.tsx
- Matched companion avatar does reveal animation
- "Meet [Name]." typewriter
- "[Companion] is here for [UserName]." (if name provided)
- 80% progress ring with checklist (3 done, 1 incomplete)
- "Start Your First Session" primary CTA
- "Explore first" secondary
- Approach-framed microcopy: "Most students feel lighter after just one conversation."