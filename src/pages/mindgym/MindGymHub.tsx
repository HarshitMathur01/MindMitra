import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Sparkles, Trophy, ChevronRight, Phone, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CrisisOverlay from "@/components/mindgym/CrisisOverlay";
import { MINDGYM_TOOLS, BADGES } from "@/lib/mindgym/catalog";
import { loadProgress, getDailyRecommendation, getStreak, isCompletedToday } from "@/lib/mindgym/storage";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

export default function MindGymHub() {
  const navigate = useNavigate();
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  const progress = useMemo(() => loadProgress(), []);
  const recommended = useMemo(() => getDailyRecommendation(), []);
  const recommendedTool = MINDGYM_TOOLS.find((t) => t.id === recommended);

  return (
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 pb-20">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary mb-2">
            MindGym
          </h1>
          <p className="text-text-secondary text-base sm:text-lg max-w-2xl">
            Evidence-based offline practices to build resilience, track your emotional state, and calm your mind.
          </p>
        </motion.div>

        {/* Stats & Progress Container */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          {/* Daily Recommendation Card */}
          {recommendedTool && (
            <motion.div
              onClick={() => navigate(`/mindgym/${recommendedTool.id}`)}
              className="bg-surface p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm cursor-pointer hover:shadow-md transition-all group flex flex-col justify-between"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
                  Recommended Today
                </p>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">
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
                <p className="text-sm text-text-secondary">
                  {recommendedTool.shortDesc}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/10">
                <span className="text-xs font-medium text-text-secondary line-clamp-1">{recommendedTool.clinicalTag}</span>
                <span className="flex items-center text-xs font-medium text-primary group-hover:translate-x-1 transition-transform">
                  Start Practice <ArrowRight className="w-3 h-3 ml-1" />
                </span>
              </div>
            </motion.div>
          )}

          {/* Stats Summary Card */}
          <div className="bg-surface p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Your Progress
              </p>
              <div className="flex flex-wrap gap-4 items-center mb-6">
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-xl border border-primary/20">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">{progress.totalXP}</span>
                  <span className="text-xs text-primary/80 font-medium">XP</span>
                </div>
                <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-2 rounded-xl border border-orange-500/20">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-bold text-orange-600 dark:text-orange-400">{progress.currentStreak}</span>
                  <span className="text-xs text-orange-600/80 dark:text-orange-400/80 font-medium">Streak</span>
                </div>
                
                <button
                  onClick={() => setShowBadges(!showBadges)}
                  className="flex items-center gap-2 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                >
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-amber-600 dark:text-amber-400">{progress.badges.length}</span>
                  <span className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">Badges</span>
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
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-black/5 dark:border-white/10">
                    {BADGES.map((b) => {
                      const earned = progress.badges.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          title={b.title}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border ${
                            earned
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-black/5 dark:bg-white/5 border-transparent text-text-secondary/60 grayscale"
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

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
            Practices Library
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
                className="group relative flex flex-col p-5 rounded-2xl bg-surface border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md text-left transition-all duration-200 overflow-hidden"
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Completion Indicator */}
                {done && (
                  <div className="absolute top-0 right-0 p-2 bg-success/10 text-success rounded-bl-xl z-10 flex items-center gap-1">
                    <span className="text-[10px] font-bold px-1 uppercase tracking-wide">Done</span>
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
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 text-text-secondary">
                    {tool.clinicalTag}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 relative z-10">
                  <h3 className="text-base font-bold text-text-primary mb-1.5 group-hover:text-primary transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                    {tool.shortDesc}
                  </p>
                </div>

                {/* Footer Footer */}
                <div className="mt-5 flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/10 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">
                      {tool.minutes} min
                    </span>
                    <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {tool.xp} XP
                    </span>
                  </div>
                  {streak > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                      <Flame className="w-3 h-3" />
                      {streak}
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
          variant="destructive"
          size="sm"
          onClick={() => setCrisisOpen(true)}
          className="flex items-center gap-2 shadow-lg rounded-full"
        >
          <Phone className="w-4 h-4" />
          Need Help?
        </Button>
      </div>

      <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
      <Footer />
    </div>
  );
}
