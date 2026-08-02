import { trust } from "./copy";

/**
 * TRUST STRIP — infinite marquee.
 *
 * The track is duplicated so a `translateX(-50%)` loop is seamless; the
 * `marquee-fade` mask softens both edges. Pauses on hover AND focus-within
 * so a keyboard user can read a label without chasing it.
 *
 * Reduced-motion audit: the animation is killed by the
 * `prefers-reduced-motion` rule in landing.css — the track simply sits
 * still and every label stays readable.
 */
export function TrustStrip() {
  // Duplicate the track so the -50% translate loops seamlessly.
  const items = [...trust, ...trust];

  return (
    <section
      aria-label="Endorsements and recognitions"
      className="relative overflow-hidden border-y border-ink/8 bg-cream/70 py-8 md:py-10"
    >
      <div className="marquee-fade group">
        <div className="anim-marquee flex min-w-max items-center gap-14 whitespace-nowrap group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]">
          {items.map((t, i) => (
            <div key={`${t.label}-${i}`} className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-terracotta/70" />
              <span className="font-serif-brand text-sm uppercase tracking-[0.18em] text-forest/85 md:text-base">
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
