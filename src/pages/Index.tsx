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
import {
  getHeroExtraVeilStyle,
  getHeroReadTier,
  getHeroScrimStyle,
  heroGreetingHaloClass,
} from "@/lib/heroReadability";

type MoodOption = {
  emoji: string;
  label: string;
  ring: string;
  bg: string;
};

type QuickAction = {
  title: string;
  duration: string;
  kind: string;
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
  { emoji: "🌧", label: "Anxious", ring: "ring-calm-blue", bg: "bg-calm-blue/40 dark:bg-calm-blue/20" },
  { emoji: "🌫", label: "Sad", ring: "ring-warm-purple", bg: "bg-warm-purple/40 dark:bg-warm-purple/20" },
  { emoji: "🌤", label: "Calm", ring: "ring-warning/50", bg: "bg-warning/15 dark:bg-warning/10" },
  { emoji: "☀️", label: "Bright", ring: "ring-serene-green", bg: "bg-serene-green/40 dark:bg-serene-green/20" },
  { emoji: "✨", label: "Glowing", ring: "ring-soft-pink", bg: "bg-soft-pink/40 dark:bg-soft-pink/20" },
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
  { title: "Breathe", duration: "3 min", kind: "Breathwork", icon: Wind, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/breathe", weeklyDone: 4 },
  { title: "Meditate", duration: "10 min", kind: "Stillness", icon: Sparkles, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/meditate", weeklyDone: 5 },
  { title: "Journal", duration: "5 min", kind: "Reflect", icon: BookOpen, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/journal", weeklyDone: 3 },
  { title: "Gratitude", duration: "3 min", kind: "Practice", icon: Heart, bg: "bg-primary/10 dark:bg-primary/15", iconColor: "text-primary", route: "/gratitude", weeklyDone: 2 },
];

const pastMoodReflections = [
  { emoji: "🙂", text: "Settled after a long walk" },
  { emoji: "😌", text: "Peaceful — family dinner" },
  { emoji: "😊", text: "Lighter after journaling" },
  { emoji: "🤩", text: "Energised by good news" },
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
];

const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];
const dummyWeekMoods: Array<string | null> = ["😊", "😌", "😰", "😐", "🤩", "😊", null];
const loggedWeekMoods: Array<string | null> = ["😊", "😌", "😰", "😐", "🤩", "😊", null];

const sectionTitleClass = "text-[18px] font-semibold text-foreground";
const sectionEyebrowClass = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";
const sectionDisplayTitleClass = "font-display text-2xl sm:text-3xl font-light tracking-tight text-ink-8";
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

const getContentDurationLabel = (type: string) => {
  if (type === "Video") return "6 min watch";
  if (type === "Carousel") return "2 min listen";
  if (type === "Guide") return "8 min read";
  if (type === "Mindful View") return "5 min view";
  return "4 min read";
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

/** Split Gita-style strings (attribution / verse / translation) for calmer layout. */
type AffirmationParts = { attribution: string; scripturalLines: string[]; translation: string };

function parseAffirmationBody(raw: string): AffirmationParts {
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    return {
      attribution: lines[0],
      scripturalLines: lines.slice(1, -1),
      translation: lines[lines.length - 1],
    };
  }
  if (lines.length === 2) {
    return { attribution: lines[0], scripturalLines: [], translation: lines[1] };
  }
  return { attribution: "", scripturalLines: [], translation: raw };
}

const getNextDayPeriodBoundary = (current: Date) => {
  const next = new Date(current);
  const hours = current.getHours();
  if (hours < 12) { next.setHours(12, 0, 0, 0); return next; }
  if (hours < 17) { next.setHours(17, 0, 0, 0); return next; }
  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  return next;
};

const getDashboardRevealStyle = (index: number, extraStyles: CSSProperties = {}): CSSProperties =>
  ({
  ...extraStyles,
    "--mm-enter-delay": `${80 + index * 90}ms`,
  }) as CSSProperties;

const SectionHeader = ({
  kicker,
  title,
  action,
  onAction,
  subtitle,
}: {
  kicker?: string;
  title: string;
  action?: string;
  onAction?: () => void;
  subtitle?: string;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
    <div className="min-w-0">
      {kicker ? <p className={sectionEyebrowClass}>{kicker}</p> : null}
      <h2 className={kicker ? `mt-1 ${sectionDisplayTitleClass}` : sectionTitleClass}>{title}</h2>
      {subtitle ? <p className="mt-1 hidden max-w-md text-sm text-ink-5 sm:block">{subtitle}</p> : null}
    </div>
    {action ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-[hsl(var(--accent-600))] transition-colors duration-base hover:text-[hsl(var(--accent-500))] sm:self-auto"
      >
        {action}
        <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
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
  const heroReadTier = useMemo(() => getHeroReadTier(heroBackgroundImage), [heroBackgroundImage]);
  const heroScrimStyle = useMemo(() => getHeroScrimStyle(heroReadTier, theme === "dark"), [heroReadTier, theme]);
  const heroExtraVeilStyle = useMemo(() => getHeroExtraVeilStyle(heroReadTier, theme === "dark"), [heroReadTier, theme]);
  const heroBackgroundPosition = getHeroBackgroundPosition(dayPeriod);

  const displayName = useMemo(() => {
    const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Friend";
    return String(name).trim().split(/[\s_-]+/)[0].replace(/^./, (c) => c.toUpperCase());
  }, [user]);

  const avatarInitial = displayName.charAt(0).toUpperCase() || "F";
  const [affirmation] = useState(() => getRandomAffirmation(dayPeriod));
  const affirmationParts = useMemo(() => parseAffirmationBody(affirmation), [affirmation]);
  const affirmationHasTopBlock =
    Boolean(affirmationParts.attribution) || affirmationParts.scripturalLines.length > 0;
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
    "--content-card-gap": "1rem",
    "--content-card-width": getContentCardColumnWidth(visibleContentCardCount, contentCarouselPeekPx),
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
        className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-5 sm:gap-10 sm:px-6 sm:pt-8 lg:px-8"
        style={{ paddingBottom: "calc(10rem + env(safe-area-inset-bottom))" }}
      >
        {/* Hero — photo-first; single warm scrim at bottom for legible ink type */}
        <section
          className="mm-dashboard-stagger overflow-hidden rounded-[2rem] bg-card shadow-dashboard-soft"
          style={getDashboardRevealStyle(0)}
        >
          <div className="relative h-[min(52vw,320px)] min-h-[260px] sm:h-[380px]">
            <img
              src={heroBackgroundImage}
              alt="Soft light over the landscape — a quiet moment for you"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: heroBackgroundPosition }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0" style={heroScrimStyle} aria-hidden />
            {heroExtraVeilStyle ? <div style={heroExtraVeilStyle} aria-hidden /> : null}

            <div className="absolute left-5 right-5 top-5 flex items-center justify-between sm:left-8 sm:right-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--card))]/85 text-[hsl(var(--accent-600))] shadow-dashboard-soft backdrop-blur-md ring-1 ring-ink-3/30 dark:bg-[hsl(var(--card))]/50 dark:text-[hsl(var(--accent-300))] dark:ring-ink-3/20">
                <Sun className="h-4 w-4" strokeWidth={1.6} />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--card))]/85 text-ink-7 shadow-dashboard-soft backdrop-blur-md ring-1 ring-ink-3/30 transition-colors hover:bg-[hsl(var(--card))] dark:bg-[hsl(var(--card))]/50 dark:text-ink-8 dark:hover:bg-[hsl(var(--card))]/65"
                aria-label="Toggle color theme"
              >
                  {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={1.6} /> : <Moon className="h-4 w-4" strokeWidth={1.6} />}
              </button>
              <button
                type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--card))]/85 text-ink-7 shadow-dashboard-soft backdrop-blur-md ring-1 ring-ink-3/30 transition-colors hover:bg-[hsl(var(--card))] dark:bg-[hsl(var(--card))]/50 dark:text-ink-8 dark:hover:bg-[hsl(var(--card))]/65"
                aria-label="Notifications"
              >
                  <Bell className="h-4 w-4" strokeWidth={1.6} />
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-400))] ring-2 ring-[hsl(var(--card))]" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--accent-400))] text-[13px] font-semibold text-white shadow-md ring-1 ring-ink-3/20 transition-colors hover:bg-[hsl(var(--accent-500))]"
                aria-label="Open profile"
              >
                {avatarInitial}
              </button>
            </div>
          </div>

            <div className="absolute inset-x-0 bottom-0 px-5 pb-7 sm:px-8 sm:pb-10">
              <p className={`${sectionEyebrowClass} text-ink-6`}>{greeting.replace(",", "").trim()}</p>
              <h1
                className={`mt-2 max-w-[22ch] break-words font-display text-[clamp(1.65rem,5.2vw,3rem)] font-light leading-[1.1] tracking-tight text-ink-8 ${heroGreetingHaloClass(heroReadTier, theme === "dark")}`}
              >
                Welcome back,{" "}
                <em className="font-display font-normal italic text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">{displayName}</em>
            </h1>
              <div className="mt-4 inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-ink-3/35 bg-[hsl(var(--card))]/92 px-4 py-2 text-sm text-ink-7 shadow-sm backdrop-blur-sm dark:border-ink-3/25 dark:bg-[hsl(var(--card))]/80 dark:text-ink-8">
                <span className="text-base" aria-hidden>
                  🌱
                </span>
                <span>6-day streak — gently growing</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/chat")}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[hsl(var(--accent-400))] px-5 text-[14.5px] font-semibold text-white shadow-md transition-colors hover:bg-[hsl(var(--accent-500))] dark:bg-[hsl(var(--accent-500))] dark:hover:bg-[hsl(var(--accent-400))]"
                >
                  When you&apos;re ready
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <p className="max-w-sm text-[13px] leading-relaxed text-ink-6">
                  No need to have an answer ready. Sit for a minute, or talk — we&apos;re here either way.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Daily affirmation — prior wide card: centered kicker, left-aligned quote, rule before translation */}
        <section
          className="mm-dashboard-stagger rounded-[2rem] border border-ink-3/35 bg-[hsl(var(--card))] px-6 py-9 shadow-dashboard-soft sm:px-10 sm:py-10 dark:border-ink-3/25 dark:bg-[hsl(var(--card))]"
          style={getDashboardRevealStyle(1)}
        >
          <p className={`${sectionEyebrowClass} text-center`}>Daily affirmation</p>

          <div className="mt-8 text-left">
            {affirmationParts.attribution ? (
              <p className="font-display text-[1.05rem] font-normal leading-snug text-ink-8 sm:text-lg">
                {affirmationParts.attribution}
              </p>
            ) : null}

            {affirmationParts.scripturalLines.length > 0 ? (
              <p
                className="mt-4 whitespace-pre-line font-display text-base font-light leading-[1.7] text-ink-7 sm:text-[1.05rem]"
                lang="sa"
              >
                {affirmationParts.scripturalLines.join("\n")}
              </p>
            ) : null}

            {affirmationHasTopBlock && affirmationParts.translation ? (
              <div className="my-5 border-t border-ink-3/25 dark:border-ink-3/20" aria-hidden />
            ) : null}

            {affirmationParts.translation ? (
              <p className="text-sm font-normal leading-relaxed text-ink-6 sm:text-[15px]">
                {affirmationParts.translation}
              </p>
            ) : null}
          </div>
        </section>

        {/* Mood check-in — subtle separator from hero card */}
        <div className="mm-dashboard-stagger space-y-5 border-t border-ink-3/30 pt-8 sm:pt-10" style={getDashboardRevealStyle(2)}>
          <SectionHeader
            kicker="Check in"
            title="How are you, really?"
            subtitle="A small pause makes a big difference."
          />
          <section
            className={`overflow-hidden rounded-[1.75rem] border border-ink-3/50 bg-[hsl(var(--card))] p-3 shadow-dashboard-soft transition-all duration-long sm:p-4 ${isMoodCardVisible ? "max-h-[280px] translate-y-0 opacity-100" : "pointer-events-none max-h-0 -translate-y-2 border-transparent p-0 opacity-0"}`}
            aria-hidden={!isMoodCardVisible}
          >
            <div className="flex items-center justify-between px-1 sm:hidden">
              <p className="text-[12.5px] text-ink-5">One tap. No pressure.</p>
            </div>

            <div className="mt-3 min-h-[88px] sm:mt-0">
              {selectedMood ? (
                <div className={`flex items-center gap-4 px-1 transition-all duration-long ${isMoodToastVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}>
                  <div className="text-[38px] leading-none">{selectedMood.emoji}</div>
                  <div>
                    <p className="font-display text-[18px] tracking-tight text-ink-8">
                      Noted. Thank you for being honest.
                    </p>
                    <p className="mt-1 text-[13.5px] text-ink-6">
                      Saved as <em>{selectedMood.label.toLowerCase()}</em> for today&apos;s rhythm.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {moodOptions.map((mood) => (
                    <button
                      key={mood.label}
                      type="button"
                      onClick={() => setSelectedMood(mood)}
                      className="group flex flex-col items-center gap-2 rounded-2xl border border-transparent px-2 py-4 text-center transition-colors duration-base hover:bg-[hsl(var(--ink-1))]"
                    >
                      <span className="text-[28px] leading-none transition-opacity duration-base group-hover:opacity-90 sm:text-[30px]">
                        {mood.emoji}
                      </span>
                      <span className="text-[11px] font-medium text-ink-5 sm:text-[11.5px]">
                        {mood.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Small rituals */}
        <section className="mm-dashboard-stagger space-y-5 border-t border-ink-3/30 pt-8 sm:pt-10" style={getDashboardRevealStyle(3)}>
          <SectionHeader
            title="A small ritual for now"
            action="View all"
            onAction={() => navigate("/healthy-habits")}
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const progressPct = Math.round((action.weeklyDone / 7) * 100);
              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => navigate(action.route)}
                  className="group relative overflow-hidden rounded-2xl border border-ink-3/40 bg-[hsl(var(--card))] p-5 text-left shadow-dashboard-soft transition-shadow duration-base hover:shadow-dashboard-warm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-600))]">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-ink-5">{action.kind}</span>
                  </div>
                  <div className="mt-6">
                    <h3 className="font-display text-xl font-normal text-ink-8">{action.title}</h3>
                    <p className="mt-1 text-sm text-ink-5">{action.duration}</p>
                  </div>
                  <div className="mt-5">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--ink-2))]">
                      <div
                        className="h-full rounded-full bg-[hsl(var(--accent-400))] transition-all duration-long"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-ink-5">
                      {action.weeklyDone} of 7 this week
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent reflections */}
        <section className="mm-dashboard-stagger space-y-4 border-t border-ink-3/30 pt-8 sm:pt-10" style={getDashboardRevealStyle(4)}>
          <h2 className={sectionDisplayTitleClass}>Recent reflections</h2>
          <div className="flex flex-wrap gap-2">
            {pastMoodReflections.map((row) => (
              <button
                key={row.text}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-ink-3/60 bg-[hsl(var(--card))] px-4 py-2.5 text-sm text-ink-7 shadow-dashboard-soft transition-colors duration-base hover:border-[hsl(var(--accent-300))] hover:bg-[hsl(var(--accent-50))]"
              >
                <span>{row.emoji}</span>
                <span>{row.text}</span>
                <ChevronRight className="h-3.5 w-3.5 text-ink-5" strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </section>

        {/* Rhythm intro */}
        <section
          className="mm-dashboard-stagger rounded-[1.75rem] border border-ink-3/50 bg-[hsl(var(--ink-1))] p-6 pt-7 shadow-dashboard-soft sm:p-8 sm:pt-8"
          style={getDashboardRevealStyle(5)}
        >
          <div className="flex flex-col gap-4">
            <div>
              <p className={sectionEyebrowClass}>Your rhythm</p>
              <h2 className="mt-2 font-display text-[clamp(1.25rem,3vw,1.75rem)] font-light leading-snug text-ink-8">
                A gentle glance at the last seven days.
              </h2>
              <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-6">
                Not streaks, not guilt — just small signals that your mind is getting what it needs.
              </p>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="mm-dashboard-stagger" style={getDashboardRevealStyle(6)}>
          <label className="flex items-center gap-3 rounded-full border border-ink-3/50 bg-[hsl(var(--card))] px-5 py-4 shadow-dashboard-soft transition-shadow focus-within:shadow-dashboard-warm focus-within:ring-2 focus-within:ring-[hsl(var(--accent-300))]">
            <Search className="h-4 w-4 text-ink-5" strokeWidth={1.6} />
            <input
              type="text"
              placeholder="Search practices, articles, sounds…"
              className="w-full bg-transparent text-sm text-ink-8 outline-none placeholder:text-ink-5"
            />
          </label>
        </section>

        {/* Habits CTA */}
        <section className="mm-dashboard-stagger space-y-4" style={getDashboardRevealStyle(7)}>
          <SectionHeader title="Habits" action="See all" onAction={() => navigate("/healthy-habits")} />
          <button
            type="button"
            onClick={() => navigate("/healthy-habits")}
            className="group block w-full overflow-hidden rounded-[24px] bg-[hsl(var(--accent-50))] p-7 text-left transition-colors duration-base hover:bg-[hsl(var(--accent-100))]"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <p className="text-[13px] text-[hsl(var(--accent-700))]">
                  a few small rituals
                </p>
                <h2 className="mt-3 font-display text-[clamp(24px,3vw,32px)] font-normal leading-[1.25] text-ink-8">
                  Little habits that hold you on hard days.
                </h2>
                <p className="mt-3 max-w-md text-[15px] leading-[1.7] text-ink-6">
                  Under five minutes each. Designed to compound quietly — not
                  to be tracked, ticked, or turned into a streak.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-[14.5px] font-medium text-[hsl(var(--accent-700))]">
                  See the practices
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </span>
              </div>
              <img
                src="/image7.png"
                alt=""
                aria-hidden
                className="hidden h-32 w-full max-w-[180px] shrink-0 rounded-2xl object-cover opacity-95 md:block"
              />
            </div>
          </button>
        </section>

        {/* Slow reads & soft sounds */}
        <section
          className="mm-dashboard-stagger space-y-5 rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] p-5 shadow-dashboard-soft sm:p-6"
          style={getDashboardRevealStyle(8)}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={`${sectionEyebrowClass} text-[hsl(var(--warmth-500))]`}>What&apos;s fresh</p>
              <h2 className="mt-1 font-display text-2xl font-light text-ink-8 sm:text-3xl">Slow reads &amp; soft sounds</h2>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="text-sm text-ink-5">
                {activeContentCardIndex + 1} / {contentCards.length}
              </div>
              {isContentCarouselInteractive && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousContentCards}
                    aria-label="Show previous content cards"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-8 text-[hsl(var(--ink-0))] shadow-dashboard-soft transition-colors hover:bg-[hsl(var(--accent-600))]"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextContentCards}
                    aria-label="Show next content cards"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-8 text-[hsl(var(--ink-0))] shadow-dashboard-soft transition-colors hover:bg-[hsl(var(--accent-600))]"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
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
                  className={`group relative overflow-hidden rounded-2xl border border-ink-3/50 bg-[hsl(var(--card))] shadow-dashboard-soft transition-shadow duration-base ${card.href ? "cursor-pointer hover:shadow-dashboard-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-300))] focus-visible:ring-offset-2" : ""}`}
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <img src={card.image} alt={card.title} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-9/35 via-transparent to-transparent" />
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={`Save ${card.title}`}
                      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-card backdrop-blur-sm transition-colors duration-150 hover:text-primary"
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-[hsl(var(--card))]/90 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-ink-7 shadow-dashboard-soft backdrop-blur-sm">
                      {card.type}
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    <h3 className="text-balance font-display text-lg font-normal leading-snug text-ink-8 transition-colors duration-base group-hover:text-[hsl(var(--accent-600))]">
                      {card.title}
                    </h3>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="text-ink-5">{getContentDurationLabel(card.type)}</p>
                      <span className="inline-flex items-center gap-1 font-medium text-[hsl(var(--accent-600))]">
                        Open <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
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

        {/* Wellness toolkit */}
        <section className="mm-dashboard-stagger space-y-5" style={getDashboardRevealStyle(9)}>
          <div>
            <h2 className={sectionDisplayTitleClass}>Your wellness toolkit</h2>
            <p className="mt-1 text-sm text-ink-5">Gentle tools, ready when you are.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {featureCards.map((card, index) => (
              <article
                key={card.title}
                className={`mm-dashboard-stagger flex flex-col overflow-hidden rounded-3xl ${card.bg} p-6 shadow-dashboard-soft transition-shadow duration-base sm:p-8 hover:shadow-dashboard-warm`}
                style={getDashboardRevealStyle(10 + index)}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 max-w-[58%] flex-1">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em] ${card.categoryClassName}`}>
                    {card.category}
                  </span>
                    <h3 className="mt-3 font-display text-2xl font-normal text-ink-8">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-6">{card.description}</p>
                <button
                      type="button"
                      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-base sm:w-auto ${card.buttonClassName}`}
                  onClick={() => navigate(card.route)}
                >
                      {card.buttonLabel} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
                  </div>
                  <img src={card.imageSrc} alt="" className="h-28 w-28 shrink-0 rounded-2xl object-cover sm:h-32 sm:w-32" />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Week rhythm + quote */}
        <section
          className="mm-dashboard-stagger rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft sm:p-8"
          style={getDashboardRevealStyle(15)}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={sectionEyebrowClass}>This week</p>
              <h2 className="mt-1 font-display text-2xl font-light text-ink-8 sm:text-[1.75rem]">A gentle glance at your rhythm</h2>
            </div>
            <span className="w-fit rounded-full bg-[hsl(var(--accent-100))] px-3 py-1 text-xs font-medium text-[hsl(var(--accent-700))]">
              {moodCompletionPercent}% logged
            </span>
          </div>

          <div className="mt-8 grid grid-cols-7 gap-2 sm:gap-3">
            {weekMoodData.map((day, index) => (
              <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-2 sm:gap-3">
                <span className={`text-xs font-medium ${day.isToday ? "text-[hsl(var(--accent-600))]" : "text-ink-5"}`}>
                  {day.label}
                </span>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 ${day.isToday ? "border-2 border-[hsl(var(--accent-300))] bg-[hsl(var(--accent-50))] text-[hsl(var(--accent-700))]" : day.mood ? "bg-[hsl(var(--ink-2))] text-ink-8 shadow-dashboard-soft" : "border border-dashed border-ink-4 text-ink-5"}`}
                >
                  {day.mood ?? <span className="h-1 w-1 rounded-full bg-ink-4" />}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--ink-2))]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--accent-400))] to-[hsl(var(--warmth-400))]"
                style={{ width: `${moodCompletionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-5">
              {loggedMoodCount} of {weekMoodData.length} days logged
            </p>
          </div>

          <blockquote className="mt-8 border-l-2 border-[hsl(var(--warmth-400))] pl-5">
            <p className="text-balance font-display text-lg font-light italic leading-relaxed text-ink-8">
              &ldquo;{dailyQuote.text}&rdquo;
            </p>
            <footer className="mt-2 text-sm text-ink-5">— {dailyQuote.writer}</footer>
          </blockquote>
        </section>
      </main>

      {/* ── Floating Chat Pill ── */}
      <div
        className={`fixed right-5 z-30 flex items-center gap-2 transition-all duration-base sm:right-6 ${showFloatingChatBubble ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="group inline-flex h-11 items-center gap-2 rounded-full bg-[hsl(var(--accent-500))] pl-3 pr-5 text-[13.5px] font-medium text-primary-foreground shadow-e1 transition-colors hover:bg-[hsl(var(--accent-600))]"
          aria-label="Talk to Mitra"
        >
          <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--accent-600))]">
            <img
              src="/image5.png"
              alt=""
              aria-hidden
              className="h-full w-full object-cover opacity-95"
            />
          </span>
          <span>Chat with MindMitra</span>
          {/* <span>Talk it through</span> */}
        </button>
      </div>

      {/* Bottom navigation — horizontal chips (clearer than stacked icon/label) */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto flex max-w-lg items-center gap-1 rounded-full border border-ink-3/60 bg-[hsl(var(--card))]/95 p-1.5 shadow-dashboard-warm backdrop-blur-xl sm:gap-1.5 sm:p-2">
          <button
            type="button"
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-[hsl(var(--accent-500))] px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[hsl(var(--accent-600))] sm:px-5"
          >
            <Home className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/psychological-content")}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink-6 transition-colors hover:bg-[hsl(var(--ink-2))] hover:text-ink-8 sm:px-5"
          >
            <Compass className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>Discover</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink-6 transition-colors hover:bg-[hsl(var(--ink-2))] hover:text-ink-8 sm:px-5"
          >
            <User className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Index;
