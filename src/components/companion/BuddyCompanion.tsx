// BuddyCompanion — the one place the 3D companion gets wired into a tool.
//
// It owns everything that used to live inline in BuddyTicTacToe: the rig
// (BuddyStage), the comedy-prop overlay (BuddyProps), the controller lifecycle
// (greet on ready → idle → dispose on unmount), the speech bubble, mute, and the
// mobile/desktop responsive shell. A tool just drops <BuddyCompanion ref={...}>
// and calls `ref.react({ kind })` / `ref.pose(emotion)` on its own events.
//
// Adaptive presence: `variant="full"` is the tall game stage with chrome;
// `variant="compact"` is a bare stage sized by the parent (e.g. an avatar slot
// inside another card), with no bubble/mute/idle-chatter by default.
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown } from "lucide-react";
import { BuddyStage, type BuddyHandle } from "@/components/BuddyStage";
import { BuddyProps, type PropCue } from "@/components/BuddyProps";
import { createBuddyController, type BuddyController } from "@/lib/companion/director";
import {
  BuddyResponseSchema,
  EMOTION_MAP,
  type BuddyContext,
  type BuddyEmotion,
  type BuddyResponse,
} from "@/lib/companion/buddyBrain";
import * as audio from "@/lib/companion/audio";

// Emotion → speech-bubble accent + leading glyph.
const BUBBLE_STYLE: Record<string, { glyph: string; accent: string }> = {
  elated:      { glyph: "✨", accent: "var(--bt-gold)" },
  happy:       { glyph: "🙂", accent: "var(--bt-gold)" },
  smug:        { glyph: "😏", accent: "var(--bt-chai)" },
  mischief:    { glyph: "😼", accent: "var(--bt-chai)" },
  curious:     { glyph: "🤔", accent: "var(--bt-chai)" },
  surprised:   { glyph: "❗", accent: "var(--bt-gold)" },
  confused:    { glyph: "❓", accent: "var(--bt-board-dark)" },
  sad:         { glyph: "🥲", accent: "var(--bt-board-dark)" },
  supportive:  { glyph: "🫶", accent: "var(--bt-chai)" },
  bored:       { glyph: "💭", accent: "oklch(0.55 0.04 60)" },
  sleepy:      { glyph: "😴", accent: "oklch(0.55 0.04 60)" },
  embarrassed: { glyph: "😅", accent: "var(--bt-chai)" },
  focused:     { glyph: "🎯", accent: "var(--bt-chai)" },
  neutral:     { glyph: "💬", accent: "var(--bt-chai)" },
};

// Emotion → compact "face disc" glyph for the mobile companion bar.
const FACE_GLYPH: Record<BuddyEmotion, string> = {
  neutral: "🙂", happy: "😄", elated: "🤩", smug: "😏", mischief: "😈",
  curious: "🤔", surprised: "😮", confused: "😕", sad: "😔", supportive: "🤗",
  bored: "😐", sleepy: "😴", embarrassed: "😅", focused: "🤨",
};

const DEFAULT_LAST_SEEN_KEY = "buddy:lastSeen";

/** Build a silent performance (no speech) that just holds an emotion's face +
 *  gesture. Used by `pose()` — e.g. "act out this mood" games or an avatar that
 *  sits inside a card with its own text, where voice blips would clash. */
function silentEmote(emotion: BuddyEmotion): BuddyResponse {
  const spec = EMOTION_MAP[emotion];
  return BuddyResponseSchema.parse({
    reply: "",
    emotion,
    facialExpression: "auto",
    microExpression: spec.micro[0] ?? "none",
    animationState: spec.animationState,
    gesture: spec.gestures[0] ?? "none",
    humorLevel: 1,
    intensity: 0.9,
    timing: { preDelayMs: 180, holdMs: 1600 },
  });
}

export interface BuddyCompanionHandle {
  /** React to an event: mood-aware banter + performance (face, gesture, voice). */
  react: (ctx: Omit<BuddyContext, "mood">) => void;
  /** Perform an explicit, scripted response. */
  play: (resp: BuddyResponse) => void;
  /** Hold an emotion silently (no speech / voice) — face + gesture only. */
  pose: (emotion: BuddyEmotion) => void;
  /** Reset idle/bored timers without speaking. */
  notifyInteraction: () => void;
  /** Celebratory exposure + bloom pop. */
  flash: (amount?: number) => void;
  /** Fire a one-shot comedy-prop burst (needs `showProps`). */
  burst: (name: PropCue["name"]) => void;
  isReady: () => boolean;
}

