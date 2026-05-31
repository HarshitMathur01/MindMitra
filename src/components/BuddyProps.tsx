// 2D comedy-prop overlay that floats over the buddy canvas. Two layers:
//   • ambient — a single prop tied to the buddy's current emotion (💤 sleepy,
//     💭 bored, ❓ confused, ❗ surprised). Driven by the onEmotion seam.
//   • burst   — a one-shot flurry on a game outcome (party on win, sweat on a
//     loss, cat's-game on a draw), re-triggered by a bumped `cue.id`.
//
// Everything is CSS-animated emoji; no 3D asset work. The `cue` seam is the same
// hook a future Tier-3 pass can use to attach real meshes to head/hand bones.
import { useEffect, useState } from "react";
import type { BuddyEmotion } from "@/lib/companion/buddyBrain";

export interface PropCue {
  name: "win" | "lose" | "draw";
  /** bump to re-fire the same burst */
  id: number;
}

const AMBIENT: Partial<Record<BuddyEmotion, { glyph: string; anim: string }>> = {
  sleepy: { glyph: "💤", anim: "bt-prop-rise" },
  bored: { glyph: "💭", anim: "bt-prop-float" },
  confused: { glyph: "❓", anim: "bt-prop-float" },
  surprised: { glyph: "❗", anim: "bt-prop-pop" },
};

const BURST: Record<PropCue["name"], string[]> = {
  win: ["🎉", "🏆", "🥳", "✨", "🎊", "⭐"],
  lose: ["💧", "💦", "😵‍💫"],
  draw: ["🐱", "🤝", "😐"],
};

interface BurstItem {
  glyph: string;
  left: number;
  delay: number;
  rot: number;
}

export function BuddyProps({ emotion, cue }: { emotion: BuddyEmotion; cue: PropCue | null }) {
  const [burst, setBurst] = useState<{ id: number; items: BurstItem[] } | null>(null);

  useEffect(() => {
    if (!cue) return;
    const glyphs = BURST[cue.name];
    const n = cue.name === "win" ? 12 : 5;
    const items: BurstItem[] = Array.from({ length: n }, (_, i) => ({
      glyph: glyphs[i % glyphs.length],
      left: 8 + Math.random() * 84,
      delay: Math.random() * 0.4,
      rot: (Math.random() - 0.5) * 80,
    }));
    setBurst({ id: cue.id, items });
    const t = window.setTimeout(() => setBurst((b) => (b && b.id === cue.id ? null : b)), 2800);
    return () => window.clearTimeout(t);
  }, [cue]);

  const ambient = AMBIENT[emotion];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[5]" aria-hidden>
      {ambient && (
        <span
          key={emotion}
          className={`absolute left-1/2 top-8 -translate-x-1/2 text-3xl drop-shadow ${ambient.anim}`}
        >
          {ambient.glyph}
        </span>
      )}
      {burst?.items.map((it, i) => (
        <span
          key={`${burst.id}-${i}`}
          className="absolute bottom-12 text-3xl bt-prop-burst"
          style={{
            left: `${it.left}%`,
            animationDelay: `${it.delay}s`,
            // @ts-expect-error custom prop consumed by the keyframe
            "--prop-rot": `${it.rot}deg`,
          }}
        >
          {it.glyph}
        </span>
      ))}
    </div>
  );
}
