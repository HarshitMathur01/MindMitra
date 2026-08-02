import proofImg from "@/assets/portraits/proof-still-life.jpg";
import { proof } from "./copy";
import { TornDivider } from "./TornDivider";

/**
 * THE PROOF section — an editorial "sand" spread: warm still life,
 * magazine-style copy, and a pull quote.
 *
 * Reduced-motion audit: fully static, no motion.
 */
export function ProofSection() {
  return (
    <section id="proof" className="relative overflow-hidden bg-sand-light">
      <TornDivider fill="#FAF8F5" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-24 md:px-12 md:py-32 lg:px-24">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-24">
          {/* Image column */}
          <div className="relative lg:col-span-5">
            <div className="absolute -inset-4 -z-10 translate-x-2 translate-y-2 border border-sand-tan/40" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-sand shadow-2xl">
              <img
                src={proofImg}
                alt={proof.imageAlt}
                width={1024}
                height={1280}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-sand-brown/5" />
            </div>
            <div className="mt-6 hidden lg:block">
              <p className="font-editorial-sans text-[10px] font-semibold uppercase italic tracking-[0.3em] text-sand-tan">
                {proof.plate}
              </p>
            </div>
          </div>

          {/* Copy column */}
          <div className="space-y-10 lg:col-span-7">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px w-8 bg-sand-tan" />
                <span className="font-editorial-sans text-xs font-semibold uppercase italic tracking-[0.2em] text-sand-brown">
                  {proof.eyebrow}
                </span>
              </div>
              <h2 className="font-editorial-serif text-4xl leading-[1.15] text-sand-brown md:text-5xl lg:text-6xl">
                {proof.headline}
              </h2>
            </div>

            <div className="relative py-2">
              <p className="relative z-10 font-editorial-serif text-2xl italic leading-relaxed text-sand-brown md:text-3xl">
                {proof.statement}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 border-t border-sand-tan/30 pt-6 md:grid-cols-2">
              <p className="font-editorial-sans leading-relaxed text-sand-brown opacity-90">
                {proof.body}
              </p>
              <p className="font-editorial-sans leading-relaxed text-sand-brown opacity-90">
                {proof.aside}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
