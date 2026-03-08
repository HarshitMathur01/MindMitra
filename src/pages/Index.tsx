import { useEffect, useMemo, useState } from "react";
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
  { emoji: "😰", label: "Anxious", ring: "ring-[#93C5FD]", bg: "bg-[#EFF6FF]" },
  { emoji: "😢", label: "Sad", ring: "ring-[#C4B5FD]", bg: "bg-[#F5F3FF]" },
  { emoji: "😐", label: "Neutral", ring: "ring-[#FCD34D]", bg: "bg-[#FFFBEB]" },
  { emoji: "😊", label: "Happy", ring: "ring-[#86EFAC]", bg: "bg-[#F0FDF4]" },
  { emoji: "🤩", label: "Excited", ring: "ring-[#FDA4AF]", bg: "bg-[#FFF1F2]" },
];

const affirmations = [
  "You are stronger than you think, and braver than you feel. 🏋️",
  "A gentle step forward is still a powerful kind of progress. 🌤️",
  "Your mind deserves the same kindness you give to everyone else. 💛",
  "Today can be soft, steady, and beautifully enough for you. 🌸",
];

const quickActions: QuickAction[] = [
  {
    title: "Breathe",
    duration: "3 min",
    icon: Wind,
    bg: "bg-[#E0F7FA]",
    iconColor: "text-[#0F766E]",
  },
  {
    title: "Meditate",
    duration: "10 min",
    icon: Sparkles,
    bg: "bg-[#FFF9C4]",
    iconColor: "text-[#B45309]",
  },
  {
    title: "Journal",
    duration: "5 min",
    icon: BookOpen,
    bg: "bg-[#FFF8E1]",
    iconColor: "text-[#A16207]",
  },
  {
    title: "Gratitude",
    duration: "3 min",
    icon: Heart,
    bg: "bg-[#FCE4EC]",
    iconColor: "text-[#BE185D]",
  },
];

const pastMoodTags = [
  "😐 So So due to Something else",
  "😓 So So due to Family",
  "😊 Feeling better after a walk",
  "🤩 Energized by good news",
];

const contentCards: ContentCard[] = [
  {
    title: "3 grounding rituals for busy mornings",
    type: "Article",
    href: "/articles/grounding-rituals-busy-mornings",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "How to reset your nervous system in 2 minutes",
    type: "Carousel",
    href: "/articles/reset-your-nervous-system",
    image:
      "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "A calming bedtime routine for deep rest",
    type: "Video",
    href: "/articles/calming-bedtime-routine",
    image:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
  },
];

const featureCards: FeatureCard[] = [
  {
    title: "Tranquil Moments",
    description:
      "Connect with your inner peace through our collection of mindfulness tracks.",
    buttonLabel: "Start Listening",
    buttonClassName: "bg-[#3B82F6] text-white",
    bg: "bg-[#F0FDFF]",
    accent: "from-[#DBEAFE] to-[#F0FDFF]",
    illustration: "🎧",
  },
  {
    title: "Stress Control Online",
    description:
      "An evidence-based CBT program helps you learn how to deal with stress.",
    buttonLabel: "Explore more",
    buttonClassName: "bg-[#F97316] text-white",
    bg: "bg-[#FFFBEB]",
    accent: "from-[#FED7AA] to-[#FFF7ED]",
    illustration: "🧘",
  },
  {
    title: "Diet and Nutrition Counselling",
    description:
      "Get personalized free health counselling and a diet plan.",
    buttonLabel: "Diet Counselling",
    buttonClassName: "bg-[#16A34A] text-white",
    bg: "bg-[#F0FFF4]",
    accent: "from-[#BBF7D0] to-[#F0FFF4]",
    illustration: "🥗",
  },
  {
    title: "Counselling support, anytime",
    description: "Get free & unlimited support from the experts.",
    buttonLabel: "Counselling Sessions",
    buttonClassName: "bg-[#3B82F6] text-white",
    bg: "bg-[#EFF6FF]",
    accent: "from-[#BFDBFE] to-[#EFF6FF]",
    illustration: "💬",
  },
  {
    title: "This is your safe space",
    description:
      "Try expressing your thoughts, feelings and stories to boost your mental health daily.",
    buttonLabel: "Write about today",
    buttonClassName: "bg-[#F97316] text-white",
    bg: "bg-[#F0F0FF]",
    accent: "from-[#DDD6FE] to-[#F5F3FF]",
    illustration: "✍️",
  },
];

