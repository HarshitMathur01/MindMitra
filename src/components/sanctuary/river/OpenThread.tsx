import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { OpenThread as OpenThreadData } from "./useOpenThread";

/** Characters shown before hover. The rest types itself in. */
const PREVIEW_CHARS = 90;
const TYPE_MS = 42;

interface OpenThreadProps {
  firstName: string;
  thread: NonNullable<OpenThreadData>;
}

/**
 * "You left this open." A tilting card over the user's last journal entry, or
 * a plain resume prompt when the only open thing is a chat session.
 *
 * One deliberate change from the design source: there, hovering typed out an
 * *invented* continuation of the user's sentence. This product does not put
 * words in the user's mouth — a fabricated "I keep coming back to the sound of
 * his voice" attributed to their own journal is a trust break, not a flourish.
 * The typewriter reveals the rest of what they actually wrote instead, so the
 * mechanic survives and the content is always theirs.
 */
export function OpenThread({ firstName, thread }: OpenThreadProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const [typed, setTyped] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [ripple, setRipple] = useState(false);

  const { preview, rest } = useMemo(() => {
    if (thread.kind !== "journal") return { preview: "", rest: "" };
    const text = thread.text.replace(/\s+/g, " ").trim();
    if (text.length <= PREVIEW_CHARS) return { preview: text, rest: "" };
    // Break on a word boundary so the preview never cuts mid-word.
    const cut = text.lastIndexOf(" ", PREVIEW_CHARS);
    const at = cut > PREVIEW_CHARS * 0.6 ? cut : PREVIEW_CHARS;
    return { preview: text.slice(0, at), rest: text.slice(at) };
  }, [thread]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ rotateX: (0.5 - y) * 8, rotateY: (x - 0.5) * 8 });
    setGlow({ x: x * 100, y: y * 100 });
  };

  const handleLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
    setGlow({ x: 50, y: 50 });
    setHovered(false);
  };

  useEffect(() => {
    if (!hovered || !rest) {
      setTyped(0);
      return;
    }
    if (reducedMotion) {
      setTyped(rest.length);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= rest.length) window.clearInterval(id);
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [hovered, rest, reducedMotion]);

  const onDismiss = () => {
    setDismissed(true);
    setRipple(true);
    window.setTimeout(() => setRipple(false), 900);
  };

  const isJournal = thread.kind === "journal";

  return (
    <div id="thread" className="mx-auto max-w-6xl scroll-mt-28 px-6 lg:h-full">
      <Reveal className="h-full">
        <div
          ref={cardRef}
          onMouseMove={handleMove}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={handleLeave}
          className={cn(
            "relative flex h-full flex-col overflow-hidden rounded-3xl border border-nr-border bg-nr-card p-7 transition-transform duration-200 ease-out md:p-9",
            dismissed && "min-h-[12rem]",
          )}
          style={{
            perspective: "1000px",
            transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-24 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, color-mix(in oklab, var(--nr-mood) 35%, transparent), transparent 55%)`,
              opacity: hovered ? 0.55 : 0.22,
            }}
          />

          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ background: "color-mix(in oklab, var(--nr-mood) 70%, transparent)" }}
          />

          {ripple && (
            <span
              aria-hidden
              className="nr-anim-ripple absolute inset-0 z-0 rounded-3xl"
              style={{ background: "color-mix(in oklab, var(--nr-mood) 20%, transparent)" }}
            />
          )}

          <div className="relative z-10 flex flex-col gap-5">
            {!dismissed ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span
                      aria-hidden
                      className="nr-anim-breathe absolute inset-0 rounded-full"
                      style={{ background: "var(--nr-mood)" }}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full opacity-50"
                      style={{ background: "var(--nr-mood)" }}
                    />
                  </span>
                  <p className="nr-label text-nr-fg">
                    Still open{isJournal ? ` · ${thread.day}` : ""}
                  </p>
                </div>

                {isJournal ? (
                  <blockquote className="font-nr-display text-2xl leading-snug text-nr-fg md:text-3xl">
                    &ldquo;{preview}
                    {hovered && typed > 0 && (
                      <span className="text-nr-fg/70">{rest.slice(0, typed)}</span>
                    )}
                    {rest && (
                      <span
                        aria-hidden
                        className={cn(
                          "ml-1 inline-block text-nr-mood",
                          hovered && typed < rest.length && "nr-anim-caret",
                        )}
                      >
                        &#9474;
                      </span>
                    )}
                    {(!rest || (hovered && typed >= rest.length)) && (
                      <span className="text-nr-fg/60">&rdquo;</span>
                    )}
                  </blockquote>
                ) : (
                  <p className="font-nr-display text-2xl leading-snug text-nr-fg md:text-3xl">
                    Your conversation is exactly where you left it.
                  </p>
                )}

                <p className="max-w-sm text-sm leading-relaxed text-nr-muted">
                  {isJournal && rest && hovered
                    ? "Your own words, still here in full."
                    : `${firstName}, nothing here expired. The page is exactly where you left it.`}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                  <Link
                    to={thread.to}
                    data-prefetch={thread.to}
                    className="group inline-flex items-center gap-2 rounded-full bg-nr-gold/40 px-6 py-3 font-nr-display text-lg text-nr-fg transition-all duration-500 hover:gap-3 hover:bg-nr-gold/60 active:scale-95"
                  >
                    pick it up
                    <ArrowRight
                      className="size-4 transition-transform duration-500 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>

                  <button
                    type="button"
                    onClick={onDismiss}
                    className="inline-flex items-center gap-2 rounded-full border border-nr-border px-4 py-2.5 text-sm text-nr-muted transition-colors duration-500 hover:text-nr-fg"
                  >
                    leave it for now
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-start justify-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-nr-mood" aria-hidden />
                  <p className="nr-label text-nr-fg">Set aside</p>
                </div>
                <p className="max-w-xs text-sm leading-relaxed text-nr-muted">
                  {firstName}, this thread is still here. It will keep the light on until you come
                  back.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDismissed(false);
                    setHovered(false);
                    setTyped(0);
                  }}
                  className="group inline-flex items-center gap-2 rounded-full bg-nr-gold/40 px-5 py-2.5 font-nr-display text-nr-fg transition-all duration-500 hover:bg-nr-gold/60"
                >
                  <RotateCcw
                    className="size-4 transition-transform duration-500 group-hover:-rotate-90"
                    aria-hidden
                  />
                  bring it back
                </button>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
