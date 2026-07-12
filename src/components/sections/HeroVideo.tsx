import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type CTA = { text: string; href: string };

interface HeroVideoProps {
  headline: string;
  subheadline?: string;
  primaryCta: CTA;
  secondaryCta?: CTA;
  posterSrc?: string;
  mp4Src?: string;
  webmSrc?: string;
  mobileMp4Src?: string;
  /**
   * When false (default), only the poster + layered scrim render — faster LCP,
   * no decode cost, better control over contrast. Set true to restore loop video.
   */
  showVideo?: boolean;
}

const DEFAULTS = {
  poster: "/video/hero-poster.jpg",
  mp4: "/video/hero.mp4",
  webm: "/video/hero.webm",
  mobileMp4: "/video/hero-mobile.mp4",
};

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function useSlowConnection(): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const conn = (
      navigator as Navigator & {
        connection?: {
          effectiveType?: string;
          saveData?: boolean;
          addEventListener?: (e: string, h: () => void) => void;
          removeEventListener?: (e: string, h: () => void) => void;
        };
      }
    ).connection;
    if (!conn) return;
    const update = () => {
      const t = conn.effectiveType;
      setSlow(Boolean(conn.saveData) || t === "2g" || t === "slow-2g");
    };
    update();
    conn.addEventListener?.("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);
  return slow;
}

function useInView<T extends Element>(rootMargin = "200px"): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, inView];
}

/**
 * Marketing hero: poster-first with optional muted loop video.
 * Scroll-safe contrast via layered scrims that follow QC canvas tokens.
 */
export function HeroVideo({
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  posterSrc = DEFAULTS.poster,
  mp4Src = DEFAULTS.mp4,
  webmSrc = DEFAULTS.webm,
  mobileMp4Src = DEFAULTS.mobileMp4,
  showVideo = false,
}: HeroVideoProps) {
  const [sectionRef, inView] = useInView<HTMLElement>("200px");
  const reduce = useReducedMotion();
  const visible = usePageVisible();
  const slow = useSlowConnection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const shouldRenderVideo = showVideo && inView && !reduce && !slow && !failed;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) {
      v.play().catch(() => {
        /* autoplay blocked — poster stays */
      });
    } else {
      v.pause();
    }
  }, [visible, shouldRenderVideo]);

  const headlineWords = headline.split(" ");
  const childEase = reduce ? ([0, 0, 1, 1] as const) : ([0.22, 1, 0.36, 1] as const);

  // Serve the hero (the landing LCP element) as responsive AVIF/WebP derived
  // from the poster path, so first paint on a phone pulls ~50 kB (AVIF 1024)
  // instead of the 219 kB JPEG. The JPG stays as the <img> fallback for the
  // rare browser without WebP/AVIF. Variants are emitted by
  // `npm run optimize:hero-poster`.
  const posterStem = posterSrc.replace(/\.[a-z]+$/i, "");
  const avifSrcSet = `${posterStem}-1024.avif 1024w, ${posterStem}-1920.avif 1920w`;
  const webpSrcSet = `${posterStem}-1024.webp 1024w, ${posterStem}-1920.webp 1920w`;

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[85vh] flex-col items-center justify-center overflow-hidden pt-[var(--header-height)] sm:min-h-[90vh] md:min-h-screen"
    >
      <picture className="contents">
        <source type="image/avif" srcSet={avifSrcSet} sizes="100vw" />
        <source type="image/webp" srcSet={webpSrcSet} sizes="100vw" />
        <img
          src={posterSrc}
          alt=""
          aria-hidden
          decoding="async"
          fetchpriority="high"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center scale-[1.02]"
        />
      </picture>

      {shouldRenderVideo && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          aria-hidden
          role="presentation"
          controlsList="nodownload"
          disablePictureInPicture
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-center transition-opacity duration-700 ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={webmSrc} type="video/webm" media="(min-width: 768px)" />
          <source src={mp4Src} type="video/mp4" media="(min-width: 768px)" />
          <source src={mobileMp4Src} type="video/mp4" media="(max-width: 767px)" />
        </video>
      )}

      {/* Readability: bottom-weighted scrim so headings stay legible on busy posters */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 90% 75% at 50% 18%, transparent 0%, color-mix(in oklab, var(--qc-canvas) 50%, transparent) 52%, color-mix(in oklab, var(--qc-canvas) 90%, transparent) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--qc-canvas) 20%, transparent) 45%, color-mix(in oklab, var(--qc-canvas) 85%, transparent) 100%)",
        }}
      />

      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-1/4 top-1/3 -z-10 h-[min(80vw,520px)] w-[min(80vw,520px)] rounded-full opacity-[0.14]"
          style={{ background: "radial-gradient(circle, var(--qc-sage) 0%, transparent 70%)" }}
          animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="relative z-10 mx-auto w-full max-w-[800px] px-5 pb-12 pt-6 text-center sm:px-8">
        <h1 className="qc-display text-balance text-[clamp(2.15rem,5.2vw,3.75rem)] leading-[1.08] text-[color:var(--qc-ink)] [text-shadow:0_1px_2px_color-mix(in_oklab,var(--qc-canvas)_80%,transparent)]">
          {headlineWords.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              className="inline-block overflow-hidden align-bottom"
              initial={false}
            >
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: reduce ? 0 : "0.35em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduce ? 0.01 : 0.55,
                  delay: reduce ? 0 : 0.06 + i * 0.045,
                  ease: childEase,
                }}
              >
                {w}
                {i < headlineWords.length - 1 ? "\u00a0" : ""}
              </motion.span>
            </motion.span>
          ))}
        </h1>

        {subheadline && (
          <motion.p
            className="mx-auto mt-6 max-w-[52ch] text-pretty text-[clamp(1rem,2.1vw,1.2rem)] leading-[1.65] text-[color:var(--qc-ink-soft)]"
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduce ? 0.01 : 0.55,
              delay: reduce ? 0 : 0.35,
              ease: childEase,
            }}
          >
            {subheadline}
          </motion.p>
        )}

        <motion.div
          className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center"
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduce ? 0.01 : 0.5,
            delay: reduce ? 0 : 0.52,
            ease: childEase,
          }}
        >
          <a href={primaryCta.href} className="qc-pill-primary min-h-[48px] px-8 py-3 text-center">
            {primaryCta.text}
          </a>
          {secondaryCta && (
            <a href={secondaryCta.href} className="qc-pill-outline min-h-[48px] px-8 py-3 text-center">
              {secondaryCta.text}
            </a>
          )}
        </motion.div>
      </div>
    </section>
  );
}

export default HeroVideo;
