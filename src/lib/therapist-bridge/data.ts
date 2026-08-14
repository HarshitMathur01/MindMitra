import therapist1 from "@/assets/therapist-bridge/therapist-1.webp";
import therapist2 from "@/assets/therapist-bridge/therapist-2.webp";
import therapist3 from "@/assets/therapist-bridge/therapist-3.webp";
import therapist4 from "@/assets/therapist-bridge/therapist-4.webp";
import therapist5 from "@/assets/therapist-bridge/therapist-5.webp";

export type MeetingFormat = "virtual" | "in-person" | "either";

export type Therapist = {
  id: string;
  name: string;
  credentials: string;
  photo: string;
  specialties: string[];
  approach: string[];
  qualities: string[];
  languages: string[];
  price: number;
  formats: Exclude<MeetingFormat, "either">[];
  nextAvailable: string;
  note: string;
};

export const therapists: Therapist[] = [
  {
    id: "maren",
    name: "Maren Ellis",
    credentials: "LCSW · 12 years",
    photo: therapist1,
    specialties: ["Anxiety", "Burnout", "Sleep"],
    approach: ["CBT", "ACT"],
    qualities: ["Structured", "Warm"],
    languages: ["English", "Danish"],
    price: 120,
    formats: ["virtual", "in-person"],
    nextAvailable: "Thursday, 4:30pm",
    note: "Works mostly with people carrying long stretches of overwork.",
  },
  {
    id: "tomas",
    name: "Tomás Rivera",
    credentials: "PsyD · 21 years",
    photo: therapist2,
    specialties: ["Grief", "Relationships", "Identity"],
    approach: ["Psychodynamic", "Existential"],
    qualities: ["Reflective", "Warm"],
    languages: ["English", "Spanish"],
    price: 155,
    formats: ["in-person", "virtual"],
    nextAvailable: "Monday, 11:00am",
    note: "Slow, unhurried sessions that follow where the conversation goes.",
  },
  {
    id: "ada",
    name: "Ada Okonkwo",
    credentials: "LPC · 8 years",
    photo: therapist3,
    specialties: ["Anxiety", "Depression", "Identity", "Burnout"],
    approach: ["CBT", "Mindfulness"],
    qualities: ["Direct", "Structured"],
    languages: ["English"],
    price: 95,
    formats: ["virtual"],
    nextAvailable: "Tomorrow, 9:15am",
    note: "Practical between-session tools, clear structure, gentle pace.",
  },
  {
    id: "ravi",
    name: "Ravi Menon",
    credentials: "LMFT · 10 years",
    photo: therapist4,
    specialties: ["Relationships", "Trauma", "Anxiety"],
    approach: ["EMDR", "Somatic"],
    qualities: ["Trauma-informed", "Warm"],
    languages: ["English", "Hindi", "Malayalam"],
    price: 135,
    formats: ["virtual", "in-person"],
    nextAvailable: "Friday, 6:00pm",
    note: "Body-aware work for people who feel stuck in the same loop.",
  },
  {
    id: "helen",
    name: "Helen Marsh",
    credentials: "PhD · 27 years",
    photo: therapist5,
    specialties: ["Depression", "Grief", "Sleep", "Purpose"],
    approach: ["Psychodynamic", "ACT"],
    qualities: ["Reflective", "Direct"],
    languages: ["English", "French"],
    price: 175,
    formats: ["in-person", "virtual"],
    nextAvailable: "Wednesday, 2:00pm",
    note: "Long-view work on meaning, loss and what comes next.",
  },
];

export type DaySignal = {
  day: string;
  short: string;
  mood: string;
  moodValue: number;
  energy: number;
  sleep: number;
};

