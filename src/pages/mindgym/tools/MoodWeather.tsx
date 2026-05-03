import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface MoodWeatherProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

type Quadrant = "stormy" | "electric" | "foggy" | "sunny";

interface MoodEntry {
  date: string;
  x: number;
  y: number;
  quadrant: Quadrant;
  timestamp: string;
}

interface WeatherData {
  entries: MoodEntry[];
}

const STORAGE_KEY = "mindmitra_mood_weather_v1";

function loadData(): WeatherData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fallback */
  }
  return { entries: [] };
}

function saveData(data: WeatherData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getQuadrant(x: number, y: number): Quadrant {
  if (x < 0.5 && y < 0.5) return "stormy";
  if (x >= 0.5 && y < 0.5) return "electric";
  if (x < 0.5 && y >= 0.5) return "foggy";
  return "sunny";
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const QUADRANT_META: Record<
  Quadrant,
  {
    label: string;
    emoji: string;
    color: string;
    activity: string;
    description: string;
  }
> = {
  stormy: {
    label: "Stormy",
    emoji: "⛈",
    color: "#5b6c8a",
    activity:
      "Try a gentle walk, even just 5 minutes — movement helps when energy is low and mood is heavy.",
    description: "Low energy, difficult mood",
  },
  electric: {
    label: "Electric",
    emoji: "⚡",
    color: "#D49B3C",
    activity:
      "Channel that energy — try journaling fast for 3 minutes or do a burst of exercise to release tension.",
    description: "High energy, difficult mood",
  },
  foggy: {
    label: "Foggy",
    emoji: "🌫",
    color: "#9988C2",
    activity:
      "You're calm but low — try calling a friend or watching something you enjoy. Small pleasures help.",
    description: "Low energy, okay mood",
  },
  sunny: {
    label: "Sunny",
    emoji: "☀️",
    color: "#5fa07a",
    activity:
      "You're in a great place — use this energy! Start a creative task or help someone else today.",
    description: "High energy, good mood",
  },
};

/* ─── CSS Weather Animations ─── */

function StormyWeather() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Soft watercolor clouds */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`cloud-${i}`}
          className="absolute rounded-full"
          style={{
            width: 120 + i * 40,
            height: 50 + i * 15,
            background: `radial-gradient(ellipse, rgba(91,108,138,0.55), rgba(120,130,160,0.30))`,
            top: 10 + i * 20,
            left: -30 + i * 60,
            filter: "blur(8px)",
          }}
          animate={{ x: [0, 20, -10, 0] }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Rain drops */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`rain-${i}`}
          className="absolute w-[1.5px] rounded-full"
          style={{
            height: 12 + Math.random() * 10,
            left: `${5 + Math.random() * 90}%`,
            top: -20,
            background: "rgba(91,108,138,0.55)",
          }}
          animate={{ y: [0, 300], opacity: [0.65, 0] }}
          transition={{
            duration: 0.6 + Math.random() * 0.4,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

function ElectricWeather() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Agitated clouds */}
      {[0, 1].map((i) => (
        <motion.div
          key={`ecloud-${i}`}
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 60,
            background: `radial-gradient(ellipse, rgba(120,80,30,0.6), rgba(60,40,15,0.4))`,
            top: 15 + i * 30,
            left: 10 + i * 80,
            filter: "blur(8px)",
          }}
          animate={{ x: [0, 15, -15, 0], scale: [1, 1.05, 0.97, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* Lightning flashes */}
      <motion.div
        className="absolute inset-0 bg-amber-300/10"
        animate={{ opacity: [0, 0, 0.4, 0, 0, 0, 0.2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      {/* Lightning bolt SVG */}
      <motion.svg
        className="absolute top-8 left-1/2 -translate-x-1/2 w-8 h-20 text-amber-300/70"
        viewBox="0 0 32 80"
        fill="currentColor"
        animate={{ opacity: [0, 0, 1, 0, 0, 0, 0.8, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <path d="M18 0 L8 35 L15 35 L10 80 L26 30 L19 30 Z" />
      </motion.svg>
    </div>
  );
}

function FoggyWeather() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Mist layers */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={`fog-${i}`}
          className="absolute w-full"
          style={{
            height: 40,
            top: 20 + i * 30,
            background: `linear-gradient(90deg, transparent, rgba(180,170,200,${0.08 + i * 0.04}), transparent)`,
            filter: "blur(12px)",
          }}
          animate={{ x: ["-20%", "20%", "-20%"] }}
          transition={{
            duration: 10 + i * 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Soft glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(139,92,246,0.08), transparent 70%)",
        }}
      />
    </div>
  );
}

function SunnyWeather() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sun */}
      <motion.div
        className="absolute top-4 right-8 w-16 h-16 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(250,204,21,0.7), rgba(250,204,21,0.2) 60%, transparent 80%)",
          boxShadow: "0 0 40px rgba(250,204,21,0.3)",
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Sun rays */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`ray-${i}`}
          className="absolute"
          style={{
            top: 20,
            right: 24,
            width: 2,
            height: 30,
            background:
              "linear-gradient(to bottom, rgba(250,204,21,0.4), transparent)",
            transformOrigin: "center -8px",
            transform: `rotate(${i * 45}deg)`,
          }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.25,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Warm particles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full bg-yellow-300/30"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${20 + Math.random() * 60}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

const WEATHER_COMPONENTS: Record<Quadrant, React.FC> = {
  stormy: StormyWeather,
  electric: ElectricWeather,
  foggy: FoggyWeather,
  sunny: SunnyWeather,
};

type MoodView = "checkin" | "calendar";

export default function MoodWeather({ onAvatarCue }: MoodWeatherProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<WeatherData>(loadData);
  const [view, setView] = useState<MoodView>("checkin");
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const gridRef = useRef<HTMLDivElement>(null);

  const currentQuadrant = pin ? getQuadrant(pin.x, pin.y) : null;
  const WeatherBg = currentQuadrant
    ? WEATHER_COMPONENTS[currentQuadrant]
    : null;

  const todayEntry = useMemo(
    () => data.entries.find((e) => e.date === todayStr()),
    [data.entries],
  );

  useEffect(() => {
    if (todayEntry && !pin) {
      setPin({ x: todayEntry.x, y: todayEntry.y });
      setConfirmed(true);
    }
  }, [todayEntry, pin]);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (confirmed) return;
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      let clientX: number, clientY: number;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(
        0,
        Math.min(1, 1 - (clientY - rect.top) / rect.height),
      );
      setPin({ x, y });
    },
    [confirmed],
  );

  const handleConfirm = useCallback(() => {
    if (!pin) return;
    const quadrant = getQuadrant(pin.x, pin.y);
    const entry: MoodEntry = {
      date: todayStr(),
      x: pin.x,
      y: pin.y,
      quadrant,
      timestamp: new Date().toISOString(),
    };
    const filtered = data.entries.filter((e) => e.date !== todayStr());
    const next: WeatherData = { entries: [...filtered, entry] };
    setData(next);
    saveData(next);
    setConfirmed(true);
    setCompleted(true);
    onAvatarCue?.(
      `Your mood today feels ${QUADRANT_META[quadrant].label.toLowerCase()}. ${QUADRANT_META[quadrant].activity.split("—")[0]}`,
      quadrant === "sunny" ? "happy" : quadrant === "foggy" ? "calm" : "caring",
    );
  }, [pin, data, onAvatarCue]);

  const handleReset = useCallback(() => {
    setCompleted(false);
    setConfirmed(false);
    setPin(null);
  }, []);

  // 30-day rolling history + weekly insight (spec)
  const last30 = useMemo(() => {
    const end = new Date();
    const days: { date: string; entry: MoodEntry | null }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const entry = data.entries.find((e) => e.date === date) || null;
      days.push({ date, entry });
    }
    return days;
  }, [data.entries]);

  const weeklyInsight = useMemo(() => {
    const counts: Record<string, number> = {};
    const byDow: Record<string, Record<Quadrant, number>> = {};
    for (const { date, entry } of last30) {
      if (!entry) continue;
      counts[entry.quadrant] = (counts[entry.quadrant] || 0) + 1;
      const dow = new Date(date).toLocaleDateString("en-IN", { weekday: "long" });
      byDow[dow] = byDow[dow] || { stormy: 0, electric: 0, foggy: 0, sunny: 0 };
      byDow[dow][entry.quadrant] += 1;
    }
    const mostCommonQuadrant = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null) as Quadrant | null;

    let mostCommonDay: { day: string; quadrant: Quadrant; count: number } | null = null;
    for (const [day, qCounts] of Object.entries(byDow)) {
      for (const [q, c] of Object.entries(qCounts) as [Quadrant, number][]) {
        if (!mostCommonDay || c > mostCommonDay.count) {
          mostCommonDay = { day, quadrant: q, count: c };
        }
      }
    }

    return { mostCommonQuadrant, mostCommonDay };
  }, [last30]);

  /* Calendar helpers */
  const calDays = useMemo(() => {
    const first = new Date(calMonth.year, calMonth.month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(
      calMonth.year,
      calMonth.month + 1,
      0,
    ).getDate();
    const cells: (MoodEntry | null | "blank")[] = [];
    for (let i = 0; i < startDay; i++) cells.push("blank");
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const entry = data.entries.find((e) => e.date === dateStr);
      cells.push(entry || null);
    }
    return cells;
  }, [calMonth, data.entries]);

  const calMonthLabel = new Date(
    calMonth.year,
    calMonth.month,
  ).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const navigateMonth = useCallback((delta: number) => {
    setCalMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 11) {
        m = 0;
        y++;
      }
      if (m < 0) {
        m = 11;
        y--;
      }
      return { year: y, month: m };
    });
  }, []);

  return (
    <ToolShell
      toolId="mood-weather"
      title="Mood Weather"
      clinicalBasis="Based on behavioral activation and structured mood monitoring — tracking your emotional state across energy and mood axes builds self-awareness and helps identify patterns."
      xp={20}
      completed={completed}
      onReset={handleReset}
      themeAccent="amber"
      surfaceTone="warm"
      backdropScene="hills"
    >
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* View tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView("checkin")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-colors backdrop-blur-sm",
              view === "checkin"
                ? "bg-[#E8C97A]/35 text-[#a06b1f] border border-[#a06b1f]/35"
                : "bg-white/68 text-[#5b4a3e] border border-black/8 hover:text-[#2a1c14] hover:bg-white/82",
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            Check-in
          </button>
          <button
            onClick={() => setView("calendar")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-colors backdrop-blur-sm",
              view === "calendar"
                ? "bg-[#E8C97A]/35 text-[#a06b1f] border border-[#a06b1f]/35"
                : "bg-white/68 text-[#5b4a3e] border border-black/8 hover:text-[#2a1c14] hover:bg-white/82",
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            History
          </button>
        </div>

        <AnimatePresence mode="wait">
          {view === "checkin" && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="text-center space-y-1">
                <h2 className="font-serif-display italic text-[1.85rem] font-light text-[#2a1c14] leading-tight">
                  How are you feeling?
                </h2>
                <p className="text-sm text-[#5b4a3e]">
                  Tap the grid to place your mood pin
                </p>
              </div>

              {/* Mood grid */}
              <div className="relative">
                {/* Weather background */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <AnimatePresence>
                    {WeatherBg && (
                      <motion.div
                        key={currentQuadrant}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        <WeatherBg />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div
                  ref={gridRef}
                  onClick={handleGridClick}
                  onTouchStart={handleGridClick}
                  className={cn(
                    "relative w-full aspect-square rounded-2xl border border-black/10 cursor-crosshair overflow-hidden shadow-[0_18px_44px_-22px_rgba(80,60,40,0.30)]",
                    confirmed && "cursor-default",
                  )}
                  style={{
                    background: "rgba(251,246,236,0.78)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-black/10" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/10" />
                  </div>

                  {/* Quadrant labels */}
                  <span className="absolute top-3 left-3 text-[10px] text-[#7a6556] font-medium uppercase tracking-[0.22em]">
                    🌫 Foggy
                  </span>
                  <span className="absolute top-3 right-3 text-[10px] text-[#7a6556] font-medium uppercase tracking-[0.22em]">
                    ☀️ Sunny
                  </span>
                  <span className="absolute bottom-3 left-3 text-[10px] text-[#7a6556] font-medium uppercase tracking-[0.22em]">
                    ⛈ Stormy
                  </span>
                  <span className="absolute bottom-3 right-3 text-[10px] text-[#7a6556] font-medium uppercase tracking-[0.22em]">
                    ⚡ Electric
                  </span>

                  {/* Axis labels */}
                  <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-[#9a8674] uppercase tracking-widest">
                    Mood →
                  </span>
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] text-[#9a8674] uppercase tracking-widest">
                    Energy →
                  </span>

                  {/* Pin */}
                  {pin && (
                    <motion.div
                      className="absolute z-10"
                      style={{
                        left: `${pin.x * 100}%`,
                        bottom: `${pin.y * 100}%`,
                        transform: "translate(-50%, 50%)",
                      }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div className="relative">
                        <div className="w-5 h-5 rounded-full bg-[#3F6B47] border-2 border-[#FBF6EC] shadow-[0_4px_14px_rgba(63,107,71,0.45)]" />
                        <motion.div
                          className="absolute inset-0 rounded-full bg-[#3F6B47]/35"
                          animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Quadrant info + confirm */}
              <AnimatePresence>
                {currentQuadrant && !confirmed && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-white/72 border border-black/8 text-center backdrop-blur-sm">
                      <p className="text-lg mb-1">
                        {QUADRANT_META[currentQuadrant].emoji}{" "}
                        <span
                          className="font-semibold"
                          style={{ color: QUADRANT_META[currentQuadrant].color }}
                        >
                          {QUADRANT_META[currentQuadrant].label}
                        </span>
                      </p>
                      <p className="text-xs text-[#5b4a3e]">
                        {QUADRANT_META[currentQuadrant].description}
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleConfirm}
                      className="w-full py-3.5 rounded-2xl bg-[#3F6B47] hover:bg-[#345a3b] text-white font-medium text-sm shadow-[0_10px_28px_-14px_rgba(63,107,71,0.45)] transition-colors"
                    >
                      Confirm Check-in
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Activity suggestion */}
              <AnimatePresence>
                {confirmed && currentQuadrant && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-5 rounded-2xl border border-black/8 bg-white/72 backdrop-blur-sm shadow-[0_10px_28px_-16px_rgba(80,60,40,0.22)]"
                    style={{
                      background: `linear-gradient(135deg, ${QUADRANT_META[currentQuadrant].color}22, rgba(251,246,236,0.7))`,
                    }}
                  >
                    <p className="text-xs text-[#7a6556] uppercase tracking-[0.22em] mb-2">
                      Suggested activity
                    </p>
                    <p className="text-sm text-[#3a2a20] leading-relaxed">
                      {QUADRANT_META[currentQuadrant].activity}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {currentQuadrant === "stormy" && (
                        <button
                          onClick={() => navigate("/mindgym/five-senses")}
                          className="text-xs text-[#3F6B47] hover:text-[#2c5235] transition-colors"
                        >
                          Open 5-4-3-2-1 Anchor →
                        </button>
                      )}
                      {currentQuadrant === "electric" && (
                        <button
                          onClick={() => navigate("/mindgym/breath-sphere")}
                          className="text-xs text-[#3F6B47] hover:text-[#2c5235] transition-colors"
                        >
                          Open Breath Sphere →
                        </button>
                      )}
                      {currentQuadrant === "foggy" && (
                        <button
                          onClick={() => navigate("/journal")}
                          className="text-xs text-[#3F6B47] hover:text-[#2c5235] transition-colors"
                        >
                          Open Journal →
                        </button>
                      )}
                      {currentQuadrant === "sunny" && (
                        <button
                          onClick={() => navigate("/mindgym/focus-flow")}
                          className="text-xs text-[#3F6B47] hover:text-[#2c5235] transition-colors"
                        >
                          Open Focus Flow →
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ─── CALENDAR VIEW ─── */}
          {view === "calendar" && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Month nav */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-lg text-[#7a6556] hover:text-[#2a1c14] hover:bg-white/72 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="font-serif-display text-base font-normal text-[#2a1c14]">
                  {calMonthLabel}
                </p>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-lg text-[#7a6556] hover:text-[#2a1c14] hover:bg-white/72 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 30-day strip + insight */}
              <div className="p-4 rounded-2xl bg-white/68 border border-black/8 backdrop-blur-sm">
                <p className="text-xs text-[#7a6556] uppercase tracking-[0.22em] mb-3">
                  Last 30 days
                </p>
                <div className="grid grid-cols-10 gap-1.5">
                  {last30.map(({ date, entry }) => {
                    const meta = entry ? QUADRANT_META[entry.quadrant] : null;
                    return (
                      <div
                        key={date}
                        className="aspect-square rounded-lg border border-black/8 flex items-center justify-center"
                        style={{
                          background: meta ? `${meta.color}28` : "rgba(80,60,40,0.05)",
                        }}
                        title={entry ? `${date} · ${meta?.label}` : `${date} · no check-in`}
                      >
                        <span className="text-[10px] opacity-85">
                          {entry ? meta?.emoji : "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-1.5">
                  {weeklyInsight.mostCommonDay && (
                    <p className="text-sm text-[#3a2a20]">
                      You&apos;re often{" "}
                      <span className="text-[#2a1c14] font-medium">
                        {QUADRANT_META[weeklyInsight.mostCommonDay.quadrant].label}
                      </span>{" "}
                      on{" "}
                      <span className="text-[#2a1c14] font-medium">
                        {weeklyInsight.mostCommonDay.day}
                      </span>
                      .
                    </p>
                  )}
                  {weeklyInsight.mostCommonQuadrant && (
                    <p className="text-xs text-[#7a6556]">
                      Most common pattern:{" "}
                      {QUADRANT_META[weeklyInsight.mostCommonQuadrant].emoji}{" "}
                      {QUADRANT_META[weeklyInsight.mostCommonQuadrant].label}
                    </p>
                  )}
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div
                    key={i}
                    className="text-center text-[10px] text-[#9a8674] py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-1">
                {calDays.map((cell, i) => {
                  if (cell === "blank") {
                    return <div key={`blank-${i}`} className="aspect-square" />;
                  }

                  const actualDay =
                    i -
                    calDays.filter((c, idx) => c === "blank" && idx < i)
                      .length +
                    1;

                  if (cell === null) {
                    return (
                      <div
                        key={`empty-${i}`}
                        className="aspect-square rounded-lg bg-white/45 border border-black/6 flex items-center justify-center"
                      >
                        <span className="text-[10px] text-[#9a8674]">
                          {actualDay}
                        </span>
                      </div>
                    );
                  }

                  const meta = QUADRANT_META[cell.quadrant];
                  return (
                    <motion.div
                      key={`day-${i}`}
                      whileHover={{ scale: 1.1 }}
                      className="aspect-square rounded-lg flex flex-col items-center justify-center cursor-default border"
                      style={{
                        background: `${meta.color}28`,
                        borderColor: `${meta.color}55`,
                      }}
                      title={`${meta.label} — ${cell.date}`}
                    >
                      <span className="text-xs">{meta.emoji}</span>
                      <span className="text-[8px] text-[#5b4a3e] mt-0.5">
                        {actualDay}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 justify-center pt-2">
                {(
                  Object.entries(QUADRANT_META) as [
                    Quadrant,
                    (typeof QUADRANT_META)[Quadrant],
                  ][]
                ).map(([key, meta]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="text-xs">{meta.emoji}</span>
                    <span className="text-[10px] text-[#7a6556]">
                      {meta.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {data.entries.length > 0 && (
                <div className="p-4 rounded-xl bg-white/68 border border-black/8 text-center backdrop-blur-sm">
                  <p className="text-xs text-[#7a6556] mb-1">
                    {data.entries.length} check-in
                    {data.entries.length > 1 ? "s" : ""} recorded
                  </p>
                  <p className="text-xs text-[#3a2a20]">
                    Most common:{" "}
                    <span className="text-[#a06b1f] font-medium">
                      {
                        QUADRANT_META[
                          (Object.entries(
                            data.entries.reduce(
                              (acc, e) => ({
                                ...acc,
                                [e.quadrant]: (acc[e.quadrant] || 0) + 1,
                              }),
                              {} as Record<string, number>,
                            ),
                          ).sort(
                            ([, a], [, b]) => (b as number) - (a as number),
                          )[0]?.[0] || "sunny") as Quadrant
                        ].label
                      }
                    </span>
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolShell>
  );
}
