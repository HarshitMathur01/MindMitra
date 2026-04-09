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
  { emoji: "😰", label: "Anxious", ring: "ring-calm-blue", bg: "bg-calm-blue/40 dark:bg-calm-blue/20" },
  { emoji: "😢", label: "Sad", ring: "ring-warm-purple", bg: "bg-warm-purple/40 dark:bg-warm-purple/20" },
  { emoji: "😐", label: "Neutral", ring: "ring-warning/50", bg: "bg-warning/15 dark:bg-warning/10" },
  { emoji: "😊", label: "Happy", ring: "ring-serene-green", bg: "bg-serene-green/40 dark:bg-serene-green/20" },
  { emoji: "🤩", label: "Excited", ring: "ring-soft-pink", bg: "bg-soft-pink/40 dark:bg-soft-pink/20" },
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

const quickActions: QuickAction[] = [
  { title: "Breathe", duration: "3 min", icon: Wind, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/breathe", weeklyDone: 4 },
  { title: "Meditate", duration: "10 min", icon: Sparkles, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/meditate", weeklyDone: 5 },
  { title: "Journal", duration: "5 min", icon: BookOpen, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/journal", weeklyDone: 3 },
  { title: "Gratitude", duration: "3 min", icon: Heart, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/gratitude", weeklyDone: 2 },
];

const pastMoodTags = [
  "😐 So So due to Something else",
  "😓 So So due to Family",
  "😊 Feeling better after a walk",
  "🤩 Energized by good news",
];

const morningHeroImages = [
  "https://images.unsplash.com/photo-1470137430626-983a37b8ea46?w=1800&auto=format&fit=crop&q=90&dpr=2",
  "https://images.unsplash.com/photo-1526344966-89049886b28d?w=1800&auto=format&fit=crop&q=90&dpr=2",
];

const afternoonHeroImages = [
  "https://images.unsplash.com/photo-1581205445756-15c1d2e9a8df?w=1800&auto=format&fit=crop&q=90&dpr=2",
  "https://images.unsplash.com/photo-1700409670474-08236194ff99?w=1800&auto=format&fit=crop&q=90&dpr=2",
];

const eveningHeroImages = [
  "https://plus.unsplash.com/premium_photo-1673002094195-f18084be89ce?w=1800&auto=format&fit=crop&q=90&dpr=2",
  "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=1800&auto=format&fit=crop&q=90&dpr=2",
  "https://images.unsplash.com/photo-1433838552652-f9a46b332c40?w=1800&auto=format&fit=crop&q=90&dpr=2",
];

const contentCards: ContentCard[] = [
  { title: "3 grounding rituals for busy mornings", type: "Article", href: "/articles/grounding-rituals-busy-mornings", image: "https://plus.unsplash.com/premium_photo-1666794846975-c07e4374bc48?w=600&auto=format&fit=crop&q=60" },
  { title: "How to reset your nervous system in 2 minutes", type: "Carousel", href: "/articles/reset-your-nervous-system", image: "https://images.unsplash.com/photo-1599168215926-ebe820046d54?w=600&auto=format&fit=crop&q=60" },
  { title: "A calming bedtime routine for deep rest", type: "Video", href: "/articles/calming-bedtime-routine", image: "https://plus.unsplash.com/premium_photo-1661953124438-3959644bbcb4?w=600&auto=format&fit=crop&q=60" },
  { title: "Mountain reset for a calmer mind", type: "Guide", href: "/articles/mountain-reset-calmer-mind", image: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=600&auto=format&fit=crop&q=60" },
  { title: "Nature focus: 5-minute visual grounding", type: "Mindful View", href: "/articles/nature-focus-visual-grounding", image: "https://plus.unsplash.com/premium_photo-1661964177687-57387c2cbd14?w=600&auto=format&fit=crop&q=60" },
];

const featureCards: FeatureCard[] = [
  { title: "Tranquil Moments", description: "Connect with your inner peace through our collection of mindfulness tracks.", buttonLabel: "Start Listening", buttonClassName: "bg-sky-500 text-white", bg: "bg-calm-blue/40 dark:bg-calm-blue/20", accent: "from-calm-blue to-transparent", illustration: "🎧", category: "Mindfulness", imageSrc: "/image1.png", categoryClassName: "bg-calm-blue text-primary", route: "/meditate" },
  { title: "Stress Control Online", description: "An evidence-based CBT program helps you learn how to deal with stress.", buttonLabel: "Explore more", buttonClassName: "bg-warning text-white", bg: "bg-warning/15 dark:bg-warning/10", accent: "from-warning/20 to-transparent", illustration: "🧘", category: "CBT Program", imageSrc: "/image2.png", categoryClassName: "bg-warning/20 text-warning", route: "/stress-control" },
  { title: "Diet and Nutrition Counselling", description: "Get personalized free health counselling and a diet plan.", buttonLabel: "Diet Counselling", buttonClassName: "bg-success text-white", bg: "bg-serene-green/40 dark:bg-serene-green/20", accent: "from-serene-green to-transparent", illustration: "🥗", category: "Nutrition", imageSrc: "/image3.png", categoryClassName: "bg-serene-green text-success", route: "/nutrition" },
  { title: "Counselling support, anytime", description: "Get free & unlimited support from the experts.", buttonLabel: "Counselling Sessions", buttonClassName: "bg-primary text-primary-foreground", bg: "bg-calm-blue/30 dark:bg-calm-blue/15", accent: "from-calm-blue to-transparent", illustration: "💬", category: "Expert Support", imageSrc: "/image4.png", categoryClassName: "bg-calm-blue text-primary", route: "/therapist-bridge" },
  { title: "This is your safe space", description: "Try expressing your thoughts, feelings and stories to boost your mental health daily.", buttonLabel: "Write about today", buttonClassName: "bg-warm-purple/60 text-foreground", bg: "bg-warm-purple/20 dark:bg-warm-purple/10", accent: "from-warm-purple to-transparent", illustration: "✍️", category: "Journaling", imageSrc: "/safe_space.png", categoryClassName: "bg-warm-purple/40 text-foreground", route: "/journal" },
];

const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];
const dummyWeekMoods: Array<string | null> = ["😊", "😌", "😰", "😐", "🤩", "😊", null];
const loggedWeekMoods: Array<string | null> = ["😊", "😌", "😰", "😐", "🤩", "😊", null];

const sectionTitleClass = "text-[18px] font-semibold text-foreground";
const cardClass = "rounded-2xl bg-card p-4 shadow-card sm:p-5";
const horizontalScrollClass = "flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const getVisibleContentCardCount = (width: number) => {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 3;
};

const getContentCardColumnWidth = (visibleCount: number, peekPx: number, gapRem = 1) => {
  if (visibleCount <= 1) return `calc(100% - ${peekPx}px)`;
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
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
};

const getRandomAffirmation = (period: "morning" | "afternoon" | "evening") => {
  const pool = affirmationsByPeriod[period];
  return pool[Math.floor(Math.random() * pool.length)];
};

const getNextDayPeriodBoundary = (current: Date) => {
  const next = new Date(current);
  const hours = current.getHours();
  if (hours < 12) { next.setHours(12, 0, 0, 0); return next; }
  if (hours < 17) { next.setHours(17, 0, 0, 0); return next; }
  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  return next;
};

const getDashboardRevealStyle = (index: number, extraStyles: CSSProperties = {}): CSSProperties => ({
  ...extraStyles,
  ["--mm-enter-delay" as const]: `${80 + index * 90}ms`,
});

const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
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
    { text: "Life itself is the most wonderful fairy tale.", writer: "Hans Christian Andersen" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", writer: "Winston S. Churchill" },
    { text: "Believe you can and you're halfway there.", writer: "Theodore Roosevelt" },
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
    const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Friend";
    return String(name).trim().split(/[\s_-]+/)[0].replace(/^./, (c) => c.toUpperCase());
  }, [user]);

  const avatarInitial = displayName.charAt(0).toUpperCase() || "F";
  const [affirmation] = useState(() => getRandomAffirmation(dayPeriod));
  const resolvedWeekMoods = loggedWeekMoods.length > 0 ? loggedWeekMoods : dummyWeekMoods;
  const loopedContentCards = useMemo(
    () => contentCards.length > visibleContentCardCount
      ? [...contentCards, ...contentCards.slice(0, visibleContentCardCount)]
      : contentCards,
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
    label, mood: index < currentDayIndex ? (resolvedWeekMoods[index] ?? null) : null, isToday: index === currentDayIndex,
  }));
  const loggedMoodCount = weekMoodData.filter((d) => d.mood !== null).length;
  const moodCompletionPercent = Math.round((loggedMoodCount / weekMoodData.length) * 100);

  useEffect(() => {
    const nextBoundary = getNextDayPeriodBoundary(currentTime);
    const timer = window.setTimeout(() => setCurrentTime(new Date()), Math.max(0, nextBoundary.getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [currentTime]);

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = window.innerWidth;
      const nextVisibleCount = getVisibleContentCardCount(nextWidth);
      setViewportWidth(nextWidth);
      setVisibleContentCardCount((prev) => {
        if (prev === nextVisibleCount) return prev;
        setIsContentCarouselAnimating(false);
        setContentCarouselIndex(0);
        return nextVisibleCount;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!selectedMood) { setIsMoodToastVisible(false); return; }
    setIsMoodToastVisible(true);
    const fadeTimer = window.setTimeout(() => setIsMoodToastVisible(false), 2400);
    const hideCardTimer = window.setTimeout(() => setIsMoodCardVisible(false), 3200);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(hideCardTimer); };
  }, [selectedMood]);

  useEffect(() => {
    const isTypingElement = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
    };
    const handleFocusIn = (e: FocusEvent) => { if (isTypingElement(e.target)) setIsTypingFocus(true); };
    const handleFocusOut = () => { window.setTimeout(() => setIsTypingFocus(isTypingElement(document.activeElement)), 0); };
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    return () => { window.removeEventListener("focusin", handleFocusIn); window.removeEventListener("focusout", handleFocusOut); };
  }, []);

  useEffect(() => {
    previousScrollY.current = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - previousScrollY.current;
      if (delta > 8 && currentY > 120) setIsScrollingDown(true);
      else if (delta < -8) setIsScrollingDown(false);
      if (scrollingDownResetTimer.current) window.clearTimeout(scrollingDownResetTimer.current);
      scrollingDownResetTimer.current = window.setTimeout(() => setIsScrollingDown(false), 800);
      previousScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => { window.removeEventListener("scroll", handleScroll); if (scrollingDownResetTimer.current) window.clearTimeout(scrollingDownResetTimer.current); };
  }, []);

  useEffect(() => () => { if (suppressCardClickTimer.current) window.clearTimeout(suppressCardClickTimer.current); }, []);

  const handleNextContentCards = () => {
    if (!isContentCarouselInteractive) return;
    setIsContentCarouselAnimating(true);
    setContentCarouselIndex((prev) => prev + 1);
  };

  const handlePreviousContentCards = () => {
    if (!isContentCarouselInteractive) return;
    setIsContentCarouselAnimating(true);
    setContentCarouselIndex((prev) => prev <= 0 ? Math.max(contentCards.length - 1, 0) : prev - 1);
  };

  const handleSelectContentCard = (index: number) => {
    setIsContentCarouselAnimating(true);
    setContentCarouselIndex(index);
  };

  const handleContentCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isContentCarouselInteractive) return;
    carouselPointerStartX.current = e.clientX;
    hasDraggedContentCarousel.current = false;
    setIsContentCarouselDragging(true);
    setIsContentCarouselAnimating(false);
    setContentDragOffset(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleContentCarouselPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isContentCarouselInteractive || !isContentCarouselDragging || carouselPointerStartX.current === null) return;
    const delta = e.clientX - carouselPointerStartX.current;
    if (Math.abs(delta) > 8) hasDraggedContentCarousel.current = true;
    setContentDragOffset(delta);
  };

  const handleContentCarouselPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isContentCarouselInteractive) return;
    if (carouselPointerStartX.current === null) { setIsContentCarouselDragging(false); setContentDragOffset(0); return; }
    const delta = e.clientX - carouselPointerStartX.current;
    carouselPointerStartX.current = null;
    setIsContentCarouselDragging(false);
    setContentDragOffset(0);
    setIsContentCarouselAnimating(true);
    if (Math.abs(delta) > 8) {
      suppressCardClick.current = true;
      if (suppressCardClickTimer.current) window.clearTimeout(suppressCardClickTimer.current);
      suppressCardClickTimer.current = window.setTimeout(() => { suppressCardClick.current = false; }, 220);
    }
    if (delta <= -56) { handleNextContentCards(); return; }
    if (delta >= 56) handlePreviousContentCards();
  };

  const handleContentCarouselTransitionEnd = () => {
    if (contentCarouselIndex < contentCards.length) return;
    setIsContentCarouselAnimating(false);
    setContentCarouselIndex(0);
  };

  if (loading) return <DashboardSkeleton />;
  if (!user) return <PublicLanding />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main
        className="flex w-full max-w-none flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8"
        style={{ paddingBottom: "calc(10rem + env(safe-area-inset-bottom))" }}
      >
        {/* ── Hero ── */}
        <section
          className="mm-dashboard-stagger relative min-h-[220px] overflow-hidden rounded-3xl px-4 pb-6 pt-4 text-white shadow-overlay sm:min-h-[280px] sm:px-6"
          style={getDashboardRevealStyle(0, {
            backgroundImage: `linear-gradient(180deg, rgba(17,24,39,0.12) 0%, rgba(15,23,42,0.48) 100%), url('${heroBackgroundImage}')`,
            backgroundSize: "cover",
            backgroundPosition: heroBackgroundPosition,
            backgroundRepeat: "no-repeat",
          })}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/20" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border border-white/40 bg-white/25 ring-2 ring-white/70 shadow-lg shadow-white/30 backdrop-blur-md transition-transform duration-150 hover:scale-105"
                aria-label="Open AI companion"
              >
                <img src="/image5.png" alt="AI companion" className="h-full w-full rounded-full object-cover" />
              </button>
              <p className="breathing-hero max-w-[10rem] text-xs font-semibold leading-tight text-white/95 sm:text-sm">
                Meet your 3D avatar companion
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-md text-white transition-transform duration-150 hover:scale-105"
                aria-label="Toggle color theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-md transition-transform duration-150 hover:scale-105"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 text-white" />
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white">
                  3
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-primary text-sm font-semibold text-primary-foreground shadow-xs transition-transform duration-150 hover:scale-105"
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
            <p className="mt-3 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
              🔥 6-day streak — keep it up!
            </p>
          </div>
        </section>

        {/* ── Daily Affirmation ── */}
        <section
          className="mm-dashboard-stagger rounded-2xl border border-primary/20 border-l-4 border-l-primary bg-primary/8 px-5 py-4 shadow-card"
          style={getDashboardRevealStyle(1)}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Daily affirmation 💫
          </p>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-foreground">
            {affirmation}
          </p>
        </section>

        {/* ── Mood Check-in ── */}
        <div className="mm-dashboard-stagger" style={getDashboardRevealStyle(2)}>
          <section
            className={`${cardClass} overflow-hidden transition-all duration-700 ${isMoodCardVisible ? "max-h-[260px] translate-y-0 opacity-100" : "pointer-events-none max-h-0 -translate-y-2 p-0 opacity-0 shadow-none"}`}
            aria-hidden={!isMoodCardVisible}
          >
            <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              How are you feeling today?
            </p>

            <div className="mt-4 min-h-[110px]">
              {selectedMood ? (
                <div className={`flex h-full flex-col items-center justify-center rounded-xl bg-warning/10 px-4 py-6 text-center transition-all duration-700 ${isMoodToastVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}>
                  <div className="text-4xl">{selectedMood.emoji}</div>
                  <p className="mt-3 text-base font-semibold text-foreground">Thanks for checking in! 💛</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We've saved that you're feeling {selectedMood.label.toLowerCase()} today.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {moodOptions.map((mood) => (
                    <button
                      key={mood.label}
                      type="button"
                      onClick={() => setSelectedMood(mood)}
                      className={`flex flex-col items-center rounded-xl px-2 py-3 text-center transition-transform duration-150 hover:scale-[1.04] ${mood.bg}`}
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

        {/* ── Quick Actions ── */}
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
                  className={`group relative min-w-[100px] flex-1 overflow-hidden rounded-3xl border border-border/50 p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-card-hover active:scale-[0.98] md:min-w-0 dark:border-white/10 ${action.bg}`}
                >
                  <span className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/5 opacity-70 transition-opacity duration-200 group-hover:opacity-100 dark:from-white/10" />
                  <span className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/20 blur-2xl transition-transform duration-300 group-hover:scale-110" />
                  {action.weeklyDone >= 7 && (
                    <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-success shadow-xs" />
                  )}
                  <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 shadow-xs ring-2 ring-white/70 backdrop-blur-sm transition-transform duration-200 group-hover:scale-105 dark:bg-white/10 dark:ring-white/10 ${action.iconColor}`}>
                    <Icon className="h-5 w-5 drop-shadow-sm" />
                  </div>
                  <p className="relative mt-4 text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="relative mt-0.5 text-xs font-medium text-muted-foreground">{action.duration}</p>
                  <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-current opacity-60 transition-all duration-300 group-hover:opacity-80" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="relative mt-1 text-[10px] font-medium text-muted-foreground">{action.weeklyDone}/7 this week</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Past Moods ── */}
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

        {/* ── Daily Rhythm Banner ── */}
        <section
          className="mm-dashboard-stagger rounded-3xl bg-gradient-to-br from-calm-blue via-warm-purple/30 to-serene-green/20 p-5 shadow-card"
          style={getDashboardRevealStyle(5)}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">A gentle glance at your daily rhythm</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Keep tabs on the tiny wins that help your mind feel grounded and cared for.
              </p>
            </div>
            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-background/60 text-3xl md:flex">
              📈
            </div>
          </div>
        </section>

        {/* ── Search ── */}
        <section className="mm-dashboard-stagger" style={getDashboardRevealStyle(6)}>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-xs transition-shadow focus-within:shadow-card focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search content, topics, exercises..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </section>

        {/* ── Habits CTA ── */}
        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(7)}>
          <SectionHeader title="Habits" action="See all >" />
          <button
            type="button"
            onClick={() => navigate("/healthy-habits")}
            className="w-full rounded-3xl bg-gradient-to-r from-soft-pink/80 via-warning/50 to-warning/30 p-5 text-left text-foreground shadow-card-hover transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <h2 className="text-2xl font-bold">Build Healthy Habits!</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/80">
                  A new way to nurture your mind, one step at a time.
                </p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-card transition-all duration-200 hover:scale-[1.04] active:scale-[0.98]">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <img
                src="/image7.png"
                alt="Healthy habits illustration"
                className="h-28 w-full max-w-[160px] shrink-0 rounded-2xl object-cover shadow-card"
              />
            </div>
          </button>
        </section>

        {/* ── Latest Content Carousel ── */}
        <section
          className="mm-dashboard-stagger space-y-4 rounded-3xl border border-border bg-card/90 p-4 shadow-card sm:p-5"
          style={getDashboardRevealStyle(8)}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-warning">What's fresh?</p>
              <h2 className="mt-1 text-[18px] font-semibold text-foreground">Latest content for you</h2>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="text-sm text-muted-foreground">
                {activeContentCardIndex + 1}/{contentCards.length}
              </div>
              {isContentCarouselInteractive && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousContentCards}
                    aria-label="Show previous content cards"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextContentCards}
                    aria-label="Show next content cards"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
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
                  onClick={card.href ? () => { if (!suppressCardClick.current) navigate(card.href!); } : undefined}
                  onKeyDown={card.href ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(card.href!); } } : undefined}
                  className={`group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 ${card.href ? "cursor-pointer hover:-translate-y-1.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : ""}`}
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <img src={card.image} alt={card.title} className={`h-full w-full object-cover transition-transform duration-300 ${card.href ? "group-hover:scale-[1.02]" : ""}`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent" />
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={`Save ${card.title}`}
                      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-card backdrop-blur-sm transition-colors duration-150 hover:text-primary"
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-sm">
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
                        Open <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {isContentCarouselInteractive && (
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
                      className={`h-2.5 rounded-full transition-all duration-200 ${isActive ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/55"}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Wellness Toolkit ── */}
        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(9)}>
          <SectionHeader title="Your Wellness Toolkit" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {featureCards.map((card, index) => (
              <article
                key={card.title}
                className={`mm-dashboard-stagger flex flex-col rounded-2xl ${card.bg} p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover`}
                style={getDashboardRevealStyle(10 + index)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${card.categoryClassName}`}>
                    {card.category}
                  </span>
                  <img src={card.imageSrc} alt={card.title} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-foreground">{card.title}</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.description}</p>
                <button
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${card.buttonClassName}`}
                  onClick={() => navigate(card.route)}
                >
                  {card.buttonLabel} <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* ── Week Mood Tracker ── */}
        <section
          className="mm-dashboard-stagger rounded-2xl bg-card p-4 shadow-card"
          style={getDashboardRevealStyle(15)}
        >
          <div className="flex items-center justify-between">
            <h2 className={sectionTitleClass}>This week's mood</h2>
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
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${day.isToday ? "border-2 border-primary/50 bg-primary/10 text-primary" : day.mood ? "bg-card text-foreground shadow-xs" : "border border-dashed border-border text-muted-foreground"}`}
                >
                  {day.mood ?? "·"}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${moodCompletionPercent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{loggedMoodCount} of {weekMoodData.length} days logged</p>
          </div>
        </section>

        {/* ── Daily Quote ── */}
        <section
          className="mm-dashboard-stagger rounded-2xl bg-card p-4 shadow-card"
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

      {/* ── Floating Chat Bubble ── */}
      <div
        className={`fixed right-4 z-30 flex items-center gap-2.5 transition-all duration-300 sm:right-6 ${showFloatingChatBubble ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <p className="breathing-hero rounded-2xl border border-border bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-card backdrop-blur-md">
          {greeting} Chat with me 👋
        </p>
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="mm-fab-glow relative h-14 w-14 overflow-hidden rounded-full shadow-overlay ring-2 ring-primary/40 transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Open AI companion"
        >
          <img src="/image5.png" alt="AI companion" className="h-full w-full object-cover" />
        </button>
      </div>

      {/* ── Bottom Navigation ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-card/80 px-6 pt-3 shadow-[0_-4px_16px_var(--shadow)] backdrop-blur-xl"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          <button className="group flex flex-col items-center gap-1 text-primary transition-transform duration-150 hover:scale-105">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 transition-colors duration-200">
              <Home className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold">Home</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/psychological-content")}
            className="group flex flex-col items-center gap-1 text-muted-foreground transition-all duration-150 hover:scale-105 hover:text-foreground"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-accent">
              <Compass className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">Discover</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="group flex flex-col items-center gap-1 text-muted-foreground transition-all duration-150 hover:scale-105 hover:text-foreground"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-accent">
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
