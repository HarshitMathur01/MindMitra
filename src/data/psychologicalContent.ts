import {
  Brain,
  Flower2,
  Activity,
  Sparkles,
  FileText,
  CheckCircle2,
  Play,
  Headphones,
  type LucideIcon,
} from "lucide-react";

export type ContentType = "article" | "video" | "audio" | "exercise";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type CollectionId = "all" | "calm-now" | "understand" | "live-well";

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  type: ContentType;
  category: string;
  tags: string[];
  duration: string;
  difficulty: DifficultyLevel;
  rating: number;
  readCount: number;
  imageEmoji: string;
  image: string;
  featured: boolean;
  keyTakeaways: string[];
}

export interface Collection {
  id: CollectionId;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

export const collections: Collection[] = [
  { id: "all", label: "All resources", short: "All", icon: Sparkles, description: "Everything in the library" },
  { id: "calm-now", label: "Calm yourself now", short: "Calm now", icon: Flower2, description: "Quick exercises, breathing, and grounding for hard moments." },
  { id: "understand", label: "Understand your mind", short: "Understand", icon: Brain, description: "Plain-language reads on anxiety, self-talk, and CBT tools." },
  { id: "live-well", label: "Live well day to day", short: "Day to day", icon: Activity, description: "Sleep, study, and relationships — gentle habits that stick." },
];

export const typeIconMap: Record<ContentType, LucideIcon> = {
  article: FileText,
  video: Play,
  audio: Headphones,
  exercise: CheckCircle2,
};

export const typeFilters: { id: ContentType | "all"; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "article", label: "Reads", icon: FileText },
  { id: "exercise", label: "Practices", icon: CheckCircle2 },
];

export function deriveCollection(item: ContentItem): Exclude<CollectionId, "all"> {
  if (item.category === "study-skills" || item.category === "relationships") return "live-well";
  if (
    item.type === "exercise" ||
    item.type === "audio" ||
    item.category === "mindfulness" ||
    item.category === "stress-management"
  )
    return "calm-now";
  return "understand";
}

export function categoryLabel(categoryId: string): string {
  const map: Record<string, string> = {
    "stress-management": "Stress",
    anxiety: "Anxiety",
    "self-esteem": "Self-esteem",
    "study-skills": "Study & focus",
    relationships: "Relationships",
    mindfulness: "Mindfulness",
    "cbt-techniques": "CBT",
  };
  return map[categoryId] ?? categoryId.replace(/-/g, " ");
}

