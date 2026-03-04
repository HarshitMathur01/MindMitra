/**
 * FirstTimeExperience — master onboarding orchestrator.
 *
 * Renders:  ConsentGate → Acts 0–5 in sequence
 * Manages:  language, collectedData, crisisState
 * Delegates: step sequencing + Supabase persistence to useOnboardingFlow
 *
 * Tier flows
 *  full / standard:  consent → act0 → act1 → act2 → act3 → act4 → act5 → complete
 *  lite:             consent → act0 → act1 → act2 → act4 → act5 → complete
 *
 * Individual act components are stateless: they receive data via props
 * and emit results via onComplete / onSkip callbacks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useDeviceCapability } from '@/hooks/useDeviceCapability';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { screenForCrisis } from '@/lib/crisisDetection';
import {
  trackOnboardingEvent,
  trackActStart,
  trackActComplete,
  trackActSkip,
  flushOnboardingAnalytics,
  resetAnalyticsSession,
} from '@/lib/onboardingAnalytics';

import ConsentGate from './ConsentGate';
import PatternInterrupt from './PatternInterrupt';
import AuthenticVulnerability from './AuthenticVulnerability';
import TheOneQuestion from './TheOneQuestion';
import MirrorAndProof from './MirrorAndProof';
import PersonalizationSteps from './PersonalizationSteps';
import CompanionRevealAndClose from './CompanionRevealAndClose';
import CrisisInterrupt from './CrisisInterrupt';
import GlobalSkip from './GlobalSkip';
import OnboardingProgress from './OnboardingProgress';
import AmbientSound from './AmbientSound';

import type { PersonalizationData } from './PersonalizationSteps';
import type { CompanionId } from './CompanionRevealAndClose';

// ── Types ──────────────────────────────────────────────────────────────────

interface CollectedData {
  userText?: string;
  personalization?: PersonalizationData;
}

interface CrisisState {
  level: 'critical' | 'high';
  active: boolean;
}

interface FirstTimeExperienceProps {
  /** Numeric step index to resume from (from user_onboarding.onboarding_step) */
  initialStep?: number;
  /** Called when onboarding is finished (completed or globally skipped) */
  onComplete: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FirstTimeExperience({
  initialStep = 0,
  onComplete,
}: FirstTimeExperienceProps) {
  const { tier } = useDeviceCapability();

  // ── Orchestrator-owned state ──────────────────────────────────────────
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [crisisState, setCrisisState] = useState<CrisisState | null>(null);

  // ── Step management ───────────────────────────────────────────────────
  const flow = useOnboardingFlow({ tier, initialStepIndex: initialStep, onComplete });

  // ── Global skip handler ───────────────────────────────────────────────
  const handleGlobalSkip = useCallback(() => {
    trackOnboardingEvent('global_skip', { fromAct: flow.step });
    flow.handleGlobalSkip({ personalization: collectedData.personalization });
  }, [flow, collectedData.personalization]);

  // ── Act 2 (TheOneQuestion) complete ──────────────────────────────────
  const handleAct2Complete = useCallback(
    (data: { text: string }) => {
      const newData: CollectedData = { ...collectedData, userText: data.text };
      setCollectedData(newData);

      // Crisis check on submission — may open CrisisInterrupt overlay
      const result = screenForCrisis(data.text);
      if (result.level === 'critical' || result.level === 'high') {
        setCrisisState({ level: result.level, active: true });
        trackOnboardingEvent('crisis_triggered', { act: 'act2', level: result.level });
      }

      // Save then advance regardless of crisis (user can still continue)
      flow.saveProgress(flow.nextStep);
      flow.advance();
    },
    [flow, collectedData],
  );

  // ── Act 4 (PersonalizationSteps) complete ────────────────────────────
  const handleAct4Complete = useCallback(
    (data: PersonalizationData) => {
      const newData: CollectedData = { ...collectedData, personalization: data };
      setCollectedData(newData);
      flow.saveProgress(flow.nextStep, { personalization: data });
      flow.advance();
    },
    [flow, collectedData],
  );

  // ── Crisis interrupt callbacks ────────────────────────────────────────
  const handleCrisisTalkToCompanion = useCallback(() => {
    // Navigate to companion immediately (global skip with current data)
    flow.handleGlobalSkip({ personalization: collectedData.personalization });
  }, [flow, collectedData.personalization]);

  const handleCrisisContinueSetup = useCallback(() => {
    setCrisisState(null);
  }, []);

  // ── Derived act index (for progress + GlobalSkip confirmation) ─────
  const actIndex = flow.actIndex;

  // ── Analytics: track act transitions + flush on unmount ────────────
  useEffect(() => {
    resetAnalyticsSession();
    return () => flushOnboardingAnalytics();
  }, []);

  useEffect(() => {
    if (flow.step !== 'consent' && flow.step !== 'complete') {
      trackActStart(flow.step, tier);
    }
  }, [flow.step, tier]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100]">
      {/* Progress dots — visible during acts, hidden during consent */}
      <OnboardingProgress actIndex={actIndex} totalActs={flow.totalActs} />

      {/* Global skip — always visible */}
      <GlobalSkip currentAct={actIndex} language={language} onSkip={handleGlobalSkip} />

      {/* Ambient sound — full tier only, opt-in, default OFF */}
      <AmbientSound tier={tier} />

      {/* Crisis overlay — highest z, interrupts any act */}
      {crisisState?.active && (
        <CrisisInterrupt
          level={crisisState.level}
          language={language}
          onTalkToCompanion={handleCrisisTalkToCompanion}
          onContinueSetup={handleCrisisContinueSetup}
        />
      )}

      {/* ── Acts ── */}

      {flow.step === 'consent' && (
        <ConsentGate
          language={language}
          onLanguageSelect={setLanguage}
          onConsent={() => {
            trackOnboardingEvent('consent_given');
            flow.saveProgress(flow.nextStep, { consentGiven: true });
            flow.advance();
          }}
          onSkip={() => flow.handleGlobalSkip({ consentGiven: false })}
        />
      )}

      {flow.step === 'act0' && (
        <PatternInterrupt
          tier={tier}
          language={language}
          onComplete={() => {
            trackActComplete('act0');
            flow.saveProgress(flow.nextStep);
            flow.advance();
          }}
          onSkip={() => { trackActSkip('act0'); flow.handleActSkip(); }}
        />
      )}

      {flow.step === 'act1' && (
        <AuthenticVulnerability
          tier={tier}
          language={language}
          onComplete={() => {
            trackActComplete('act1');
            flow.saveProgress(flow.nextStep);
            flow.advance();
          }}
          onSkip={() => { trackActSkip('act1'); flow.handleActSkip(); }}
        />
      )}

      {flow.step === 'act2' && (
        <TheOneQuestion
          tier={tier}
          language={language}
          onComplete={handleAct2Complete}
          onSkip={() => {
            trackActSkip('act2');
            // Skipped without text — no mirror, advance to next step
            flow.saveProgress(flow.nextStep);
            flow.handleActSkip();
          }}
        />
      )}

      {flow.step === 'act3' && (
        <MirrorAndProof
          tier={tier}
          language={language}
          userText={collectedData.userText}
          onComplete={() => {
            trackActComplete('act3');
            flow.saveProgress(flow.nextStep);
            flow.advance();
          }}
          onSkip={() => {
            trackActSkip('act3');
            flow.saveProgress(flow.nextStep);
            flow.handleActSkip();
          }}
        />
      )}

      {flow.step === 'act4' && (
        <PersonalizationSteps
          tier={tier}
          language={language}
          onComplete={handleAct4Complete}
          onSkip={() => {
            trackActSkip('act4');
            // Apply companion default when skipping personalization
            const defaults: PersonalizationData = {
              name: '',
              pressures: [],
              supportStyle: 'maya',
              companion: 'maya',
            };
            const newData = { ...collectedData, personalization: defaults };
            setCollectedData(newData);
            flow.saveProgress(flow.nextStep, { personalization: defaults });
            flow.handleActSkip();
          }}
        />
      )}

      {flow.step === 'act5' && (
        <CompanionRevealAndClose
          tier={tier}
          language={language}
          userName={collectedData.personalization?.name}
          companion={(collectedData.personalization?.companion as CompanionId) ?? 'maya'}
          onComplete={() => {
            trackActComplete('act5');
            trackOnboardingEvent('onboarding_completed');
            flow.saveProgress('complete', { personalization: collectedData.personalization });
            flow.advance();
          }}
          onSkip={handleGlobalSkip}
        />
      )}
    </div>
  );
}
