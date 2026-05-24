import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Snapshot of the user's ambient personalization signals from
 * `GET /me/snapshot`. Field names match the backend Pydantic shape so the
 * AmbienceProvider / DoorsGrid / WhisperWall consumers can pass it through
 * without manual reshaping.
 *
 * Themes are inputs to ranking only — never render `dominant_themes` as
 * user-facing text.
 */
export interface Snapshot {
  user_id: string;
  computed_at: string;
  affect_ema: { valence: number; arousal: number } | null;
  recent_crisis_flag: boolean;
  crisis_flag_set_at: string | null;
  longitudinal_risk_flag: boolean;
  last_slope: number | null;
  dominant_themes: string[];
  comfort_topics: string[];
  dominant_mode:
    | "companion"
    | "active_listener"
    | "psychoeducation"
    | "skill_coach"
    | "referral_bridge"
    | "recovery_check"
    | string
    | null;
  cultural_frame_id: string | null;
  language_baseline: { code_mix: number; register: string } | null;
  session_count_28d: number;
  distinct_days_28d: number;
}

const SNAPSHOT_STALE_MS = 60_000;

// Gate the remote round-trip until /me/snapshot is deployed on the target
// Railway backend. Off by default keeps the dev console clean while running
// against an un-deployed backend. Flip to "true" in env once the route ships.
const REMOTE_ENABLED =
  import.meta.env.VITE_SANCTUARY_SNAPSHOT_REMOTE === "true";

function snapshotEndpoint(): string {
  const backend = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (backend) return `${backend.replace(/\/$/, "")}/me/snapshot`;
  if (import.meta.env.PROD) {
    throw new Error("Missing VITE_BACKEND_URL for production snapshot fetch");
  }
  return `${window.location.origin.replace(/\/$/, "")}/me/snapshot`;
}

async function fetchSnapshot(): Promise<Snapshot> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("not-authenticated");
  }
  const res = await fetch(snapshotEndpoint(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`snapshot fetch failed: ${res.status}`);
  }
  return (await res.json()) as Snapshot;
}

/**
 * Tanstack query wrapper around `GET /me/snapshot`. staleTime matches the
 * server-side Redis TTL (60s) so a refresh inside that window is a single
 * cache-hit request and the AmbienceProvider doesn't thrash.
 */
export function useSnapshot(): {
  data: Snapshot | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["sanctuary-snapshot", user?.id],
    queryFn: fetchSnapshot,
    enabled: !!user?.id && REMOTE_ENABLED,
    staleTime: SNAPSHOT_STALE_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
