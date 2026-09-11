import { useEffect, useRef, useState } from "react";
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
  /** Whether OpenThread is rendered on the page this scroll. See below. */
  hasThread?: boolean;
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
 *
 * "Thread" is dropped from that list unless `hasThread` is true: OpenThread
 * (`#thread`) only renders when there is an open thread to resume, so the
 * link would otherwise point at nothing on the majority of visits.
 */
export function Nav({ firstName, initials, context, hasThread = false }: NavProps) {
  const links = hasThread ? LINKS : LINKS.filter((link) => link.href !== "#thread");

  const [scrolled, setScrolled] = useState(false);
  // The bar only has two states, so only the two crossings of the threshold are
  // worth telling React about. Dispatching on every scroll event and letting the
  // reducer bail on an unchanged value is not free: measured at ~2.2ms per call
  // under 4x CPU throttle, 202 calls over one screen-height scroll and back —
  // 447ms, the largest single JS cost left on this page.
  const scrolledRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 24;
      if (next === scrolledRef.current) return;
      scrolledRef.current = next;
      setScrolled(next);
    };
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
        Two backings, one foreground. The bar used to float on the hero
        photograph and had to borrow a per-hour measured ink to stay legible;
        the greeting is paper now, so `nr-fg` is correct on both the bare page
        and the glass, and only the backing animates.
      */}
      <nav
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3 text-nr-fg transition-all duration-700",
          scrolled ? "nr-glass mx-4 md:mx-auto" : "border border-transparent",
        )}
      >
        <a href="#top" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-nr-ink font-nr-display text-base text-nr-paper">
            m
          </span>
          <span className="font-nr-display text-xl leading-none">MindMitra</span>
        </a>

        <ul className="hidden items-center gap-9 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="nr-label nr-label-strong nr-nav-link transition-opacity duration-500"
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
            className="hidden items-center gap-3 rounded-full border border-nr-border py-1.5 pr-5 pl-1.5 transition-colors duration-500 hover:border-nr-mood sm:inline-flex"
            aria-label={`Signed in as ${firstName} — open your profile`}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-nr-ink font-nr-display text-sm text-nr-paper">
              {initials}
            </span>
            <span className="text-left leading-tight">
              <span className="block text-sm font-medium">{firstName}</span>
              <span className="nr-label nr-label-strong block">{context}</span>
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
