import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type RevealTag = Extract<ElementType, "div" | "section" | "li" | "span" | "article">;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger, in ms. Applied as `transition-delay`, so it costs no timers. */
  delay?: number;
  as?: RevealTag;
  /** Merged under the delay — Reveal owns `transitionDelay`, callers own the rest. */
  style?: CSSProperties;
}

/**
 * The scroll-in primitive for the Night River home: fades and lifts its child
 * once it enters the viewport, then disconnects. Every section uses it.
 *
 * The transition itself lives in river.css (`.nr-reveal` / `.nr-reveal-in`) so
 * the initial hidden state is painted by CSS on first frame — if it were driven
 * from JS the content would flash at full opacity before the observer ran.
 *
 * Note this does NOT use framer-motion's `whileInView`, which the rest of the
 * app reaches for. The design is deliberately CSS-only motion, and a page with
 * this many revealed nodes is measurably cheaper with one observer per node
 * than with a motion value per node.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (old WebViews) → show immediately rather than
    // leaving the page permanently blank.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      // Fire *before* the element is on screen, not after. The previous
      // `-8%` bottom margin shrank the root, so a section had to be well
      // inside the viewport before its fade even started — the animation was
      // still running under the user's eyes as they scrolled past it.
      // 200px on both edges so the work starts in the approach, whichever
      // direction the scroll came from (a restored scroll position lands
      // mid-page and reveals upward).
      { threshold: 0, rootMargin: "200px 0px 200px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // React 18 has no ref-as-prop, and a polymorphic tag can't be typed against a
  // single ref shape, so the cast is load-bearing rather than laziness.
  const Component = Tag as "div";

  return (
    <Component
      ref={ref as React.RefObject<HTMLDivElement>}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
      className={cn("nr-reveal", shown && "nr-reveal-in", className)}
    >
      {children}
    </Component>
  );
}
