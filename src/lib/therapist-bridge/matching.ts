import { therapists, type MeetingFormat, type Therapist } from "./data";

export type IntakeAnswers = {
  focuses: string[];
  format: MeetingFormat;
  qualities: string[];
  budget: number;
};

export const emptyIntake: IntakeAnswers = {
  focuses: [],
  format: "either",
  qualities: [],
  budget: 140,
};

export type Match = {
  therapist: Therapist;
  score: number;
  phrase: string;
  reasons: string[];
};

function fitPhrase(score: number) {
  if (score >= 85) return "Feels like a strong fit";
  if (score >= 70) return "Feels like a good fit";
  if (score >= 55) return "Could be worth a conversation";
  return "A gentler possibility";
}

export function matchTherapists(intake: IntakeAnswers): Match[] {
  const scored = therapists.map((therapist) => {
    const sharedFocus = intake.focuses.filter((f) =>
      therapist.specialties.some((s) => s.toLowerCase() === f.toLowerCase()),
    );
    const sharedQualities = intake.qualities.filter((q) =>
      therapist.qualities.some((s) => s.toLowerCase() === q.toLowerCase()),
    );
    const formatOk =
      intake.format === "either" ||
      therapist.formats.includes(intake.format as Exclude<MeetingFormat, "either">);
    const withinBudget = therapist.price <= intake.budget;

    const focusScore = intake.focuses.length
      ? (sharedFocus.length / intake.focuses.length) * 46
      : 26;
    const qualityScore = intake.qualities.length
      ? (sharedQualities.length / intake.qualities.length) * 26
      : 15;
    const formatScore = formatOk ? 14 : 0;
    const budgetScore = withinBudget
      ? 14
      : Math.max(0, 14 - (therapist.price - intake.budget) / 6);

    const score = Math.round(
      Math.min(97, focusScore + qualityScore + formatScore + budgetScore + 4),
    );

    const reasons: string[] = [];
    if (sharedFocus.length) {
      reasons.push(
        `You mentioned ${listify(sharedFocus.map((f) => f.toLowerCase()))}. ${therapist.name.split(" ")[0]} works with ${sharedFocus.length > 1 ? "both" : "this"} regularly.`,
      );
    }
    if (sharedQualities.length) {
      reasons.push(
        `You preferred a ${listify(sharedQualities.map((q) => q.toLowerCase()))} presence. Their practice is described that way by the people they see.`,
      );
    }
    if (therapist.approach.length) {
      reasons.push(`Their work draws on ${listify(therapist.approach)}.`);
    }
    if (formatOk && intake.format !== "either") {
      reasons.push(`They offer ${intake.format === "virtual" ? "virtual sessions" : "in-person sessions"}, which is what you asked for.`);
    }
    reasons.push(
      withinBudget
        ? `Sessions are $${therapist.price}, inside the range you set.`
        : `Sessions are $${therapist.price}, a little above the range you set — included in case the fit matters more.`,
    );

    return { therapist, score, phrase: fitPhrase(score), reasons };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 4);
}

function listify(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
