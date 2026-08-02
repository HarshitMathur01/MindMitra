import { useEffect, useState } from "react";
import { sceneForHour, type TimeScene } from "./moods";

export interface TimeSceneState {
  scene: TimeScene;
  hour: number;
}

/**
 * The hour of arrival, and the hillside that belongs to it.
 *
 * Lifted out of Hero because the scene is no longer only Hero's business: the
 * page root stamps it as `data-nr-scene` so the header and hero can pick a
 * legible text colour for the backdrop they happen to be sitting on. One
 * source keeps the art and the contrast decision from drifting apart.
 *
 * Re-checked every minute so a page left open across a boundary follows the
 * light instead of stranding, say, dark text over a hillside that has since
 * gone to night.
 */
export function useTimeScene(): TimeSceneState {
  const [state, setState] = useState<TimeSceneState>(() => {
    const hour = new Date().getHours();
    return { scene: sceneForHour(hour), hour };
  });

  useEffect(() => {
    const tick = () => {
      const hour = new Date().getHours();
      setState((prev) =>
        prev.hour === hour ? prev : { scene: sceneForHour(hour), hour },
      );
    };
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  return state;
}
