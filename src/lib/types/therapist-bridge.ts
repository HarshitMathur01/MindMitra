export interface EmotionalProfile {
  moodTrends: Array<{ date: string; mood: number }>;
  patterns: Array<{ icon: string; title: string; description: string }>;
  topics: Array<{ topic: string; frequency: number; sentiment: number }>;
  assessments: Array<{
    type: "PHQ-9" | "GAD-7" | "WEMWBS";
    score: number;
    severity: string;
    date: string;
  }>;
  crisisEvents: Array<{
    date: string;
    severity: string;
    actionTaken: string;
  }>;
}

export interface ConsentState {
  shareFullProfile: boolean;
  shareAssessments: boolean;
  sharePatterns: boolean;
  shareAnonymously: boolean;
}

export interface TherapistFilters {
  languages: string[];
  specializations: string[];
  location: string[];
  availability: string[];
  priceRange: { min: number; max: number };
}

export interface Therapist {
  id: string;
  name: string;
  title: string;
  avatar: string;
  rciNumber: string;
  rating: number;
  reviewCount: number;
  experience: string;
  languages: string[];
  specializations: string[];
  testimonial: string;
  nextAvailable: string;
  sessionFee: number;
  availability: string[];
  location: string[];
}

export interface ReferralPayload {
  userId: string;
  therapistId: string;
  consent: ConsentState;
  profileSnapshot: EmotionalProfile;
}

export interface ReferralResponse {
  id: string;
  status: "created" | "failed";
}

export const therapistBridgeColors = {
  primary: "#028090",
  secondary: "#00A896",
  accent: "#02C39A",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  textDark: "#2D3748",
  textLight: "#64748B",
  background: "#F5F5F5",
};

export const defaultConsentState: ConsentState = {
  shareFullProfile: true,
  shareAssessments: true,
  sharePatterns: true,
  shareAnonymously: true,
};

export const defaultFilters: TherapistFilters = {
  languages: [],
  specializations: [],
  location: [],
  availability: [],
  priceRange: { min: 500, max: 3000 },
};

export const mockProfile: EmotionalProfile = {
  moodTrends: Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000).toISOString(),
    mood: Math.floor(Math.random() * 4) + 5,
  })),
  patterns: [
    {
      icon: "🌙",
      title: "Late Night Anxiety",
      description: "You often feel anxious late at night, especially between 11 PM - 1 AM",
    },
    {
      icon: "📚",
      title: "Exam Stress",
      description: "Stress levels peak around exam periods (2-3 weeks before exams)",
    },
    {
      icon: "✍️",
      title: "Journaling Benefits",
      description: "Journaling helps improve your mood by an average of 23%",
    },
    {
      icon: "🤝",
      title: "Support Network Effect",
      description: "Conversations with trusted friends correlate with better next-day mood",
    },
  ],
  topics: [
    { topic: "Family Pressure", frequency: 45, sentiment: -0.3 },
    { topic: "Academic Stress", frequency: 38, sentiment: -0.5 },
    { topic: "Career Anxiety", frequency: 32, sentiment: -0.2 },
    { topic: "Loneliness", frequency: 28, sentiment: -0.4 },
    { topic: "Self-Doubt", frequency: 25, sentiment: -0.6 },
  ],
  assessments: [
    { type: "PHQ-9", score: 12, severity: "Moderate depression", date: "2024-01-15" },
    { type: "GAD-7", score: 14, severity: "Moderate anxiety", date: "2024-01-20" },
    { type: "WEMWBS", score: 42, severity: "Below average wellbeing", date: "2024-01-22" },
  ],
  crisisEvents: [
    {
      date: "2024-01-10",
      severity: "moderate",
      actionTaken: "Immediate support provided, escalated to MNNIT counselor",
    },
    {
      date: "2024-01-25",
      severity: "moderate",
      actionTaken: "Crisis script enabled and follow-up safety check completed",
    },
  ],
};

