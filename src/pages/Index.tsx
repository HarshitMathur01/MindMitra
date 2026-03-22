import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  Home,
  Moon,
  Search,
  Sparkles,
  Sun,
  User,
  Wind,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PublicLanding from "./PublicLanding";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import { useTheme } from "@/context/ThemeContext";

type MoodOption = {
  emoji: string;
  label: string;
  ring: string;
  bg: string;
};

type QuickAction = {
  title: string;
  duration: string;
  icon: typeof Wind;
  bg: string;
  iconColor: string;
  route: string;
  weeklyDone: number;
};

type ContentCard = {
  title: string;
  type: string;
  image: string;
  href?: string;
};

type FeatureCard = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonClassName: string;
  bg: string;
  accent: string;
  illustration: string;
  category: string;
  imageSrc: string;
  categoryClassName: string;
  route: string;
};

const moodOptions: MoodOption[] = [
  { emoji: "😰", label: "Anxious", ring: "ring-blue-300", bg: "bg-blue-50 dark:bg-blue-500/10" },
  { emoji: "😢", label: "Sad", ring: "ring-violet-300", bg: "bg-violet-50 dark:bg-violet-500/10" },
  { emoji: "😐", label: "Neutral", ring: "ring-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10" },
  { emoji: "😊", label: "Happy", ring: "ring-green-300", bg: "bg-green-50 dark:bg-green-500/10" },
  { emoji: "🤩", label: "Excited", ring: "ring-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10" },
];

const affirmationsByPeriod: Record<"morning" | "afternoon" | "evening", string[]> = {
  morning: [
    "Bhagavad Gita, Chapter 2, Verse 47\nकर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nYou have a right to action alone, never to its fruits.",
    "Bhagavad Gita, Chapter 6, Verse 5\nउद्धरेदात्मनात्मानं नात्मानमवसादयेत्।\nLet a person lift oneself by oneself; do not let oneself fall.",
    "Bhagavad Gita, Chapter 18, Verse 66\nसर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।\nAbandon all duties and take refuge in Me alone.",
  ],
  afternoon: [
    "Bhagavad Gita, Chapter 2, Verse 14\nमात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदुःखदाः।\nThe contact of the senses with matter gives rise to cold and heat, pleasure and pain.",
    "Bhagavad Gita, Chapter 2, Verse 48\nयोगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय।\nEstablished in yoga, perform your actions and abandon attachment.",
    "Bhagavad Gita, Chapter 6, Verse 26\nयतो यतो निश्चरति मनश्चञ्चलमस्थिरम्।\nWhenever the restless and unsteady mind wanders, bring it back.",
  ],
  evening: [
    "Bhagavad Gita, Chapter 6, Verse 6\nबन्धुरात्मात्मनस्तस्य येनात्मैवात्मना जितः।\nFor one who has conquered the mind, the mind is the best friend.",
    "Bhagavad Gita, Chapter 12, Verse 13\nअद्वेष्टा सर्वभूतानां मैत्रः करुण एव च।\nOne who is non-hateful, friendly, and compassionate to all beings.",
    "Bhagavad Gita, Chapter 18, Verse 62\nतमेव शरणं गच्छ सर्वभावेन भारत।\nTake refuge in Him with all your heart.",
  ],
};

const culturalPrefixByRegion: Record<string, string[]> = {
  IN: ["Namaste", "Shubh din"],
  PK: ["Assalamu alaikum", "Khush aamdeed"],
  BD: ["Nomoskar", "Assalamu alaikum"],
  NP: ["Namaste", "Namaskar"],
  LK: ["Ayubowan", "Vanakkam"],
  US: ["You belong", "You are seen"],
  GB: ["You belong", "You are seen"],
  CA: ["You belong", "You are seen"],
  AU: ["You belong", "You are seen"],
};

const quickActions: QuickAction[] = [
  {
    title: "Breathe",
    duration: "3 min",
    icon: Wind,
    bg: "bg-teal-50 dark:bg-teal-500/10",
    iconColor: "text-teal-700 dark:text-teal-400",
    route: "/breathe",
    weeklyDone: 4,
  },
  {
    title: "Meditate",
    duration: "10 min",
    icon: Sparkles,
    bg: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-700 dark:text-amber-400",
    route: "/meditate",
    weeklyDone: 5,
  },
  {
    title: "Journal",
    duration: "5 min",
    icon: BookOpen,
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    iconColor: "text-yellow-700 dark:text-yellow-400",
    route: "/journal",
    weeklyDone: 3,
  },
  {
    title: "Gratitude",
    duration: "3 min",
    icon: Heart,
    bg: "bg-pink-50 dark:bg-pink-500/10",
    iconColor: "text-pink-700 dark:text-pink-400",
    route: "/gratitude",
    weeklyDone: 2,
  },
];

