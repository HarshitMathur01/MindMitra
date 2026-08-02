import { useEffect, useRef, type DependencyList, type RefObject } from "react";
import gsap from "gsap";

/**
 * Runs `fn` inside a `gsap.context()` scoped to `scope`, and reverts the
 * whole context on unmount or dependency change.
 *
 * The context is what makes this safe under React StrictMode and route
 * transitions: every tween, ScrollTrigger and inline style created inside
 * `fn` is tracked and undone by `ctx.revert()`, so nothing leaks between
 * mounts.
 */
export function useGsapContext<T extends HTMLElement>(
  scope: RefObject<T | null>,
  fn: () => void,
  deps: DependencyList = [],
) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!scope.current) return;
    const ctx = gsap.context(() => saved.current(), scope.current);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
