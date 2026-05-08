import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, BookOpen, RotateCcw, Volume2, VolumeX, CloudRain, Trees, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface TherapeuticGameShellProps {
  title: string;
  gameId: string;
  xp?: number;
  completed?: boolean;
  onReset?: () => void;
  children: ReactNode;
  themePhase?: "idle" | "focus" | "success" | "alert";
  streakCount?: number;
  fitViewport?: boolean;
}

const AMBIENT_BG: Record<string, string> = {
  idle: "from-[#0b1120] via-[#0e1829] to-[#0a1322]",
  focus: "from-[#091e2d] via-[#0c2838] to-[#071c2e]",
  success: "from-[#0e1833] via-[#111d3a] to-[#0c162e]",
  alert: "from-[#2a1315] via-[#1a0e10] to-[#120a0b]", // Gentle alert
};

const THEME_AFFIRMATIONS = [
  "You are doing your best, and that is enough.",
  "Every small step is progress.",
  "Let go of perfection. Be here now.",
  "Your mind is a sky; thoughts are just clouds passing by.",
  "Breathe in calm, breathe out tension.",
];

// Reusable gentle particle system
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2.5 + 1,
  duration: Math.random() * 25 + 18,
  delay: Math.random() * 12,
  opacity: Math.random() * 0.25 + 0.08,
}));

type AudioTrack = "none" | "brown-noise" | "rain" | "forest";

// Audio Hook for ambient noise
function useAmbientAudio(track: AudioTrack) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  
  // Clean up
  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
      ctxRef.current?.close();
    } catch {
      /* stop/close may throw if already stopped */
    }
    ctxRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    filterRef.current = null;
  }, []);

  const generateBrownNoise = useCallback((ctx: AudioContext) => {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastSample = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastSample + (0.02 * white)) / 1.02;
        lastSample = data[i];
        data[i] *= 3.5; 
    }
    return buffer;
  }, []);

  useEffect(() => {
    stop();
    if (track === "none") return;
    
    // For now, implement Generative Brown Noise. 
    // Wait for explicit mp3s for rain/forest or use varying generators
    // Here we'll treat rain/forest as variations of brown noise if no mp3s exist
    
    try {
      const ctx = new AudioContext();
      const buffer = generateBrownNoise(ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      
      if (track === "rain") {
        filter.frequency.setValueAtTime(800, ctx.currentTime);
      } else if (track === "forest") {
        filter.frequency.setValueAtTime(400, ctx.currentTime);
      } else {
        // deep brown noise
        filter.frequency.setValueAtTime(200, ctx.currentTime);
      }
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime); // Keep it very subtle

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      ctxRef.current = ctx;
      sourceRef.current = source;
      gainRef.current = gain;
      filterRef.current = filter;
    } catch (e) {
      console.warn("AudioContext failed", e);
    }

    return () => stop();
  }, [track, stop, generateBrownNoise]);

  return { stop };
}

export default function TherapeuticGameShell({
  title,
  gameId,
  xp = 10,
  completed = false,
  onReset,
  children,
  themePhase = "idle",
  streakCount = 1,
  fitViewport = false,
}: TherapeuticGameShellProps) {
  const navigate = useNavigate();
  const [audioTrack, setAudioTrack] = useState<AudioTrack>("none");
  const [quoteIdx, setQuoteIdx] = useState(0);

  useAmbientAudio(audioTrack);

  // Rotate affirmations
  useEffect(() => {
    if (completed) return;
    const int = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % THEME_AFFIRMATIONS.length);
    }, 15000);
    return () => clearInterval(int);
  }, [completed]);

  return (
    <div className={`relative ${fitViewport ? "flex h-screen flex-col" : "min-h-screen"} bg-gradient-to-b ${AMBIENT_BG[themePhase]} transition-colors duration-1000 overflow-hidden font-sans text-white/90`}>
      {/* Particle Overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-40">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white blur-[1px]"
            style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, opacity: p.opacity }}
            animate={{
              y: [0, -40, -80, -120],
              x: p.id % 2 === 0 ? [0, 10, -10, 0] : [0, -15, 15, 0],
              opacity: [0, p.opacity, p.opacity, 0],
            }}
            transition={{ duration: p.duration, repeat: Infinity, ease: "linear", delay: p.delay }}
          />
        ))}
      </div>

      {/* Top Navigation Pill */}
      <div className="pt-safe pb-2 px-4 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 shadow-lg mt-4">
          <button
            onClick={() => navigate("/mindgym")}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">MindGym</span>
          </button>

          <span className="text-sm font-semibold tracking-wide text-white/90 truncate max-w-[40%]">
            {title}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioTrack(prev => {
                if (prev === "none") return "brown-noise";
                if (prev === "brown-noise") return "rain";
                if (prev === "rain") return "forest";
                return "none";
              })}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-colors"
            >
                {audioTrack === "none" && <VolumeX className="w-4 h-4 text-white/50" />}
                {audioTrack === "brown-noise" && <Wind className="w-4 h-4 text-teal-400" />}
                {audioTrack === "rain" && <CloudRain className="w-4 h-4 text-blue-400" />}
                {audioTrack === "forest" && <Trees className="w-4 h-4 text-green-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* Rotating Affirmation */}
      <AnimatePresence mode="wait">
        {!completed && (
          <motion.div
            key={quoteIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 1 }}
            className={`max-w-2xl mx-auto px-6 text-center z-20 relative ${fitViewport ? "mt-2" : "mt-6"}`}
          >
            <p className="text-xs text-white/40 italic tracking-wide">
              {THEME_AFFIRMATIONS[quoteIdx]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <main className={`max-w-2xl mx-auto px-4 z-10 relative relative flex w-full flex-col justify-center ${fitViewport ? "min-h-0 flex-1 overflow-hidden pt-3 pb-4" : "min-h-[60vh] pt-6 pb-24"}`}>
        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="completion"
              className="flex flex-col items-center justify-center py-12"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 40, damping: 38, mass: 1.2 }}
            >
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                <Star className="w-12 h-12 text-teal-300 drop-shadow-lg" />
              </div>
              
              <h2 className="text-3xl font-light tracking-wide mb-2 text-white">Well done.</h2>
              <p className="text-white/60 mb-8 max-w-sm text-center">
                Take a moment to notice how your mind and body feel right now.
              </p>

              <div className="flex gap-4 mb-10">
                 <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[12px] text-white/45 font-medium mb-1">Gentle points</p>
                    <p className="text-2xl font-medium text-teal-300">+{xp}</p>
                 </div>
                 <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[12px] text-white/45 font-medium mb-1">Visits in a row</p>
                    <p className="text-2xl font-medium text-orange-300">{streakCount}</p>
                 </div>
              </div>

              <div className="space-y-3 w-full max-w-xs">
                {onReset && (
                  <Button
                    onClick={onReset}
                    variant="ghost"
                    className="w-full rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm h-14 text-base"
                  >
                    <RotateCcw className="w-5 h-5 mr-3" />
                    Try again
                  </Button>
                )}
                <Button
                  onClick={() => navigate("/journal")}
                  className="w-full rounded-full border border-teal-500/30 bg-teal-500/20 hover:bg-teal-500/30 text-teal-100 backdrop-blur-sm h-14 text-base font-medium transition-colors duration-base"
                >
                  <BookOpen className="w-5 h-5 mr-3" />
                  Write in journal
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ type: "spring", stiffness: 44, damping: 38, mass: 1.15 }}
              className="w-full"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
