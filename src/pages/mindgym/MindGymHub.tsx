import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Sparkles, Trophy, Phone, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CrisisOverlay from "@/components/mindgym/CrisisOverlay";
import { MINDGYM_TOOLS, BADGES } from "@/lib/mindgym/catalog";
import { loadProgress, getDailyRecommendation, getStreak, isCompletedToday } from "@/lib/mindgym/storage";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 42, damping: 38, mass: 1.15 },
  },
} as const;

export default function MindGymHub() {
  const navigate = useNavigate();
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  const progress = useMemo(() => loadProgress(), []);
  const recommended = useMemo(() => getDailyRecommendation(), []);
  const recommendedTool = MINDGYM_TOOLS.find((t) => t.id === recommended);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 pb-20">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 44, damping: 40, mass: 1.15 }}
          className="mb-10"
        >
          <h1 className="font-display text-3xl sm:text-[2.125rem] font-normal tracking-tight text-ink-8 mb-3">
            MindGym
          </h1>
          <p className="text-ink-6 text-base sm:text-[17px] max-w-prose leading-[1.65]">
            Small offline practices you can do at your own pace — nothing to prove, no score that defines you.
          </p>
        </motion.div>

        {/* Stats & Progress Container */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 40, damping: 38, mass: 1.15, delay: 0.05 }}
        >
          {/* Daily Recommendation Card */}
          {recommendedTool && (
            <motion.div
              onClick={() => navigate(`/mindgym/${recommendedTool.id}`)}
              className="held-surface cursor-pointer transition-colors duration-base group flex flex-col justify-between rounded-[24px] p-6"
            >
              <div>
                <p className="text-[13px] font-medium text-ink-6 mb-3">
                  If you want one gentle suggestion
                </p>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-ink-8 group-hover:text-[hsl(var(--accent-600))] transition-colors duration-base">
                    {recommendedTool.title}
                  </h3>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${recommendedTool.gradient[0]}, ${recommendedTool.gradient[1]})`,
                    }}
                  >
                    <recommendedTool.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {recommendedTool.shortDesc}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between pt-4 border-t border-ink-3/50">
                <span className="text-[12px] font-medium text-ink-5 line-clamp-1">{recommendedTool.clinicalTag}</span>
                <span className="flex items-center text-[12px] font-medium text-[hsl(var(--accent-600))] transition-opacity duration-base group-hover:opacity-80">
                  Try this practice <ArrowRight className="w-3 h-3 ml-1" strokeWidth={1.8} />
                </span>
              </div>
            </motion.div>
          )}

          {/* Stats Summary Card */}
          <div className="held-surface flex flex-col justify-between rounded-[24px] p-6">
            <div>
              <p className="text-[13px] font-medium text-ink-6 mb-4">
                Your pace, not a race
              </p>
              <div className="flex flex-wrap gap-4 items-center mb-6">
                <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--accent-100))] px-3 py-2">
                  <Sparkles className="w-4 h-4 text-[hsl(var(--accent-600))]" strokeWidth={1.8} />
                  <span className="font-medium text-ink-8">{progress.totalXP}</span>
                  <span className="text-[12px] text-ink-6">moments</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--warmth-100))] px-3 py-2">
                  <Flame className="w-4 h-4 text-[hsl(var(--warmth-500))]" strokeWidth={1.8} />
                  <span className="font-medium text-ink-8">{progress.currentStreak}</span>
                  <span className="text-[12px] text-ink-6">days in a row</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowBadges(!showBadges)}
                  className="flex items-center gap-2 rounded-full bg-ink-1 px-3 py-2 transition-colors duration-base hover:bg-ink-2"
                >
                  <Trophy className="w-4 h-4 text-ink-6" strokeWidth={1.8} />
                  <span className="font-medium text-ink-8">{progress.badges.length}</span>
                  <span className="text-[12px] text-ink-6">small wins</span>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showBadges && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border/40">
                    {BADGES.map((b) => {
                      const earned = progress.badges.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          title={b.title}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border ${
                            earned
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-muted/60 border-transparent text-muted-foreground/60 grayscale"
                          }`}
                        >
                          <span className="text-sm">{earned ? b.icon : "🔒"}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl sm:text-2xl font-normal text-ink-8">
            Practices you can open anytime
          </h2>
        </div>

        {/* Tool Cards Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {MINDGYM_TOOLS.map((tool) => {
            const streak = getStreak(tool.id);
            const done = isCompletedToday(tool.id);

            return (
              <motion.button
                key={tool.id}
                variants={cardVariants}
                onClick={() => navigate(`/mindgym/${tool.id}`)}
                className="group relative flex flex-col overflow-hidden rounded-[24px] bg-card p-5 text-left transition-colors duration-base hover:bg-ink-1"
              >
                {/* Completion Indicator */}
                {done && (
                  <div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-2xl bg-[hsl(var(--accent-100))] px-2 py-1.5 text-[hsl(var(--accent-600))]">
                    <span className="text-[11px] font-medium px-1">Visited today</span>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-4 mt-1 relative z-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${tool.gradient[0]}25, ${tool.gradient[1]}15)`,
                    }}
                  >
                    <tool.icon
                      className="w-6 h-6"
                      style={{ color: tool.gradient[0] }}
                    />
                  </div>
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-muted/60 text-muted-foreground">
                    {tool.clinicalTag}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 relative z-10">
                  <h3 className="text-base font-medium text-ink-8 mb-1.5 transition-colors duration-base group-hover:text-[hsl(var(--accent-600))]">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {tool.shortDesc}
                  </p>
                </div>

                {/* Footer Footer */}
                <div className="mt-5 flex items-center justify-between pt-4 border-t border-border/40 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                      {tool.minutes} min
                    </span>
                    <span className="text-[11px] font-medium text-ink-6 bg-ink-1 px-2 py-0.5 rounded-full">
                      +{tool.xp} gentle points
                    </span>
                  </div>
                  {streak > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-ink-6 bg-[hsl(var(--warmth-50))] px-2 py-0.5 rounded-full">
                      <Flame className="w-3 h-3 text-[hsl(var(--warmth-500))]" strokeWidth={1.8} />
                      {streak} visits
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </main>

      {/* Persistent crisis help */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          variant="warmth"
          size="sm"
          onClick={() => setCrisisOpen(true)}
          className="flex items-center gap-2 rounded-full shadow-none"
        >
          <Phone className="w-4 h-4" strokeWidth={1.8} />
          If you need someone
        </Button>
      </div>

      <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
      <Footer />
    </div>
  );
}
