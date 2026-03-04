/**
 * useOnboardingFlow — step sequencing + Supabase persistence for onboarding.
 *
 * Responsibilities:
 *  - Build the correct act sequence for the current device tier
 *  - Expose advance(), handleActSkip(), handleGlobalSkip()
 *  - saveProgress() upserts to user_onboarding (best-effort, auth-gated)
 *  - Detect when step reaches 'complete' and call onComplete callback
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { DeviceTier } from '@/hooks/useDeviceCapability';
import type { PersonalizationData } from '@/components/onboarding/PersonalizationSteps';

// ── Types ──────────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'consent'
  | 'act0'   // PatternInterrupt
  | 'act1'   // AuthenticVulnerability
  | 'act2'   // TheOneQuestion
  | 'act3'   // MirrorAndProof (skipped on lite)
  | 'act4'   // PersonalizationSteps
  | 'act5'   // CompanionRevealAndClose
  | 'complete';

export interface SaveProgressOpts {
  personalization?: PersonalizationData;
  consentGiven?: boolean;
}

export interface UseOnboardingFlowReturn {
  /** Current step name */
  step: OnboardingStep;
  /** 0-based index into the full step sequence */
  stepIndex: number;
  /** The next step in the sequence (useful for explicit saveProgress calls) */
  nextStep: OnboardingStep;
  /** 0-based act index for OnboardingProgress dots (-1 during consent) */
  actIndex: number;
  /** Total act count for the tier (excludes consent + complete) */
  totalActs: number;
  /** Set of steps the user explicitly skipped */
  skippedSteps: Set<OnboardingStep>;
  /** True while a Supabase write is in-flight */
  isSaving: boolean;
  /** Advance to the next step */
  advance: () => void;
  /** Track the current act as skipped, then advance */
  handleActSkip: () => void;
  /** Save with defaults → call onComplete (bypasses remaining steps) */
  handleGlobalSkip: (opts?: SaveProgressOpts) => void;
  /** Upsert current progress to Supabase (fire-and-forget) */
  saveProgress: (step: OnboardingStep, opts?: SaveProgressOpts) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_PERSONALIZATION: PersonalizationData = {
  name:         '',
  pressures:    [],
  supportStyle: 'maya',
  companion:    'maya',
};

function buildSequence(tier: DeviceTier): OnboardingStep[] {
  // Lite: merge acts 0+1 (both run sequentially but faster), skip act3 mirror
  if (tier === 'lite') {
    return ['consent', 'act0', 'act1', 'act2', 'act4', 'act5', 'complete'];
  }
  return ['consent', 'act0', 'act1', 'act2', 'act3', 'act4', 'act5', 'complete'];
}

const ACT_STEPS: OnboardingStep[] = ['act0', 'act1', 'act2', 'act3', 'act4', 'act5'];

// ── Hook ───────────────────────────────────────────────────────────────────

interface Options {
  tier: DeviceTier;
  /** Numeric index to resume from (from user_onboarding.onboarding_step) */
  initialStepIndex?: number;
  onComplete: () => void;
}

export function useOnboardingFlow({
  tier,
  initialStepIndex = 0,
  onComplete,
}: Options): UseOnboardingFlowReturn {
  const sequence = useMemo(() => buildSequence(tier), [tier]);

  // Clamp initial to a valid non-complete position
  const clamped = Math.min(
    Math.max(0, initialStepIndex),
    sequence.length - 2, // never start at 'complete'
  );

  const [stepIndex, setStepIndex] = useState(clamped);
  const [skippedSteps, setSkippedSteps] = useState<Set<OnboardingStep>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Stable ref for onComplete so closures always see the latest version
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Derived values
  const step     = (sequence[stepIndex] ?? 'complete') as OnboardingStep;
  const nextStep = (sequence[Math.min(stepIndex + 1, sequence.length - 1)] ?? 'complete') as OnboardingStep;
  const actIndex = ACT_STEPS.indexOf(step as typeof ACT_STEPS[number]);
  // Only count the acts that are actually in this tier's sequence
  const totalActs = sequence.filter(s => ACT_STEPS.includes(s as typeof ACT_STEPS[number])).length;

  // Fire onComplete when step reaches 'complete'
  useEffect(() => {
    if (step === 'complete') {
      onCompleteRef.current();
    }
  }, [step]);

  // ── saveProgress (fire-and-forget) ──────────────────────────────────────

  const saveProgress = useCallback(
    (targetStep: OnboardingStep, opts?: SaveProgressOpts) => {
      const numericStep  = sequence.indexOf(targetStep);
      const isComplete   = targetStep === 'complete';
      const personalization = opts?.personalization ?? DEFAULT_PERSONALIZATION;
      const consentGiven = opts?.consentGiven ?? true; // only called after consent

      const run = async () => {
        try {
          setIsSaving(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return; // unauthenticated — skip silently

          await supabase
            .from('user_onboarding')
            .upsert(
              {
                user_id:               user.id,
                consent_given:         consentGiven,
                onboarding_step:       numericStep,
                onboarding_completed:  isComplete,
                device_tier:           tier,
                personalization:       personalization as unknown as Json,
                steps_skipped:         [...skippedSteps] as unknown as Json,
              },
              { onConflict: 'user_id' },
            );
        } catch (err) {
          console.warn('[useOnboardingFlow] saveProgress failed silently:', err);
        } finally {
          setIsSaving(false);
        }
      };

      run();
    },
    [sequence, tier, skippedSteps],
  );

  // ── advance ─────────────────────────────────────────────────────────────

  const advance = useCallback(() => {
    setStepIndex(prev => Math.min(prev + 1, sequence.length - 1));
  }, [sequence.length]);

  // ── handleActSkip ───────────────────────────────────────────────────────

  const handleActSkip = useCallback(() => {
    // Capture current step synchronously before state update
    const currentStep = sequence[stepIndex] as OnboardingStep;
    setSkippedSteps(prev => {
      const updated = new Set(prev);
      updated.add(currentStep);
      return updated;
    });
    setStepIndex(prev => Math.min(prev + 1, sequence.length - 1));
  }, [sequence, stepIndex]);

  // ── handleGlobalSkip ────────────────────────────────────────────────────

  const handleGlobalSkip = useCallback(
    (opts?: SaveProgressOpts) => {
      saveProgress('complete', {
        personalization: opts?.personalization ?? DEFAULT_PERSONALIZATION,
        consentGiven:    opts?.consentGiven ?? true,
      });
      // Call onComplete directly — don't advance through 'complete' step
      // (avoids double-fire with the useEffect watcher)
      onCompleteRef.current();
    },
    [saveProgress],
  );

  return {
    step,
    stepIndex,
    nextStep,
    actIndex,
    totalActs,
    skippedSteps,
    isSaving,
    advance,
    handleActSkip,
    handleGlobalSkip,
    saveProgress,
  };
}
