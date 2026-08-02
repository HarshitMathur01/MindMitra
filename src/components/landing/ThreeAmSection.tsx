import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useLowTierDevice } from "@/hooks/useLowTierDevice";
import { useGsapContext } from "@/hooks/useGsapContext";
import { threeAm } from "./copy";
import { splitGraphemes } from "./graphemes";

gsap.registerPlugin(ScrollTrigger);

/**
 * THE 3AM SECTION — pinned, scroll-scrubbed "night into dawn" narrative.
 *
 * Scroll is the storyteller. Across a ~260vh pin the section plays one
 * continuous dawn:
 *
 *   0.00–1.00  sky lerps night-indigo → dawn-cream, stars fade out, a sun
 *              glow rises from the horizon, the clock ticks 3:00 → 5:42 AM
 *   0.00–0.15  the user's message rises in, the scroll cue retires
 *   0.15–0.30  the three-dot typing indicator springs in
 *   0.30–0.90  Mitra's reply grapheme-types, scrubbed to progress
 *   0.00–1.00  copy column and phone drift at different depths
 *
 * Fully reversible on scroll-up; a hairline rail tracks the journey.
 *
 * Reduced-motion / low-tier audit: no pin, no scrub, no parallax, no
 * drifting stars. The exchange renders complete on a static dawn-cream sky,
 * the clock shows the resolved time, and the progress rail is not rendered.
 */
