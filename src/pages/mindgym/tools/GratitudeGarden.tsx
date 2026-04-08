import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flower2, Plus, Sun, Moon, ChevronLeft, Sparkles } from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { cn } from "@/lib/utils";
import { incrementMindGymCounter } from "@/lib/mindgym/analytics";

interface GratitudeGardenProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

interface GardenEntry {
  text: string;
  date: string;
  plantType: number;
}

interface GardenData {
  entries: GardenEntry[];
}

const STORAGE_KEY = "mindmitra_gratitude_garden_v1";
const TOTAL_GRATITUDES = 3;

const PROMPTS = [
  "A person who helped you today...",
  "Something about your chai or coffee this morning...",
  "One small thing that went right today...",
  "A memory from home that makes you smile...",
  "Something about your college or hostel...",
  "A meal you enjoyed recently...",
  "Something kind someone said to you...",
  "A subject or topic you found interesting...",
  "A friend who made you laugh recently...",
  "Something in nature you noticed today...",
  "Something you're good at that you appreciate...",
  "A song that lifted your mood today...",
] as const;

const PLANT_COLORS = [
  { stem: "#22c55e", flower: "#f472b6", center: "#facc15" },
  { stem: "#16a34a", flower: "#c084fc", center: "#fb923c" },
  { stem: "#15803d", flower: "#f87171", center: "#fbbf24" },
  { stem: "#059669", flower: "#60a5fa", center: "#f9a8d4" },
  { stem: "#0d9488", flower: "#fbbf24", center: "#fb7185" },
  { stem: "#166534", flower: "#a78bfa", center: "#34d399" },
] as const;

function loadGarden(): GardenData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    return JSON.parse(raw) as GardenData;
  } catch {
    return { entries: [] };
  }
}

function saveGarden(data: GardenData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 19 || h < 6;
}

function getRotatingPrompt(index: number): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return PROMPTS[(dayOfYear + index) % PROMPTS.length];
}

function PlantSVG({
  type,
  index,
  onClick,
  size = 1,
}: {
  type: number;
  index: number;
  onClick: () => void;
  size?: number;
}) {
  const colors = PLANT_COLORS[type % PLANT_COLORS.length];
  const baseHeight = 30 + (type % 3) * 10;
  const h = baseHeight * size;
  const flowerSize = (6 + (type % 4)) * size;
  const hasLeaves = type % 2 === 0;
  const variant = type % 6;

  return (
    <motion.g
      onClick={onClick}
      className="cursor-pointer"
      initial={{ scaleY: 0, originY: 1 }}
      animate={{ scaleY: 1 }}
      transition={{
        type: "spring",
        damping: 8,
        stiffness: 80,
        delay: index * 0.12,
      }}
      whileHover={{ scale: 1.1 }}
    >
      {/* Stem */}
      <motion.line
        x1="0"
        y1="0"
        x2="0"
        y2={-h}
        stroke={colors.stem}
        strokeWidth={2 * size}
        strokeLinecap="round"
      />
      {/* Leaves */}
      {hasLeaves && (
        <>
          <ellipse
            cx={-6 * size}
            cy={-h * 0.4}
            rx={5 * size}
            ry={2.5 * size}
            fill={colors.stem}
            opacity={0.7}
            transform={`rotate(-30 ${-6 * size} ${-h * 0.4})`}
          />
          <ellipse
            cx={6 * size}
            cy={-h * 0.65}
            rx={5 * size}
            ry={2.5 * size}
            fill={colors.stem}
            opacity={0.7}
            transform={`rotate(30 ${6 * size} ${-h * 0.65})`}
          />
        </>
      )}
      {/* Flower head */}
      {variant < 2 ? (
        // Circular petals
        <>
          {Array.from({ length: 5 }, (_, i) => {
            const angle = (i * 72 - 90) * (Math.PI / 180);
            return (
              <circle
                key={i}
                cx={Math.cos(angle) * flowerSize * 0.6}
                cy={-h + Math.sin(angle) * flowerSize * 0.6}
                r={flowerSize * 0.45}
                fill={colors.flower}
                opacity={0.85}
              />
            );
          })}
          <circle cx={0} cy={-h} r={flowerSize * 0.3} fill={colors.center} />
        </>
      ) : variant < 4 ? (
        // Tulip shape
        <>
          <ellipse
            cx={0}
            cy={-h - flowerSize * 0.2}
            rx={flowerSize * 0.5}
            ry={flowerSize * 0.7}
            fill={colors.flower}
            opacity={0.9}
          />
          <ellipse
            cx={-flowerSize * 0.3}
            cy={-h}
            rx={flowerSize * 0.35}
            ry={flowerSize * 0.55}
            fill={colors.flower}
            opacity={0.7}
          />
          <ellipse
            cx={flowerSize * 0.3}
            cy={-h}
            rx={flowerSize * 0.35}
            ry={flowerSize * 0.55}
            fill={colors.flower}
            opacity={0.7}
          />
        </>
      ) : (
        // Sunflower shape
        <>
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * 45) * (Math.PI / 180);
            return (
              <ellipse
                key={i}
                cx={Math.cos(angle) * flowerSize * 0.55}
                cy={-h + Math.sin(angle) * flowerSize * 0.55}
                rx={flowerSize * 0.3}
                ry={flowerSize * 0.15}
                fill={colors.flower}
                opacity={0.8}
                transform={`rotate(${i * 45} ${Math.cos(angle) * flowerSize * 0.55} ${-h + Math.sin(angle) * flowerSize * 0.55})`}
              />
            );
          })}
          <circle cx={0} cy={-h} r={flowerSize * 0.35} fill={colors.center} />
        </>
      )}
    </motion.g>
  );
}

