export type Severity = "minimal" | "mild" | "moderate" | "severe";

export type Therapist = {
  id: string;
  name: string;
  credentials: string;
  specialties: string[];
  modality: ("in-person" | "virtual")[];
  languages: string[];
  gender: "female" | "male" | "non-binary";
  rating: number;
  reviews: number;
  pricePerSession: number;
  nextAvailable: string;
  bio: string;
  avatarHue: number;
  photo: string;
};

export type EmotionalProfile = {
  mood7d: { day: string; value: number }[];
  patterns: { label: string; trend: "up" | "down" | "flat"; detail: string }[];
  topics: { word: string; weight: number }[];
  assessments: { name: string; score: number; max: number; severity: Severity }[];
};

export const mockProfile: EmotionalProfile = {
  mood7d: [
    { day: "Mon", value: 4 },
    { day: "Tue", value: 5 },
    { day: "Wed", value: 3 },
    { day: "Thu", value: 6 },
    { day: "Fri", value: 5 },
    { day: "Sat", value: 7 },
    { day: "Sun", value: 6 },
  ],
  patterns: [
    { label: "Sleep disruption", trend: "up", detail: "Avg 5.2h, down from 6.8h" },
    { label: "Rumination episodes", trend: "down", detail: "12 → 7 this week" },
    { label: "Social withdrawal", trend: "flat", detail: "Stable, low engagement" },
    { label: "Energy levels", trend: "up", detail: "Improving since Wednesday" },
  ],
  topics: [
    { word: "work stress", weight: 9 },
    { word: "family", weight: 7 },
    { word: "sleep", weight: 8 },
    { word: "anxiety", weight: 6 },
    { word: "loneliness", weight: 5 },
    { word: "future", weight: 4 },
    { word: "self-worth", weight: 6 },
    { word: "purpose", weight: 3 },
  ],
  assessments: [
    { name: "PHQ-9", score: 11, max: 27, severity: "moderate" },
    { name: "GAD-7", score: 9, max: 21, severity: "mild" },
  ],
};

export const mockTherapists: Therapist[] = [
  {
    id: "t1",
    name: "Dr. Anya Rao",
    credentials: "PhD, Clinical Psychologist",
    specialties: ["Anxiety", "Burnout", "CBT"],
    modality: ["virtual", "in-person"],
    languages: ["English", "Hindi"],
    gender: "female",
    rating: 4.9,
    reviews: 184,
    pricePerSession: 1800,
    nextAvailable: "Tomorrow, 4:00 PM",
    bio: "Evidence-based care for high-achievers navigating burnout and anxiety.",
    avatarHue: 175,
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=70",
  },
  {
    id: "t2",
    name: "Marcus Lin, LMFT",
    credentials: "Licensed Marriage & Family Therapist",
    specialties: ["Relationships", "Grief", "ACT"],
    modality: ["virtual"],
    languages: ["English", "Mandarin"],
    gender: "male",
    rating: 4.8,
    reviews: 96,
    pricePerSession: 2200,
    nextAvailable: "Thu, 11:00 AM",
    bio: "Warm, structured approach to relational and life-transition work.",
    avatarHue: 195,
    photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=70",
  },
  {
    id: "t3",
    name: "Priya Menon, MA",
    credentials: "Counseling Psychologist",
    specialties: ["Depression", "Sleep", "Mindfulness"],
    modality: ["virtual", "in-person"],
    languages: ["English", "Malayalam", "Tamil"],
    gender: "female",
    rating: 4.7,
    reviews: 142,
    pricePerSession: 1500,
    nextAvailable: "Today, 7:30 PM",
    bio: "Integrative practice blending CBT with somatic and mindfulness tools.",
    avatarHue: 160,
    photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=400&q=70",
  },
  {
    id: "t4",
    name: "Sam Okafor, PsyD",
    credentials: "Doctor of Psychology",
    specialties: ["Trauma", "PTSD", "EMDR"],
    modality: ["in-person"],
    languages: ["English"],
    gender: "non-binary",
    rating: 4.95,
    reviews: 73,
    pricePerSession: 2600,
    nextAvailable: "Mon, 2:00 PM",
    bio: "Specialist in trauma-focused therapy with a body-aware lens.",
    avatarHue: 210,
    photo: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?auto=format&fit=crop&w=400&q=70",
  },
  {
    id: "t5",
    name: "Dr. Elena Sokolova",
    credentials: "MD, Psychiatrist",
    specialties: ["Anxiety", "Mood Disorders", "Medication"],
    modality: ["virtual"],
    languages: ["English", "Russian"],
    gender: "female",
    rating: 4.85,
    reviews: 211,
    pricePerSession: 3200,
    nextAvailable: "Fri, 10:00 AM",
    bio: "Combined psychotherapy and medication management when indicated.",
    avatarHue: 145,
    photo: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=400&q=70",
  },
  {
    id: "t6",
    name: "Jordan Reyes, LCSW",
    credentials: "Licensed Clinical Social Worker",
    specialties: ["LGBTQ+", "Identity", "Anxiety"],
    modality: ["virtual", "in-person"],
    languages: ["English", "Spanish"],
    gender: "non-binary",
    rating: 4.9,
    reviews: 158,
    pricePerSession: 1700,
    nextAvailable: "Wed, 6:00 PM",
    bio: "Affirming, identity-aware care for everyday and complex challenges.",
    avatarHue: 185,
    photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=70",
  },
];

export const concernOptions = [
  "Anxiety",
  "Depression",
  "Burnout",
  "Relationships",
  "Trauma",
  "Sleep",
  "Grief",
  "Identity",
  "LGBTQ+",
];

export const languageOptions = [
  "English",
  "Hindi",
  "Spanish",
  "Mandarin",
  "Tamil",
  "Malayalam",
  "Russian",
];

export type IntakePrefs = {
  concerns: string[];
  modality: "any" | "in-person" | "virtual";
  language: string;
  gender: "any" | "female" | "male" | "non-binary";
  budget: number;
};

export const defaultIntake: IntakePrefs = {
  concerns: [],
  modality: "any",
  language: "any",
  gender: "any",
  budget: 3500,
};

export type ConsentState = {
  assessments: boolean;
  fullProfile: boolean;
  sessionSummaries: boolean;
  contactInfo: boolean;
};

export const defaultConsent: ConsentState = {
  assessments: false,
  fullProfile: false,
  sessionSummaries: false,
  contactInfo: false,
};

export const minimumConsent = (c: ConsentState) => c.assessments && c.contactInfo;
