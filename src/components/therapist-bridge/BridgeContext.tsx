import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { emptyIntake, matchTherapists, type IntakeAnswers, type Match } from "@/lib/therapist-bridge/matching";

export type ConsentKey = "assessments" | "patterns" | "summaries" | "words";

export type FieldMood = {
  warmth: number;
  tempo: number;
  links: number;
};

type BridgeState = {
  intake: IntakeAnswers;
  setIntake: (next: IntakeAnswers) => void;
  draft: IntakeAnswers;
  setDraft: (next: IntakeAnswers) => void;
  matches: Match[] | null;
  consent: Record<ConsentKey, boolean>;
  toggleConsent: (key: ConsentKey) => void;
  mood: FieldMood;
};

const BridgeContext = createContext<BridgeState | null>(null);

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);
  const [draft, setDraft] = useState<IntakeAnswers>(emptyIntake);
  const [consent, setConsent] = useState<Record<ConsentKey, boolean>>({
    assessments: true,
    patterns: true,
    summaries: false,
    words: false,
  });

  const matches = useMemo(() => (intake ? matchTherapists(intake) : null), [intake]);

  const mood = useMemo<FieldMood>(() => {
    const f = draft.focuses.map((x) => x.toLowerCase());
    return {
      warmth: f.includes("anxiety") || f.includes("burnout") ? 1 : 0,
      tempo: f.includes("sleep") ? 0.45 : 1,
      links: f.includes("relationships") || f.includes("identity") ? 1 : 0,
    };
  }, [draft.focuses]);

  const value = useMemo<BridgeState>(
    () => ({
      intake: intake ?? draft,
      setIntake,
      draft,
      setDraft,
      matches,
      consent,
      toggleConsent: (key) => setConsent((c) => ({ ...c, [key]: !c[key] })),
      mood,
    }),
    [intake, draft, matches, consent, mood],
  );

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge() {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error("useBridge must be used inside BridgeProvider");
  return ctx;
}
