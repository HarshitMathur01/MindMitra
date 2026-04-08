import {
  ConsentState,
  EmotionalProfile,
  ReferralPayload,
  ReferralResponse,
  Therapist,
  mockProfile,
  mockTherapists,
} from "@/lib/types/therapist-bridge";
import { generateEmotionalProfile as localGenerateProfile } from "@/lib/utils/emotional-profile";
import { supabase } from "@/integrations/supabase/client";
import { syncMindGymHistoryToSupabase } from "@/lib/mindgym/supabaseSync";

function backendBase(): string | null {
  const u = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");
  return u || null;
}

async function authHeader(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export const fetchTherapists = async (): Promise<Therapist[]> => {
  const base = backendBase();
  if (!base) {
    if (import.meta.env.PROD) {
      throw new Error("VITE_BACKEND_URL is required to load therapists in production.");
    }
    return mockTherapists;
  }
  try {
    const response = await fetch(`${base}/therapist-bridge/therapists`);
    if (!response.ok) throw new Error("Therapist fetch failed");
    return (await response.json()) as Therapist[];
  } catch {
    if (import.meta.env.PROD) throw new Error("Unable to load therapists.");
    return mockTherapists;
  }
};

export const fetchEmotionalProfile = async (
  userId: string,
  consent?: ConsentState,
): Promise<EmotionalProfile> => {
  void userId;
  await syncMindGymHistoryToSupabase().catch(() => undefined);

  const base = backendBase();
  if (!base) {
    if (import.meta.env.PROD) {
      throw new Error(
        "VITE_BACKEND_URL is required for Therapist Bridge in production.",
      );
    }
    return await localGenerateProfile(userId || "local-preview");
  }

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(await authHeader()),
    };
    const response = await fetch(`${base}/therapist-bridge/profile-preview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        includeNarrative: true,
        narrativeAsync: false,
        consent: consent ?? null,
      }),
    });

    if (!response.ok) throw new Error("Profile generation failed");
    const data = await response.json();
    const profile = data.emotionalProfile as EmotionalProfile;
    if (!profile) throw new Error("Missing emotionalProfile");
    return profile;
  } catch (e) {
    if (import.meta.env.PROD) throw e;
    console.warn("[TherapistBridge] Backend unavailable, using local preview:", e);
    return userId ? await localGenerateProfile(userId) : mockProfile;
  }
};

export const createReferral = async (
  payload: ReferralPayload,
): Promise<ReferralResponse> => {
  const base = backendBase();
  if (!base) {
    if (import.meta.env.PROD) {
      throw new Error("VITE_BACKEND_URL is required to create a referral in production.");
    }
    return {
      id: `ref-${payload.therapistId}-${Date.now()}`,
      status: "failed",
    };
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };
  const response = await fetch(`${base}/therapist-bridge/referral`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      therapistId: payload.therapistId,
      consent: payload.consent,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Referral creation failed");
  }

  return (await response.json()) as ReferralResponse;
};

export const hasMinimumConsentForBooking = (consent: ConsentState): boolean => {
  return consent.shareFullProfile || consent.shareAssessments;
};
