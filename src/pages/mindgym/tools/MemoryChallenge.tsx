import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Volume2, VolumeX, Eye, Target, Sparkles, Zap } from "lucide-react";
import TherapeuticGameShell from "@/components/mindgym/TherapeuticGameShell";
import { useGameDataSaver } from "@/lib/gameDataSaver";
import memoryBuddyImg from "@/assets/memory-buddy.png";

type Mode = "classic" | "snapshot";
type Phase = "ready" | "countdown" | "showing" | "playing" | "feedback" | "finished";
type BuddyMood = "idle" | "happy" | "thinking" | "celebrate" | "oops" | "hint";

const GRID = 9;
const LIVES = 3;
const BASE_FLASH_MS = 600;
const MIN_FLASH_MS = 320;
const COMBO_MULTIPLIERS = [1, 1.5, 2, 3] as const;
const MAX_COMBO = COMBO_MULTIPLIERS.length;

// C major pentatonic over two octaves — soft, no dissonance.
const TILE_FREQS = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.26, 783.99];
// Hues sweep within the catalog gradient family (cyan → teal → emerald).
const TILE_HUES = [188, 178, 168, 195, 173, 158, 192, 165, 152];

const POSITION_LABELS = [
  "top left", "top center", "top right",
  "middle left", "middle center", "middle right",
  "bottom left", "bottom center", "bottom right",
];

const STORAGE = {
  best: "memoryChallengeBestScore",
  muted: "memoryChallengeMuted",
  streak: "memoryChallengeStreak",
} as const;

function flashMsForLevel(level: number): number {
  if (level <= 4) return BASE_FLASH_MS;
  if (level <= 7) return Math.max(MIN_FLASH_MS, BASE_FLASH_MS - (level - 4) * 70);
  return MIN_FLASH_MS;
}

function comboMultiplier(combo: number): number {
  return COMBO_MULTIPLIERS[Math.min(combo, MAX_COMBO) - 1] ?? 1;
}

function generateSequence(level: number, mode: Mode): number[] {
  if (mode === "classic") {
    const length = level + 2;
    const seq: number[] = [];
    let last = -1;
    for (let i = 0; i < length; i++) {
      let next = Math.floor(Math.random() * GRID);
      if (next === last) next = (next + 1 + Math.floor(Math.random() * (GRID - 1))) % GRID;
      seq.push(next);
      last = next;
    }
    return seq;
  }
  const count = Math.min(3 + Math.floor(level / 2), 7);
  const all = Array.from({ length: GRID }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

function useTone(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastRef = useRef<{ freq: number; t: number }>({ freq: 0, t: 0 });

  const play = useCallback(
    (freq: number, durationMs = 320, gain = 0.16) => {
      if (muted) return;
      const now = performance.now();
      if (lastRef.current.freq === freq && now - lastRef.current.t < 80) return;
      lastRef.current = { freq, t: now };
      try {
        if (!ctxRef.current) {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) return;
          ctxRef.current = new Ctor();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + durationMs / 1000 + 0.05);
      } catch {
        /* audio unavailable — silently degrade */
      }
    },
    [muted],
  );

  useEffect(
    () => () => {
      ctxRef.current?.close().catch(() => {});
    },
    [],
  );

  return play;
}

interface TileProps {
  index: number;
  isActive: boolean;
  isWrong: boolean;
  isHint: boolean;
  isClickable: boolean;
  onClick: () => void;
  reduceMotion: boolean;
}

function Tile({ index, isActive, isWrong, isHint, isClickable, onClick, reduceMotion }: TileProps) {
  const hue = TILE_HUES[index];
  const style: CSSProperties = {
    background: isActive
      ? `radial-gradient(circle at 50% 40%, hsla(${hue}, 85%, 72%, 0.95), hsla(${hue}, 70%, 45%, 0.55))`
      : isWrong
        ? "radial-gradient(circle at 50% 40%, hsla(0, 78%, 65%, 0.78), hsla(0, 65%, 38%, 0.5))"
        : isHint
          ? "radial-gradient(circle at 50% 40%, hsla(150, 70%, 62%, 0.72), hsla(150, 55%, 38%, 0.45))"
          : undefined,
    boxShadow: isActive
      ? `0 0 32px hsla(${hue}, 85%, 60%, 0.55), inset 0 0 22px hsla(${hue}, 90%, 75%, 0.3)`
      : isWrong
        ? "0 0 26px hsla(0, 80%, 55%, 0.5)"
        : isHint
          ? "0 0 26px hsla(150, 70%, 45%, 0.45)"
          : undefined,
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-label={`Tile ${index + 1}, ${POSITION_LABELS[index]}`}
      whileHover={isClickable && !reduceMotion ? { scale: 1.04 } : undefined}
      whileTap={isClickable && !reduceMotion ? { scale: 0.94 } : undefined}
      animate={
        reduceMotion
          ? undefined
          : isActive
            ? { scale: 1.06 }
            : { scale: 1 }
      }
      transition={{ duration: 0.2 }}
      className={`relative aspect-square rounded-2xl border backdrop-blur-sm overflow-hidden transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70 ${
        isActive
          ? "border-white/30"
          : isWrong
            ? "border-red-300/40"
            : isHint
              ? "border-emerald-300/40"
              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
      }`}
      style={style}
    >
      <span className="absolute top-1.5 left-2 text-[10px] font-medium text-white/25 select-none pointer-events-none">
        {index + 1}
      </span>
      {isActive && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ opacity: 0.7, scale: 0.55 }}
          animate={{ opacity: 0, scale: 1.25 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{
            background: `radial-gradient(circle, hsla(${hue}, 95%, 75%, 0.4), transparent 70%)`,
          }}
        />
      )}
    </motion.button>
  );
}

