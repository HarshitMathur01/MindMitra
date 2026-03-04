# Phase 0: Foundation

## Task 1: Supabase Schema
Create migration file with these tables:
- user_onboarding (consent, progress, skip tracking, device tier, personalization JSONB)
- crisis_events (level, source, timestamp — NO user text stored)
- onboarding_analytics (step, metadata JSONB, device_tier)
- platform_stats (active_users_today, total_sessions_completed)
- RLS policies: users read/write own data, platform_stats public read
- RPC function: reset_onboarding(target_user_id UUID)

## Task 2: useFirstTimeUser.ts
Hook that checks: URL param ?firsttime=true → Supabase user_onboarding table → defaults.
Returns: { isFirstTime, onboardingStep, onboardingCompleted, deviceTier }

## Task 3: useDeviceCapability.ts  
Detect RAM (navigator.deviceMemory), GPU (WebGL2), connection (navigator.connection),
CPU cores. Return tier: 'full' | 'standard' | 'lite' + boolean flags for each capability.

## Task 4: crisisDetection.ts
Client-side keyword screening. English + Hindi keywords at 3 levels (critical/high/medium).
Export: screenForCrisis(text: string) → { level, matchedPatterns, suggestedAction }