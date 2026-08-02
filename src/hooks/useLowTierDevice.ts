import { useEffect, useState } from "react";

/**
 * True on devices we should not run heavy parallax / particle work on.
 * Threshold: fewer than 4 logical cores OR less than 4GB of device memory.
 *
 * Both signals are advisory (`deviceMemory` is Chromium-only) — we default
 * to "capable" when the browser won't tell us, and degrade only when it
 * explicitly reports a weak device.
 */
export function useLowTierDevice(): boolean {
  const [low, setLow] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    setLow(cores < 4 || mem < 4);
  }, []);

  return low;
}
