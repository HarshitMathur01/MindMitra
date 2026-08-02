import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useLowTierDevice } from "@/hooks/useLowTierDevice";
import { personas, personasIntro } from "./copy";

/**
 * FIVE COMPANIONS — Daadi · Mitra · Anaya · Bhaiya · Saadhu.
 *
 * A horizontally stacked, depth-layered carousel. The active card sits
 * centred, slightly larger, sharp and softly elevated; neighbours recede
 * behind it with reduced scale, opacity and a light blur, and travel a
 * shorter distance for parallax. All movement is spring-based — no
 * overshoot, no abrupt jumps. The active card breathes gently when idle.
 *
 * Accessibility: the stack is a single-select listbox. Arrow / Home / End
 * move the selection, focus follows the active card (roving tabindex),
 * inactive cards are hidden from assistive tech, and a polite live region
 * announces the selected companion.
 *
 * Reduced-motion audit: reduced → no blur, no idle drift, no parallax
 * differential, no 3D rotation, no waveform loop, no stagger; transitions
 * collapse to ≤200ms cross-fades and the stack stays fully legible and
 * navigable. Low-tier devices get the same treatment with softer springs so
 * dragging never jitters.
 */
export function Personas() {
  const [index, setIndex] = useState(2);
  const [settled, setSettled] = useState(false);
  const [entered, setEntered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const lowTier = useLowTierDevice();
  const calm = reduced || lowTier;
  const shouldFocusRef = useRef(false);

  // Entrance: stagger the stack in once the section is mounted.
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Content (text + waveform) fades in only after the card settles.
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), reduced ? 120 : 520);
    return () => clearTimeout(t);
  }, [index, reduced]);

  const select = (i: number, viaKeyboard = false) => {
    shouldFocusRef.current = viaKeyboard;
    setIndex(Math.max(0, Math.min(personas.length - 1, i)));
  };

  return (
    <section
      id="personas"
      className="relative overflow-hidden bg-cream py-24 md:py-32"
      aria-labelledby="personas-heading"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-serif-brand text-sm uppercase tracking-[0.35em] text-terracotta-ink">
            {personasIntro.eyebrow}
          </p>
          <h2
            id="personas-heading"
            className="mt-6 font-serif-brand text-3xl leading-tight text-forest md:text-5xl"
          >
            {personasIntro.headline}
          </h2>
          <p className="mt-6 font-ui text-ink/75 md:text-lg">
            {personasIntro.body}
          </p>
        </div>

        <StackedCarousel
          index={index}
          select={select}
          reduced={reduced}
          calm={calm}
          entered={entered}
          settled={settled}
          shouldFocusRef={shouldFocusRef}
        />

        {/* Selection feedback for screen readers */}
        <p className="sr-only" role="status" aria-live="polite">
          {`${personas[index].name} selected. Companion ${index + 1} of ${personas.length}. ${personas[index].tagline}`}
        </p>

        <div className="mt-10 flex items-center justify-center gap-6">
          <StackButton
            label="Previous companion"
            onClick={() => select(index - 1)}
            disabled={index === 0}
          >
            ‹
          </StackButton>
          <div className="flex items-center gap-3">
            {personas.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Show ${p.name}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => select(i)}
                className="group flex min-h-11 min-w-11 items-center justify-center rounded-full p-1 outline-none ring-terracotta/50 focus-visible:ring-2"
              >
                <motion.span
                  className="block h-1.5 rounded-full bg-ink/25"
                  animate={{
                    width: i === index ? 28 : 8,
                    opacity: i === index ? 1 : 0.45,
                    backgroundColor: i === index ? p.hue : "rgba(42,42,38,0.25)",
                  }}
                  transition={
                    reduced
                      ? { duration: 0.2 }
                      : { type: "spring", stiffness: 220, damping: 26 }
                  }
                />
              </button>
            ))}
          </div>
          <StackButton
            label="Next companion"
            onClick={() => select(index + 1)}
            disabled={index === personas.length - 1}
          >
            ›
          </StackButton>
        </div>
      </div>
    </section>
  );
}

function StackButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/12 font-serif-brand text-xl text-forest outline-none ring-terracotta/50 transition-[opacity,background-color,box-shadow] duration-300 hover:bg-forest/5 focus-visible:ring-2 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

/* ------------------------------- The stack -------------------------------- */

