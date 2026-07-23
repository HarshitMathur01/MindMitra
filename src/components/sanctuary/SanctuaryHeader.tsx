import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function SanctuaryHeader({ name }: { name: string }) {
  const { t } = useTranslation("sanctuary");
  const initial = (name?.charAt(0) ?? "M").toUpperCase();
  return (
    <header
      className="sticky top-0 z-30 w-full backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in oklab, var(--paper-soft) 80%, transparent)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-12 md:py-5">
        <Link
          to="/"
          className="flex items-center gap-2.5 group"
          aria-label={t("header.logoAria")}
        >
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
          className="hidden items-center gap-6 text-xs uppercase tracking-[0.25em] md:flex"
          style={{ color: "var(--ink-soft)" }}
        >
          <a href="#checkin" className="transition-colors hover:text-[var(--ink)]">
            {t("header.navCheckin")}
          </a>
          <a href="#doors" className="transition-colors hover:text-[var(--ink)]">
            {t("header.navDoors")}
          </a>
          <a href="#practice" className="transition-colors hover:text-[var(--ink)]">
            {t("header.navPractice")}
          </a>
          <a href="#reflect" className="transition-colors hover:text-[var(--ink)]">
            {t("header.navReflection")}
          </a>
          <span aria-hidden style={{ color: "var(--ink-faint)" }}>
            ·
          </span>
          <Link to="/me" className="transition-colors hover:text-[var(--ink)]">
            {t("header.navMemory")}
          </Link>
          <Link to="/settings" className="transition-colors hover:text-[var(--ink)]">
            {t("header.navSettings")}
          </Link>
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
          aria-label={t("header.profileAria")}
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}