const pastMoodTags = [
  "😐 So So due to Something else",
  "😓 So So due to Family",
  "😊 Feeling better after a walk",
  "🤩 Energized by good news",
];

const morningHeroImages = [
  "https://images.unsplash.com/photo-1470137430626-983a37b8ea46?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8Z29vZCUyMG1vcm5pbmd8ZW58MHwwfDB8fHww",
  "https://images.unsplash.com/photo-1526344966-89049886b28d?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGdvb2QlMjBtb3JuaW5nfGVufDB8MHwwfHx8MA%3D%3D",
];

const afternoonHeroImages = [
  "https://images.unsplash.com/photo-1581205445756-15c1d2e9a8df?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fGdvb2QlMjBhZnRlcm5vb258ZW58MHwwfDB8fHww",
  "https://images.unsplash.com/photo-1700409670474-08236194ff99?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fGFmdGVybm9vbiUyMHNreXxlbnwwfDB8MHx8fDA%3D",
];

const eveningHeroImages = [
  "https://plus.unsplash.com/premium_photo-1673002094195-f18084be89ce?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8c3Vuc2V0fGVufDB8MHwwfHx8MA%3D%3D",
  "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bGFuZHNjYXBlfGVufDB8MHwwfHx8MA%3D%3D",
  "https://images.unsplash.com/photo-1433838552652-f9a46b332c40?w=1800&auto=format&fit=crop&q=90&dpr=2&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGxhbmRzY2FwZXxlbnwwfDB8MHx8fDA%3D",
];

const contentCards: ContentCard[] = [
  {
    title: "3 grounding rituals for busy mornings",
    type: "Article",
    href: "/articles/grounding-rituals-busy-mornings",
    image:
      "https://plus.unsplash.com/premium_photo-1666794846975-c07e4374bc48?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDIwfHx8ZW58MHx8fHx8",
  },
  {
    title: "How to reset your nervous system in 2 minutes",
    type: "Carousel",
    href: "/articles/reset-your-nervous-system",
    image:
      "https://images.unsplash.com/photo-1599168215926-ebe820046d54?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Zm9yZXN0JTIwbW91bnRhaW58ZW58MHx8MHx8fDA%3D",
  },
  {
    title: "A calming bedtime routine for deep rest",
    type: "Video",
    href: "/articles/calming-bedtime-routine",
    image:
      "https://plus.unsplash.com/premium_photo-1661953124438-3959644bbcb4?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Zm9yZXN0JTIwbW91bnRhaW58ZW58MHx8MHx8fDA%3D",
  },
  {
    title: "Mountain reset for a calmer mind",
    type: "Guide",
    href: "/articles/mountain-reset-calmer-mind",
    image:
      "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8NGslMjBtb3VudGFpbnxlbnwwfHwwfHx8MA%3D%3D",
  },
  {
    title: "Nature focus: 5-minute visual grounding",
    type: "Mindful View",
    href: "/articles/nature-focus-visual-grounding",
    image:
      "https://plus.unsplash.com/premium_photo-1661964177687-57387c2cbd14?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTd8fDRrJTIwbW91bnRhaW58ZW58MHwwfDB8fHww",
  },
];

const featureCards: FeatureCard[] = [
  {
    title: "Tranquil Moments",
    description:
      "Connect with your inner peace through our collection of mindfulness tracks.",
    buttonLabel: "Start Listening",
    buttonClassName: "bg-sky-500 text-white",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    accent: "from-blue-100 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/10",
    illustration: "🎧",
    category: "Mindfulness",
    imageSrc: "/image1.png",
    categoryClassName: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    route: "/meditate",
  },
  {
    title: "Stress Control Online",
    description:
      "An evidence-based CBT program helps you learn how to deal with stress.",
    buttonLabel: "Explore more",
    buttonClassName: "bg-amber-500 text-white",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    accent: "from-orange-200 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/10",
    illustration: "🧘",
    category: "CBT Program",
    imageSrc: "/image2.png",
    categoryClassName: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    route: "/stress-control",
  },
  {
    title: "Diet and Nutrition Counselling",
    description:
      "Get personalized free health counselling and a diet plan.",
    buttonLabel: "Diet Counselling",
    buttonClassName: "bg-green-600 text-white",
    bg: "bg-green-50 dark:bg-green-500/10",
    accent: "from-green-200 to-green-50 dark:from-green-900/20 dark:to-green-900/10",
    illustration: "🥗",
    category: "Nutrition",
    imageSrc: "/image3.png",
    categoryClassName: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    route: "/nutrition",
  },
  {
    title: "Counselling support, anytime",
    description: "Get free & unlimited support from the experts.",
    buttonLabel: "Counselling Sessions",
    buttonClassName: "bg-blue-500 text-white",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    accent: "from-blue-200 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/10",
    illustration: "💬",
    category: "Expert Support",
    imageSrc: "/image4.png",
    categoryClassName: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    route: "/therapist-bridge",
  },
  {
    title: "This is your safe space",
    description:
      "Try expressing your thoughts, feelings and stories to boost your mental health daily.",
    buttonLabel: "Write about today",
    buttonClassName: "bg-violet-500 text-white",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    accent: "from-violet-200 to-violet-50 dark:from-violet-900/20 dark:to-violet-900/10",
    illustration: "✍️",
    category: "Journaling",
    imageSrc: "/safe_space.png",
    categoryClassName: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    route: "/journal",
  },
];

