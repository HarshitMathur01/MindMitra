import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useLowTierDevice } from "@/hooks/useLowTierDevice";
import { useGsapContext } from "@/hooks/useGsapContext";
import { hero, brand } from "./copy";
import { splitGraphemes } from "./graphemes";
import { WatercolorBlob } from "./WatercolorBlob";
import { MagneticButton } from "./MagneticButton";

gsap.registerPlugin(ScrollTrigger);

/**
 * HERO — ink bleed reveal.
 *
 *  - Headline split by GRAPHEME cluster (not by char) so Devanagari matras
 *    and conjuncts survive; 28ms stagger, y 14→0, blur 6→0.
 *  - The #mm-ink-bleed feTurbulence baseFrequency tweens 0.02 → 0.008 over
 *    1.6s, so the type looks like it's settling into wet paper.
 *  - Three watercolour blobs on independent scrub parallax + sine drift.
 *  - 40 canvas dust motes.
 *
 * The markup renders complete and legible before any of this runs — GSAP
 * only enhances, it never reveals.
 *
 * Reduced-motion audit: reduced → no stagger, no blur, no ink-bleed filter,
 * no parallax, no particles; graphemes sit at their final position on first
 * paint. Low-tier device → keep the entrance stagger, drop particles and
 * scrub parallax.
 */
export function Hero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const lowTier = useLowTierDevice();

  // Split into words first so line-wrapping never breaks mid-word, then into
  // graphemes for the per-character reveal.
  const headlineWords = hero.headline
    .split(" ")
    .map((word) => splitGraphemes(word));

  useGsapContext(
    rootRef,
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (!reduced) {
        const turb = document.getElementById("mm-ink-turb");
        if (turb) {
          const obj = { f: 0.02 };
          tl.to(
            obj,
            {
              f: 0.008,
              duration: 1.6,
              ease: "power2.out",
              onUpdate: () => turb.setAttribute("baseFrequency", obj.f.toFixed(4)),
            },
            0,
          );
        }

        tl.from(
          ".mm-hero-grapheme",
          {
            y: 14,
            opacity: 0,
            filter: "blur(6px)",
            stagger: 0.028,
            duration: 0.9,
            ease: "power3.out",
          },
          0.1,
        );
        tl.from(
          [".mm-hero-sub", ".mm-hero-cta", ".mm-hero-secondary"],
          {
            y: 18,
            opacity: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
          },
          1.0,
        );
      } else {
        // Reduced motion: a gentle cross-fade and nothing else.
        tl.from([".mm-hero-headline", ".mm-hero-sub", ".mm-hero-cta"], {
          opacity: 0,
          duration: 0.2,
        });
      }

      // Scrub parallax on the blobs. Created inside the gsap context so
      // ctx.revert() kills the ScrollTriggers on unmount.
      if (!reduced && !lowTier) {
        gsap.utils.toArray<HTMLElement>(".mm-hero-blob").forEach((el, i) => {
          const depth = [80, 140, 220][i] ?? 100;
          gsap.to(el, {
            y: depth,
            ease: "none",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        });
      }
    },
    [reduced, lowTier],
  );

  // Dust motes.
  useEffect(() => {
    if (reduced || lowTier) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;

    const resize = () => {
      const { width, height } = cvs.getBoundingClientRect();
      cvs.width = width * dpr;
      cvs.height = height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const motes = Array.from({ length: 40 }, () => ({
      x: Math.random() * cvs.width,
      y: Math.random() * cvs.height,
      r: (Math.random() * 1.6 + 0.4) * dpr,
      vx: (Math.random() - 0.5) * 0.12 * dpr,
      vy: (Math.random() - 0.5) * 0.12 * dpr,
      a: Math.random() * 0.4 + 0.1,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < 0 || m.x > cvs.width) m.vx *= -1;
        if (m.y < 0 || m.y > cvs.height) m.vy *= -1;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(42,42,38,${m.a * 0.35})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced, lowTier]);

  return (
    <section
      id="top"
      ref={rootRef}
      className="relative isolate overflow-hidden pb-24 pt-16 md:pb-40 md:pt-24"
    >
      {/* Blobs */}
      <WatercolorBlob
        fill="#8FA68E"
        opacity={0.55}
        seed={3}
        className="mm-hero-blob anim-drift-a left-[-6%] top-[6%] h-[420px] w-[420px] md:h-[560px] md:w-[560px]"
      />
      <WatercolorBlob
        fill="#C8794F"
        opacity={0.4}
        seed={5}
        className="mm-hero-blob anim-drift-b right-[-8%] top-[18%] h-[360px] w-[360px] md:h-[520px] md:w-[520px]"
      />
      <WatercolorBlob
        fill="#1B3A2B"
        opacity={0.22}
        seed={9}
        className="mm-hero-blob anim-drift-c bottom-[-10%] left-[30%] h-[420px] w-[420px] md:h-[600px] md:w-[600px]"
      />

      {/* Dust canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 text-center md:px-10">
        {/* Eyebrow: wordmark framed by hairline rules */}
        <div className="flex items-center gap-4">
          <span className="h-px w-8 bg-terracotta/40 sm:w-12" />
          <p className="font-serif-brand text-[11px] uppercase tracking-[0.4em] text-terracotta-ink sm:text-xs">
            {brand.name}
          </p>
          <span className="h-px w-8 bg-terracotta/40 sm:w-12" />
        </div>

        <h1
          className="mm-hero-headline mt-7 max-w-4xl text-balance font-serif-brand text-[2rem] leading-[1.12] tracking-[-0.015em] text-forest sm:text-5xl md:mt-9 md:text-[4.25rem]"
          style={{ filter: reduced ? undefined : "url(#mm-ink-bleed)" }}
          aria-label={hero.headline}
        >
          {headlineWords.map((word, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap" aria-hidden>
              {word.map((g, i) => (
                <span key={i} className="mm-hero-grapheme inline-block">
                  {g}
                </span>
              ))}
              {/* The separator below is a literal NBSP (U+00A0), not a
                  space — a regular space inside an inline-block collapses
                  to zero width and the words would run together. */}
              {wi < headlineWords.length - 1 ? (
                <span className="mm-hero-grapheme inline-block">{" "}</span>
              ) : null}
            </span>
          ))}
        </h1>

        <p className="mm-hero-sub mt-6 max-w-xl text-pretty font-ui text-[15px] leading-[1.75] text-ink/75 md:mt-8 md:text-lg md:leading-[1.8]">
          {hero.sub}
        </p>

        <div className="mm-hero-cta mt-10 flex w-full flex-col items-center justify-center gap-5 sm:w-auto sm:flex-row sm:gap-8 md:mt-12">
          <MagneticButton href={hero.ctaHref} ariaLabel={hero.cta}>
            {hero.cta}
          </MagneticButton>
          <a
            href={hero.ctaSecondaryHref}
            className="mm-hero-secondary ink-underline font-ui text-sm text-forest/75 decoration-terracotta transition-colors hover:text-forest md:text-base"
          >
            {hero.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}
