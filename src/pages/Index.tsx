import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  ChevronRight,
  Compass,
  Flame,
  Heart,
  Home,
  Search,
  Sparkles,
  User,
  Wind,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PublicLanding from "./PublicLanding";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";

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
    "You are stronger than you think, and braver than you feel. 🏋️",
    "A steady start is still powerful progress. 🌤️",
    "Today begins with your courage, one breath at a time. 🌱",
  ],
  afternoon: [
    "You are doing enough for this moment, and that matters. 💛",
    "Pause, reset, and continue with self-trust. 🌿",
    "Your effort today carries quiet strength. ✨",
  ],
  evening: [
    "You made it through today with heart—rest is deserved. 🌙",
    "You can release today gently and keep your peace. 🕊️",
    "Your worth is not measured by productivity; you are enough. 🌸",
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
  },
  {
    title: "Meditate",
    duration: "10 min",
    icon: Sparkles,
    bg: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-700 dark:text-amber-400",
  },
  {
    title: "Journal",
    duration: "5 min",
    icon: BookOpen,
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    iconColor: "text-yellow-700 dark:text-yellow-400",
  },
  {
    title: "Gratitude",
    duration: "3 min",
    icon: Heart,
    bg: "bg-pink-50 dark:bg-pink-500/10",
    iconColor: "text-pink-700 dark:text-pink-400",
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
    buttonClassName: "bg-blue-500 text-white",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    accent: "from-blue-100 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/10",
    illustration: "🎧",
  },
  {
    title: "Stress Control Online",
    description:
      "An evidence-based CBT program helps you learn how to deal with stress.",
    buttonLabel: "Explore more",
    buttonClassName: "bg-orange-500 text-white",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    accent: "from-orange-200 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/10",
    illustration: "🧘",
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
  },
  {
    title: "Counselling support, anytime",
    description: "Get free & unlimited support from the experts.",
    buttonLabel: "Counselling Sessions",
    buttonClassName: "bg-blue-500 text-white",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    accent: "from-blue-200 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/10",
    illustration: "💬",
  },
  {
    title: "This is your safe space",
    description:
      "Try expressing your thoughts, feelings and stories to boost your mental health daily.",
    buttonLabel: "Write about today",
    buttonClassName: "bg-orange-500 text-white",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    accent: "from-violet-200 to-violet-50 dark:from-violet-900/20 dark:to-violet-900/10",
    illustration: "✍️",
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

const getContentCardColumnWidth = (visibleCount: number) => {
  if (visibleCount <= 1) return "100%";
  return `calc((100% - ${(visibleCount - 1)}rem) / ${visibleCount})`;
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
  const baseAffirmation = pool[(dayIndex + hourIndex) % pool.length];

  const region = getRegionCode();
  const culturalPrefixes = culturalPrefixByRegion[region] ?? ["You are valued", "You are supported"];
  const prefix = culturalPrefixes[(dayIndex + hourIndex) % culturalPrefixes.length];

  return `${prefix} — ${baseAffirmation}`;
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
}: {
  title: string;
  action?: string;
}) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className={sectionTitleClass}>{title}</h2>
    {action ? (
      <button className="text-sm font-medium text-muted-foreground transition-transform duration-150 hover:scale-[1.02] hover:text-primary">
        {action}
      </button>
    ) : null}
  </div>
);

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [isMoodToastVisible, setIsMoodToastVisible] = useState(false);
  const [isMoodCardVisible, setIsMoodCardVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [visibleContentCardCount, setVisibleContentCardCount] = useState(() => getVisibleContentCardCount(window.innerWidth));
  const [contentCarouselIndex, setContentCarouselIndex] = useState(0);
  const [isContentCarouselAnimating, setIsContentCarouselAnimating] = useState(true);

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
  const affirmation = getDynamicAffirmation(now, dayPeriod);
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
  const contentCarouselStyle = {
    ["--content-card-width" as const]: getContentCardColumnWidth(visibleContentCardCount),
    gridAutoColumns: "var(--content-card-width)",
    transform: `translateX(calc(-${contentCarouselIndex} * (var(--content-card-width) + 1rem)))`,
  } as CSSProperties;

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
      const nextVisibleCount = getVisibleContentCardCount(window.innerWidth);
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

  const handleNextContentCards = () => {
    if (!isContentCarouselInteractive) {
      return;
    }

    setIsContentCarouselAnimating(true);
    setContentCarouselIndex((previousIndex) => previousIndex + 1);
  };

  const handleSelectContentCard = (index: number) => {
    setIsContentCarouselAnimating(true);
    setContentCarouselIndex(index);
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
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-36 pt-4 sm:px-6 lg:px-8">
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
          className="mm-dashboard-stagger rounded-[24px] border-l-4 border-primary bg-primary/10 px-5 py-4 shadow-[0_16px_35px_rgba(129,140,248,0.12)]"
          style={getDashboardRevealStyle(1)}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Daily affirmation 💫
          </p>
          <p className="mt-2 text-[15px] leading-6 text-foreground">{affirmation}</p>
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
          <SectionHeader title="Quick Actions" action="More >" />
          <div className={`${horizontalScrollClass} md:grid md:grid-cols-4 md:overflow-visible md:pb-0`}>
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.title}
                  type="button"
                  className={`min-w-[92px] flex-1 rounded-[22px] p-4 text-left transition-transform duration-150 hover:scale-[1.03] md:min-w-0 ${action.bg}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-background/70 dark:bg-white/10 ${action.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.duration}</p>
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
          className="mm-dashboard-stagger overflow-hidden rounded-[28px] bg-indigo-100 dark:bg-indigo-500/15 p-5 shadow-[0_18px_40px_rgba(59,130,246,0.08)]"
          style={getDashboardRevealStyle(5)}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Habit Tracker</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">A gentle glance at your daily rhythm</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Keep tabs on the tiny wins that help your mind feel grounded and cared for.
              </p>
            </div>

            <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-full bg-background/60 dark:bg-white/10 text-4xl md:flex">
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
          <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-[#F8B4B4] via-[#FDBA8C] to-[#FCD9B6] p-5 text-white shadow-[0_24px_50px_rgba(249,115,22,0.18)]">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/95">
                  <Flame className="h-4 w-4" />
                  Start a new habit
                </div>
                <h2 className="mt-4 text-2xl font-bold">Build Healthy Habits!</h2>
                <p className="mt-2 text-sm leading-6 text-white/90">
                  A new way to nurture your mind, one step at a time.
                </p>
                <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white transition-transform duration-150 hover:scale-[1.03]">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <img
                src="/image7.png"
                alt="Healthy habits illustration"
                className="h-28 w-full max-w-[180px] rounded-[24px] object-cover"
              />
            </div>
          </div>
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
                <button
                  type="button"
                  onClick={handleNextContentCards}
                  aria-label="Show next content cards"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#2563EB]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden">
            <div
              className={`grid grid-flow-col gap-4 ${isContentCarouselAnimating ? "transition-transform duration-500 ease-out" : "transition-none"}`}
              style={contentCarouselStyle}
              onTransitionEnd={handleContentCarouselTransitionEnd}
            >
              {loopedContentCards.map((card, index) => (
                <article
                  key={`${card.title}-${index}`}
                  role={card.href ? "button" : undefined}
                  tabIndex={card.href ? 0 : undefined}
                  onClick={card.href ? () => navigate(card.href) : undefined}
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
        </section>

        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(9)}>
          {featureCards.map((card, index) => (
            <article
              key={card.title}
              className={`mm-dashboard-stagger overflow-hidden rounded-[28px] ${card.bg} p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]`}
              style={getDashboardRevealStyle(10 + index)}
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <h3 className="text-xl font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                  <button className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.03] ${card.buttonClassName}`}>
                    {card.buttonLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {card.illustration === "🎧" ? (
                  <img
                    src="/image1.png"
                    alt="Calming illustration"
                    className="h-28 w-full max-w-[160px] rounded-[24px] object-cover"
                  />
                ) : card.illustration === "🧘" ? (
                  <img
                    src="/image2.png"
                    alt="Meditation illustration"
                    className="h-28 w-full max-w-[160px] rounded-[24px] object-cover"
                  />
                ) : card.illustration === "🥗" ? (
                  <img
                    src="/image3.png"
                    alt="Nutrition illustration"
                    className="h-28 w-full max-w-[160px] rounded-[24px] object-cover"
                  />
                ) : card.illustration === "💬" ? (
                  <img
                    src="/image4.png"
                    alt="Conversation illustration"
                    className="h-28 w-full max-w-[160px] rounded-[24px] object-cover"
                  />
                ) : card.illustration === "✍️" ? (
                  <img
                    src="/safe_space.png"
                    alt="Safe space illustration"
                    className="h-28 w-full max-w-[160px] rounded-[24px] object-cover"
                  />
                ) : (
                  <div className={`flex h-28 w-full max-w-[160px] items-center justify-center rounded-[24px] bg-gradient-to-br ${card.accent} text-5xl`}>
                    {card.illustration}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        <section
          className="mm-dashboard-stagger rounded-[24px] bg-card p-4 shadow-[0_16px_35px_rgba(148,163,184,0.08)] sm:p-5"
          style={getDashboardRevealStyle(15)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={sectionTitleClass}>This week&apos;s mood</h2>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Track your emotional pattern, one day at a time</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-[0_8px_20px_rgba(59,130,246,0.15)]">
              {moodCompletionPercent}% logged
            </span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-3">
            {weekMoodData.map((day, index) => (
              <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-2">
                <span className={`text-xs font-semibold ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {day.label}
                </span>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition-all duration-200 ${day.isToday
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-500/10 text-primary ring-2 ring-blue-200"
                    : day.mood
                      ? "border-border bg-card text-foreground shadow-[0_6px_14px_rgba(15,23,42,0.08)]"
                      : "border-dashed border-border bg-transparent text-muted-foreground"
                    }`}
                >
                  {day.mood ?? "·"}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-primary" style={{ width: `${moodCompletionPercent}%` }} />
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{loggedMoodCount} of {weekMoodData.length} days logged</p>
          </div>
        </section>

        <section
          className="mm-dashboard-stagger rounded-[24px] bg-card border border-border p-5 shadow-[0_16px_35px_rgba(148,163,184,0.06)]"
          style={getDashboardRevealStyle(16)}
        >
          <div className="flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-9xl text-muted-foreground/20 pointer-events-none">"</div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Daily Insight</h3>
            <div className="flex flex-col items-end self-start">
              <p className="text-[17px] leading-relaxed font-medium text-foreground italic text-left w-full">
                "{dailyQuote.text}"
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-[2px] w-6 bg-primary rounded-full"></div>
                <p className="text-[14px] font-semibold text-muted-foreground">{dailyQuote.writer}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-24 right-4 z-30 flex items-center gap-2 sm:right-6">
        <p className="breathing-hero rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
          {greeting} Chat with me 👋
        </p>
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="h-14 w-14 overflow-hidden rounded-full shadow-[0_18px_40px_rgba(17,24,39,0.28)] transition-transform duration-150 hover:scale-105"
          aria-label="Open AI companion"
        >
          <img src="/image5.png" alt="AI companion" className="h-full w-full object-cover" />
        </button>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/96 px-6 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/psychological-content")}
            className="flex flex-col items-center gap-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <Compass className="h-5 w-5" />
            <span className="text-xs font-medium">Discover</span>
            <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex flex-col items-center gap-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
            <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Index;