export interface BuddyCompanionProps {
  /** "full" = tall game stage with chrome · "compact" = bare stage sized by parent. */
  variant?: "full" | "compact";
  /** Greet (time-aware) once the rig is ready. Default true. */
  greetOnReady?: boolean;
  /** On phones/tablets, collapse the stage behind a tappable bar. Default true (full only). */
  collapsibleOnMobile?: boolean;
  /** Show the typewriter speech bubble. Default true. */
  showBubble?: boolean;
  /** Show the mute toggle. Default true (full only). */
  showMute?: boolean;
  /** Render the comedy-prop overlay (ambient + bursts). Default true. */
  showProps?: boolean;
  /** Notified whenever the buddy's felt emotion changes. */
  onEmotion?: (e: BuddyEmotion) => void;
  /** Fired once the rig is loaded and the controller is live. */
  onReady?: () => void;
  className?: string;
  /** Override the stage container style (e.g. background) — handy for compact. */
  stageStyle?: CSSProperties;
  /** localStorage key for the "last seen" greeting buckets. */
  lastSeenKey?: string;
}

export const BuddyCompanion = forwardRef<BuddyCompanionHandle, BuddyCompanionProps>(
  function BuddyCompanion(
    {
      variant = "full",
      greetOnReady = true,
      collapsibleOnMobile = true,
      showBubble = true,
      showMute = true,
      showProps = true,
      onEmotion,
      onReady: onReadyProp,
      className,
      stageStyle,
      lastSeenKey = DEFAULT_LAST_SEEN_KEY,
    },
    ref,
  ) {
    const buddyRef = useRef<BuddyHandle>(null);
    const controllerRef = useRef<BuddyController | null>(null);
    const sayTimer = useRef<number | null>(null);
    const onEmotionRef = useRef(onEmotion);
    const onReadyPropRef = useRef(onReadyProp);
    useEffect(() => {
      onEmotionRef.current = onEmotion;
      onReadyPropRef.current = onReadyProp;
    }, [onEmotion, onReadyProp]);

    const [emotion, setEmotion] = useState<BuddyEmotion>("neutral");
    const [say, setSay] = useState("");
    const [propCue, setPropCue] = useState<PropCue | null>(null);
    const [muted, setMuted] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => setMuted(audio.isMuted()), []);

    const speak = useCallback((text: string, ms = 3000) => {
      setSay(text);
      if (sayTimer.current) window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => setSay(""), ms);
    }, []);

    const toggleMute = useCallback(() => {
      const next = audio.toggleMuted();
      setMuted(next);
      if (!next) {
        audio.unlockAudio();
        audio.sfx.uiPop();
      }
    }, []);

    // Build the controller + greet once the rig is ready.
    const onReady = useCallback(() => {
      const b = buddyRef.current;
      if (!b) return;
      const ctrl =
        controllerRef.current ??
        createBuddyController(b, {
          onEmotion: (e) => {
            setEmotion(e.emotion);
            buddyRef.current?.setMood(e.emotion);
            onEmotionRef.current?.(e.emotion);
          },
        });
      controllerRef.current = ctrl;
      if (greetOnReady) {
        let lastSeen: number | null = null;
        try {
          const raw = localStorage.getItem(lastSeenKey);
          lastSeen = raw ? Number(raw) : null;
          localStorage.setItem(lastSeenKey, String(Date.now()));
        } catch {
          /* storage unavailable */
        }
        ctrl.react({ kind: "greeting", lastSeenMs: lastSeen });
      }
      ctrl.startIdle();
      onReadyPropRef.current?.();
    }, [greetOnReady, lastSeenKey]);

    useEffect(
      () => () => {
        controllerRef.current?.dispose();
        controllerRef.current = null;
        if (sayTimer.current) window.clearTimeout(sayTimer.current);
      },
      [],
    );

    useImperativeHandle(
      ref,
      (): BuddyCompanionHandle => ({
        react: (ctx) => void controllerRef.current?.react(ctx),
        play: (resp) => void controllerRef.current?.play(resp),
        pose: (e) => {
          const ctrl = controllerRef.current;
          if (!ctrl) return;
          ctrl.notifyInteraction();
          void ctrl.play(silentEmote(e));
        },
        notifyInteraction: () => controllerRef.current?.notifyInteraction(),
        flash: (amount) => buddyRef.current?.flash(amount),
        burst: (name) => setPropCue({ name, id: Date.now() }),
        isReady: () => !!controllerRef.current,
      }),
      [],
    );

    // ---- Compact: a bare stage the parent sizes (e.g. an avatar slot) --------
    if (variant === "compact") {
      return (
        <div
          className={["bt-game relative overflow-hidden rounded-xl", className ?? ""].join(" ")}
          style={stageStyle}
        >
          <BuddyStage
            ref={buddyRef}
            onReady={onReady}
            onSay={showBubble ? speak : undefined}
            className="w-full h-full"
          />
          {showProps && <BuddyProps emotion={emotion} cue={propCue} />}
          {showBubble && say ? (
            <div className="pointer-events-none absolute top-2 left-2 right-2 z-10">
              <Bubble text={say} emotion={emotion} />
            </div>
          ) : null}
        </div>
      );
    }

    // ---- Full: the tall game stage with chrome -------------------------------
    return (
      <div className={["bt-game relative w-full", className ?? ""].join(" ")}>
        {collapsibleOnMobile && (
          <div className="lg:hidden mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                audio.unlockAudio();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              className="flex flex-1 min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left"
            >
              <FaceDisc emotion={emotion} />
              <span
                className="min-w-0 flex-1 truncate text-[13px] opacity-80"
                style={{ color: "var(--bt-ink)" }}
              >
                {say || (expanded ? "your buddy is here" : "tap to meet your buddy")}
              </span>
              <ChevronDown
                className={[
                  "w-4 h-4 shrink-0 opacity-60 transition-transform duration-300",
                  expanded ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
            {showMute && <MuteButton muted={muted} onClick={toggleMute} compact />}
          </div>
        )}

        <div
          className={[
            "relative w-full overflow-hidden rounded-xl transition-[height] duration-300 ease-out",
            collapsibleOnMobile
              ? expanded
                ? "h-[clamp(240px,60vw,360px)]"
                : "h-0"
              : "h-[clamp(240px,60vw,360px)]",
            "lg:h-[clamp(360px,38vw,520px)]",
          ].join(" ")}
          style={{ background: "#2a2d33", ...stageStyle }}
        >
          {/* Desktop floating bubble + mute */}
          <div className="hidden lg:flex absolute top-3 left-3 right-3 z-10 items-start justify-between gap-2 pointer-events-none">
            {showBubble && say ? <Bubble text={say} emotion={emotion} /> : <span />}
            {showMute && <MuteButton muted={muted} onClick={toggleMute} />}
          </div>

          <BuddyStage
            ref={buddyRef}
            onReady={onReady}
            onSay={speak}
            className="w-full h-full"
          />
          {showProps && <BuddyProps emotion={emotion} cue={propCue} />}
        </div>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Internal chrome
// ---------------------------------------------------------------------------

function MuteButton({
  muted,
  onClick,
  compact,
}: {
  muted: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        compact
          ? "shrink-0 px-2.5 py-1.5 rounded-full"
          : "pointer-events-auto px-3 py-1.5 rounded-full",
        "text-[10px] font-mono uppercase tracking-widest border transition-colors",
      ].join(" ")}
      style={{
        background: "rgba(255,255,255,0.9)",
        borderColor: "color-mix(in oklab,var(--bt-ink) 18%,transparent)",
        color: "var(--bt-ink)",
      }}
      title="Mute / unmute sounds"
    >
      {compact ? (muted ? "🔇" : "🔊") : muted ? "🔇 muted" : "🔊 sound"}
    </button>
  );
}

// Round emotion "face" for the mobile companion bar.
function FaceDisc({ emotion }: { emotion: BuddyEmotion }) {
  return (
    <span
      key={emotion}
      aria-hidden
      className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-xl bt-bubble-in"
      style={{
        background: "color-mix(in oklab, var(--bt-chai) 10%, white)",
        border: "1px solid color-mix(in oklab,var(--bt-chai) 22%,transparent)",
      }}
    >
      {FACE_GLYPH[emotion] ?? "🙂"}
    </span>
  );
}

// Typewriter speech bubble, tinted by the buddy's emotion.
function Bubble({ text, emotion }: { text: string; emotion: BuddyEmotion }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!text) {
      setShown("");
      return;
    }
    setShown("");
    let i = 0;
    const step = Math.max(16, Math.min(45, 900 / Math.max(1, text.length)));
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, step);
    return () => window.clearInterval(id);
  }, [text]);

  const s = BUBBLE_STYLE[emotion] ?? BUBBLE_STYLE.neutral;
  const thought = emotion === "bored" || emotion === "sleepy";
  return (
    <div
      className={[
        "relative max-w-[75%] bg-white/95 backdrop-blur px-3 py-2 shadow-lg bt-bubble-in",
        thought ? "rounded-3xl border-2 border-dashed" : "rounded-2xl border",
      ].join(" ")}
      style={{ borderColor: s.accent, color: "var(--bt-ink)" }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50 mb-0.5 flex items-center gap-1">
        <span aria-hidden>{s.glyph}</span> buddy
      </div>
      <p className="text-[13px] leading-snug opacity-90 min-h-[1.15em]">{shown}</p>
      {!thought && <span className="bt-bubble-tail" style={{ borderColor: s.accent }} />}
    </div>
  );
}

export default BuddyCompanion;
