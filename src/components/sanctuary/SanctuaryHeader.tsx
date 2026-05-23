import { Link } from "react-router-dom";

export function SanctuaryHeader({ name }: { name: string }) {
  const initial = (name?.charAt(0) ?? "M").toUpperCase();
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-12 md:py-8">
      <Link to="/" className="flex items-center gap-2.5 group">
        <span
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          aria-hidden
        >
          <span
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
            className="text-lg leading-none"
          >
            m
          </span>
        </span>
        <span
          className="text-base tracking-tight"
          style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
        >
          MindMitra
        </span>
      </Link>

      <nav
        className="hidden items-center gap-7 text-xs uppercase tracking-[0.25em] md:flex"
        style={{ color: "var(--ink-soft)" }}
      >
        <a href="#doors" className="transition-colors hover:text-[var(--ink)]">
          Doors
        </a>
        <a href="#practice" className="transition-colors hover:text-[var(--ink)]">
          Today
        </a>
        <a href="#reflection" className="transition-colors hover:text-[var(--ink)]">
          Reflect
        </a>
      </nav>

      <Link
        to="/profile"
        className="grid h-10 w-10 place-items-center rounded-full border text-sm font-medium transition-colors"
        style={{
          borderColor: "var(--border)",
          color: "var(--ink)",
          fontFamily: "var(--font-serif)",
          backgroundColor: "var(--paper)",
        }}
        aria-label="Account menu"
      >
        {initial}
      </Link>
    </header>
  );
}
