# Phase 1: Safety Layer

## Task 1: ConsentGate.tsx
- Full-screen gate before any onboarding
- Language toggle (English/Hindi) top-right
- 5 bullet points about what MindMitra is/isn't
- Privacy policy link
- "I understand and want to continue" primary CTA
- "Skip intro and go straight to the app →" secondary link
- Calls onConsent() and onLanguageSelect(lang)

## Task 2: CrisisInterrupt.tsx
- Full-screen overlay replacing current act
- "I hear you." header — warm, not alarming
- For critical level: show 3 Indian helplines with tel: links
  - iCall: 9152987821 (Mon-Sat 8am-10pm)
  - Vandrevala Foundation: 1800-599-0019 (24/7)
  - NIMHANS: 080-46110007 (Mon-Sat 9:30am-4:30pm)
- "Talk to my AI companion about this" primary button
- "Continue setup — I'm okay right now" secondary button
- Disclaimer: "I'm an AI — a real person can help more"

## Task 3: SoftCheck.tsx
- Inline amber-toned nudge for medium-level distress
- "That sounds like a lot..." message
- "Thank you — let's continue" dismiss link

## Task 4: GlobalSkip.tsx + ActSkip.tsx
- GlobalSkip: fixed bottom-right "Skip to app →", always visible
- If currentAct >= 2, show soft confirmation before skipping
- ActSkip: per-act skip button, small, bottom-center
- Custom label per act (e.g., "I'd rather not say yet")