export const mockTherapists: Therapist[] = [
  {
    id: "1",
    name: "Dr. Priya Sharma",
    title: "Clinical Psychologist",
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&q=80",
    rciNumber: "A12345",
    rating: 4.9,
    reviewCount: 127,
    experience: "8 years",
    languages: ["Hindi", "English"],
    specializations: ["Anxiety", "Academic Stress", "Family Issues"],
    testimonial: "Warm, non-judgmental approach that helped me open up about family issues",
    nextAvailable: "Tomorrow 6 PM",
    sessionFee: 1200,
    availability: ["Evenings", "Weekends"],
    location: ["Online", "Lucknow"],
  },
  {
    id: "2",
    name: "Dr. Rajesh Kumar",
    title: "Clinical Psychologist",
    avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&q=80",
    rciNumber: "A23456",
    rating: 4.8,
    reviewCount: 94,
    experience: "12 years",
    languages: ["Hindi", "English", "Punjabi"],
    specializations: ["Depression", "Career Counseling", "Relationship Issues"],
    testimonial: "His calm demeanor helped me work through depression after my breakup",
    nextAvailable: "Friday 5 PM",
    sessionFee: 1500,
    availability: ["Weekdays", "Evenings"],
    location: ["Online", "Delhi"],
  },
  {
    id: "3",
    name: "Dr. Meena Iyer",
    title: "Counseling Psychologist",
    avatar: "https://images.unsplash.com/photo-1594824388853-2f89cde2aeb4?w=300&q=80",
    rciNumber: "A34567",
    rating: 4.9,
    reviewCount: 81,
    experience: "9 years",
    languages: ["Tamil", "English"],
    specializations: ["Burnout", "Work Stress", "Self-Esteem"],
    testimonial: "Sessions are practical and deeply empathetic",
    nextAvailable: "Today 8 PM",
    sessionFee: 1300,
    availability: ["Evenings", "Weekends"],
    location: ["Online", "Chennai"],
  },
  {
    id: "4",
    name: "Dr. Aditi Verma",
    title: "Clinical Psychologist",
    avatar: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=300&q=80",
    rciNumber: "A45678",
    rating: 4.7,
    reviewCount: 66,
    experience: "7 years",
    languages: ["Hindi", "English"],
    specializations: ["Anxiety", "Panic", "Trauma-Informed Care"],
    testimonial: "I felt heard from day one, and my panic episodes reduced",
    nextAvailable: "Saturday 10 AM",
    sessionFee: 1400,
    availability: ["Mornings", "Weekends"],
    location: ["Online", "Noida"],
  },
  {
    id: "5",
    name: "Dr. Imran Ali",
    title: "Psychotherapist",
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&q=80",
    rciNumber: "A56789",
    rating: 4.8,
    reviewCount: 73,
    experience: "10 years",
    languages: ["Hindi", "English", "Urdu"],
    specializations: ["Relationships", "Family Conflict", "Men's Mental Health"],
    testimonial: "Very balanced guidance with clear weekly action steps",
    nextAvailable: "Monday 7 PM",
    sessionFee: 1600,
    availability: ["Evenings", "Weekdays"],
    location: ["Online", "Lucknow"],
  },
  {
    id: "6",
    name: "Dr. Kavya Nair",
    title: "Clinical Psychologist",
    avatar: "https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=300&q=80",
    rciNumber: "A67890",
    rating: 4.9,
    reviewCount: 112,
    experience: "11 years",
    languages: ["English", "Malayalam"],
    specializations: ["Depression", "CBT", "ACT"],
    testimonial: "Evidence-based care that made progress measurable",
    nextAvailable: "Tomorrow 9 AM",
    sessionFee: 1800,
    availability: ["Mornings", "Weekdays"],
    location: ["Online", "Bengaluru"],
  },
  {
    id: "7",
    name: "Dr. Nishant Singh",
    title: "Counseling Psychologist",
    avatar: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=300&q=80",
    rciNumber: "A78901",
    rating: 4.6,
    reviewCount: 58,
    experience: "6 years",
    languages: ["Hindi", "English"],
    specializations: ["Academic Stress", "Career Anxiety", "Motivation"],
    testimonial: "Helped me rebuild confidence before placements",
    nextAvailable: "Sunday 4 PM",
    sessionFee: 1100,
    availability: ["Weekends", "Evenings"],
    location: ["Online", "Delhi"],
  },
  {
    id: "8",
    name: "Dr. Sneha Banerjee",
    title: "Clinical Psychologist",
    avatar: "https://images.unsplash.com/photo-1594824388853-2f89cde2aeb4?w=300&q=80",
    rciNumber: "A89012",
    rating: 4.8,
    reviewCount: 88,
    experience: "9 years",
    languages: ["English", "Bengali", "Hindi"],
    specializations: ["Loneliness", "Identity", "Emotional Regulation"],
    testimonial: "A safe and structured process that truly changed how I cope",
    nextAvailable: "Thursday 6 PM",
    sessionFee: 1400,
    availability: ["Weekdays", "Evenings"],
    location: ["Online", "Kolkata"],
  },
];

export const processSteps = [
  {
    number: "1️⃣",
    title: "Book Your First Session",
    description: "Choose a therapist and schedule a time (Video call or in-person)",
  },
  {
    number: "2️⃣",
    title: "Therapist Reviews Your Profile",
    description: "They'll receive your emotional summary. No need to re-explain your journey",
  },
  {
    number: "3️⃣",
    title: "Productive First Session",
    description: "Therapist already understands your patterns. Skip the intake - dive into solutions",
  },
  {
    number: "4️⃣",
    title: "MindMitra Stays With You",
    description: "Continue using the AI between sessions. Therapist can track your progress",
  },
] as const;