export function ThreeAmSection() {
  const rootRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLDivElement>(null);

  const reduced = usePrefersReducedMotion();
  const lowTier = useLowTierDevice();
  const calm = reduced || lowTier;

  const reply = threeAm.chat[1].text;
  const replyGraphemes = splitGraphemes(reply);
  const [reveal, setReveal] = useState(calm ? replyGraphemes.length : 0);
  const [minutes, setMinutes] = useState(calm ? 342 : 180);

  // Deterministic star field — a hash, not Math.random, so the layout is
  // stable across re-renders.
  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 12345.6789;
        const c = Math.sin(i * 3.7) * 9871.23;
        return {
          left: Math.abs(a % 1) * 100,
          top: Math.abs(b % 1) * 72,
          size: 1 + Math.abs(c % 1) * 1.8,
          opacity: 0.25 + Math.abs(a % 1) * 0.55,
          delay: Math.abs(c % 1) * 4,
        };
      }),
    [],
  );

  const clock = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} AM`;

  useGsapContext(
    rootRef,
    () => {
      if (calm) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "+=260%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          onUpdate: (self) => {
            if (railRef.current) {
              railRef.current.style.transform = `scaleY(${self.progress})`;
            }
          },
        },
      });

      // Initial states
      gsap.set(userMsgRef.current, { y: 40, opacity: 0 });
      gsap.set(typingRef.current, { opacity: 0, scale: 0.9 });
      gsap.set(replyRef.current, { opacity: 0 });
      gsap.set(glowRef.current, { yPercent: 60, opacity: 0 });
      gsap.set(phoneRef.current, {
        y: 60,
        rotateX: 9,
        scale: 0.96,
        transformPerspective: 900,
      });

      // Sky: night → dawn
      tl.fromTo(
        bgRef.current,
        { backgroundColor: "#1A1F3A" },
        { backgroundColor: "#F6F0E2", duration: 1, ease: "none" },
        0,
      );
      tl.fromTo(
        rootRef.current,
        { color: "#F6F0E2" },
        { color: "#2A2A26", duration: 1, ease: "none" },
        0,
      );
      // Sun glow rises from the horizon
      tl.to(
        glowRef.current,
        { yPercent: -6, opacity: 1, duration: 0.75, ease: "none" },
        0.1,
      );
      tl.to(glowRef.current, { opacity: 0.35, duration: 0.15, ease: "none" }, 0.85);
      // Stars dissolve as light arrives
      tl.to(starsRef.current, { opacity: 0, duration: 0.55, ease: "none" }, 0.1);

      // Clock ticks 3:00 → 5:42 AM
      const t = { m: 180 };
      tl.to(
        t,
        {
          m: 342,
          duration: 1,
          ease: "none",
          onUpdate: () => setMinutes(Math.round(t.m)),
        },
        0,
      );

      // Depth parallax between the two columns
      tl.to(copyRef.current, { y: -70, duration: 1, ease: "none" }, 0);
      tl.to(
        phoneRef.current,
        { y: -10, rotateX: 0, scale: 1, duration: 0.5, ease: "power2.out" },
        0,
      );
      tl.to(phoneRef.current, { y: 40, duration: 0.5, ease: "none" }, 0.5);

      // Scroll cue retires once the story starts
      tl.to(cueRef.current, { opacity: 0, y: 10, duration: 0.12 }, 0);

      // Conversation beats
      tl.to(userMsgRef.current, { y: 0, opacity: 1, duration: 0.15 }, 0);
      tl.to(typingRef.current, { opacity: 1, scale: 1, duration: 0.15 }, 0.15);
      tl.to(typingRef.current, { opacity: 0, duration: 0.05 }, 0.3);

      const rev = { n: 0 };
      tl.to(
        rev,
        {
          n: replyGraphemes.length,
          duration: 0.6,
          ease: "none",
          onUpdate: () => setReveal(Math.round(rev.n)),
        },
        0.3,
      );
      tl.to(replyRef.current, { opacity: 1, duration: 0.06 }, 0.3);
    },
    [calm, replyGraphemes.length],
  );

  return (
    <section
      id="three-am"
      ref={rootRef}
      className="relative min-h-screen overflow-hidden"
      style={{ color: calm ? "#2A2A26" : "#F6F0E2" }}
    >
      <div
        ref={bgRef}
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundColor: calm ? "#F6F0E2" : "#1A1F3A" }}
      />

      {/* Star field */}
      {!calm && (
        <div ref={starsRef} aria-hidden className="absolute inset-0">
          {stars.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-cream"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animation: `mm-typing 3.6s ${s.delay}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Dawn glow rising from the horizon */}
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70vh]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 100%, rgba(200,121,79,0.55) 0%, rgba(200,121,79,0.18) 42%, rgba(200,121,79,0) 72%)",
          opacity: calm ? 0.3 : 0,
        }}
      />

      {/* Progress rail */}
      {!calm && (
        <div
          aria-hidden
          className="absolute left-4 top-1/2 hidden h-40 w-px -translate-y-1/2 md:block"
          // currentColor animates cream → ink across the section, so the
          // track has to be derived from it rather than a fixed value.
          style={{
            backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)",
          }}
        >
          <span
            ref={railRef}
            className="absolute inset-0 block origin-top bg-terracotta"
            style={{ transform: "scaleY(0)" }}
          />
        </div>
      )}

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-20 md:grid-cols-2 md:px-10 md:py-28">
        {/* Left: copy */}
        <div ref={copyRef}>
          <p className="font-serif-brand text-sm uppercase tracking-[0.35em] tabular-nums opacity-70">
            {calm ? threeAm.eyebrow : clock}
          </p>
          <h2 className="mt-6 font-serif-brand text-3xl leading-tight md:text-5xl">
            {threeAm.headline}
          </h2>
          <p className="mt-6 max-w-md font-ui text-base leading-relaxed opacity-80 md:text-lg">
            {threeAm.body}
          </p>

          {!calm && (
            <div
              ref={cueRef}
              className="mt-10 flex items-center gap-3 font-ui text-xs uppercase tracking-[0.25em] opacity-60"
            >
              <span
                className="relative block h-8 w-px"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, currentColor 40%, transparent)",
                }}
              >
                <span className="absolute inset-x-[-1px] top-0 h-3 animate-[mm-typing_2s_ease-in-out_infinite] bg-current" />
              </span>
              scroll to stay
            </div>
          )}
        </div>

        {/* Right: phone frame */}
        <div className="justify-self-center">
          <div
            ref={phoneRef}
            className="relative mx-auto w-[300px] rounded-[36px] border border-cream/20 bg-[#0f1224]/60 p-4 shadow-2xl backdrop-blur-sm md:w-[340px]"
          >
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-cream/25" />
            <div className="min-h-[440px] rounded-2xl bg-[#0b0e1e]/70 p-4">
              {/* User message */}
              <div ref={userMsgRef} className="mb-4 flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-terracotta px-4 py-3 font-ui text-sm text-cream">
                  {threeAm.chat[0].text}
                </div>
              </div>

              {/* Typing */}
              <div ref={typingRef} className="mb-4 flex">
                <div className="rounded-2xl rounded-bl-md bg-cream/10 px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block h-2 w-2 rounded-full bg-cream/70"
                        style={{
                          animation: calm
                            ? undefined
                            : `mm-typing 1.2s ${i * 0.15}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Reply */}
              <div ref={replyRef} className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-cream/95 px-4 py-3 font-ui text-sm text-ink">
                  {replyGraphemes.slice(0, reveal).join("")}
                  {reveal < replyGraphemes.length && (
                    <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] bg-terracotta" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
