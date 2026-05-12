import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { ROUND_THE_CLOCK_HELPLINE } from "@/lib/helplines";
import heroImg from "@/assets/sanctuary/hero-morning.jpg";
import treeMountainImg from "@/assets/sanctuary/scene-tree-mountain.jpg";
import lakeImg from "@/assets/sanctuary/scene-lake.jpg";
import meadowImg from "@/assets/sanctuary/scene-meadow.jpg";
import forestImg from "@/assets/sanctuary/scene-forest.jpg";
import windowImg from "@/assets/sanctuary/scene-window.jpg";
import hillsImg from "@/assets/sanctuary/scene-hills.jpg";
import fireflyImg from "@/assets/sanctuary/scene-firefly.jpg";
import leafImg from "@/assets/sanctuary/leaf.png";
import butterflyImg from "@/assets/sanctuary/butterfly.png";

const closingBgImg = "/illustrations/hills-1600.webp";

/* ---------- Soft cursor glow ---------- */
function CursorGlow() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 60, damping: 20, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 60, damping: 20, mass: 0.8 });
  const bg = useMotionTemplate`radial-gradient(280px circle at ${sx}px ${sy}px, oklch(0.92 0.06 75 / 0.55), transparent 70%)`;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] mix-blend-soft-light"
      style={{ background: bg }}
    />
  );
}

/* ---------- Scroll progress thread ---------- */
function ScrollThread({ progress }: { progress: MotionValue<number> }) {
  const scaleY = useSpring(progress, { stiffness: 80, damping: 20 });
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-6 top-0 z-[40] hidden h-screen w-px md:block"
      style={{ backgroundColor: "color-mix(in oklab, var(--ink) 12%, transparent)" }}
    >
      <motion.div
        className="origin-top w-full"
        style={{
          scaleY,
          height: "100%",
          background:
            "linear-gradient(to bottom, var(--accent-sage), var(--accent-sky), var(--accent-blush))",
          opacity: 0.6,
        }}
      />
    </div>
  );
}

/* ---------- Paper grain ---------- */
function PaperGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.12] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

/* ---------- Scene registry & progress nav ---------- */
const SCENES = [
  { id: "hero", label: "Sunrise" },
  { id: "scene-1", label: "Settle" },
  { id: "breath", label: "Breathe" },
  { id: "scene-2", label: "Open" },
  { id: "hills", label: "Wander" },
  { id: "moments", label: "Moments" },
  { id: "scene-3", label: "Drift" },
  { id: "closing", label: "Rest" },
] as const;

