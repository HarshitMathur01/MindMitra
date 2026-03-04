import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DeviceTier = 'full' | 'standard' | 'lite';

interface FirstTimeUserState {
  isFirstTime: boolean;
  onboardingStep: number;
  onboardingCompleted: boolean;
  deviceTier: DeviceTier | null;
  loading: boolean;
}

const DEFAULTS: FirstTimeUserState = {
  isFirstTime: false,
  onboardingStep: 0,
  onboardingCompleted: false,
  deviceTier: null,
  loading: false,
};

/**
 * Determines whether the current user is a first-time user.
 *
 * Resolution order:
 *  1. URL param ?firsttime=true  → treat as first-time regardless
 *  2. Supabase user_onboarding row for the authenticated user
 *  3. Defaults (not first-time, step 0, not completed)
 */
export function useFirstTimeUser(): FirstTimeUserState {
  const [state, setState] = useState<FirstTimeUserState>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // ── 1. URL param shortcut ──────────────────────────────────────────────
      const params = new URLSearchParams(window.location.search);
      if (params.get('firsttime') === 'true') {
        if (!cancelled) {
          setState({
            isFirstTime: true,
            onboardingStep: 0,
            onboardingCompleted: false,
            deviceTier: null,
            loading: false,
          });
        }
        return;
      }

      // ── 2. Supabase lookup ─────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not signed in → treat as first-time visitor
        if (!cancelled) setState({ ...DEFAULTS, isFirstTime: true, loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('onboarding_step, onboarding_completed, device_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        // No row yet → genuinely first-time
        setState({ ...DEFAULTS, isFirstTime: true, loading: false });
        return;
      }

      // ── 3. Row found ───────────────────────────────────────────────────────
      setState({
        isFirstTime: !data.onboarding_completed,
        onboardingStep: data.onboarding_step,
        onboardingCompleted: data.onboarding_completed,
        deviceTier: (data.device_tier as DeviceTier) ?? null,
        loading: false,
      });
    }

    resolve();
    return () => { cancelled = true; };
  }, []);

  return state;
}
