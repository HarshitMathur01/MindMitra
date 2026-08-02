import { brand, crisis, footer } from "./copy";
import { LandingLink } from "./LandingLink";
import { TornDivider } from "./TornDivider";

/**
 * Landing footer — wordmark, the crisis line again (last thing on the page
 * as well as the first), and the two link columns.
 *
 * Reduced-motion audit: no motion.
 */
export function LandingFooter() {
  return (
    <footer className="relative bg-forest text-cream">
      <TornDivider fill="#1B3A2B" flip />
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-baseline gap-3">
              <span className="font-serif-brand text-3xl">{brand.wordmark}</span>
            </div>
            <p className="mt-4 max-w-sm font-serif-brand italic text-cream/80">
              {footer.tagline}
            </p>
            <a
              href={crisis.href}
              aria-label={`${crisis.label} — call ${crisis.name} on ${crisis.tel}, ${crisis.hours}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm text-cream ring-1 ring-terracotta-ink/40"
            >
              <span className="font-ui">{crisis.label}</span>
              <span className="font-ui text-cream/85">
                · {crisis.name} {crisis.tel}
              </span>
            </a>
          </div>

          {footer.cols.map((col) => (
            <div key={col.title}>
              <h4 className="font-serif-brand text-sm uppercase tracking-[0.25em] text-cream/60">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <LandingLink
                      href={l.href}
                      className="font-ui text-sm text-cream/85 transition-colors hover:text-terracotta"
                    >
                      {l.label}
                    </LandingLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-cream/15 pt-6 md:flex-row md:items-center">
          <p className="font-ui text-xs text-cream/60">
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <p className="font-serif-brand text-xs italic text-cream/50">
            {footer.madeWith}
          </p>
        </div>
      </div>
    </footer>
  );
}