export default function GratitudeGarden({ onAvatarCue }: GratitudeGardenProps) {
  const [garden, setGarden] = useState<GardenData>(loadGarden);
  const [currentText, setCurrentText] = useState("");
  const [selectedPlant, setSelectedPlant] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const night = isNightTime();

  const todayEntries = useMemo(
    () => garden.entries.filter((e) => e.date.startsWith(todayStr())),
    [garden]
  );

  const todayDone = todayEntries.length >= TOTAL_GRATITUDES;
  const entryIndex = todayEntries.length;

  useEffect(() => {
    if (todayDone && !completed) {
      setCompleted(true);
    }
  }, [todayDone, completed]);

  useEffect(() => {
    onAvatarCue?.(
      todayDone
        ? "Your garden is looking beautiful today! Come back tomorrow to plant more."
        : "Let's grow your gratitude garden. What are you thankful for today?",
      todayDone ? "happy" : "warm"
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!currentText.trim() || todayDone) return;

    const entry: GardenEntry = {
      text: currentText.trim(),
      date: new Date().toISOString(),
      plantType: (garden.entries.length + Math.floor(Math.random() * 3)) % PLANT_COLORS.length,
    };

    const updated: GardenData = {
      entries: [...garden.entries, entry],
    };
    saveGarden(updated);
    setGarden(updated);
    setCurrentText("");
    incrementMindGymCounter("gratitude_entries", 1);

    const newCount = todayEntries.length + 1;
    if (newCount >= TOTAL_GRATITUDES) {
      onAvatarCue?.("You've planted all 3 today! Your garden is growing beautifully.", "proud");
    } else {
      onAvatarCue?.(`${TOTAL_GRATITUDES - newCount} more to go. Keep planting!`, "encouraging");
    }
  }, [currentText, garden, todayDone, todayEntries.length, onAvatarCue]);

  const handleReset = useCallback(() => {
    setCompleted(false);
    setSelectedPlant(null);
  }, []);

  const gardenWidth = 600;
  const gardenHeight = 300;

  const plantPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = [];
    const total = garden.entries.length;
    const cols = Math.ceil(Math.sqrt(total * 2));
    const spacing = gardenWidth / (cols + 1);

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = spacing * (col + 1) + (row % 2 === 0 ? 0 : spacing / 2);
      const y = gardenHeight - 20 - row * 35;
      positions.push({
        x: Math.min(Math.max(x, 30), gardenWidth - 30),
        y: Math.min(Math.max(y, 60), gardenHeight - 15),
      });
    }
    return positions;
  }, [garden.entries.length]);

  return (
    <ToolShell
      toolId="gratitude-garden"
      title="Gratitude Garden"
      clinicalBasis="Gratitude journaling (Emmons & McCullough, 2003) increases well-being, reduces depression, and improves sleep quality. Regular practice strengthens neural pathways for positive emotion."
      xp={30}
      themeColor="from-[#0b1c1c] via-[#183a37] to-[#0b1c1c]"
      completed={completed}
      onReset={handleReset}
      totalSteps={TOTAL_GRATITUDES}
      currentStep={entryIndex}
      onAvatarCue={onAvatarCue}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Garden visualization */}
        <motion.div
          className="relative rounded-2xl overflow-hidden mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <svg
            viewBox={`0 0 ${gardenWidth} ${gardenHeight}`}
            className="w-full"
            style={{ minHeight: 200 }}
          >
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                {night ? (
                  <>
                    <stop offset="0%" stopColor="#0c0a12" />
                    <stop offset="100%" stopColor="#1a1530" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#1e1b2e" />
                    <stop offset="100%" stopColor="#1a2332" />
                  </>
                )}
              </linearGradient>
              <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a2e1a" />
                <stop offset="100%" stopColor="#0f1a0f" />
              </linearGradient>
            </defs>

            {/* Sky */}
            <rect width={gardenWidth} height={gardenHeight} fill="url(#skyGrad)" />

            {/* Stars (night) or sun glow (day) */}
            {night ? (
              <>
                {Array.from({ length: 20 }, (_, i) => (
                  <motion.circle
                    key={`star-${i}`}
                    cx={30 + (i * 97) % (gardenWidth - 60)}
                    cy={10 + (i * 53) % 80}
                    r={0.8 + (i % 3) * 0.4}
                    fill="white"
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{
                      duration: 2 + (i % 3),
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
                <Moon
                  x={gardenWidth - 60}
                  y={15}
                  className="text-yellow-200/60"
                  width={28}
                  height={28}
                />
              </>
            ) : (
              <>
                <circle
                  cx={gardenWidth - 50}
                  cy={40}
                  r={18}
                  fill="#fbbf24"
                  opacity={0.15}
                />
                <circle
                  cx={gardenWidth - 50}
                  cy={40}
                  r={10}
                  fill="#fbbf24"
                  opacity={0.3}
                />
                <Sun
                  x={gardenWidth - 62}
                  y={28}
                  className="text-yellow-400/40"
                  width={24}
                  height={24}
                />
              </>
            )}

            {/* Ground */}
            <ellipse
              cx={gardenWidth / 2}
              cy={gardenHeight + 30}
              rx={gardenWidth * 0.7}
              ry={80}
              fill="url(#groundGrad)"
            />
            <line
              x1={0}
              y1={gardenHeight - 10}
              x2={gardenWidth}
              y2={gardenHeight - 10}
              stroke="#22543d"
              strokeWidth={0.5}
              opacity={0.3}
            />

            {/* Plants */}
            {garden.entries.map((entry, i) => {
              const pos = plantPositions[i];
              if (!pos) return null;
              return (
                <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                  <PlantSVG
                    type={entry.plantType}
                    index={i}
                    onClick={() => setSelectedPlant(i)}
                    size={0.8 + Math.min(i * 0.02, 0.4)}
                  />
                </g>
              );
            })}

            {/* Empty garden message */}
            {garden.entries.length === 0 && (
              <text
                x={gardenWidth / 2}
                y={gardenHeight / 2}
                textAnchor="middle"
                fill="rgba(255,255,255,0.2)"
                fontSize="14"
              >
                Your garden is waiting to grow...
              </text>
            )}
          </svg>

          {/* Plant count badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-xs text-white/60">
            <Flower2 className="w-3 h-3 text-green-400" />
            {garden.entries.length} plant{garden.entries.length !== 1 ? "s" : ""}
          </div>
        </motion.div>

        {/* Selected plant detail */}
        <AnimatePresence>
          {selectedPlant !== null && garden.entries[selectedPlant] && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white/80 leading-relaxed">
                    &ldquo;{garden.entries[selectedPlant].text}&rdquo;
                  </p>
                  <p className="text-[11px] text-white/30 mt-2">
                    Planted on{" "}
                    {new Date(garden.entries[selectedPlant].date).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlant(null)}
                  className="text-white/30 hover:text-white/60 transition-colors mt-0.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input section */}
        {todayDone ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="w-8 h-8 text-green-400" />
            </motion.div>
            <h3 className="text-lg font-medium text-white mb-2">
              Today&apos;s garden is complete!
            </h3>
            <p className="text-white/40 text-sm">
              Come back tomorrow to plant more gratitude.
            </p>
            <p className="text-white/30 text-xs mt-4">
              Click any plant above to revisit your past entries.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {Array.from({ length: TOTAL_GRATITUDES }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      i < entryIndex
                        ? "bg-green-400"
                        : i === entryIndex
                        ? "bg-green-400/50"
                        : "bg-white/10"
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-white/40">
                {entryIndex} of {TOTAL_GRATITUDES} — plant {TOTAL_GRATITUDES - entryIndex} more today
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-sm text-white/50 mb-3 italic">
                {getRotatingPrompt(entryIndex)}
              </p>
              <textarea
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                placeholder="I'm grateful for..."
                className="w-full h-24 bg-transparent text-white placeholder:text-white/25 resize-none focus:outline-none text-sm leading-relaxed"
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-white/20">
                  {currentText.length}/500
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!currentText.trim()}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    currentText.trim()
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Plant
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled
                  className="text-xs px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
                  title="Coming soon"
                >
                  Share anonymously (coming soon)
                </button>
                <span className="text-[11px] text-white/25">
                  Weekly garden snapshot reminders: coming soon
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </ToolShell>
  );
}