const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];
const dummyWeekMoods: Array<string | null> = ["😊", "😌", "😰", "😐", "🤩", "😊", null];
const loggedWeekMoods: Array<string | null> = ["😊", "😌", "😰", "😐", "🤩", "😊", null];

const sectionTitleClass = "text-[18px] font-semibold text-foreground";
const cardClass = "rounded-[24px] bg-card p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-5";
const horizontalScrollClass =
  "flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const getVisibleContentCardCount = (width: number) => {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 3;
};

const getContentCardColumnWidth = (visibleCount: number, peekPx: number, gapRem = 1) => {
  if (visibleCount <= 1) {
    return `calc(100% - ${peekPx}px)`;
  }

  return `calc((100% - ${(visibleCount - 1) * gapRem}rem - ${peekPx}px) / ${visibleCount})`;
};

const getContentCardActionLabel = (type: string) => {
  if (type === "Video") return "Watch now";
  if (type === "Carousel") return "Swipe through";
  if (type === "Guide") return "Open guide";
  if (type === "Mindful View") return "Start view";
  return "Read now";
};

const getGreeting = (hours: number) => {
  if (hours < 12) return "Good morning,";
  if (hours < 17) return "Good afternoon,";
  return "Good evening,";
};

const getDayPeriod = (hours: number): "morning" | "afternoon" | "evening" => {
  if (hours < 12) return "morning";
  if (hours < 17) return "afternoon";
  return "evening";
};

const pickRandomImage = (images: string[]) => images[Math.floor(Math.random() * images.length)] ?? "";

const getHeroBackgroundPosition = (dayPeriod: "morning" | "afternoon" | "evening") => {
  if (dayPeriod === "morning") return "center 28%";
  if (dayPeriod === "afternoon") return "center 40%";
  return "center 52%";
};

const getDayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
};

const getRegionCode = () => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const parts = locale.split(/[-_]/);
  return parts.length > 1 ? parts[1]?.toUpperCase() ?? "" : "";
};

const getDynamicAffirmation = (date: Date, period: "morning" | "afternoon" | "evening") => {
  const dayIndex = getDayOfYear(date);
  const hourIndex = date.getHours();
  const pool = affirmationsByPeriod[period];
  return pool[(dayIndex + hourIndex) % pool.length];
};

const getRandomAffirmation = (period: "morning" | "afternoon" | "evening") => {
  const pool = affirmationsByPeriod[period];
  return pool[Math.floor(Math.random() * pool.length)];
};

const getNextDayPeriodBoundary = (current: Date) => {
  const next = new Date(current);
  const hours = current.getHours();

  if (hours < 12) {
    next.setHours(12, 0, 0, 0);
    return next;
  }

  if (hours < 17) {
    next.setHours(17, 0, 0, 0);
    return next;
  }

  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  return next;
};

const getDashboardRevealStyle = (
  index: number,
  extraStyles: CSSProperties = {},
) => ({
  ...extraStyles,
  ["--mm-enter-delay" as const]: `${80 + index * 90}ms`,
}) as CSSProperties;