function SceneNav({ activeId }: { activeId: string }) {
  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <nav
      aria-label="Scene navigation"
      className="pointer-events-auto fixed left-4 top-1/2 z-[45] hidden -translate-y-1/2 md:block"
    >
      <ul className="flex flex-col gap-5">
        {SCENES.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                aria-label={`Jump to ${s.label}`}
                aria-current={active ? "true" : undefined}
                className="group relative flex items-center gap-3 outline-none"
              >
                <motion.span
                  className="block rounded-full"
                  animate={{
                    width: active ? 28 : 10,
                    opacity: active ? 1 : 0.45,
                  }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    height: 4,
                    backgroundColor: active
                      ? "var(--accent-sage)"
                      : "color-mix(in oklab, var(--ink) 50%, transparent)",
                  }}
                />
                <motion.span
                  animate={{ opacity: active ? 1 : 0, x: active ? 0 : -4 }}
                  transition={{ duration: 0.4 }}
                  className="text-[0.7rem] uppercase tracking-[0.3em]"
                  style={{
                    fontFamily: "var(--font-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {s.label}
                </motion.span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Hook: track which scene is centered in viewport */
function useActiveScene(): string {
  const [active, setActive] = useState<string>(SCENES[0].id);
  useEffect(() => {
    const els = SCENES
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    let current = active;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0] && visible[0].target.id !== current) {
          current = visible[0].target.id;
          setActive(current);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return active;
}

/* Hook: pause off-screen animations */
function useInView(ref: React.RefObject<HTMLElement | null>, margin = "200px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: `${margin} 0px ${margin} 0px` }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, margin]);
  return inView;
}

function FloatingLeaf({
  delay = 0,
  duration = 22,
  x = "20%",
  size = 50,
  rotate = 0,
  play = true,
}: {
  delay?: number;
  duration?: number;
  x?: string;
  size?: number;
  rotate?: number;
  play?: boolean;
}) {
  return (
    <motion.img
      src={leafImg}
      alt=""
      aria-hidden
      className="pointer-events-none absolute opacity-70"
      style={{ left: x, width: size, height: size, top: -120, willChange: "transform" }}
      initial={{ y: -120, rotate }}
      animate={
        play
          ? {
            y: ["0vh", "120vh"],
            x: [0, 30, -25, 15, 0],
            rotate: [rotate, rotate + 200, rotate + 360],
          }
          : { y: -120, rotate }
      }
      transition={{ duration, delay, repeat: play ? Infinity : 0, ease: "linear" }}
    />
  );
}

/* ---------- Word-by-word reveal ---------- */
function RevealWords({
  text,
  className,
  style,
  delay = 0,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={className} style={style}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0 }}
            whileInView={{ y: "0%", opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 1.1,
              delay: delay + i * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ---------- Hero ---------- */
function HeroScene({ firstName }: { firstName: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "100px");
  const reduceMotion = useReducedMotion();
  const ambient = inView && !reduceMotion;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "55%"]);
  const blur = useTransform(scrollYProgress, [0, 1], [0, 6]);
  const filter = useMotionTemplate`blur(${blur}px)`;

  return (
    <section
      ref={ref}
      id="hero"
      className="relative h-screen w-full overflow-hidden"
      style={{ backgroundColor: "var(--background)", contain: "layout paint" }}
    >
      <motion.img
        src={heroImg}
        alt="A young woman meditating peacefully under a great tree at sunrise"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
        style={{ y, opacity, scale, filter, willChange: "filter" }}
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.6, ease: "easeOut" }}
      />

      <FloatingLeaf play={ambient} delay={0} duration={26} x="55%" size={38} rotate={20} />
      <FloatingLeaf play={ambient} delay={5} duration={32} x="68%" size={50} rotate={-15} />
      <FloatingLeaf play={ambient} delay={9} duration={24} x="80%" size={32} rotate={45} />
      <FloatingLeaf play={ambient} delay={14} duration={30} x="88%" size={42} rotate={-30} />

      <motion.img
        src={butterflyImg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute"
        style={{ width: 80, height: 80, willChange: "transform" }}
        initial={{ x: "85vw", y: "70vh", rotate: -10 }}
        animate={
          ambient
            ? {
              x: ["85vw", "65vw", "50vw", "70vw", "82vw"],
              y: ["70vh", "32vh", "48vh", "22vh", "55vh"],
              rotate: [-10, 12, -5, 18, -10],
            }
            : { x: "85vw", y: "70vh", rotate: -10 }
        }
        transition={{ duration: 28, repeat: ambient ? Infinity : 0, ease: "easeInOut" }}
      />

      <motion.div
        style={{ y: textY }}
        className="relative z-10 flex h-full flex-col items-end justify-center px-8 md:px-20"
      >
        <div className="max-w-2xl text-right">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1.4 }}
            className="leading-snug italic"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--ink-soft)",
              fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)",
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            sun's up — so are new possibilities.
          </motion.p>

          <h1
            className="mt-6 leading-[1.05] font-medium"
            style={{
              fontFamily: "var(--font-script)",
              color: "var(--ink)",
              fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
            }}
          >
            <RevealWords text="Good morning," delay={1.2} />
            <br />
            <RevealWords
              text={`${firstName}.`}
              delay={1.6}
              style={{ fontFamily: "var(--font-script)", fontWeight: 600 }}
            />
          </h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8, duration: 1.6 }}
            className="mt-10 flex items-center justify-end gap-4"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}
          >
            <span className="text-xs uppercase tracking-[0.4em]">scroll, gently</span>
            <motion.span
              animate={ambient ? { y: [0, 8, 0] } : { y: 0 }}
              transition={{ duration: 2.4, repeat: ambient ? Infinity : 0, ease: "easeInOut" }}
              className="text-base"
            >
              ↓
            </motion.span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- Sliding scroll scene ---------- */