export const weekSignal: DaySignal[] = [
  { day: "Wednesday", short: "Wed", mood: "low", moodValue: 3.4, energy: 4.1, sleep: 5.2 },
  { day: "Thursday", short: "Thu", mood: "unsettled", moodValue: 4.2, energy: 4.6, sleep: 5.0 },
  { day: "Friday", short: "Fri", mood: "brighter", moodValue: 5.8, energy: 5.4, sleep: 6.4 },
  { day: "Saturday", short: "Sat", mood: "steady", moodValue: 6.4, energy: 6.6, sleep: 7.1 },
  { day: "Sunday", short: "Sun", mood: "tired", moodValue: 4.8, energy: 4.9, sleep: 6.0 },
  { day: "Monday", short: "Mon", mood: "tense", moodValue: 4.4, energy: 5.2, sleep: 5.4 },
  { day: "Tuesday", short: "Tue", mood: "steady", moodValue: 6.1, energy: 6.2, sleep: 5.8 },
];

export type Insight = {
  id: string;
  direction: "up" | "down" | "flat";
  label: string;
  detail: string;
};

export const insights: Insight[] = [
  {
    id: "energy",
    direction: "up",
    label: "Energy improving",
    detail:
      "Your energy check-ins have moved from an average of 4.4 to 6.2 over the past week. The clearest lift shows up on days after you logged more than six hours of sleep.",
  },
  {
    id: "rumination",
    direction: "down",
    label: "Rumination easing",
    detail:
      "You described looping thoughts on four days two weeks ago, and on one day this week. That's a real change, though a single week is a short window to read from.",
  },
  {
    id: "social",
    direction: "flat",
    label: "Social engagement steady",
    detail:
      "Contact with people close to you has stayed about the same. Not a warning sign on its own — worth noticing alongside everything else.",
  },
  {
    id: "sleep",
    direction: "up",
    label: "Sleep needs attention",
    detail:
      "Five of the last seven nights came in under six hours. Short sleep tends to move mood and energy the next day more than anything else you've logged.",
  },
];

export type Assessment = {
  id: string;
  name: string;
  band: string;
  score: string;
  date: string;
  meaning: string;
};

export const assessments: Assessment[] = [
  {
    id: "phq9",
    name: "PHQ-9",
    band: "Moderate",
    score: "13 of 27",
    date: "Taken 4 days ago",
    meaning:
      "A moderate score usually means low mood has been present most days and is starting to affect ordinary things — sleep, focus, wanting to see people. It's a common place to begin therapy from.",
  },
  {
    id: "gad7",
    name: "GAD-7",
    band: "Mild",
    score: "8 of 21",
    date: "Taken 4 days ago",
    meaning:
      "A mild score suggests worry shows up regularly but isn't taking over most days. Many people in this range find short, structured work helpful.",
  },
];

export type Topic = {
  id: string;
  label: string;
  weight: number;
  insight: string;
};

export const topics: Topic[] = [
  { id: "work", label: "work stress", weight: 1, insight: "Work has come up in 6 of your last 9 check-ins." },
  { id: "sleep", label: "sleep", weight: 0.9, insight: "Sleep has come up 4 times recently, usually late at night." },
  { id: "future", label: "future", weight: 0.6, insight: "Thoughts about the future appear alongside work, not on their own." },
  { id: "selfworth", label: "self-worth", weight: 0.8, insight: "Self-criticism showed up 3 times, mostly after difficult days." },
  { id: "family", label: "family", weight: 0.55, insight: "Family has come up twice, both times in a warmer tone." },
  { id: "anxiety", label: "anxiety", weight: 0.95, insight: "Anxiety is your most frequent theme over the past two weeks." },
  { id: "purpose", label: "purpose", weight: 0.5, insight: "Questions about purpose surfaced once, at length." },
];

export const focusOptions = [
  "Anxiety",
  "Depression",
  "Burnout",
  "Relationships",
  "Trauma",
  "Sleep",
  "Grief",
  "Identity",
  "Purpose",
];

export const qualityOptions = [
  "Structured",
  "Warm",
  "Direct",
  "Reflective",
  "Trauma-informed",
];
