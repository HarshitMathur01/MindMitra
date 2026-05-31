import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Title shown in the modal header. */
  title: string;
  /** Small eyebrow above the title. Defaults to "How to play". */
  eyebrow?: string;
  /**
   * The game's scope class (e.g. "cc-chess" or "cl-scope"). The modal is
   * portalled to <body>, so we re-establish the scope here with
   * `display: contents` — that keeps the game's CSS custom properties and
   * `.scope .paper-card` / font rules resolving, without painting the scope's
   * own full-screen background.
   */
  scopeClassName: string;
  /** Filled "Got it" button colours — pass scope tokens so it matches the game. */
  solidBg: string;
  solidFg: string;
  children: ReactNode;
}

/**
 * Reusable, theme-agnostic "how to play" overlay for the MindGym Fun games.
 * Structural only: backdrop + centered paper-card + close (✕) + "Got it".
 * Each game supplies its own themed body via `children`. Closes on backdrop
 * click, Escape, and either button.
 */
export function GameRulesModal({
  open,
  onClose,
  title,
  eyebrow = "How to play",
  scopeClassName,
  solidBg,
  solidFg,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (open === false) return null;

  return createPortal(
    <div className={scopeClassName} style={{ display: "contents" }}>
      <style>{
        "@keyframes grm-fade{from{opacity:0}to{opacity:1}}" +
        "@keyframes grm-rise{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}" +
        "@media (prefers-reduced-motion: reduce){.grm-overlay,.grm-card{animation:none!important}}"
      }</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
        className="grm-overlay fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-4"
        style={{ background: "color-mix(in oklab, black 55%, transparent)", animation: "grm-fade 0.18s ease-out" }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="grm-card paper-card relative w-full max-w-lg max-h-[88vh] overflow-y-auto p-5 sm:p-7"
          style={{ animation: "grm-rise 0.24s cubic-bezier(0.22,1,0.36,1)" }}
        >
          <button
            onClick={onClose}
            aria-label="Close how to play"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md opacity-60 transition-opacity hover:opacity-100"
            style={{ border: "1px solid color-mix(in oklab, currentColor 25%, transparent)" }}
          >
            ✕
          </button>

          <p className="font-mono text-[11px] uppercase tracking-[0.25em] opacity-60 mb-2">{eyebrow}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight mb-4 pr-8">{title}</h2>

          <div className="space-y-4 text-sm leading-relaxed">{children}</div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="font-mono text-[11px] uppercase tracking-[0.2em] px-5 py-3 rounded-md transition-opacity hover:opacity-90"
              style={{ background: solidBg, color: solidFg }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