const SectionHeader = ({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className={sectionTitleClass}>{title}</h2>
    {action ? (
      <button onClick={onAction} className="text-sm font-medium text-muted-foreground transition-transform duration-150 hover:scale-[1.02] hover:text-primary">
        {action}
      </button>
    ) : null}
  </div>
);

const Index = () => {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [isMoodToastVisible, setIsMoodToastVisible] = useState(false);
  const [isMoodCardVisible, setIsMoodCardVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [visibleContentCardCount, setVisibleContentCardCount] = useState(() => getVisibleContentCardCount(window.innerWidth));
  const [contentCarouselIndex, setContentCarouselIndex] = useState(0);
  const [isContentCarouselAnimating, setIsContentCarouselAnimating] = useState(true);
  const [isContentCarouselDragging, setIsContentCarouselDragging] = useState(false);
  const [contentDragOffset, setContentDragOffset] = useState(0);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [isTypingFocus, setIsTypingFocus] = useState(false);
  const carouselPointerStartX = useRef<number | null>(null);
  const hasDraggedContentCarousel = useRef(false);
  const suppressCardClick = useRef(false);
  const suppressCardClickTimer = useRef<number | null>(null);
  const previousScrollY = useRef(0);
  const scrollingDownResetTimer = useRef<number | null>(null);

  const motivationalQuotes = [
    { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", writer: "Nelson Mandela" },
    { text: "The way to get started is to quit talking and begin doing.", writer: "Walt Disney" },
    { text: "Your time is limited, so don't waste it living someone else's life.", writer: "Steve Jobs" },
    { text: "If life were predictable it would cease to be life, and be without flavor.", writer: "Eleanor Roosevelt" },
    { text: "Life is what happens when you're busy making other plans.", writer: "John Lennon" },
    { text: "The only impossible journey is the one you never begin.", writer: "Tony Robbins" },
    { text: "Life itself is the most wonderful fairy tale.", writer: "Hans Christian Andersen" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", writer: "Winston S. Churchill" },
    { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", writer: "Zig Ziglar" },
    { text: "Believe you can and you're halfway there.", writer: "Theodore Roosevelt" }
  ];

  const [dailyQuote] = useState(() => motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);

  const now = currentTime;
  const currentDayIndex = (now.getDay() + 6) % 7;
  const dayPeriod = getDayPeriod(now.getHours());
  const greeting = getGreeting(now.getHours());
  const heroBackgroundImage = useMemo(() => {
    if (dayPeriod === "morning") return pickRandomImage(morningHeroImages);
    if (dayPeriod === "afternoon") return pickRandomImage(afternoonHeroImages);
    return pickRandomImage(eveningHeroImages);
  }, [dayPeriod]);
  const heroBackgroundPosition = getHeroBackgroundPosition(dayPeriod);

  const displayName = useMemo(() => {
    const metadataName =
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "Friend";

    return String(metadataName)
      .trim()
      .split(/[\s_-]+/)[0]
      .replace(/^./, (character) => character.toUpperCase());
  }, [user]);

  const avatarInitial = displayName.charAt(0).toUpperCase() || "F";
  const [affirmation] = useState(() => getRandomAffirmation(dayPeriod));
  const resolvedWeekMoods = loggedWeekMoods.length > 0 ? loggedWeekMoods : dummyWeekMoods;
  const loopedContentCards = useMemo(
    () => (
      contentCards.length > visibleContentCardCount
        ? [...contentCards, ...contentCards.slice(0, visibleContentCardCount)]
        : contentCards
    ),
    [visibleContentCardCount],
  );
  const isContentCarouselInteractive = contentCards.length > visibleContentCardCount;
  const activeContentCardIndex = contentCards.length > 0 ? contentCarouselIndex % contentCards.length : 0;
  const contentCarouselPeekPx = viewportWidth < 1024 ? 36 : 0;
  const contentCarouselStyle = {
    ["--content-card-gap" as const]: "1rem",
    ["--content-card-width" as const]: getContentCardColumnWidth(visibleContentCardCount, contentCarouselPeekPx),
    gridAutoColumns: "var(--content-card-width)",
    transform: `translateX(calc(-${contentCarouselIndex} * (var(--content-card-width) + var(--content-card-gap)) + ${contentDragOffset}px))`,
  } as CSSProperties;
  const showFloatingChatBubble = !isScrollingDown && !isTypingFocus;

  const weekMoodData = weekLabels.map((label, index) => ({
    label,
    mood: index < currentDayIndex ? (resolvedWeekMoods[index] ?? null) : null,
    isToday: index === currentDayIndex,
  }));
  const loggedMoodCount = weekMoodData.filter((day) => day.mood !== null).length;
  const moodCompletionPercent = Math.round((loggedMoodCount / weekMoodData.length) * 100);

  useEffect(() => {
    const nextBoundary = getNextDayPeriodBoundary(currentTime);
    const delayMs = Math.max(0, nextBoundary.getTime() - Date.now());

    const timer = window.setTimeout(() => {
      setCurrentTime(new Date());
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentTime]);

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = window.innerWidth;
      const nextVisibleCount = getVisibleContentCardCount(nextWidth);
      setViewportWidth(nextWidth);
      setVisibleContentCardCount((previousCount) => {
        if (previousCount === nextVisibleCount) {
          return previousCount;
        }

        setIsContentCarouselAnimating(false);
        setContentCarouselIndex(0);
        return nextVisibleCount;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!selectedMood) {
      setIsMoodToastVisible(false);
      return;
    }

    setIsMoodToastVisible(true);

    const fadeTimer = window.setTimeout(() => {
      setIsMoodToastVisible(false);
    }, 2400);

    const hideCardTimer = window.setTimeout(() => {
      setIsMoodCardVisible(false);
    }, 3200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideCardTimer);
    };
  }, [selectedMood]);

  useEffect(() => {
    const isTypingElement = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName;
      return (
        target.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      );
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isTypingElement(event.target)) {
        setIsTypingFocus(true);
      }
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        setIsTypingFocus(isTypingElement(document.activeElement));
      }, 0);
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  useEffect(() => {
    previousScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const scrollDelta = currentY - previousScrollY.current;

      if (scrollDelta > 8 && currentY > 120) {
        setIsScrollingDown(true);
      } else if (scrollDelta < -8) {
        setIsScrollingDown(false);
      }

      if (scrollingDownResetTimer.current) {
        window.clearTimeout(scrollingDownResetTimer.current);
      }

      scrollingDownResetTimer.current = window.setTimeout(() => {
        setIsScrollingDown(false);
      }, 800);

      previousScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollingDownResetTimer.current) {
        window.clearTimeout(scrollingDownResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (suppressCardClickTimer.current) {
        window.clearTimeout(suppressCardClickTimer.current);
      }
    };
  }, []);

  const handleNextContentCards = () => {
    if (!isContentCarouselInteractive) {
      return;
    }

    setIsContentCarouselAnimating(true);
    setContentCarouselIndex((previousIndex) => previousIndex + 1);
  };

  const handlePreviousContentCards = () => {
    if (!isContentCarouselInteractive) {
      return;
    }

    setIsContentCarouselAnimating(true);
    setContentCarouselIndex((previousIndex) => {
      if (previousIndex <= 0) {
        return Math.max(contentCards.length - 1, 0);
      }

      return previousIndex - 1;
    });
  };

  const handleSelectContentCard = (index: number) => {
    setIsContentCarouselAnimating(true);
    setContentCarouselIndex(index);
  };

  const handleContentCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isContentCarouselInteractive) {
      return;
    }

    carouselPointerStartX.current = event.clientX;
    hasDraggedContentCarousel.current = false;
    setIsContentCarouselDragging(true);
    setIsContentCarouselAnimating(false);
    setContentDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleContentCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isContentCarouselInteractive || !isContentCarouselDragging || carouselPointerStartX.current === null) {
      return;
    }

    const delta = event.clientX - carouselPointerStartX.current;
    if (Math.abs(delta) > 8) {
      hasDraggedContentCarousel.current = true;
    }
    setContentDragOffset(delta);
  };

  const handleContentCarouselPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isContentCarouselInteractive) {
      return;
    }

    if (carouselPointerStartX.current === null) {
      setIsContentCarouselDragging(false);
      setContentDragOffset(0);
      return;
    }

    const delta = event.clientX - carouselPointerStartX.current;
    const swipeThreshold = 56;

    carouselPointerStartX.current = null;
    setIsContentCarouselDragging(false);
    setContentDragOffset(0);
    setIsContentCarouselAnimating(true);

    if (Math.abs(delta) > 8) {
      suppressCardClick.current = true;
      if (suppressCardClickTimer.current) {
        window.clearTimeout(suppressCardClickTimer.current);
      }
      suppressCardClickTimer.current = window.setTimeout(() => {
        suppressCardClick.current = false;
      }, 220);
    }

    if (delta <= -swipeThreshold) {
      handleNextContentCards();
      return;
    }

    if (delta >= swipeThreshold) {
      handlePreviousContentCards();
    }
  };

  const handleContentCarouselTransitionEnd = () => {
    if (contentCarouselIndex < contentCards.length) {
      return;
    }

    setIsContentCarouselAnimating(false);
    setContentCarouselIndex(0);
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <PublicLanding />;
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-[#1A1A1A]">
      <main
        className="flex w-full max-w-none flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8"
        style={{ paddingBottom: "calc(10rem + env(safe-area-inset-bottom))" }}
      >
        <section
          className="mm-dashboard-stagger relative min-h-[220px] overflow-hidden rounded-[32px] px-4 pb-6 pt-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:min-h-[280px] sm:px-6"
          style={getDashboardRevealStyle(0, {
            backgroundImage:
              `linear-gradient(180deg, rgba(17,24,39,0.12) 0%, rgba(15,23,42,0.48) 100%), url('${heroBackgroundImage}')`,
            backgroundSize: "cover",
            backgroundPosition: heroBackgroundPosition,
            backgroundRepeat: "no-repeat",
          })}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.22))]" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border border-white/40 bg-white/25 p-0 ring-2 ring-white/70 shadow-lg shadow-white/30 backdrop-blur-md transition-transform duration-150 hover:scale-105"
                aria-label="Open AI companion"
              >
                <img src="/image5.png" alt="AI companion" className="h-full w-full rounded-full object-cover" />
              </button>
              <p className="breathing-hero font-genz max-w-[10rem] text-xs font-semibold leading-tight text-white/95 sm:text-sm">
                Meet your 3D avatar companion
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/18 backdrop-blur-md text-white transition-transform duration-150 hover:scale-105"
                aria-label="Toggle color theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle dark or light mode</span>
              </button>
              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/18 backdrop-blur-md transition-transform duration-150 hover:scale-105"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 text-white" />
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F97316] px-1 text-[10px] font-semibold text-white">
                  3
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-[#F59E0B] text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:scale-105"
                aria-label="Open profile"
              >
                {avatarInitial}
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-10 flex h-full flex-col items-center justify-center text-center sm:mt-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/85">{greeting}</p>
            <h1 className="mt-3 text-[2rem] font-bold leading-tight sm:text-[2.35rem]">
              {displayName} <span className="inline-block origin-[70%_70%]">👋</span>
            </h1>
            <p className="mt-3 rounded-full bg-white/18 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
              🔥 6-day streak — keep it up!
            </p>
          </div>
        </section>

        <section
          className="mm-dashboard-stagger rounded-[24px] border border-primary/20 border-l-4 border-l-primary bg-primary/10 px-5 py-4 shadow-[0_16px_35px_rgba(129,140,248,0.12)] dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-[0_16px_35px_rgba(15,23,42,0.35)]"
          style={getDashboardRevealStyle(1)}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary dark:text-sky-300">
            Daily affirmation 💫
          </p>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-foreground dark:text-slate-100">
            {affirmation}
          </p>
        </section>

        <div className="mm-dashboard-stagger" style={getDashboardRevealStyle(2)}>
          <section
            className={`${cardClass} overflow-hidden transition-all duration-700 ${isMoodCardVisible
              ? "max-h-[260px] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 p-0 opacity-0 shadow-none"
              }`}
            aria-hidden={!isMoodCardVisible}
          >
            <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              How are you feeling today?
            </p>

            <div className="mt-4 min-h-[110px]">
              {selectedMood ? (
                <div
                  className={`flex h-full flex-col items-center justify-center rounded-[20px] bg-amber-50 dark:bg-amber-500/10 px-4 py-6 text-center transition-all duration-700 ${isMoodToastVisible
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-1 opacity-0"
                    }`}
                >
                  <div className="text-4xl">{selectedMood.emoji}</div>
                  <p className="mt-3 text-base font-semibold text-foreground">Thanks for checking in! 💛</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We&apos;ve saved that you&apos;re feeling {selectedMood.label.toLowerCase()} today.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {moodOptions.map((mood) => (
                    <button
                      key={mood.label}
                      type="button"
                      onClick={() => setSelectedMood(mood)}
                      className={`flex flex-col items-center rounded-[20px] px-2 py-3 text-center transition-transform duration-150 hover:scale-[1.04] ${mood.bg}`}
                    >
                      <span className={`rounded-full ring-2 ring-transparent transition-all duration-150 ${mood.ring} px-1 py-1 text-[2rem]`}>
                        {mood.emoji}
                      </span>
                      <span className="mt-2 text-[11px] font-medium text-muted-foreground sm:text-xs">{mood.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(3)}>
          <SectionHeader title="Quick Actions" action="More >" onAction={() => navigate("/healthy-habits")} />
          <div className={`${horizontalScrollClass} md:grid md:grid-cols-4 md:overflow-visible md:pb-0`}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              const progressPct = Math.round((action.weeklyDone / 7) * 100);

              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => navigate(action.route)}
                  className={`relative min-w-[100px] flex-1 rounded-3xl p-4 text-left transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] md:min-w-0 ${action.bg}`}
                >
                  {/* Completion dot */}
                  {action.weeklyDone >= 7 && (
                    <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-green-400 shadow-sm" />
                  )}
                  {/* Icon with gradient ring */}
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70 dark:bg-white/10 ring-2 ring-white/60 dark:ring-white/10 ${action.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.duration}</p>
                  {/* Weekly progress bar */}
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-current opacity-50"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{action.weeklyDone}/7 this week</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(4)}>
          <h2 className={sectionTitleClass}>Your past moods</h2>
          <div className={horizontalScrollClass}>
            {pastMoodTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-foreground transition-transform duration-150 hover:scale-[1.02]"
              >
                <span>{tag}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>

        <section
          className="mm-dashboard-stagger rounded-[28px] bg-gradient-to-br from-[#E0E8FF] via-[#EDE9FE] to-[#DBEAFE] p-5 shadow-[0_18px_40px_rgba(59,130,246,0.08)]"
          style={getDashboardRevealStyle(5)}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#1E3A8A]">A gentle glance at your daily rhythm</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#475569]">
                Keep tabs on the tiny wins that help your mind feel grounded and cared for.
              </p>
            </div>
            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/60 text-3xl md:flex">
              📈
            </div>
          </div>
        </section>

        <section className="mm-dashboard-stagger" style={getDashboardRevealStyle(6)}>
          <label className="flex items-center gap-3 rounded-[22px] border border-border bg-card px-4 py-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search content, topics, exercises..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </section>

        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(7)}>
          <SectionHeader title="Habits" action="See all >" />
          <button
            type="button"
            onClick={() => navigate("/healthy-habits")}
            className="w-full rounded-[28px] bg-gradient-to-r from-[#F8B4B4] via-[#FDBA8C] to-[#FCD9B6] p-5 text-left text-white shadow-[0_24px_50px_rgba(249,115,22,0.18)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <h2 className="text-2xl font-bold">Build Healthy Habits!</h2>
                <p className="mt-2 text-sm leading-6 text-white/90">
                  A new way to nurture your mind, one step at a time.
                </p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] transition-all duration-200 group-hover:scale-[1.04] active:scale-[0.98]">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <img
                src="/image7.png"
                alt="Healthy habits illustration"
                className="h-28 w-full max-w-[160px] shrink-0 rounded-[20px] object-cover shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
              />
            </div>
          </button>
        </section>

        <section
          className="mm-dashboard-stagger space-y-4 rounded-[28px] border border-border bg-card/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-5"
          style={getDashboardRevealStyle(8)}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-orange-500">What&apos;s fresh?</p>
              <h2 className="mt-1 text-[18px] font-semibold text-foreground">Latest content for you</h2>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="text-sm text-muted-foreground">
                {activeContentCardIndex + 1}/{contentCards.length}
              </div>
              {isContentCarouselInteractive ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousContentCards}
                    aria-label="Show previous content cards"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#2563EB]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextContentCards}
                    aria-label="Show next content cards"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#2563EB]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="overflow-hidden pr-5 sm:pr-3 lg:pr-0"
            onPointerDown={handleContentCarouselPointerDown}
            onPointerMove={handleContentCarouselPointerMove}
            onPointerUp={handleContentCarouselPointerEnd}
            onPointerCancel={handleContentCarouselPointerEnd}
          >
            <div
              className={`grid grid-flow-col gap-4 touch-pan-y ${isContentCarouselAnimating && !isContentCarouselDragging ? "transition-transform duration-500 ease-out" : "transition-none"}`}
              style={contentCarouselStyle}
              onTransitionEnd={handleContentCarouselTransitionEnd}
            >
              {loopedContentCards.map((card, index) => (
                <article
                  key={`${card.title}-${index}`}
                  role={card.href ? "button" : undefined}
                  tabIndex={card.href ? 0 : undefined}
                  onClick={card.href ? () => {
                    if (suppressCardClick.current) {
                      return;
                    }
                    navigate(card.href);
                  } : undefined}
                  onKeyDown={card.href ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(card.href);
                    }
                  } : undefined}
                  className={`group relative overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition-all duration-200 ${card.href
                    ? "cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_24px_45px_rgba(15,23,42,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    : ""
                    }`}
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.title}
                      className={`h-full w-full object-cover transition-transform duration-300 ${card.href ? "group-hover:scale-[1.02]" : ""}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/30 via-transparent to-transparent" />
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label={`Save ${card.title}`}
                      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[0_10px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-colors duration-150 hover:text-primary"
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>

                    <div className="absolute left-3 top-3 z-10 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow-[0_10px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                      {card.type}
                    </div>
                  </div>

                  <div className="space-y-2 p-4">
                    <h3 className={`text-sm font-semibold leading-6 transition-colors duration-150 ${card.href ? "text-foreground group-hover:text-primary" : "text-foreground"}`}>
                      {card.title}
                    </h3>

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="text-muted-foreground">{getContentCardActionLabel(card.type)}</p>
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {isContentCarouselInteractive ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">Swipe cards to explore more</p>
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Content carousel pagination">
                {contentCards.map((card, index) => {
                  const isActive = index === activeContentCardIndex;

                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => handleSelectContentCard(index)}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Go to card ${index + 1}: ${card.title}`}
                      className={`h-2.5 rounded-full transition-all duration-200 ${isActive
                        ? "w-6 bg-primary"
                        : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/55"
                        }`}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(9)}>
          <SectionHeader title="Your Wellness Toolkit" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {featureCards.map((card, index) => (
              <article
                key={card.title}
                className={`mm-dashboard-stagger flex flex-col rounded-[24px] ${card.bg} p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)]`}
                style={getDashboardRevealStyle(10 + index)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${card.categoryClassName}`}>
                    {card.category}
                  </span>
                  <img
                    src={card.imageSrc}
                    alt={card.title}
                    className="h-24 w-24 shrink-0 rounded-xl object-cover"
                  />
                </div>
                <h3 className="mt-3 text-base font-semibold text-foreground">{card.title}</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.description}</p>
                <button
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${card.buttonClassName}`}
                  onClick={() => navigate(card.route)}
                >
                  {card.buttonLabel}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section
          className="mm-dashboard-stagger rounded-[24px] bg-card p-4 shadow-[0_14px_30px_rgba(148,163,184,0.08)]"
          style={getDashboardRevealStyle(15)}
        >
          <div className="flex items-center justify-between">
            <h2 className={sectionTitleClass}>This week&apos;s mood</h2>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {moodCompletionPercent}% logged
            </span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {weekMoodData.map((day, index) => (
              <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-1.5">
                <span className={`text-[11px] font-medium ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {day.label}
                </span>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${day.isToday
                    ? "border-2 border-blue-300 bg-blue-50 text-primary"
                    : day.mood
                      ? "bg-card text-foreground shadow-sm"
                      : "border border-dashed border-border text-muted-foreground"
                    }`}
                >
                  {day.mood ?? "·"}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-primary" style={{ width: `${moodCompletionPercent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{loggedMoodCount} of {weekMoodData.length} days logged</p>
          </div>
        </section>

        <section
          className="mm-dashboard-stagger rounded-[20px] bg-card p-4 shadow-[0_12px_24px_rgba(148,163,184,0.06)]"
          style={getDashboardRevealStyle(16)}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Insight</p>
          <div className="mt-2 inline-flex flex-col items-start">
            <p className="text-[15px] font-medium italic leading-relaxed text-foreground">
              &ldquo;{dailyQuote.text}&rdquo;
            </p>
            <p className="mt-2 self-end text-sm font-semibold text-muted-foreground">— {dailyQuote.writer}</p>
          </div>
        </section>
      </main>

      <div
        className={`fixed right-4 z-30 flex items-center gap-2.5 transition-all duration-300 sm:right-6 ${showFloatingChatBubble ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <p className="breathing-hero rounded-2xl border border-white/60 bg-white/95 px-4 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-md">
          {greeting} Chat with me 👋
        </p>
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="mm-fab-glow relative h-14 w-14 overflow-hidden rounded-full shadow-[0_18px_40px_rgba(99,102,241,0.30)] ring-2 ring-white/40 transition-all duration-200 hover:scale-110 hover:shadow-[0_22px_48px_rgba(99,102,241,0.40)] active:scale-95"
          aria-label="Open AI companion"
        >
          <img src="/image5.png" alt="AI companion" className="h-full w-full object-cover" />
        </button>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E8E0F0]/40 bg-white/80 px-6 pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          <button className="group flex flex-col items-center gap-1 text-[#3B82F6] transition-transform duration-150 hover:scale-105">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] transition-colors duration-200">
              <Home className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold">Home</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/psychological-content")}
            className="group flex flex-col items-center gap-1 text-[#9CA3AF] transition-all duration-150 hover:scale-105 hover:text-[#6B7280]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-[#F5F3FF]">
              <Compass className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">Discover</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="group flex flex-col items-center gap-1 text-[#9CA3AF] transition-all duration-150 hover:scale-105 hover:text-[#6B7280]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-[#FFF7ED]">
              <User className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Index;