function StackedCarousel({
  index,
  select,
  reduced,
  calm,
  entered,
  settled,
  shouldFocusRef,
}: {
  index: number;
  select: (i: number, viaKeyboard?: boolean) => void;
  reduced: boolean;
  calm: boolean;
  entered: boolean;
  settled: boolean;
  shouldFocusRef: MutableRefObject<boolean>;
}) {
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Roving focus: move focus to the active card only after keyboard
  // selection, never after a click or a drag.
  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    cardRefs.current[index]?.focus({ preventScroll: true });
  }, [index, shouldFocusRef]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    if (e.key === "ArrowRight") select(index + 1, true);
    if (e.key === "ArrowLeft") select(index - 1, true);
    if (e.key === "Home") select(0, true);
    if (e.key === "End") select(personas.length - 1, true);
  };

  const spring = calm
    ? { stiffness: 90, damping: 24, mass: 1 }
    : { stiffness: 120, damping: 22, mass: 0.9 };

  return (
    <div
      className="relative mt-14 select-none md:mt-20"
      style={{ perspective: 1400 }}
    >
      <motion.div
        className="relative mx-auto h-[430px] w-full max-w-4xl cursor-grab active:cursor-grabbing"
        style={{ transformStyle: "preserve-3d" }}
        drag={reduced ? false : "x"}
        dragElastic={0.06}
        dragMomentum={false}
        dragDirectionLock
        dragTransition={{ power: 0, bounceStiffness: 200, bounceDamping: 34 }}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          // Clamp velocity so a flick on a laggy Android never overshoots.
          const v = Math.max(-1200, Math.min(1200, info.velocity.x));
          const projected = info.offset.x + v * 0.09;
          if (projected < -90) select(index + 1);
          else if (projected > 90) select(index - 1);
        }}
        role="listbox"
        aria-label="Companion personas"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        {personas.map((p, i) => {
          const offset = i - index;
          const abs = Math.abs(offset);
          const visible = abs <= 2;
          // Background layers travel a shorter distance → parallax. Calm
          // mode uses a constant step (no parallax differential).
          const step = calm ? 150 : 168 - abs * 26;
          const x = offset * step;
          const scale = calm ? 1 - abs * 0.06 : 1 - abs * 0.085;
          const blur = calm || abs === 0 ? 0 : 2 + abs * 1.6;
          const opacity = visible ? 1 - abs * 0.28 : 0;
          const rotateY = calm ? 0 : offset * -7;

          return (
            <motion.div
              key={p.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute left-1/2 top-0 rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
              style={{ zIndex: 20 - abs, transformStyle: "preserve-3d" }}
              role="option"
              aria-selected={abs === 0}
              aria-hidden={abs === 0 ? undefined : true}
              tabIndex={abs === 0 ? 0 : -1}
              aria-label={`${p.name} — ${p.tagline} ${p.voice}`}
              initial={{ opacity: 0, y: 46, x: "-50%", scale: 0.92 }}
              animate={
                entered
                  ? {
                      opacity,
                      x: `calc(-50% + ${x}px)`,
                      y: calm ? 0 : abs === 0 ? -14 : abs * 14,
                      scale,
                      rotateY,
                      filter: `blur(${blur}px) saturate(${calm || abs === 0 ? 1 : 0.62})`,
                      pointerEvents: visible ? "auto" : "none",
                    }
                  : { opacity: 0, y: 46, x: "-50%", scale: 0.92 }
              }
              transition={
                reduced
                  ? { duration: 0.2, ease: "linear" }
                  : {
                      type: "spring",
                      // Softer, slightly heavier spring: fewer frames of
                      // micro-correction → no jitter on weaker GPUs.
                      stiffness: spring.stiffness,
                      damping: spring.damping,
                      mass: spring.mass,
                      restDelta: 0.4,
                      restSpeed: 0.4,
                      opacity: { duration: 0.6, delay: entered ? 0 : i * 0.09 },
                    }
              }
              onClick={() => offset !== 0 && select(i)}
            >
              <BreathingWrap active={abs === 0} calm={calm} depth={abs}>
                <PersonaCard
                  persona={p}
                  active={abs === 0}
                  reduced={reduced}
                  calm={calm}
                  settled={settled}
                />
              </BreathingWrap>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

function BreathingWrap({
  active,
  calm,
  depth,
  children,
}: {
  active: boolean;
  calm: boolean;
  depth: number;
  children: ReactNode;
}) {
  if (calm) return <div>{children}</div>;
  return (
    <motion.div
      animate={
        active
          ? { y: [0, -6, 0], scale: [1, 1.006, 1] }
          : { y: [0, -3 + depth * 0.5, 0] }
      }
      transition={{
        duration: active ? 7 : 9 + depth,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------ Persona card ------------------------------ */

type Persona = (typeof personas)[number];

function PersonaCard({
  persona,
  active,
  reduced,
  calm,
  settled,
}: {
  persona: Persona;
  active: boolean;
  reduced: boolean;
  calm: boolean;
  settled: boolean;
}) {
  const maskId = `mm-wash-${persona.id}`;
  const clipId = `mm-clip-${persona.id}`;
  const show = active && settled;

  return (
    <motion.div
      className="paper-card relative flex w-[260px] flex-col items-center rounded-[2rem] px-6 py-8 md:w-[300px]"
      animate={{
        boxShadow: active
          ? `0 32px 60px -28px rgba(27,58,43,0.35), 0 0 0 1px rgba(42,42,38,0.05), 0 0 56px -18px ${persona.hue}66`
          : "0 14px 30px -22px rgba(27,58,43,0.28), 0 0 0 1px rgba(42,42,38,0.04)",
      }}
      transition={
        reduced ? { duration: 0.2 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {/* Portrait: pale line art under a pigment-wash mask */}
      <div className="relative h-40 w-40">
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="100" cy="100" r="92" />
            </clipPath>
            <mask id={maskId}>
              <rect x="0" y="0" width="200" height="200" fill="black" />
              <rect
                x="-10"
                y="0"
                width="220"
                height="200"
                fill="white"
                style={{
                  transform: active ? "translateX(0)" : "translateX(-220px)",
                  transition: reduced
                    ? "transform 200ms linear"
                    : "transform 900ms cubic-bezier(.22,1,.36,1)",
                }}
              />
            </mask>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <rect
              x="0"
              y="0"
              width="200"
              height="200"
              fill={persona.hue}
              opacity="0.8"
              mask={`url(#${maskId})`}
              filter="url(#mm-water-edge)"
            />
            <rect
              x="0"
              y="0"
              width="200"
              height="200"
              fill="#F6F0E2"
              opacity={active ? 0 : 0.6}
              style={{ transition: "opacity 600ms cubic-bezier(.22,1,.36,1)" }}
            />
          </g>

          {/* Line art — abstract face silhouette, varied per companion */}
          <g
            clipPath={`url(#${clipId})`}
            fill="none"
            stroke="#2A2A26"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          >
            <circle cx="100" cy="100" r="92" strokeWidth="2" />
            <path d="M60 110 C 60 78, 140 78, 140 110 C 140 148, 120 168, 100 168 C 80 168, 60 148, 60 110 Z" />
            <path
              d={
                persona.id === "daadi"
                  ? "M55 96 C 78 66, 122 66, 145 96"
                  : persona.id === "saadhu"
                    ? "M62 92 C 78 60, 122 60, 138 92 M76 60 L 78 44 M124 60 L 122 44"
                    : persona.id === "anaya"
                      ? "M55 92 C 70 72, 130 72, 145 92 L 148 118"
                      : persona.id === "mitra"
                        ? "M60 92 C 74 76, 126 76, 140 92"
                        : "M58 92 C 72 68, 128 68, 142 92 M100 60 L 100 46"
              }
            />
            <path d="M84 108 q 4 -4 8 0" />
            <path d="M108 108 q 4 -4 8 0" />
            <path d="M90 130 q 10 6 20 0" />
            {persona.id === "daadi" && (
              <path d="M78 132 q -6 -2 -8 4 M122 132 q 6 -2 8 4" />
            )}
          </g>
        </svg>
      </div>

      <h3 className="mt-5 font-serif-brand text-2xl text-forest">
        {persona.name}
      </h3>

      {/* Text + waveform settle in after the card lands */}
      <AnimatePresence initial={false}>
        {show && (
          <motion.div
            key="details"
            className="flex w-full flex-col items-center"
            initial={
              calm ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{
              duration: reduced ? 0.18 : 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.p
              className="mt-3 text-center font-ui text-sm text-ink/80"
              initial={calm ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {persona.tagline}
            </motion.p>
            <motion.p
              className="mt-2 text-center font-serif-brand text-xs italic text-ink/50"
              initial={calm ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {persona.voice}
            </motion.p>

            <div className="mt-5 flex h-8 items-end gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="block w-1.5 origin-bottom rounded-full"
                  style={{
                    height: 24,
                    background: persona.hue,
                    transform: "scaleY(0.25)",
                    animation: calm
                      ? undefined
                      : `mm-waveform 1400ms ${i * 120}ms ease-in-out infinite`,
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reserve space so the stack never reflows while details settle */}
      {!show && <div className="h-[124px]" aria-hidden />}
    </motion.div>
  );
}
