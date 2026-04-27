import { useEffect, useRef, useState } from "react";
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
}

const DEFAULTS = {
  poster: "/video/hero-poster.jpg",
  mp4: "/video/hero.mp4",
  webm: "/video/hero.webm",
  mobileMp4: "/video/hero-mobile.mp4",
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

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
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean; addEventListener?: (e: string, h: () => void) => void; removeEventListener?: (e: string, h: () => void) => void } }).connection;
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

function useInView<T extends Element>(rootMargin = "200px"): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
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
 * Full-bleed hero video for the public landing. Decorative loop
 * (muted, no audio toggle) layered behind the headline + CTAs.
 *
 * Fallback chain: webm → mp4 (desktop), mp4 (mobile <768px), and
 * a poster image that is always rendered as the LCP base layer.
 * Reduced-motion, slow-connection, save-data, and load failures
 * all collapse to poster-only — no video element is mounted.
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
}: HeroVideoProps) {
  const [sectionRef, inView] = useInView<HTMLElement>("200px");
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  const slow = useSlowConnection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const shouldRenderVideo = inView && !reduced && !slow && !failed;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) {
      v.play().catch(() => {/* autoplay blocked — poster stays */});
    } else {
      v.pause();
    }
  }, [visible, shouldRenderVideo]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[80vh] flex-col items-center justify-center overflow-hidden pt-[var(--header-height)] md:min-h-screen"
    >
      <img
        src={posterSrc}
        alt=""
        aria-hidden
        decoding="async"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />

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
            "pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-center transition-opacity duration-[600ms] ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={webmSrc} type="video/webm" media="(min-width: 768px)" />
          <source src={mp4Src} type="video/mp4" media="(min-width: 768px)" />
          <source src={mobileMp4Src} type="video/mp4" media="(max-width: 767px)" />
        </video>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(245,237,224,0) 0%, rgba(245,237,224,0.40) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[720px] px-6 text-center">
        <h1 className="qc-display text-[clamp(2.4rem,5.4vw,4rem)] text-[color:var(--qc-ink)]">
          {headline}
        </h1>
        {subheadline && (
          <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-[1.6] text-[color:var(--qc-ink-soft)]">
            {subheadline}
          </p>
        )}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href={primaryCta.href} className="qc-pill-primary">
            {primaryCta.text}
          </a>
          {secondaryCta && (
            <a href={secondaryCta.href} className="qc-pill-outline">
              {secondaryCta.text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroVideo;
