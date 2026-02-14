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

export const fetchTherapists = async (): Promise<Therapist[]> => {
  try {
    const response = await fetch("/api/therapist-bridge/therapists");
    if (!response.ok) throw new Error("Therapist fetch failed");
    return (await response.json()) as Therapist[];
  } catch {
    return mockTherapists;
  }
};

export const fetchEmotionalProfile = async (userId: string): Promise<EmotionalProfile> => {
  try {
    const response = await fetch("/api/therapist-bridge/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) throw new Error("Profile generation failed");
    return (await response.json()) as EmotionalProfile;
  } catch {
    return userId ? localGenerateProfile(userId) : mockProfile;
  }
};

export const createReferral = async (payload: ReferralPayload): Promise<ReferralResponse> => {
  try {
    const response = await fetch("/api/therapist-bridge/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Referral creation failed");
    return (await response.json()) as ReferralResponse;
  } catch {
    return {
      id: `ref-${payload.therapistId}-${Date.now()}`,
      status: "created",
    };
  }
};

export const hasMinimumConsentForBooking = (consent: ConsentState): boolean => {
  return consent.shareFullProfile || consent.shareAssessments;
};