export function formatTypeLabel(type: ContentType): string {
  if (type === "article") return "Article";
  if (type === "video") return "Video";
  if (type === "audio") return "Audio";
  return "Exercise";
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export const allContent: ContentItem[] = [
  {
    id: "1",
    title: "The 5-4-3-2-1 Grounding Technique",
    description: "A simple sensory exercise to pull yourself out of anxiety spirals in under 3 minutes.",
    longDescription:
      "When anxiety hits — that tight feeling in your chest, the racing thoughts, the sense of losing control — your body is in fight-or-flight mode. The 5-4-3-2-1 grounding technique works by redirecting your brain from the anxious thought loop back to the present moment through your five senses.\n\nHere's how it works:\n• 5 things you can SEE — Look around and name them.\n• 4 things you can TOUCH — Feel the texture of your desk, your clothes, a pen.\n• 3 things you can HEAR — The fan humming, traffic outside, your own breathing.\n• 2 things you can SMELL — Your hand sanitizer, the air freshener.\n• 1 thing you can TASTE — Take a small sip of water.\n\nThis CBT-rooted technique reduces acute anxiety in 2–5 minutes. Especially helpful before exams, presentations, and viva voce.",
    type: "exercise",
    category: "anxiety",
    tags: ["grounding", "quick-relief", "CBT", "exam-anxiety"],
    duration: "3 min",
    difficulty: "beginner",
    rating: 4.9,
    readCount: 12400,
    imageEmoji: "🌊",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=70",
    featured: true,
    keyTakeaways: [
      "Uses your 5 senses to redirect attention from anxious thoughts",
      "Can be done anywhere — during an exam, in a bus, before a presentation",
      "Research-backed CBT technique effective in 2–5 minutes",
      "Regular practice makes it more effective over time",
    ],
  },
  {
    id: "2",
    title: "Why Indian Students Struggle with Saying 'No'",
    description: "Understanding the cultural roots of people-pleasing and how to set boundaries respectfully.",
    longDescription:
      "In Indian culture, saying 'no' — especially to elders or authority figures — is often associated with disrespect. We grow up hearing 'adjust karo', learning to suppress our own needs.\n\nResearch shows an inability to set boundaries is linked to burnout, resentment, and anxiety. Healthy, culturally-sensitive strategies:\n\n1. The Sandwich Method — Appreciation, boundary, care.\n2. The Delayed Response — 'Let me think about it and get back to you.'\n3. The Honest Voice — Lead with feelings: 'I feel overwhelmed when…'\n4. Recognising Guilt vs. Values — Guilt after a boundary doesn't mean you did wrong. It means you did something new.\n\nA boundary is not a wall. It's a gate that you control.",
    type: "article",
    category: "self-esteem",
    tags: ["boundaries", "cultural-context", "people-pleasing", "assertiveness"],
    duration: "7 min read",
    difficulty: "intermediate",
    rating: 4.8,
    readCount: 8900,
    imageEmoji: "🛡️",
    image: "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&w=1200&q=70",
    featured: true,
    keyTakeaways: [
      "Cultural conditioning makes saying 'no' feel like disrespect",
      "Inability to set boundaries leads to burnout and resentment",
      "The Sandwich Method helps say no while maintaining respect",
      "Guilt after a healthy boundary is normal — it means growth",
    ],
  },
  {
    id: "3",
    title: "Box Breathing: The Navy SEAL Technique",
    description: "A regulated breathing pattern used by soldiers and surgeons to stay calm under pressure.",
    longDescription:
      "Box breathing (4-4-4-4) activates your parasympathetic nervous system — your body's 'rest and digest' mode.\n\n1. Breathe IN for 4 seconds\n2. HOLD for 4 seconds\n3. Breathe OUT for 4 seconds\n4. HOLD for 4 seconds\n5. Repeat 4–5 cycles\n\nWhen anxious, breathing becomes shallow and fast — signalling danger to the brain. Slowing the breath sends the opposite signal: 'I am safe.' Practice when calm so your body remembers the pattern under stress.",
    type: "exercise",
    category: "stress-management",
    tags: ["breathing", "quick-relief", "exam-prep", "focus"],
    duration: "5 min",
    difficulty: "beginner",
    rating: 4.7,
    readCount: 15600,
    imageEmoji: "🫁",
    image: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=70",
    featured: false,
    keyTakeaways: [
      "Breathe in 4s → Hold 4s → Out 4s → Hold 4s → Repeat",
      "Activates the parasympathetic nervous system",
      "Improves exam performance by reducing cognitive anxiety",
      "Practice when calm so your body remembers it under stress",
    ],
  },
  {
    id: "4",
    title: "The Pomodoro Technique — Student Edition",
    description: "Adapt the famous focus technique to work with real study schedules and family interruptions.",
    longDescription:
      "The original 25-minute Pomodoro doesn't always fit Indian households. An adapted version:\n\nFocus Block: 25–35 minutes\nShort Break: 5–7 minutes\nAfter 3 blocks: 15–20 minute long break\n\nDealing with interruptions:\n- Tell family your schedule in advance\n- Phone in another room (not just on silent)\n- Use the first block for the hardest subject\n\nStructured blocks improve retention by ~40% vs. marathon sessions.",
    type: "article",
    category: "study-skills",
    tags: ["study-technique", "focus", "time-management", "productivity"],
    duration: "6 min read",
    difficulty: "beginner",
    rating: 4.6,
    readCount: 21300,
    imageEmoji: "🍅",
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=70",
    featured: true,
    keyTakeaways: [
      "Adapted for households where interruptions are common",
      "Adjust block lengths per subject type",
      "Phone in another room, not just silent",
      "Structured blocks improve retention by ~40%",
    ],
  },
  {
    id: "5",
    title: "Understanding Impostor Syndrome in College",
    description: "Why high-achieving students often feel like frauds — and how to silence that inner critic.",
    longDescription:
      "You worked hard, got into a good college, and now feel like you don't belong. Impostor syndrome affects up to 70% of high-achievers.\n\nWhy it hits harder in competitive cultures:\n- Survivor guilt — 'I got in but lakhs didn't'\n- Comparison culture\n- Family expectations\n- First-generation college pressure\n\nHow to fight it:\n1. Evidence Journal — 3 real accomplishments weekly\n2. Talk about it — naming it reduces its power\n3. Reframe failure\n4. Find your people",
    type: "article",
    category: "self-esteem",
    tags: ["impostor-syndrome", "college", "self-doubt"],
    duration: "8 min read",
    difficulty: "intermediate",
    rating: 4.9,
    readCount: 9700,
    imageEmoji: "🎭",
    image: "https://images.unsplash.com/photo-1499914485622-a88fac536970?auto=format&fit=crop&w=1200&q=70",
    featured: false,
    keyTakeaways: [
      "70% of high-achievers experience impostor syndrome",
      "Competitive culture amplifies these feelings",
      "Keep an Evidence Journal of real accomplishments",
      "Naming the feeling reduces its power",
    ],
  },
  {
    id: "6",
    title: "Body Scan Meditation for Beginners",
    description: "A 10-minute guided meditation to release tension stored in your body.",
    longDescription:
      "Your body keeps score of your stress. A body scan helps you notice — and release — stored tension.\n\nFind a comfortable position. Close your eyes.\n1. Start at the top of your head\n2. Move slowly down: forehead → eyes → jaw → neck → shoulders\n3. Breathe INTO each area, imagine tension melting\n4. Continue: arms → hands → chest → stomach → legs → feet\n5. Finish by noticing your whole body\n\n10 minutes daily reduces physical stress symptoms by ~35% over 4 weeks.",
    type: "exercise",
    category: "mindfulness",
    tags: ["meditation", "body-scan", "relaxation"],
    duration: "10 min",
    difficulty: "beginner",
    rating: 4.8,
    readCount: 7200,
    imageEmoji: "🧘",
    image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=70",
    featured: false,
    keyTakeaways: [
      "Systematically scan your body from head to toe",
      "Breathe into areas of tension",
      "10 minutes daily reduces stress by ~35%",
      "Emotions are often stored as physical sensations",
    ],
  },
  {
    id: "7",
    title: "How Social Media Affects Your Brain",
    description: "The neuroscience behind doom scrolling, comparison traps, and digital anxiety.",
    longDescription:
      "Every like releases dopamine — the same chemical released by chocolate or compliments. Social media engineers this on a variable-ratio schedule, the same mechanism that makes gambling addictive.\n\nWhat the research shows:\n- 30+ minutes daily is linked to increased anxiety in young adults\n- A week without social media significantly reduces loneliness and depression\n\nStrategies:\n1. The 20-minute timer rule\n2. Mute, don't unfollow\n3. Phone-free morning window\n4. Curate your content diet\n5. Use built-in screen time tools",
    type: "article",
    category: "anxiety",
    tags: ["social-media", "digital-wellness", "attention"],
    duration: "12 min read",
    difficulty: "beginner",
    rating: 4.7,
    readCount: 18900,
    imageEmoji: "📱",
    image: "https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=1200&q=70",
    featured: true,
    keyTakeaways: [
      "Social media uses the same mechanisms as gambling",
      "1 week off significantly reduces depression",
      "30-minute daily limit is the evidence-based recommendation",
      "Mute aggressively; curate your feed",
    ],
  },
  {
    id: "8",
    title: "Progressive Muscle Relaxation Guide",
    description: "Tense and release muscle groups to reduce physical anxiety — perfect for late-night study sessions.",
    longDescription:
      "PMR teaches your body what relaxation feels like. For each group, TENSE for 5s then RELEASE for 15s.\n\n1. Hands → fists\n2. Forearms → bend wrists back\n3. Shoulders → shrug to ears\n4. Forehead → raise eyebrows\n5. Eyes → squeeze shut\n6. Jaw → clench gently\n7. Chest → deep breath, hold\n8. Stomach → tighten abs\n9. Thighs → press together\n10. Calves → point toes up\n11. Feet → curl toes\n\nGreat for insomnia and tension headaches.",
    type: "exercise",
    category: "stress-management",
    tags: ["relaxation", "PMR", "sleep"],
    duration: "15 min",
    difficulty: "beginner",
    rating: 4.6,
    readCount: 6800,
    imageEmoji: "💆",
    image: "https://images.unsplash.com/photo-1540206395-68808572332f?auto=format&fit=crop&w=1200&q=70",
    featured: false,
    keyTakeaways: [
      "Tense each group for 5s then release for 15s",
      "You can't be physically tense and mentally relaxed at once",
      "Especially effective for insomnia and tension headaches",
      "Can be done at your study desk in 15 minutes",
    ],
  },
  {
    id: "9",
    title: "Cognitive Distortions: The Lies Your Brain Tells",
    description: "Identify 10 common thinking traps that fuel anxiety and depression.",
    longDescription:
      "Cognitive distortions are automatic, convincing, but inaccurate ways of thinking.\n\n10 common distortions:\n1. All-or-Nothing — 'If I don't get 90%, I'm a failure'\n2. Catastrophizing — 'My career is over'\n3. Mind Reading — 'Everyone thinks I'm stupid'\n4. Should Statements — Unrealistic demands\n5. Personalization — 'Sir was upset because of me'\n6. Emotional Reasoning — 'I feel like a failure, so I am'\n7. Filtering — Fixating on the 5% you lost\n8. Overgeneralization — 'I always mess up'\n9. Labeling — 'I'm an idiot' vs 'I made a mistake'\n10. Fortune Telling — 'I know I'll blank out'\n\nChallenge each: What's the evidence? What would I tell a friend?",
    type: "article",
    category: "cbt-techniques",
    tags: ["CBT", "cognitive-distortions", "depression"],
    duration: "10 min read",
    difficulty: "intermediate",
    rating: 4.9,
    readCount: 14200,
    imageEmoji: "🧠",
    image: "https://images.unsplash.com/photo-1531171596281-8b5d26917d8b?auto=format&fit=crop&w=1200&q=70",
    featured: true,
    keyTakeaways: [
      "10 common thinking traps that worsen anxiety",
      "All-or-nothing thinking is the most common in students",
      "Separate feelings from facts",
      "Ask: What would I tell a friend with this thought?",
    ],
  },
  {
    id: "10",
    title: "How to Talk to Your Parents About Mental Health",
    description: "A practical script for approaching the 'log kya kahenge' generation.",
    longDescription:
      "Most parents aren't unavailable — they grew up where mental health wasn't discussed. When you say 'I'm depressed', they hear 'I've failed as a parent.'\n\nA sample script:\n'I want to talk about something important. I've been struggling with [anxiety/low mood], and I want you to know it's not because of anything you've done. Just like a fever needs a doctor, sometimes our mind needs one too. I'd like to speak to a counselor.'\n\nCommon responses:\n- 'Log kya kahenge?' → 'Counseling is completely private.'\n- 'You're making excuses' → 'My studies are suffering because of this.'\n- 'We never needed all this' → 'Different generations face different challenges.'",
    type: "article",
    category: "relationships",
    tags: ["family", "communication", "seeking-help"],
    duration: "8 min read",
    difficulty: "intermediate",
    rating: 4.9,
    readCount: 22100,
    imageEmoji: "💬",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=70",
    featured: true,
    keyTakeaways: [
      "Parents may hear 'I've failed' when you say 'I'm depressed'",
      "Choose a calm moment and use a prepared script",
      "Address 'log kya kahenge' with privacy reassurance",
      "Share helpline numbers with parents",
    ],
  },
  {
    id: "11",
    title: "Sleep Hygiene for Night-Owl Students",
    description: "Why your 3 AM study sessions destroy your memory — and what to do instead.",
    longDescription:
      "Sleep is when your brain converts short-term memories into long-term ones. Sacrificing sleep to study literally erases what you studied.\n\nEvery hour below 7 reduces cognition by ~10%.\n\nTips:\n1. Fixed wake-up time — more important than bedtime\n2. No screens 30 min before bed\n3. Cool room temperature\n4. No caffeine after 2 PM\n5. Worry-dump tomorrow's to-do list before bed\n6. 20-min naps between 1–3 PM",
    type: "article",
    category: "study-skills",
    tags: ["sleep", "memory", "neuroscience"],
    duration: "7 min read",
    difficulty: "beginner",
    rating: 4.7,
    readCount: 16500,
    imageEmoji: "🌙",
    image: "https://images.unsplash.com/photo-1455642305367-68834a1da7ab?auto=format&fit=crop&w=1200&q=70",
    featured: false,
    keyTakeaways: [
      "Sleep converts short-term memories into long-term ones",
      "Each hour below 7 reduces cognition by ~10%",
      "No caffeine after 2 PM — including evening chai",
      "Fixed wake-up time matters more than fixed bedtime",
    ],
  },
  {
    id: "12",
    title: "The ABC Model: Challenging Negative Thoughts",
    description: "Use this CBT framework to break the cycle between events, beliefs, and consequences.",
    longDescription:
      "Events don't directly cause feelings — your BELIEFS about events do.\n\nA = Activating Event\nB = Belief\nC = Consequence\nD = Dispute the belief\nE = Effective new belief\n\nExample:\nA: Friend didn't reply for 2 days\nB: 'They don't care about me'\nC: Sad, withdrawn\nD: 'They could be busy. Am I mind-reading?'\nE: 'I'll check in once more without assuming.'\n\nPractice with one negative thought daily. Within 2 weeks, automatic thoughts feel less powerful.",
    type: "exercise",
    category: "cbt-techniques",
    tags: ["CBT", "ABC-model", "reframing"],
    duration: "8 min",
    difficulty: "intermediate",
    rating: 4.8,
    readCount: 11300,
    imageEmoji: "🔄",
    image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=70",
    featured: false,
    keyTakeaways: [
      "Beliefs about events cause feelings, not events themselves",
      "A → B → C → D → E framework",
      "Practice with one negative thought daily",
      "Especially helpful for comparison-triggered distress",
    ],
  },
];