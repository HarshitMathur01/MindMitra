import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Plus,
  Clock,
  BarChart3,
  Trash2,
  Check,
  X,
} from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { CRISIS_KEYWORDS } from "@/lib/mindgym/types";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";
import { cn } from "@/lib/utils";

interface WorryVaultProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

interface Worry {
  text: string;
  addedAt: string;
  resolved?: boolean;
  happened?: boolean;
  severity?: number;
}

interface VaultData {
  worries: Worry[];
  worryTime: string;
  stats: { total: number; happened: number; didntHappen: number };
}

const STORAGE_KEY = "mindmitra_worry_vault_v1";
const MAX_WORRIES = 10;

function loadVault(): VaultData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fallback */
  }
  return {
    worries: [],
    worryTime: "20:00",
    stats: { total: 0, happened: 0, didntHappen: 0 },
  };
}

function saveVault(data: VaultData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function containsCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

function isWorryTime(worryTime: string): boolean {
  const [h, m] = worryTime.split(":").map(Number);
  const now = new Date();
  const start = h * 60 + m;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= start && current < start + 15;
}

function getTimeUntil(worryTime: string): string {
  const [h, m] = worryTime.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const diff = target.getTime() - now.getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

type View = "main" | "add" | "review" | "stats" | "setTime";

export default function WorryVault({ onAvatarCue }: WorryVaultProps) {
  const [vault, setVault] = useState<VaultData>(loadVault);
  const [view, setView] = useState<View>("main");
  const [worryText, setWorryText] = useState("");
  const [folding, setFolding] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [crisisWarning, setCrisisWarning] = useState(false);
  const [timeInput, setTimeInput] = useState(vault.worryTime);
  const [severity, setSeverity] = useState(5);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const activeWorries = useMemo(
    () => vault.worries.filter((w) => !w.resolved),
    [vault.worries],
  );
  const worryTimeActive = isWorryTime(vault.worryTime);
  const unreviewedWorries = useMemo(
    () => activeWorries.filter((w) => !w.resolved),
    [activeWorries],
  );

  const persist = useCallback(
    (next: VaultData) => {
      setVault(next);
      saveVault(next);
    },
    [],
  );

  const handleAddWorry = useCallback(() => {
    if (!worryText.trim()) return;
    if (containsCrisis(worryText)) {
      trackMindGymEvent("crisis_triggered", { toolId: "worry-vault" });
      setCrisisWarning(true);
      return;
    }
    setFolding(true);
    setTimeout(() => {
      const next: VaultData = {
        ...vault,
        worries: [
          ...vault.worries,
          { text: worryText.trim(), addedAt: new Date().toISOString() },
        ],
        stats: { ...vault.stats, total: vault.stats.total + 1 },
      };
      persist(next);
      setWorryText("");
      setFolding(false);
      setCompleted(true);
      onAvatarCue?.(
        "Your worry is safely stored. You can revisit it at your scheduled worry time.",
        "calm",
      );
      setTimeout(() => setView("main"), 600);
    }, 1200);
  }, [worryText, vault, persist, onAvatarCue]);

  const handleReviewAnswer = useCallback(
    (happened: boolean) => {
      const worry = unreviewedWorries[reviewIdx];
      if (!worry) return;
      const idx = vault.worries.findIndex(
        (w) => w.addedAt === worry.addedAt && w.text === worry.text,
      );
      if (idx === -1) return;

      const updated = { ...vault };
      updated.worries = [...vault.worries];
      updated.worries[idx] = {
        ...worry,
        resolved: true,
        happened,
        severity: happened ? severity : undefined,
      };
      updated.stats = {
        ...vault.stats,
        happened: vault.stats.happened + (happened ? 1 : 0),
        didntHappen: vault.stats.didntHappen + (happened ? 0 : 1),
      };
      persist(updated);
      setSeverity(5);

      if (reviewIdx < unreviewedWorries.length - 1) {
        setReviewIdx((i) => i + 1);
      } else {
        setCompleted(true);
        onAvatarCue?.(
          "Great job reviewing your worries. Notice how many didn't come true.",
          "proud",
        );
        setTimeout(() => setView("main"), 400);
      }
    },
    [unreviewedWorries, reviewIdx, vault, severity, persist, onAvatarCue],
  );

  const handleDeleteWorry = useCallback(
    (worry: Worry) => {
      const removed = vault.worries.find((w) => w.addedAt === worry.addedAt);
      const remaining = vault.worries.filter((w) => w.addedAt !== worry.addedAt);

      // Keep stats consistent if deleting an already-reviewed worry.
      let happened = vault.stats.happened;
      let didnt = vault.stats.didntHappen;
      if (removed?.resolved) {
        if (removed.happened) happened = Math.max(0, happened - 1);
        else didnt = Math.max(0, didnt - 1);
      }

      const next: VaultData = {
        ...vault,
        worries: remaining,
        stats: {
          total: Math.max(0, vault.stats.total - 1),
          happened,
          didntHappen: didnt,
        },
      };
      persist(next);
    },
    [vault, persist],
  );

  const handleSetTime = useCallback(() => {
    persist({ ...vault, worryTime: timeInput });
    setView("main");
  }, [vault, timeInput, persist]);

  const handleReset = useCallback(() => {
    setCompleted(false);
    setView("main");
    setReviewIdx(0);
  }, []);

  const neverHappenedPct =
    vault.stats.total > 0
      ? Math.round(
          (vault.stats.didntHappen /
            (vault.stats.happened + vault.stats.didntHappen || 1)) *
            100,
        )
      : 0;

  return (
    <ToolShell
      toolId="worry-vault"
      title="Worry Vault"
      clinicalBasis="Based on ACT cognitive defusion and the scheduled worry technique — containing worries to a specific time reduces their power over you throughout the day."
      xp={30}
      completed={completed}
      onReset={handleReset}
      themeColor="from-[#1A110D] via-[#2F1D11] to-[#120C06]"
    >
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {/* ─── MAIN VIEW ─── */}
          {view === "main" && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* 3D Vault */}
              <div className="flex justify-center py-4">
                <div
                  className="relative"
                  style={{ perspective: "800px", width: 220, height: 240 }}
                >
                  {/* Vault body */}
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(145deg, #2a2a3e 0%, #1a1a2e 50%, #0d0d1a 100%)",
                      boxShadow:
                        "inset 0 2px 4px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.6)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Vault rivets */}
                    {[
                      [12, 12],
                      [12, "auto"],
                      ["auto", 12],
                      ["auto", "auto"],
                    ].map(([t, l], i) => (
                      <div
                        key={i}
                        className="absolute w-3 h-3 rounded-full"
                        style={{
                          top: typeof t === "number" ? t : undefined,
                          bottom: t === "auto" ? 12 : undefined,
                          left: typeof l === "number" ? l : undefined,
                          right: l === "auto" ? 12 : undefined,
                          background:
                            "radial-gradient(circle at 40% 40%, #555 0%, #222 100%)",
                          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
                        }}
                      />
                    ))}

                    {/* Vault handle */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <motion.div
                        animate={
                          doorOpen ? { rotate: 90 } : { rotate: 0 }
                        }
                        transition={{
                          type: "spring",
                          stiffness: 120,
                          damping: 15,
                        }}
                        className="relative w-16 h-16"
                      >
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background:
                              "conic-gradient(from 0deg, #555, #888, #555, #333, #555)",
                            boxShadow:
                              "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.1)",
                          }}
                        />
                        <div
                          className="absolute inset-2 rounded-full"
                          style={{
                            background:
                              "radial-gradient(circle at 40% 35%, #444, #1a1a1a)",
                          }}
                        />
                        <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-6 h-1 rounded-full bg-gradient-to-r from-white/20 to-transparent" />
                      </motion.div>
                    </div>

                    {/* Door (3D perspective) */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl overflow-hidden"
                      style={{
                        transformOrigin: "left center",
                        transformStyle: "preserve-3d",
                        backfaceVisibility: "hidden",
                      }}
                      animate={{
                        rotateY: doorOpen ? -75 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 60,
                        damping: 20,
                      }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          background: doorOpen
                            ? "linear-gradient(90deg, rgba(20,20,40,0.3), transparent)"
                            : "transparent",
                        }}
                      />
                    </motion.div>

                    {/* Lock icon */}
                    <motion.div
                      className="absolute bottom-4 left-1/2 -translate-x-1/2"
                      animate={{ scale: doorOpen ? 0 : 1 }}
                    >
                      {worryTimeActive ? (
                        <Unlock className="w-5 h-5 text-teal-400" />
                      ) : (
                        <Lock className="w-5 h-5 text-white/30" />
                      )}
                    </motion.div>

                    {/* Worry count badge */}
                    <div className="absolute -top-2 -right-2 bg-teal-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg">
                      {activeWorries.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="text-center space-y-1">
                <p className="text-white/40 text-xs">
                  {activeWorries.length}/{MAX_WORRIES} worries stored
                </p>
                {worryTimeActive ? (
                  <p className="text-teal-400 text-sm font-medium">
                    Worry time is active — review your worries now
                  </p>
                ) : (
                  <p className="text-white/50 text-sm">
                    Next worry time in{" "}
                    <span className="text-teal-400 font-medium">
                      {getTimeUntil(vault.worryTime)}
                    </span>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (activeWorries.length >= MAX_WORRIES) return;
                    setView("add");
                  }}
                  disabled={activeWorries.length >= MAX_WORRIES}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-2xl border transition-colors",
                    activeWorries.length >= MAX_WORRIES
                      ? "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  )}
                >
                  <Plus className="w-6 h-6 text-teal-400" />
                  <span className="text-sm text-white/70">Add Worry</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (worryTimeActive && unreviewedWorries.length > 0) {
                      setDoorOpen(true);
                      setReviewIdx(0);
                      setTimeout(() => setView("review"), 800);
                    }
                  }}
                  disabled={!worryTimeActive || unreviewedWorries.length === 0}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-2xl border transition-colors",
                    worryTimeActive && unreviewedWorries.length > 0
                      ? "border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20"
                      : "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed",
                  )}
                >
                  <Unlock className="w-6 h-6 text-teal-400" />
                  <span className="text-sm text-white/70">Open Vault</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setView("setTime")}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <Clock className="w-6 h-6 text-amber-400" />
                  <span className="text-sm text-white/70">
                    Set Time
                  </span>
                  <span className="text-xs text-white/30">
                    {vault.worryTime}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setView("stats")}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <BarChart3 className="w-6 h-6 text-purple-400" />
                  <span className="text-sm text-white/70">Stats</span>
                </motion.button>
              </div>

              {/* Active worries list */}
              {activeWorries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-white/30 uppercase tracking-wider">
                    Stored worries
                  </p>
                  {activeWorries.map((w, i) => (
                    <motion.div
                      key={w.addedAt}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-400/60 shrink-0" />
                      <p className="text-sm text-white/60 flex-1 truncate">
                        {w.text}
                      </p>
                      <button
                        onClick={() => handleDeleteWorry(w)}
                        className="text-white/20 hover:text-rose-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ─── ADD WORRY VIEW ─── */}
          {view === "add" && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => {
                  setView("main");
                  setCrisisWarning(false);
                }}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold text-white/90">
                  Write your worry
                </h2>
                <p className="text-sm text-white/40">
                  Once stored, you'll only revisit it at your scheduled worry
                  time.
                </p>
              </div>

              {/* Paper-like input */}
              <div className="relative">
                <AnimatePresence>
                  {folding ? (
                    <motion.div
                      key="fold"
                      className="relative mx-auto overflow-hidden"
                      style={{
                        width: 280,
                        perspective: "600px",
                      }}
                    >
                      <motion.div
                        className="rounded-lg p-6"
                        style={{
                          background:
                            "linear-gradient(135deg, #f5f0e8, #e8e0d0)",
                          transformOrigin: "top center",
                        }}
                        initial={{ rotateX: 0, scale: 1, opacity: 1 }}
                        animate={{
                          rotateX: 90,
                          scale: 0.6,
                          opacity: 0,
                          y: 60,
                        }}
                        transition={{ duration: 1, ease: "easeInOut" }}
                      >
                        <p className="text-sm text-foreground font-serif leading-relaxed whitespace-pre-wrap">
                          {worryText}
                        </p>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="input"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div
                        className="rounded-xl p-1"
                        style={{
                          background:
                            "linear-gradient(135deg, #f5f0e8, #e8e0d0)",
                        }}
                      >
                        <textarea
                          value={worryText}
                          onChange={(e) => {
                            setWorryText(e.target.value);
                            setCrisisWarning(false);
                          }}
                          placeholder="What's worrying you?"
                          rows={4}
                          maxLength={300}
                          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground p-4 rounded-lg resize-none focus:outline-none text-sm font-serif leading-relaxed"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(transparent, transparent 27px, #d4c8b8 27px, #d4c8b8 28px)",
                            backgroundPositionY: "4px",
                          }}
                        />
                      </div>
                      <p className="text-right text-xs text-white/30 mt-1">
                        {worryText.length}/300
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {crisisWarning && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-rose-400 text-sm text-center"
                >
                  If you're in crisis, please use the "Need help?" button below.
                </motion.p>
              )}

              {!folding && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddWorry}
                  disabled={!worryText.trim()}
                  className={cn(
                    "w-full py-3.5 rounded-2xl font-medium text-sm transition-all",
                    worryText.trim()
                      ? "bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20"
                      : "bg-white/5 text-white/30 cursor-not-allowed",
                  )}
                >
                  Store in Vault
                </motion.button>
              )}
            </motion.div>
          )}

          {/* ─── REVIEW VIEW ─── */}
          {view === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => {
                  setView("main");
                  setDoorOpen(false);
                }}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold text-white/90">
                  Review Worry {reviewIdx + 1}/{unreviewedWorries.length}
                </h2>
                <p className="text-sm text-white/40">
                  Let's check in on this worry
                </p>
              </div>

              {unreviewedWorries[reviewIdx] && (
                <motion.div
                  key={unreviewedWorries[reviewIdx].addedAt}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {/* Worry card */}
                  <div
                    className="rounded-xl p-6 mx-auto max-w-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, #f5f0e8, #e8e0d0)",
                    }}
                  >
                    <p className="text-sm text-foreground font-serif leading-relaxed">
                      {unreviewedWorries[reviewIdx].text}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Added{" "}
                      {new Date(
                        unreviewedWorries[reviewIdx].addedAt,
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>

                  {/* Question */}
                  <div className="text-center">
                    <p className="text-white/70 text-sm mb-4">
                      Did this worry actually happen?
                    </p>
                    <div className="flex gap-3 justify-center">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReviewAnswer(false)}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 hover:bg-teal-500/25 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        No
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReviewAnswer(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Yes
                      </motion.button>
                    </div>
                  </div>

                  {/* Severity slider (shown always, used if "Yes") */}
                  <div className="space-y-3">
                    <p className="text-center text-xs text-white/40">
                      How bad was it? (1 = mild, 10 = severe)
                    </p>
                    <div className="flex items-center gap-4 px-4">
                      <span className="text-xs text-white/30 w-4 text-right">
                        1
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={severity}
                        onChange={(e) => setSeverity(Number(e.target.value))}
                        className="flex-1 accent-teal-500 h-1.5"
                      />
                      <span className="text-xs text-white/30 w-4">10</span>
                    </div>
                    <p className="text-center text-lg font-semibold text-teal-400">
                      {severity}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ─── STATS VIEW ─── */}
          {view === "stats" && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setView("main")}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold text-white/90">
                  Worry Stats
                </h2>
                <p className="text-sm text-white/40">
                  What your data shows
                </p>
              </div>

              {vault.stats.happened + vault.stats.didntHappen > 0 ? (
                <div className="space-y-6">
                  {/* Big stat */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="text-center p-8 rounded-2xl bg-gradient-to-br from-teal-500/10 to-purple-500/10 border border-white/5"
                  >
                    <p className="text-5xl font-bold text-teal-400">
                      {neverHappenedPct}%
                    </p>
                    <p className="text-sm text-white/50 mt-2">
                      of your worries never happened
                    </p>
                  </motion.div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-2xl font-bold text-white/80">
                        {vault.stats.total}
                      </p>
                      <p className="text-xs text-white/40 mt-1">Total</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-2xl font-bold text-teal-400">
                        {vault.stats.didntHappen}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Didn't happen
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-2xl font-bold text-amber-400">
                        {vault.stats.happened}
                      </p>
                      <p className="text-xs text-white/40 mt-1">Happened</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-white/30 mb-2">
                      <span>Didn't happen</span>
                      <span>Happened</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
                      <motion.div
                        className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-l-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${neverHappenedPct}%`,
                        }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-r-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${100 - neverHappenedPct}%`,
                        }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                    </div>
                  </div>

                  <p className="text-center text-xs text-white/30 italic">
                    Research shows ~85% of worried-about events never occur,
                    and of those that do, 79% are handled better than expected.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-white/30 text-sm">
                    No reviewed worries yet. Stats will appear after you
                    review worries during your worry time.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── SET TIME VIEW ─── */}
          {view === "setTime" && (
            <motion.div
              key="setTime"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setView("main")}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold text-white/90">
                  Set Worry Time
                </h2>
                <p className="text-sm text-white/40">
                  Choose a 15-minute window to review your worries daily
                </p>
              </div>

              <div className="flex justify-center">
                <input
                  type="time"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="bg-white/[0.05] border border-white/10 rounded-xl px-6 py-4 text-2xl text-white text-center focus:outline-none focus:border-teal-500/50 transition-colors [color-scheme:dark]"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSetTime}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm shadow-lg shadow-teal-500/20 transition-colors"
              >
                Save Time
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolShell>
  );
}