interface ModeCardProps {
  active: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

function ModeCard({ active, title, subtitle, icon, onSelect }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`text-left p-4 rounded-2xl border transition-all duration-300 ${
        active
          ? "bg-teal-500/15 border-teal-400/50 shadow-[0_0_18px_rgba(20,184,166,0.22)]"
          : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={active ? "text-teal-300" : "text-white/60"}>{icon}</span>
        <span className={`text-sm font-medium tracking-wide ${active ? "text-teal-100" : "text-white/85"}`}>
          {title}
        </span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{subtitle}</p>
    </button>
  );
}

interface MemoryBuddyProps {
  mood: BuddyMood;
  message: string;
  progress: number;
  reduceMotion: boolean;
}

interface MemoryAvatarStageProps {
  mood: BuddyMood;
  reduceMotion: boolean;
}

const BUDDY_AVATAR_URL = "/talkinghead/avatars/Valentina.glb";

type BuddyAvatarEmotion =
  | "calm"
  | "listening"
  | "acknowledgment"
  | "encouragement"
  | "concern"
  | "surprised";
type BuddyAvatarGesture = "slow_nod" | "lean_forward" | "thinking_tilt" | "agreement_nod";

interface BuddyAvatarCue {
  emotion: BuddyAvatarEmotion;
  intensity: number;
  gesture: BuddyAvatarGesture | null;
  flashEmotion?: BuddyAvatarEmotion;
  flashIntensity?: number;
}

function avatarCueForBuddyMood(mood: BuddyMood): BuddyAvatarCue {
  switch (mood) {
    case "celebrate":
      return { emotion: "encouragement", intensity: 1.45, gesture: "agreement_nod" };
    case "happy":
      return { emotion: "encouragement", intensity: 1.3, gesture: "agreement_nod" };
    case "oops":
      return {
        emotion: "concern",
        intensity: 1.35,
        gesture: "lean_forward",
        flashEmotion: "surprised",
        flashIntensity: 1.28,
      };
    case "thinking":
      return { emotion: "acknowledgment", intensity: 1.18, gesture: "slow_nod" };
    case "hint":
      return { emotion: "listening", intensity: 1.08, gesture: "thinking_tilt" };
    case "idle":
    default:
      return { emotion: "calm", intensity: 1, gesture: null };
  }
}

function MemoryAvatarStage({ mood, reduceMotion }: MemoryAvatarStageProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const lastGestureKeyRef = useRef<string | null>(null);
  const emotionSettleTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      avatarUrl: BUDDY_AVATAR_URL,
      cameraView: "head",
      transparent: "1",
      ttsLang: "en-IN",
      ttsVoice: "en-IN-Neural2-A",
    });
    return `/talkinghead.html?${params.toString()}`;
  }, []);

  const postToAvatar = useCallback((data: object) => {
    iframeRef.current?.contentWindow?.postMessage(data, window.location.origin);
  }, []);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      if (!isReady) setLoadFailed(true);
    }, 8000);
    return () => window.clearTimeout(fallbackTimer);
  }, [isReady]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type } = event.data || {};
      if (type === "needConfig") {
        postToAvatar({
          type: "config",
          googleKey: "",
          azureKey: "",
          azureRegion: "eastasia",
        });
      }
      if (type === "ready") {
        setIsReady(true);
        setLoadFailed(false);
      }
      if (type === "error") {
        setLoadFailed(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postToAvatar]);

  useEffect(() => {
    if (!isReady || loadFailed) return;
    const cue = avatarCueForBuddyMood(mood);
    if (emotionSettleTimerRef.current) {
      window.clearTimeout(emotionSettleTimerRef.current);
      emotionSettleTimerRef.current = null;
    }

    postToAvatar({
      type: "setEmotion",
      emotion: cue.flashEmotion ?? cue.emotion,
      intensity: cue.flashIntensity ?? cue.intensity,
    });

    if (cue.flashEmotion) {
      emotionSettleTimerRef.current = window.setTimeout(() => {
        postToAvatar({
          type: "setEmotion",
          emotion: cue.emotion,
          intensity: cue.intensity,
        });
        emotionSettleTimerRef.current = null;
      }, 720);
    }

    const gesture = reduceMotion ? null : cue.gesture;
    const gestureKey = `${mood}:${gesture ?? "none"}`;
    if (gesture && gestureKey !== lastGestureKeyRef.current) {
      lastGestureKeyRef.current = gestureKey;
      postToAvatar({ type: "triggerGesture", gesture });
    }
  }, [isReady, loadFailed, mood, postToAvatar, reduceMotion]);

  useEffect(
    () => () => {
      if (emotionSettleTimerRef.current) {
        window.clearTimeout(emotionSettleTimerRef.current);
      }
      postToAvatar({ type: "pause" });
    },
    [postToAvatar],
  );

  return (
    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_14px_24px_rgba(20,184,166,0.16)] sm:w-28">
      {!loadFailed && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="3D memory buddy"
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${
            isReady ? "opacity-100" : "opacity-0"
          }`}
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin"
          style={{ backgroundColor: "transparent" }}
        />
      )}

      {(!isReady || loadFailed) && (
        <img
          src={memoryBuddyImg}
          alt="Memory buddy"
          className="absolute inset-0 h-full w-full object-contain p-1.5 drop-shadow-[0_14px_22px_rgba(20,184,166,0.18)]"
        />
      )}

      {!isReady && !loadFailed && (
        <span
          className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-teal-300 ring-2 ring-[#0b1120]/80 ${
            reduceMotion ? "" : "animate-pulse"
          }`}
        />
      )}
    </div>
  );
}

function MemoryBuddy({ mood, message, progress, reduceMotion }: MemoryBuddyProps) {
  const [displayed, setDisplayed] = useState("");
  const [confetti, setConfetti] = useState<number[]>([]);
  const safeProgress = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(message);
      return;
    }
    setDisplayed("");
    let index = 0;
    const id = window.setInterval(() => {
      index += 1;
      setDisplayed(message.slice(0, index));
      if (index >= message.length) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [message, reduceMotion]);

  useEffect(() => {
    if (mood !== "celebrate" || reduceMotion) return;
    setConfetti(Array.from({ length: 24 }, (_, i) => i));
    const id = window.setTimeout(() => setConfetti([]), 2200);
    return () => window.clearTimeout(id);
  }, [mood, reduceMotion]);

  const statusClass =
    mood === "thinking" || mood === "hint"
      ? "bg-amber-300"
      : mood === "oops"
        ? "bg-rose-300"
        : "bg-emerald-300";

  const botAnimate = reduceMotion
    ? undefined
    : mood === "oops"
      ? { x: [0, -5, 5, -3, 3, 0] }
      : mood === "celebrate"
        ? { y: [0, -6, 0], rotate: [-2, 2, -2], scale: [1, 1.03, 1] }
        : { y: [0, -4, 0], rotate: [-1, 1, -1] };

  return (
    <div className="relative w-full">
      {confetti.map((item) => {
        const colors = ["#5eead4", "#fda4af", "#fde68a", "#93c5fd", "#86efac"];
        return (
          <motion.span
            key={item}
            className="pointer-events-none absolute top-4 z-20 h-2 w-2 rounded-sm"
            style={{ left: `${(item * 37) % 96}%`, background: colors[item % colors.length] }}
            initial={{ y: -12, opacity: 1, rotate: 0 }}
            animate={{ y: 180, opacity: 0, rotate: 520 }}
            transition={{ duration: 1.8, delay: (item % 8) * 0.08, ease: "easeIn" }}
          />
        );
      })}

      <div className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-2xl backdrop-blur-xl sm:gap-3">
        <motion.div
          className="relative shrink-0"
          animate={botAnimate}
          transition={
            mood === "oops"
              ? { duration: 0.42 }
              : { duration: 4.6, ease: "easeInOut", repeat: Infinity }
          }
        >
          <MemoryAvatarStage mood={mood} reduceMotion={reduceMotion} />
          <span
            className={`absolute bottom-1 right-1 h-3 w-3 rounded-full ${statusClass} ring-2 ring-[#0b1120]/80 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </motion.div>

        <div className="relative min-w-0 flex-1">
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-lg">
            <div className="absolute left-[-5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-white/[0.04]" />
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Buddy / {mood}
              </span>
              <span className="text-[10px] font-bold text-teal-200">{Math.round(safeProgress * 100)}%</span>
            </div>
            <p className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-snug text-white/75 sm:text-sm">
              {displayed}
              {!reduceMotion && <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-teal-200 align-middle" />}
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-teal-400"
                initial={false}
                animate={{ width: `${safeProgress * 100}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.55 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HudProps {
  level: number;
  lives: number;
  combo: number;
  score: number;
  phase: Phase;
  showingProgress: number;
  playProgress: number;
  reduceMotion: boolean;
}

function Hud({ level, lives, combo, score, phase, showingProgress, playProgress, reduceMotion }: HudProps) {
  const hint =
    phase === "showing"
      ? "Watch"
      : phase === "playing"
        ? "Your turn"
        : phase === "feedback"
          ? "Breathe — the pattern returns"
          : "";
  const progress = phase === "showing" ? showingProgress : playProgress;
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="text-center min-w-[3.5rem]">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Level</p>
          <p className="text-2xl font-light text-white/90 leading-none mt-0.5">{level}</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5" aria-label={`${lives} of ${LIVES} tries remaining`}>
            {Array.from({ length: LIVES }).map((_, i) => {
              const filled = i < lives;
              return (
                <motion.span
                  key={i}
                  initial={false}
                  animate={
                    reduceMotion
                      ? undefined
                      : { scale: filled ? 1 : 0.85, opacity: filled ? 1 : 0.35 }
                  }
                  transition={{ duration: 0.25 }}
                >
                  <Heart
                    className={`h-4 w-4 ${filled ? "text-rose-300 fill-rose-400/80" : "text-white/20"}`}
                  />
                </motion.span>
              );
            })}
          </div>
          <p
            className={`text-xs font-medium tracking-wide ${
              phase === "feedback" ? "text-rose-200" : "text-teal-300"
            }`}
          >
            {hint}
          </p>
        </div>
        <div className="text-center min-w-[3.5rem]">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">XP</p>
          <p className="text-2xl font-light text-white/90 leading-none mt-0.5">{score}</p>
        </div>
      </div>
      <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            phase === "feedback" ? "bg-rose-300/70" : "bg-teal-400"
          }`}
          initial={false}
          animate={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.3 }}
        />
      </div>
      {combo >= 2 && phase !== "feedback" && (
        <div className="flex items-center justify-center gap-1.5 text-[11px]">
          <Zap className="h-3 w-3 text-amber-300" />
          <span className="text-amber-200/90 font-medium tracking-wide">
            ×{comboMultiplier(combo)} combo
          </span>
        </div>
      )}
    </div>
  );
}

const MemoryChallenge = () => {
  const { saveMemoryChallenge } = useGameDataSaver();
  const reducedMotionPref = useReducedMotion();
  const reduceMotion = !!reducedMotionPref;

  const winAudio = useRef<HTMLAudioElement | null>(null);
  const wrongAudio = useRef<HTMLAudioElement | null>(null);
  const flipAudio = useRef<HTMLAudioElement | null>(null);
  const matchAudio = useRef<HTMLAudioElement | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [mode, setMode] = useState<Mode>("classic");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [snapshotRemaining, setSnapshotRemaining] = useState<Set<number>>(() => new Set());
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [combo, setCombo] = useState(1);
  const [mistakesThisRun, setMistakesThisRun] = useState(0);
  const [maxSequenceReached, setMaxSequenceReached] = useState(0);
  const [activeTiles, setActiveTiles] = useState<number[]>([]);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [hintTile, setHintTile] = useState<number | null>(null);
  const [showingIndex, setShowingIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [bestScore, setBestScore] = useState(0);
  const [streakCount, setStreakCount] = useState(1);
  const [muted, setMuted] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [endLine, setEndLine] = useState("");

  const startTimeRef = useRef<number>(0);
  const playTone = useTone(muted);

  useEffect(() => {
    winAudio.current = new Audio("/sounds/win.mp3");
    wrongAudio.current = new Audio("/sounds/wrong.mp3");
    flipAudio.current = new Audio("/sounds/flip.mp3");
    matchAudio.current = new Audio("/sounds/match.mp3");
    [winAudio, wrongAudio, flipAudio, matchAudio].forEach((r) => {
      if (r.current) r.current.volume = 0.5;
    });

    const savedBest = window.localStorage.getItem(STORAGE.best);
    if (savedBest) setBestScore(Number(savedBest) || 0);

    const savedMute = window.localStorage.getItem(STORAGE.muted);
    if (savedMute === "1") setMuted(true);

    try {
      const raw = window.localStorage.getItem(STORAGE.streak);
      if (raw) {
        const data = JSON.parse(raw) as { count: number; date: string };
        const today = todayKey();
        const yKey = yesterdayKey();
        if (data.date === today || data.date === yKey) setStreakCount(data.count || 1);
        else setStreakCount(1);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      window.localStorage.setItem(STORAGE.best, String(score));
    }
  }, [score, bestScore]);

  const playSfx = useCallback(
    (ref: MutableRefObject<HTMLAudioElement | null>) => {
      if (muted) return;
      const el = ref.current;
      if (!el) return;
      el.currentTime = 0;
      el.play().catch(() => {});
    },
    [muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE.muted, next ? "1" : "0");
      return next;
    });
  }, []);

  // Countdown — also re-used to launch next-level sequences (with countdown=0).
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      const seq = generateSequence(level, mode);
      setSequence(seq);
      setPlayerSequence([]);
      setSnapshotRemaining(new Set(seq));
      setSnapshotTotal(seq.length);
      setShowingIndex(0);
      setLiveMessage(mode === "classic" ? "Watch the pattern" : "Memorise the pattern");
      setPhase("showing");
      return;
    }
    setLiveMessage(`Starting in ${countdown}`);
    const timer = window.setTimeout(() => {
      playTone(330 + (3 - countdown) * 110, 150, 0.1);
      setCountdown((c) => c - 1);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, level, mode, playTone]);

  // Showing — Classic: one-by-one with optional distractor / pair flashes.
  useEffect(() => {
    if (phase !== "showing" || mode !== "classic") return;
    if (showingIndex >= sequence.length) {
      const t = window.setTimeout(() => {
        setActiveTiles([]);
        setLiveMessage("Your turn");
        setPhase("playing");
      }, 480);
      return () => window.clearTimeout(t);
    }

    const flashMs = flashMsForLevel(level);
    const idx = sequence[showingIndex];
    const inMiddle = showingIndex > 0 && showingIndex < sequence.length - 1;

    let distractor: number | null = null;
    if (level >= 8 && inMiddle && Math.random() < 0.25) {
      const candidates = Array.from({ length: GRID }, (_, i) => i).filter((i) => !sequence.includes(i));
      if (candidates.length) distractor = candidates[Math.floor(Math.random() * candidates.length)];
    }

    let isPair = false;
    let companion: number | null = null;
    if (level >= 10 && inMiddle && Math.random() < 0.3) {
      companion = sequence[showingIndex + 1];
      isPair = true;
    }
    const flashSet = isPair && companion !== null ? [idx, companion] : [idx];

    let cleanup: number | null = null;
    let nextTimer: number | null = null;
    const lead = window.setTimeout(() => {
      if (distractor !== null) {
        setActiveTiles([distractor]);
        playTone(160, 110, 0.05);
        cleanup = window.setTimeout(() => {
          setActiveTiles(flashSet);
          flashSet.forEach((t) => playTone(TILE_FREQS[t], flashMs, 0.16));
          playSfx(flipAudio);
          nextTimer = window.setTimeout(() => {
            setActiveTiles([]);
            setShowingIndex((i) => i + (isPair ? 2 : 1));
          }, flashMs);
        }, 200);
      } else {
        setActiveTiles(flashSet);
        flashSet.forEach((t) => playTone(TILE_FREQS[t], flashMs, 0.16));
        playSfx(flipAudio);
        nextTimer = window.setTimeout(() => {
          setActiveTiles([]);
          setShowingIndex((i) => i + (isPair ? 2 : 1));
        }, flashMs);
      }
    }, 280);

    return () => {
      window.clearTimeout(lead);
      if (cleanup) window.clearTimeout(cleanup);
      if (nextTimer) window.clearTimeout(nextTimer);
    };
  }, [phase, mode, showingIndex, sequence, level, playTone, playSfx]);

  // Showing — Snapshot: flash the whole pattern at once.
  useEffect(() => {
    if (phase !== "showing" || mode !== "snapshot") return;
    if (sequence.length === 0) return;
    const showMs = 1100 + level * 150;
    setActiveTiles(sequence);
    sequence.forEach((t, i) =>
      window.setTimeout(() => playTone(TILE_FREQS[t], 220, 0.13), i * 35),
    );
    playSfx(flipAudio);
    const t = window.setTimeout(() => {
      setActiveTiles([]);
      setLiveMessage("Tap the tiles you saw");
      setPhase("playing");
    }, showMs);
    return () => window.clearTimeout(t);
  }, [phase, mode, sequence, level, playTone, playSfx]);

  // Feedback — alert window, then either replay or finish.
  useEffect(() => {
    if (phase !== "feedback") return;
    setLiveMessage("Missed — the pattern returns");
    playSfx(wrongAudio);
    const t = window.setTimeout(() => {
      setWrongTile(null);
      setHintTile(null);
      if (lives <= 0) {
        setPhase("finished");
      } else {
        setPlayerSequence([]);
        setSnapshotRemaining(new Set(sequence));
        setShowingIndex(0);
        setPhase("showing");
      }
    }, 1300);
    return () => window.clearTimeout(t);
  }, [phase, lives, sequence, playSfx]);

  // Finished — persist and save.
  useEffect(() => {
    if (phase !== "finished") return;
    playSfx(winAudio);

    let nextStreak = streakCount;
    try {
      const today = todayKey();
      const raw = window.localStorage.getItem(STORAGE.streak);
      const prev = raw ? (JSON.parse(raw) as { count: number; date: string }) : { count: 0, date: "" };
      if (prev.date !== today) {
        nextStreak = prev.date === yesterdayKey() ? (prev.count || 0) + 1 : 1;
        setStreakCount(nextStreak);
      }
      window.localStorage.setItem(
        STORAGE.streak,
        JSON.stringify({ count: nextStreak, date: today }),
      );
    } catch {
      /* ignore */
    }

    const reachedLevel = level - (lives === 0 ? 1 : 0);
    if (mistakesThisRun === 0 && score > 0) {
      setEndLine("Clean run. Your attention held — that's evidence of focus.");
    } else if (score === 0) {
      setEndLine("A gentle start. The pattern will be there next time.");
    } else if (mistakesThisRun <= 2) {
      setEndLine(`You held the pattern through level ${Math.max(1, reachedLevel)}. Steady work.`);
    } else {
      setEndLine("Recall takes practice. Each attempt strengthens the loop.");
    }
    setLiveMessage(`Run complete. ${score} XP earned.`);

    const duration = Math.max(1, Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000));
    const reachedSeq = Math.max(1, maxSequenceReached, sequence.length);
    saveMemoryChallenge(score, mistakesThisRun, duration, reachedSeq).catch((err) =>
      console.error("Failed to save MemoryChallenge result:", err),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startRun = useCallback((selectedMode: Mode) => {
    setMode(selectedMode);
    setSequence([]);
    setPlayerSequence([]);
    setSnapshotRemaining(new Set());
    setSnapshotTotal(0);
    setLevel(1);
    setScore(0);
    setLives(LIVES);
    setCombo(1);
    setMistakesThisRun(0);
    setMaxSequenceReached(0);
    setActiveTiles([]);
    setWrongTile(null);
    setHintTile(null);
    setShowingIndex(0);
    setCountdown(3);
    setEndLine("");
    startTimeRef.current = Date.now();
    setPhase("countdown");
  }, []);

  const handleReset = useCallback(() => {
    setPhase("ready");
    setSequence([]);
    setPlayerSequence([]);
    setSnapshotRemaining(new Set());
    setSnapshotTotal(0);
    setLevel(1);
    setScore(0);
    setLives(LIVES);
    setCombo(1);
    setMistakesThisRun(0);
    setMaxSequenceReached(0);
    setActiveTiles([]);
    setWrongTile(null);
    setHintTile(null);
    setShowingIndex(0);
    setCountdown(3);
    setEndLine("");
  }, []);

  const handleTileClick = useCallback(
    (tileIdx: number) => {
      if (phase !== "playing") return;
      if (mode === "classic" && playerSequence.length >= sequence.length) return;
      if (mode === "snapshot" && snapshotRemaining.size === 0) return;

      if (mode === "classic") {
        const expected = sequence[playerSequence.length];
        if (tileIdx !== expected) {
          playTone(180, 220, 0.08);
          setLives((l) => Math.max(0, l - 1));
          setMistakesThisRun((m) => m + 1);
          setCombo(1);
          setWrongTile(tileIdx);
          setHintTile(expected);
          setPhase("feedback");
          return;
        }
        playTone(TILE_FREQS[tileIdx], 220, 0.14);
        const next = [...playerSequence, tileIdx];
        setPlayerSequence(next);
        setActiveTiles([tileIdx]);
        window.setTimeout(() => setActiveTiles([]), 180);

        if (next.length === sequence.length) {
          const newCombo = Math.min(combo + 1, MAX_COMBO);
          const gain = Math.round(level * 10 * comboMultiplier(newCombo));
          setCombo(newCombo);
          setScore((s) => s + gain);
          setMaxSequenceReached((m) => Math.max(m, sequence.length));
          playSfx(matchAudio);
          setLiveMessage(`Level ${level} cleared. Plus ${gain} XP.`);
          window.setTimeout(() => {
            setLevel((l) => l + 1);
            setCountdown(0);
            setPhase("countdown");
          }, 750);
        }
        return;
      }

      // snapshot
      if (!snapshotRemaining.has(tileIdx)) {
        playTone(180, 220, 0.08);
        setLives((l) => Math.max(0, l - 1));
        setMistakesThisRun((m) => m + 1);
        setCombo(1);
        setWrongTile(tileIdx);
        const remainingArr = Array.from(snapshotRemaining);
        setHintTile(remainingArr[0] ?? null);
        setPhase("feedback");
        return;
      }
      playTone(TILE_FREQS[tileIdx], 220, 0.14);
      const newRemaining = new Set(snapshotRemaining);
      newRemaining.delete(tileIdx);
      setSnapshotRemaining(newRemaining);
      setPlayerSequence((p) => [...p, tileIdx]);
      setActiveTiles([tileIdx]);
      window.setTimeout(() => setActiveTiles([]), 180);

      if (newRemaining.size === 0) {
        const newCombo = Math.min(combo + 1, MAX_COMBO);
        const gain = Math.round(level * 10 * comboMultiplier(newCombo));
        setCombo(newCombo);
        setScore((s) => s + gain);
        setMaxSequenceReached((m) => Math.max(m, sequence.length));
        playSfx(matchAudio);
        setLiveMessage(`Pattern recovered. Plus ${gain} XP.`);
        window.setTimeout(() => {
          setLevel((l) => l + 1);
          setCountdown(0);
          setPhase("countdown");
        }, 750);
      }
    },
    [phase, mode, sequence, playerSequence, snapshotRemaining, level, combo, playTone, playSfx],
  );

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "m" || e.key === "M") {
        toggleMute();
        return;
      }
      if (phase === "ready" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        startRun(mode);
        return;
      }
      if (phase !== "playing") return;
      const n = Number(e.key);
      if (Number.isFinite(n) && n >= 1 && n <= 9) {
        e.preventDefault();
        handleTileClick(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, mode, startRun, handleTileClick, toggleMute]);

  const themePhase: "idle" | "focus" | "success" | "alert" =
    phase === "finished"
      ? "success"
      : phase === "feedback"
        ? "alert"
        : phase === "showing" || phase === "playing"
          ? "focus"
          : "idle";

  const showingProgress = sequence.length > 0 ? showingIndex / sequence.length : 0;
  const playProgress =
    mode === "classic"
      ? sequence.length > 0
        ? playerSequence.length / sequence.length
        : 0
      : snapshotTotal > 0
        ? (snapshotTotal - snapshotRemaining.size) / snapshotTotal
        : 0;

  const cards = useMemo(() => Array.from({ length: GRID }, (_, i) => i), []);
  const buddyProgress =
    phase === "finished"
      ? 1
      : phase === "ready"
        ? 0
        : phase === "countdown"
          ? (3 - Math.max(0, countdown)) / 3
          : phase === "showing" || phase === "feedback"
            ? showingProgress
            : playProgress;
  const buddyMood: BuddyMood =
    phase === "finished"
      ? "celebrate"
      : phase === "feedback"
        ? "oops"
        : phase === "showing"
          ? "thinking"
          : phase === "playing"
            ? "hint"
            : score > 0
              ? "happy"
              : "idle";
  const buddyMessage =
    phase === "ready"
      ? "Ready when you are. Pick a mode, and I will track the pattern with you."
      : phase === "countdown"
        ? countdown > 0
          ? `Steady your gaze. Starting in ${countdown}.`
          : "Loading the next pattern."
        : phase === "showing"
          ? mode === "classic"
            ? "Watch the glow order. I will keep the beat soft and steady."
            : "Let the full pattern land. You can tap those tiles in any order."
          : phase === "playing"
            ? mode === "classic"
              ? `${Math.max(0, sequence.length - playerSequence.length)} taps left. Follow the order you saw.`
              : `${snapshotRemaining.size} tiles left. Choose the ones that stayed in memory.`
            : phase === "feedback"
              ? "Almost. I marked the next helpful tile, then we will replay the pattern."
              : endLine || `Run complete. You earned ${score} XP.`;

  return (
    <TherapeuticGameShell
      title="Memory Challenge"
      gameId="memory-challenge"
      xp={score}
      completed={phase === "finished"}
      onReset={handleReset}
      themePhase={themePhase}
      streakCount={streakCount}
      fitViewport
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </div>

        <MemoryBuddy
          mood={buddyMood}
          message={buddyMessage}
          progress={buddyProgress}
          reduceMotion={reduceMotion}
        />

        {phase === "ready" && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full space-y-3"
          >
            <div className="bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl sm:p-5">
              <p className="text-white/70 mb-3 leading-relaxed text-sm font-light text-center sm:text-base">
                Hold the pattern in mind, then return it to the grid. Two ways to practise focus.
              </p>

              <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-2 sm:gap-3">
                <ModeCard
                  active={mode === "classic"}
                  title="Classic"
                  subtitle="Repeat a growing sequence in order. Trains serial recall."
                  icon={<Sparkles className="h-4 w-4" />}
                  onSelect={() => setMode("classic")}
                />
                <ModeCard
                  active={mode === "snapshot"}
                  title="Snapshot"
                  subtitle="A pattern flashes once. Tap the tiles you saw, in any order."
                  icon={<Eye className="h-4 w-4" />}
                  onSelect={() => setMode("snapshot")}
                />
              </div>

              <button
                type="button"
                onClick={() => startRun(mode)}
                className="w-full py-3 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-medium tracking-wide shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-colors duration-300 flex items-center justify-center gap-2"
              >
                <Target className="h-4 w-4" />
                Begin {mode === "classic" ? "Classic" : "Snapshot"}
              </button>

              <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
                <span className="tracking-wide">Press 1–9 to tap · M to mute</span>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={muted}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 transition-colors"
                >
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {bestScore > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">Best</span>
                  <span className="text-teal-300 font-semibold text-sm">{bestScore} XP</span>
                </div>
              )}
              {streakCount > 1 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">Streak</span>
                  <span className="text-amber-200 font-semibold text-sm">{streakCount} days</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {phase === "countdown" && countdown > 0 && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-white/40">Steady your gaze</p>
            <motion.div
              key={countdown}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.4 }}
              className="text-8xl font-extralight text-teal-200 drop-shadow-[0_0_20px_rgba(94,234,212,0.4)]"
              aria-hidden
            >
              {countdown}
            </motion.div>
          </div>
        )}

        {(phase === "showing" || phase === "playing" || phase === "feedback") && (
          <div className="w-full flex flex-col items-center gap-3">
            <Hud
              level={level}
              lives={lives}
              combo={combo}
              score={score}
              phase={phase}
              showingProgress={showingProgress}
              playProgress={playProgress}
              reduceMotion={reduceMotion}
            />

            <motion.div
              animate={
                phase === "feedback" && !reduceMotion
                  ? { x: [-6, 6, -4, 4, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.45 }}
              className="grid aspect-square w-full grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
              style={{ maxWidth: "min(100%, calc(100svh - 22rem))" }}
            >
              {cards.map((index) => (
                <Tile
                  key={index}
                  index={index}
                  isActive={activeTiles.includes(index)}
                  isWrong={wrongTile === index}
                  isHint={hintTile === index && phase === "feedback"}
                  isClickable={phase === "playing"}
                  onClick={() => handleTileClick(index)}
                  reduceMotion={reduceMotion}
                />
              ))}
            </motion.div>

            <div className="flex w-full items-center justify-between text-[11px] text-white/40 px-2">
              <span className="tracking-wide">
                {mode === "classic" ? "Classic · sequence" : "Snapshot · any order"}
              </span>
              <button
                type="button"
                onClick={toggleMute}
                aria-pressed={muted}
                aria-label={muted ? "Unmute" : "Mute"}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 transition-colors"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        {phase === "finished" && endLine && (
          <p className="mt-6 text-sm text-white/60 text-center max-w-xs italic leading-relaxed">
            {endLine}
          </p>
        )}
      </div>
    </TherapeuticGameShell>
  );
};

export default MemoryChallenge;