function ScrollScene({
  id,
  index,
  image,
  alt,
  eyebrow,
  title,
  body,
  reverse = false,
  tint = "var(--paper-soft)",
}: {
  id: string;
  index: number;
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  reverse?: boolean;
  tint?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Image slides in from the side, settles, then drifts out
  const imgX = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    reverse ? ["12%", "0%", "0%", "-8%"] : ["-12%", "0%", "0%", "8%"]
  );
  const imgScale = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], [1.1, 1, 1, 1.05]);
  const imgRotate = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    reverse ? [2.5, 0, -2] : [-2.5, 0, 2]
  );
  const imgOpacity = useTransform(
    scrollYProgress,
    [0, 0.25, 0.75, 1],
    [0, 1, 1, 0.4]
  );

  // Text slides from opposite side
  const textX = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    reverse ? ["-8%", "0%", "0%", "5%"] : ["8%", "0%", "0%", "-5%"]
  );
  const textOpacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.75, 1],
    [0, 1, 1, 0.3]
  );

  return (
    <section
      ref={ref}
      id={id}
      className="relative w-full overflow-hidden py-32 md:py-44"
      style={{ backgroundColor: tint, contain: "layout paint" }}
    >
      {/* faint chapter number */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(8rem, 22vw, 22rem)",
          color: "var(--ink)",
          opacity: 0.04,
          fontStyle: "italic",
          top: "50%",
          left: reverse ? "auto" : "-2%",
          right: reverse ? "-2%" : "auto",
          transform: "translateY(-50%)",
          lineHeight: 1,
        }}
      >
        {String(index).padStart(2, "0")}
      </motion.span>

      <div
        className={`relative mx-auto flex max-w-6xl flex-col items-center gap-14 px-6 md:gap-24 md:px-12 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}
      >
        <motion.div
          className="relative w-full md:w-1/2"
          style={{ x: imgX, scale: imgScale, rotate: imgRotate, opacity: imgOpacity }}
        >
          <div
            className="relative overflow-hidden rounded-[2rem]"
            style={{
              boxShadow:
                "0 30px 80px -40px color-mix(in oklab, var(--ink) 30%, transparent)",
            }}
          >
            <img
              src={image}
              alt={alt}
              loading="lazy"
              width={1024}
              height={1024}
              className="h-full w-full object-cover mix-blend-multiply"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[2rem]"
              style={{
                boxShadow: "inset 0 0 60px 10px color-mix(in oklab, var(--paper-soft) 60%, transparent)",
              }}
            />
          </div>
        </motion.div>

        <motion.div
          className="w-full md:w-1/2"
          style={{ x: textX, opacity: textOpacity }}
        >
          <p
            className="mb-5 text-xs uppercase tracking-[0.4em]"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}
          >
            {eyebrow}
          </p>
          <h2
            className="leading-[1.1] font-medium"
            style={{
              fontFamily: "var(--font-script)",
              color: "var(--ink)",
              fontSize: "clamp(2rem, 4vw, 3.4rem)",
            }}
          >
            <RevealWords text={title} />
          </h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.4, delay: 0.5 }}
            className="mt-7 leading-relaxed"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--ink-soft)",
              fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)",
            }}
          >
            {body}
          </motion.p>

          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: 0.8, ease: "easeOut" }}
            className="mt-10 h-px origin-left"
            style={{
              backgroundColor: "color-mix(in oklab, var(--ink) 30%, transparent)",
              maxWidth: 120,
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Breath pause ---------- */
function BreathPause() {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, "150px");
  const reduceMotion = useReducedMotion();
  const breathe = inView && !reduceMotion;

  // Pause/play with viewport visibility to avoid wasted decode work off-screen.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView && !reduceMotion) {
      v.play().catch(() => { });
    } else {
      v.pause();
    }
  }, [inView, reduceMotion]);

  return (
    <section
      ref={ref}
      id="breath"
      className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden px-6 py-32"
      style={{ backgroundColor: "var(--paper-deep)", contain: "layout paint" }}
    >
      {!reduceMotion && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={inView ? "/videos/inhale_exhale.mp4" : undefined}
          loop
          muted
          playsInline
          preload="none"
          poster={treeMountainImg}
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--paper-deep)", opacity: 0.55 }}
        aria-hidden
      />
      <motion.div
        className="relative flex items-center justify-center"
        style={{ width: 320, height: 320 }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 2 }}
      >
        {[0, 0.4, 0.8].map((d, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              inset: i * 32,
              border: "1px solid var(--accent-sage-soft)",
              willChange: "opacity",
            }}
            animate={
              breathe
                ? {
                  scale: [0.7 + i * 0.05, 1, 0.7 + i * 0.05],
                  opacity: [0.25, 0.7, 0.25],
                }
                : { scale: 0.7 + i * 0.05, opacity: 0.25 }
            }
            transition={{
              duration: 8,
              repeat: breathe ? Infinity : 0,
              ease: "easeInOut",
              delay: d,
            }}
          />
        ))}
        <motion.div
          className="absolute inset-20 rounded-full"
          style={{ backgroundColor: "var(--accent-sage-soft)", opacity: 0.18, willChange: "transform" }}
          animate={breathe ? { scale: [0.85, 1.08, 0.85] } : { scale: 0.85 }}
          transition={{ duration: 8, repeat: breathe ? Infinity : 0, ease: "easeInOut" }}
        />
        <motion.span
          className="relative z-10 -translate-y-16 rounded-full px-6 py-3 text-center italic font-semibold tracking-[0.08em]"
          style={{
            fontFamily: "var(--font-script)",
            color: "var(--paper-soft)",
            fontSize: "clamp(1.9rem, 3vw, 2.8rem)",
            backgroundColor: "rgba(0, 0, 0, 0.16)",
            backdropFilter: "blur(6px)",
            textShadow: "0 2px 12px rgba(0, 0, 0, 0.75)",
            boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.06), 0 10px 28px rgba(0, 0, 0, 0.14)",
          }}
          animate={breathe ? { opacity: [0.35, 0.85, 0.35] } : { opacity: 0.6 }}
          transition={{ duration: 8, repeat: breathe ? Infinity : 0, ease: "easeInOut" }}
        >
          breathe in… and out
        </motion.span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, delay: 0.6 }}
        className="mt-16 max-w-md text-center italic"
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--ink-soft)",
          fontSize: "clamp(1rem, 1.4vw, 1.2rem)",
        }}
      >
        there is nowhere to be. only here, only this.
      </motion.p>
    </section>
  );
}


/* ---------- Wide parallax banner ---------- */
function ParallaxBanner({
  id,
  image,
  alt,
  caption,
  height = "70vh",
}: {
  id?: string;
  image: string;
  alt: string;
  caption?: string;
  height?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.05, 1.15]);
  const captionOpacity = useTransform(scrollYProgress, [0.2, 0.5, 0.8], [0, 1, 0]);

  return (
    <section
      ref={ref}
      id={id}
      className="relative w-full overflow-hidden"
      style={{ height, contain: "layout paint" }}
    >
      <motion.img
        src={image}
        alt={alt}
        loading="lazy"
        width={1600}
        height={900}
        className="absolute inset-0 h-[125%] w-full object-cover mix-blend-multiply"
        style={{ y, scale, top: "-12%", willChange: "transform" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in oklab, var(--paper-soft) 50%, transparent), transparent 35%, transparent 65%, color-mix(in oklab, var(--paper-soft) 60%, transparent))",
        }}
      />
      {caption && (
        <motion.p
          style={{ opacity: captionOpacity, fontFamily: "var(--font-serif)", color: "var(--ink)" }}

          className="absolute inset-x-0 bottom-12 mx-auto max-w-xl px-6 text-center italic"
        >
          <span style={{ fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)" }}>{caption}</span>
        </motion.p>
      )}
    </section>
  );
}

/* ---------- Image trio strip ---------- */
function MomentsStrip() {
  const ref = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const lite = isMobile || prefersReducedMotion;
  const minimal = prefersReducedMotion;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Parallax only on larger screens — avoids paint jank on mobile
  const rawY0 = useTransform(scrollYProgress, [0, 1], ["40px", "-50px"]);
  const rawY1 = useTransform(scrollYProgress, [0, 1], ["70px", "-90px"]);
  const rawY2 = useTransform(scrollYProgress, [0, 1], ["100px", "-130px"]);
  const y0 = useSpring(rawY0, { stiffness: 60, damping: 22, mass: 0.9 });
  const y1 = useSpring(rawY1, { stiffness: 60, damping: 22, mass: 0.9 });
  const y2 = useSpring(rawY2, { stiffness: 60, damping: 22, mass: 0.9 });
  const ys = [y0, y1, y2];
  const items = [
    { src: windowImg, alt: "Open window with morning tea", label: "resources", to: "/psychological-content" },
    { src: forestImg, alt: "Misty forest path", label: "mindgym", to: "/mindgym" },
    { src: fireflyImg, alt: "Hand cupping a firefly", label: "the therapist bridge", to: "/therapist-bridge" },
  ];

  return (
    <section
      ref={ref}
      id="moments"
      className="relative w-full overflow-hidden py-28 md:py-36"
      style={{ backgroundColor: "var(--paper-soft)", contain: "layout paint" }}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: minimal ? 0.4 : 1.6 }}
          className="mb-14 text-center text-xs uppercase tracking-[0.45em]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}
        >
          small moments · gathered softly
        </motion.p>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {items.map((it, i) => {
            const figureStyle = lite
              ? { marginTop: 0, willChange: "opacity" as const }
              : {
                y: ys[i],
                marginTop: i === 1 ? "3rem" : 0,
                willChange: "opacity" as const,
              };
            const figureTransition = minimal
              ? { duration: 0.35, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] as const }
              : lite
                ? { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const }
                : { duration: 1.6, delay: i * 0.22, ease: [0.22, 1, 0.36, 1] as const };
            const imgTransition = minimal
              ? { duration: 0.4, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] as const }
              : lite
                ? { duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const }
                : { duration: 1.8, delay: i * 0.22, ease: [0.22, 1, 0.36, 1] as const };
            const captionTransition = minimal
              ? { duration: 0.3, delay: 0.08 + i * 0.03, ease: [0.22, 1, 0.36, 1] as const }
              : lite
                ? { duration: 0.6, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] as const }
                : { duration: 1.2, delay: 0.4 + i * 0.22, ease: [0.22, 1, 0.36, 1] as const };

            const revealY = minimal ? 8 : lite ? 24 : 60;
            const revealScale = minimal ? 1.02 : lite ? 1.06 : 1.18;
            const captionY = minimal ? 4 : 10;

            return (
              <motion.figure
                key={it.label}
                style={figureStyle}
                initial={{ opacity: 0, y: revealY }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={figureTransition}
                className="group relative"
              >
                <Link to={it.to} aria-label={it.label} className="block">
                  <div
                    className="relative overflow-hidden rounded-[1.75rem]"
                    style={{
                      boxShadow:
                        "0 24px 60px -32px color-mix(in oklab, var(--ink) 35%, transparent)",
                      transform: "translateZ(0)",
                    }}
                  >
                    <motion.img
                      src={it.src}
                      alt={it.alt}
                      loading="lazy"
                      width={1024}
                      height={1024}
                      initial={{ scale: revealScale }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={imgTransition}
                      className={`aspect-square w-full object-cover ${lite ? "" : "mix-blend-multiply"} ${minimal ? "" : "transition-transform duration-1500 ease-out group-hover:scale-105"}`}
                      style={{ willChange: "transform" }}
                    />
                  </div>
                  <motion.figcaption
                    initial={{ opacity: 0, y: captionY }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={captionTransition}
                    className="mt-5 text-center text-xs uppercase tracking-[0.4em]"
                    style={{ color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}
                  >
                    {it.label}
                  </motion.figcaption>
                </Link>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Closing ---------- */
function ClosingScene() {
  const helplineLine = `if you need to talk, ${ROUND_THE_CLOCK_HELPLINE.name} is open 24/7 · ${ROUND_THE_CLOCK_HELPLINE.display}.`;
  const footerLinks = [
    { label: "Privacy", to: "/privacy" },
    { label: "Terms", to: "/terms" },
    { label: "Safety plan", to: "/safety-plan" },
    { label: "Resources", to: "/psychological-content" },
  ];
  return (
    <section
      id="closing"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-32"
      style={{ backgroundColor: "var(--paper-soft)" }}
    >
      <img
        aria-hidden
        alt=""
        src={closingBgImg}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        style={{ transform: "scale(1.02)" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(250, 247, 241, 0) 28%, rgba(250, 247, 241, 0.22) 72%, rgba(250, 247, 241, 0.38) 100%)",
        }}
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/5" />

      <div className="relative z-10 flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h2
          className="max-w-2xl text-center italic leading-[1.05] font-medium"
          style={{
            fontFamily: "var(--font-script)",
            color: "var(--ink)",
            fontSize: "clamp(2.4rem, 4.5vw, 4.4rem)",
            textShadow: "0 2px 10px rgba(255, 248, 238, 0.85)",
          }}
        >
          <RevealWords text="rest now. tomorrow finds you here." />
        </h2>

      </div>

      <div className="absolute inset-x-0 bottom-8 z-10 flex w-full flex-col items-center gap-6 px-6 text-center sm:bottom-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, delay: 0.8 }}
          className="flex w-full flex-wrap items-stretch justify-center gap-4 text-xl sm:text-2xl"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-sans)",
            textShadow: "0 1px 6px rgba(255, 248, 238, 0.7)",
          }}
        >
          {footerLinks.map((l, i, arr) => (
            <span key={l.label} className="flex min-w-[9rem] flex-1 items-center justify-center gap-x-2">
              <Link to={l.to} className="transition-opacity hover:opacity-60">
                {l.label}
              </Link>
              {i < arr.length - 1 && <span aria-hidden>·</span>}
            </span>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, delay: 1.2 }}
          className="w-full max-w-none text-lg leading-relaxed sm:text-xl"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-sans)",
            textShadow: "0 1px 6px rgba(255, 248, 238, 0.7)",
          }}
        >
          a companion, not a clinician - a bridge to care, not a replacement.
          {" "}
          {helplineLine}
        </motion.p>
      </div>
    </section>
  );
}

export default function SanctuaryHome() {
  const { scrollYProgress } = useScroll();
  const activeId = useActiveScene();
  const { user } = useAuth();

  // Mirrors the displayName derivation used in pages/Index.tsx so the hero
  // greeting matches whatever the rest of the product calls the user.
  const firstName = useMemo(() => {
    const raw =
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "friend";
    return String(raw)
      .trim()
      .split(/[\s_-]+/)[0]
      .replace(/^./, (c) => c.toUpperCase());
  }, [user]);

  return (
    <main
      className="relative w-full overflow-x-hidden"
      style={{ backgroundColor: "var(--background)", scrollBehavior: "smooth" }}
    >
      <PaperGrain />
      <CursorGlow />
      <ScrollThread progress={scrollYProgress} />
      <SceneNav activeId={activeId} />

      <HeroScene firstName={firstName} />

      <ScrollScene
        id="scene-1"
        index={1}
        image={treeMountainImg}
        alt="Watercolor of a figure meditating beneath a tree before soft mountains"
        eyebrow="settle"
        title="Let the morning hold you, gently."
        body="Nothing to perform. Nothing to fix. Just a slow noticing - the weight of your shoulders, the warmth of the light, the quiet between thoughts."
      />

      <BreathPause />

      <ScrollScene
        id="scene-2"
        index={2}
        reverse
        tint="var(--background)"
        image={meadowImg}
        alt="Watercolor of a wide meadow with wildflowers and a single bird flying"
        eyebrow="open"
        title="A small bird, a wide sky."
        body="Possibility doesn't shout. It rustles in the grass, hums in the wind. Step into the day with the same softness - and let it surprise you."
      />

      <ParallaxBanner
        id="hills"
        image={hillsImg}
        alt="Soft watercolor hills at dawn with a tiny figure walking"
        caption="one slow step is still forward."
        height="80vh"
      />

      <MomentsStrip />

      <ScrollScene
        id="scene-3"
        index={3}
        tint="var(--paper-deep)"
        image={lakeImg}
        alt="Watercolor of a still lake at twilight with a small boat and a glowing moon"
        eyebrow="drift"
        title="Stillness has its own current."
        body="When the day grows heavy, return here. Float a while. The water holds you. The moon keeps watch. You don't have to row."
      />

      <ClosingScene />
    </main>
  );
}