const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];
const loggedWeekMoods = ["😊", "😌", "😰", "😐", "🤩", "😊", null] as const;

const sectionTitleClass = "text-[18px] font-semibold text-[#1A1A1A]";
const cardClass = "rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-5";
const horizontalScrollClass =
  "flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const getGreeting = (hours: number) => {
  if (hours < 12) return "Good morning,";
  if (hours < 17) return "Good afternoon,";
  return "Good evening,";
};

const getDayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
};

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
      <button className="text-sm font-medium text-[#6B7280] transition-transform duration-150 hover:scale-[1.02] hover:text-[#3B82F6]">
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

  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7;
  const greeting = getGreeting(now.getHours());

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
  const affirmation = affirmations[getDayOfYear(now) % affirmations.length];

  const weekMoodData = weekLabels.map((label, index) => ({
    label,
    mood: index < currentDayIndex ? loggedWeekMoods[index] : null,
    isToday: index === currentDayIndex,
  }));

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] px-6 text-[#1A1A1A]">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_16px_40px_rgba(59,130,246,0.16)]">
            <Sparkles className="h-6 w-6 animate-pulse text-[#3B82F6]" />
          </div>
          <p className="text-sm font-medium text-[#6B7280]">Loading your calm corner...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <PublicLanding />;
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-[#1A1A1A]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-36 pt-4 sm:px-6 lg:px-8">
        <section
          className="relative min-h-[220px] overflow-hidden rounded-[32px] px-4 pb-6 pt-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:min-h-[280px] sm:px-6"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(17,24,39,0.12) 0%, rgba(15,23,42,0.48) 100%), url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.22))]" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/18 backdrop-blur-md transition-transform duration-150 hover:scale-105"
              aria-label="Open AI companion"
            >
              <img src="/image5.png" alt="AI companion" className="h-7 w-7 rounded-full object-cover" />
            </button>

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

        <section className="rounded-[24px] border-l-4 border-[#818CF8] bg-[#E8EAFF] px-5 py-4 shadow-[0_16px_35px_rgba(129,140,248,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6366F1]">
            Daily affirmation 💫
          </p>
          <p className="mt-2 text-[15px] leading-6 text-[#312E81]">{affirmation}</p>
        </section>

        <section
          className={`${cardClass} overflow-hidden transition-all duration-700 ${isMoodCardVisible
            ? "max-h-[260px] translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 -translate-y-2 p-0 opacity-0 shadow-none"
            }`}
          aria-hidden={!isMoodCardVisible}
        >
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#6B7280]">
            How are you feeling today?
          </p>

          <div className="mt-4 min-h-[110px]">
            {selectedMood ? (
              <div
                className={`flex h-full flex-col items-center justify-center rounded-[20px] bg-[#FFF8E8] px-4 py-6 text-center transition-all duration-700 ${isMoodToastVisible
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
                  }`}
              >
                <div className="text-4xl">{selectedMood.emoji}</div>
                <p className="mt-3 text-base font-semibold text-[#1A1A1A]">Thanks for checking in! 💛</p>
                <p className="mt-1 text-sm text-[#6B7280]">
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
                    <span className="mt-2 text-[11px] font-medium text-[#6B7280] sm:text-xs">{mood.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
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
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ${action.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#1A1A1A]">{action.title}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">{action.duration}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className={sectionTitleClass}>Your past moods</h2>
          <div className={horizontalScrollClass}>
            {pastMoodTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="flex shrink-0 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#4B5563] transition-transform duration-150 hover:scale-[1.02]"
              >
                <span>{tag}</span>
                <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] bg-[#E0E8FF] p-5 shadow-[0_18px_40px_rgba(59,130,246,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">Habit Tracker</p>
              <h2 className="mt-2 text-xl font-semibold text-[#1E3A8A]">A gentle glance at your daily rhythm</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#475569]">
                Keep tabs on the tiny wins that help your mind feel grounded and cared for.
              </p>
            </div>

            <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white/60 text-4xl md:flex">
              📈
            </div>
          </div>
        </section>

        <section>
          <label className="flex items-center gap-3 rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-4">
            <Search className="h-5 w-5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search content, topics, exercises..."
              className="w-full bg-transparent text-sm text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF]"
            />
          </label>
        </section>

        <section className="space-y-4">
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

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#F97316]">What&apos;s fresh?</p>
              <h2 className="mt-1 text-[18px] font-semibold text-[#1A1A1A]">Latest content for you</h2>
            </div>
            <button className="text-sm font-medium text-[#6B7280] transition-transform duration-150 hover:scale-[1.02] hover:text-[#3B82F6]">
              View All →
            </button>
          </div>

          <div className={`${horizontalScrollClass} md:grid md:grid-cols-3 md:overflow-visible`}>
            {contentCards.map((card) => (
              <article
                key={card.title}
                role={card.href ? "button" : undefined}
                tabIndex={card.href ? 0 : undefined}
                onClick={card.href ? () => navigate(card.href) : undefined}
                onKeyDown={card.href ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(card.href);
                  }
                } : undefined}
                className={`group relative min-w-[220px] overflow-hidden rounded-[24px] bg-white shadow-[0_16px_35px_rgba(15,23,42,0.08)] transition-all duration-150 md:min-w-0 ${card.href
                  ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                  : ""
                  }`}
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <img
                    src={card.image}
                    alt={card.title}
                    className={`h-full w-full object-cover transition-transform duration-300 ${card.href ? "group-hover:scale-[1.02]" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#111827] backdrop-blur-sm"
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>

                  <div className="absolute bottom-3 left-3 z-10 rounded-full bg-[#111827]/78 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {card.type}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className={`text-sm font-semibold leading-6 transition-colors duration-150 ${card.href ? "text-[#1F2937] group-hover:text-[#2563EB]" : "text-[#1F2937]"}`}>
                    {card.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className={`overflow-hidden rounded-[28px] ${card.bg} p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]`}
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <h3 className="text-xl font-semibold text-[#111827]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4B5563]">{card.description}</p>
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

        <section className="rounded-[24px] bg-[#F8FAFC] p-4 shadow-[0_16px_35px_rgba(148,163,184,0.08)] sm:p-5">
          <h2 className={sectionTitleClass}>This week&apos;s mood</h2>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {weekMoodData.map((day, index) => (
              <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-2">
                <span className={`text-xs font-semibold ${day.isToday ? "text-[#3B82F6]" : "text-[#6B7280]"}`}>
                  {day.label}
                </span>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg ${day.isToday
                    ? "border-[#93C5FD] bg-[#EFF6FF] text-[#3B82F6]"
                    : day.mood
                      ? "border-white bg-white"
                      : "border-dashed border-[#CBD5E1] bg-transparent text-[#94A3B8]"
                    }`}
                >
                  {day.mood ?? "·"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={() => navigate("/chat")}
        className="fixed bottom-24 right-4 z-30 h-14 w-14 overflow-hidden rounded-full shadow-[0_18px_40px_rgba(17,24,39,0.28)] transition-transform duration-150 hover:scale-105 sm:right-6"
        aria-label="Open AI companion"
      >
        <img src="/image5.png" alt="AI companion" className="h-full w-full object-cover" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#F3E8DA] bg-white/96 px-6 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-[#3B82F6]">
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/psychological-content")}
            className="flex flex-col items-center gap-1 text-[#9CA3AF] transition-colors duration-150 hover:text-[#6B7280]"
          >
            <Compass className="h-5 w-5" />
            <span className="text-xs font-medium">Discover</span>
            <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex flex-col items-center gap-1 text-[#9CA3AF] transition-colors duration-150 hover:text-[#6B7280]"
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
