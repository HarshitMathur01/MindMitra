import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useReadingProgress } from "@/hooks/useReadingProgress";

export function makeArticleStepId(prefix: string, index: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${index}-${slug || "step"}`;
}

/** Sticky thin bar below the header; tracks page scroll depth. */
export function ArticleScrollProgress() {
  const p = useReadingProgress();
  const pct = Math.round(p * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
      className="sticky top-14 z-40 print:hidden"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-[hsl(var(--ink-2))]/90 dark:bg-[hsl(var(--ink-3))]/40">
          <div
            className="h-full rounded-full bg-[hsl(var(--accent-500))] transition-[width] duration-150 ease-out dark:bg-[hsl(var(--accent-400))]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export type ArticleTocItem = { id: string; label: string };

type ArticleOnThisPageNavProps = {
  items: ArticleTocItem[];
  variant?: "sidebar" | "bar";
  className?: string;
};

const scrollOffset = 112;

/**
 * In-page anchors with scroll spy. Use `scroll-mt-28` (or similar) on target sections.
 */
export function ArticleOnThisPageNav({ items, variant = "sidebar", className }: ArticleOnThisPageNavProps) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;

    const onScroll = () => {
      let current = items[0].id;
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= scrollOffset) current = id;
      }
      setActive(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (items.length === 0) return null;

  if (variant === "bar") {
    return (
      <nav aria-label="On this page" className={cn("-mx-1 flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
        {items.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-left text-[13px] font-medium transition-colors",
              active === id
                ? "border-[hsl(var(--accent-500))]/40 bg-[hsl(var(--accent-100))]/50 text-ink-8 dark:bg-[hsl(var(--accent-100))]/15 dark:text-ink-8"
                : "border-ink-3/25 bg-[hsl(var(--card))]/80 text-ink-6 hover:border-ink-3/40 hover:text-ink-8",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="On this page" className={cn("rounded-[1.25rem] border border-ink-3/30 bg-[hsl(var(--card))] p-4 shadow-dashboard-soft lg:sticky lg:top-28", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">On this page</p>
      <ul className="mt-3 space-y-1">
        {items.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => go(id)}
              className={cn(
                "w-full rounded-lg px-2 py-1.5 text-left text-[13.5px] leading-snug transition-colors",
                active === id ? "bg-[hsl(var(--ink-1))] font-medium text-ink-8" : "text-ink-6 hover:bg-[hsl(var(--ink-1))]/60 hover:text-ink-8",
              )}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
