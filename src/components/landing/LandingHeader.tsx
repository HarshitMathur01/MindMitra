import { brand, crisis, nav } from "./copy";
import { LandingLink } from "./LandingLink";

/**
 * Landing header — wordmark, in-page nav, sign-in, and a persistent crisis
 * link.
 *
 * The crisis affordance is never behind a menu, never below the fold, and
 * never depends on JS having hydrated: it is a plain `tel:` anchor rendered
 * in the first paint. That is deliberate and should stay that way.
 *
 * Reduced-motion audit: no motion.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/8 bg-cream/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4">
        <a href="#top" className="flex items-baseline gap-2">
          <span className="font-serif-brand text-2xl leading-none text-forest md:text-3xl">
            {brand.wordmark}
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-ui text-sm text-forest/80 transition-colors hover:text-forest"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          <LandingLink
            href="/auth"
            className="hidden font-ui text-sm text-forest/80 transition-colors hover:text-forest sm:inline"
          >
            Sign in
          </LandingLink>

          <a
            href={crisis.href}
            aria-label={`${crisis.label} — call ${crisis.name} on ${crisis.tel}, ${crisis.hours}`}
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm text-cream shadow-sm ring-1 ring-terracotta-ink/30"
          >
            <span aria-hidden className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cream/80" />
            </span>
            <span className="font-ui">{crisis.label}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
