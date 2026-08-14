import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { label: "Doors", href: "#doors" },
  { label: "Practice", href: "#practice" },
  { label: "Thread", href: "#thread" },
];

interface NavProps {
  firstName: string;
  initials: string;
  /** e.g. "23 check-ins" — the quiet context line under the name. */
  context: string;
}

/**
 * The Night River header. Page-local, like SanctuaryHeader before it: `/`
 * never renders the global <Header>, because both branches of the route bring
 * their own (see src/pages/Index.tsx).
 *
 * The anchor list is deliberately shorter than the design's. That version
 * linked `#why`, `#reflection` and `#waitlist`, none of which exist as
 * sections — `#reflection` was never built and a waitlist makes no sense on a
 * page only signed-in users can reach.
 */
export function Nav({ firstName, initials, context }: NavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-700",
        scrolled ? "py-2" : "py-5",
      )}
    >
      {/*
        Until it scrolls, the bar is transparent and floating directly on the
        hero photograph, so it has to borrow the hero's measured foreground —
        the page colour is unreadable on half the hillsides. Once `nr-glass`
        kicks in it has its own backing and reverts to the page colour.
      */}
      <nav
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3 transition-all duration-700",
          scrolled
            ? "nr-glass mx-4 text-nr-fg md:mx-auto"
            : "border border-transparent text-nr-hero-fg",
        )}
      >
        <a href="#top" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-nr-ink font-nr-display text-base text-nr-paper">
            m
          </span>
          <span className="font-nr-display text-xl leading-none">MindMitra</span>
        </a>

        <ul className="hidden items-center gap-9 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  "nr-label nr-label-strong nr-nav-link transition-opacity duration-500",
                  !scrolled && "nr-hero-ink",
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/profile"
            data-prefetch="/profile"
            className={cn(
              "hidden items-center gap-3 rounded-full border py-1.5 pr-5 pl-1.5 transition-colors duration-500 hover:border-nr-mood sm:inline-flex",
              scrolled ? "border-nr-border" : "border-nr-hero-border",
            )}
            aria-label={`Signed in as ${firstName} — open your profile`}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-nr-ink font-nr-display text-sm text-nr-paper">
              {initials}
            </span>
            <span className="text-left leading-tight">
              <span className="block text-sm font-medium">{firstName}</span>
              {/*
                Same conditional as the bar's own colour above, for the same
                reason: unscrolled this label is floating on the photograph and
                needs the hero ink and its halo, but once `nr-glass` is behind
                it that halo would be a glow against a flat backing. `nr-hero-ink`
                carries no metrics, so nothing resizes as the bar transitions.
              */}
              <span className={cn("nr-label nr-label-strong block", !scrolled && "nr-hero-ink")}>
                {context}
              </span>
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
