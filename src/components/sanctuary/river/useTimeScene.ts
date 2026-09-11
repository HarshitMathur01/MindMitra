import { useEffect, useState } from "react";

/**
 * The hour of arrival.
 *
 * Lives in a hook rather than a bare `new Date().getHours()` at the top of the
 * greeting so a page left open across a boundary follows the clock: someone
 * who opens this at 04:58 should not still be reading "Quiet night" at 06:00.
 * Re-checked every minute; state only changes on the hour, so the page renders
 * 24 times a day at most.
 *
 * This used to return a `scene` as well — one of four hillside photographs
 * that backed the hero. The greeting is paper and ink now, and the hour is the
 * only thing left that the time of day decides. See moods.ts for what reads it
 * (`greetingForHour`, `contextForHour`).
 */
export function useTimeScene(): { hour: number } {
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { hour };
}
