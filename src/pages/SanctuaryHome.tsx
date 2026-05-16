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
import Footer from "@/components/layout/Footer";
import { ROUND_THE_CLOCK_HELPLINE } from "@/lib/helplines";
import heroImg from "@/assets/sanctuary/mm-hero-monk-tree.webp";
// import treeMountainImg from "@/assets/sanctuary/scene-tree-mountain.jpg";
import landingSecondImg from "@/assets/sanctuary/mindmitra-landing-2nd.png";
import lakeImg from "@/assets/sanctuary/scene-lake.jpg";
import forestImg from "@/assets/sanctuary/scene-forest.jpg";
import windowImg from "@/assets/sanctuary/scene-window.jpg";
import fireflyImg from "@/assets/sanctuary/scene-firefly.jpg";
import leafImg from "@/assets/sanctuary/leaf.png";
import butterflyImg from "@/assets/sanctuary/butterfly.png";

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
      className="pointer-events-none fixed right-4 sm:right-6 top-0 z-[40] hidden h-screen w-px md:block"
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
  { id: "hero", label: "Hello" },
  { id: "scene-1", label: "Thread" },
  { id: "moments", label: "Doors" },
  { id: "scene-3", label: "Night" },
] as const;

function SceneNav({ activeId }: { activeId: string }) {
  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <nav
      aria-label="Scene navigation"
      className="pointer-events-auto fixed left-2 sm:left-4 top-1/2 z-[45] hidden -translate-y-1/2 md:block"
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
function HeroScene({ firstName, canResume }: { firstName: string; canResume: boolean }) {
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
        alt="A robed figure sits in quiet meditation beneath a wide tree, soft golden light through the leaves"
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
        style={{ y, opacity }}
        className="relative z-10 flex h-full flex-col items-start justify-center pl-6 pr-4 sm:pl-10 sm:pr-8 md:pl-20 md:pr-16 lg:pl-32 lg:pr-20 pt-20 md:pt-24 lg:pt-32"
      >
        <div className="max-w-lg text-left sm:max-w-xl md:max-w-xl lg:max-w-2xl mt-8 sm:mt-10 md:mt-16">
          
          {/* Eyebrow Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2E5F4A' }}></span>
            <span
              className="text-[10px] sm:text-xs md:text-sm font-semibold tracking-[0.2em]"
              style={{ color: 'rgba(40, 35, 30, 0.9)' }}
            >
              {new Date().getHours() < 12 ? "GOOD MORNING" : new Date().getHours() < 18 ? "GOOD AFTERNOON" : "GOOD EVENING"}, {firstName?.toUpperCase() || 'FRIEND'}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1.2 }}
            className="leading-[1.15] sm:leading-[1.1] md:leading-[1.05] font-light"
            style={{
              fontFamily: "var(--font-serif-display, 'DM Serif Display', 'Fraunces', serif)",
              color: "rgba(25, 20, 15, 0.95)", // Very dark ink matching the image
              fontSize: "clamp(2.5rem, 10vw, 6.5rem)",
              letterSpacing: "-0.02em",
              textShadow: "0 4px 32px rgba(255, 255, 255, 0.7)", // Gentle glow for readability against pure sun without blur
            }}
          >
            <span className="block">The light</span>
            <span className="block">is soft,</span>
            <span className="block italic" style={{ color: '#2E5F4A' }}>and I am</span>
            <span className="block italic" style={{ color: '#2E5F4A' }}>listening.</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 1.2 }}
            className="mt-5 sm:mt-6 leading-relaxed max-w-md sm:max-w-lg"
            style={{
              fontFamily: "var(--font-sans, 'Inter', sans-serif)",
              color: "#1C1917", // Pure dark ink for crisp visibility
              fontSize: "clamp(0.875rem, 1.5vw, 1.15rem)",
              fontWeight: 500, // Thickened slightly to hold over detailed background
              textShadow: "0 0 16px rgba(255, 255, 255, 0.95), 0 0 40px rgba(255, 255, 255, 0.8), 0 1px 2px rgba(255, 255, 255, 1)", // Massive dense halo buffer
              letterSpacing: "0.01em",
            }}
          >
            Hindi, English, ya Hinglish — jis bhi zubaan mein dil khulta ho. Mitra remembers, adapts, and stays beside you.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 1 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-wrap items-start sm:items-center justify-start gap-4 sm:gap-6"
          >
            <Link
              to="/chat"
              className="group flex items-center gap-3 sm:gap-4 rounded-full p-2 pr-5 sm:pr-6 transition-all hover:scale-105 active:scale-95 shadow-xl w-full sm:w-auto"
              style={{ backgroundColor: 'rgba(25, 20, 15, 0.95)' }}
            >
              <div
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-transform group-hover:rotate-12"
                style={{ backgroundColor: '#2E5F4A' }}
              >
                {/* Voice/Mic SVG Icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FDFBF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
              </div>
              <span className="text-sm font-medium tracking-wide text-[#FDFBF7]" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
                Start a conversation
              </span>
            </Link>

            <Link
              to="/chat"
              className="group flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md px-5 sm:px-6 py-2.5 text-sm font-semibold shadow-[0_4px_24px_rgba(255,255,255,0.5)] transition-all hover:scale-105 hover:bg-white active:scale-95 border border-white/40 w-full sm:w-auto justify-center sm:justify-start"
              style={{ color: "#1C1917", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}
            >
              Try the avatar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8, duration: 1.6 }}
            className="mt-8 flex items-center justify-end gap-4"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}
          >
            <span className="text-xs uppercase tracking-[0.4em]">scroll the tour</span>
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
      className="relative w-full overflow-hidden py-20 sm:py-24 md:py-32 lg:py-44"
      style={{ backgroundColor: tint, contain: "layout paint" }}
    >
      {/* faint chapter number */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(4rem, 15vw, 22rem)",
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
        className={`relative mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 sm:px-6 sm:gap-16 md:gap-24 md:px-12 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}
      >
        <motion.div
          className="relative w-full md:w-1/2"
          style={{ x: imgX, scale: imgScale, rotate: imgRotate, opacity: imgOpacity }}
        >
          <div
            className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem]"
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
              className="pointer-events-none absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem]"
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
            className="leading-[1.15] sm:leading-[1.1] font-medium"
            style={{
              fontFamily: "var(--font-script)",
              color: "var(--ink)",
              fontSize: "clamp(1.5rem, 5vw, 3.4rem)",
            }}
          >
            <RevealWords text={title} />
          </h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.4, delay: 0.5 }}
            className="mt-6 sm:mt-7 leading-relaxed"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--ink-soft)",
              fontSize: "clamp(0.95rem, 1.5vw, 1.25rem)",
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
    { src: windowImg, alt: "Open window with morning tea", label: "Reads & explainers", to: "/psychological-content" },
    { src: forestImg, alt: "Misty forest path", label: "Mind Gym micro-tools", to: "/mindgym" },
    { src: fireflyImg, alt: "Hand cupping a firefly", label: "Therapist bridge", to: "/therapist-bridge" },
  ];

  return (
    <section
      ref={ref}
      id="moments"
      className="relative w-full overflow-hidden py-20 sm:py-24 md:py-28 lg:py-36"
      style={{ backgroundColor: "var(--paper-soft)", contain: "layout paint" }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: minimal ? 0.4 : 1.6 }}
          className="mb-10 sm:mb-14 text-center text-[10px] sm:text-xs uppercase tracking-[0.35em] sm:tracking-[0.45em]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}
        >
          pick a door · same private account
        </motion.p>

        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3 md:gap-10">
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
                    className="relative overflow-hidden rounded-[1.25rem] sm:rounded-[1.5rem] md:rounded-[1.75rem]"
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
                    className="mt-4 sm:mt-5 text-center text-[10px] sm:text-xs uppercase tracking-[0.35em] sm:tracking-[0.4em]"
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

export default function SanctuaryHome() {
  const { scrollYProgress } = useScroll();
  const activeId = useActiveScene();
  const { user } = useAuth();
  const [canResume, setCanResume] = useState(false);

  useEffect(() => {
    setCanResume(!!localStorage.getItem("currentChatSession"));
  }, []);

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

      <HeroScene firstName={firstName} canResume={canResume} />

      <ScrollScene
        id="scene-1"
        index={1}
        image={landingSecondImg}
        alt="Watercolor of a figure sitting gracefully beneath a large leafing tree"
        eyebrow="thread"
        title="She remembers the subplot, not just the headline."
        body="Mitra keeps the emotional through-line across days — the lab partner tension, the scholarship worry, the homesick Sundays. You don’t re-introduce yourself every time."
      />

      <MomentsStrip />

      <ScrollScene
        id="scene-3"
        index={2}
        tint="var(--paper-deep)"
        image={lakeImg}
        alt="Watercolor of a still lake at twilight with a small boat and a glowing moon"
        eyebrow="night mode honesty"
        title="Crisis words are fixed templates — never improvised."
        body="If tonight is unsafe, Mitra routes you to clinician-reviewed lines and helplines. The rest of the time she stays conversational, messy, human-shaped."
      />

      <Footer />
    </main>
  );
}
