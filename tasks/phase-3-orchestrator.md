# Phase 3: Master Orchestrator + API

## Task 1: FirstTimeExperience.tsx
- Master component that renders ConsentGate → Acts 0-5 in sequence
- Manages: currentAct, language, consentGiven, collectedData, crisisState
- Persists progress to Supabase on every act change
- Handles 3 flows: full (6 acts), standard (6 acts), lite (4 condensed acts)
- Lite: merge Act 0+1, skip Act 3 mirror, go straight to personalization
- Renders GlobalSkip on all screens
- Renders OnboardingProgress dots at top
- Crisis detection can interrupt any act

## Task 2: useOnboardingFlow.ts
- Step management hook: advance, skip, save progress, resume
- handleGlobalSkip: save partial data → apply defaults → mark complete → navigate
- handleActSkip: track skip → advance to next act
- applyDefaultPersonalization: mitra companion, "just-listen", no name, no focus areas
- saveOnboardingProgress: upsert to Supabase

## Task 3: /api/onboarding/mirror-response
- POST endpoint receiving { user_answer, language }
- LLM prompt: mirror feeling, name emotion, normalize, 45 words max
- Crisis screening on input before generating response
- Returns: { response_text, crisis_assessment }

## Task 4: /api/onboarding/crisis-check  
- POST endpoint for LLM-based crisis assessment
- Used for ambiguous cases (medium client-side score)
- Returns: { level, reasoning, recommended_action }

## Task 5: AppRouter update
- If useFirstTimeUser.isFirstTime → render FirstTimeExperience
- Else → render MainApp
- Loading state while checking