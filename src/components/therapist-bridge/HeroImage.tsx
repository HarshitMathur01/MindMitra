import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
// Upstream imports these from `*.png.asset.json` descriptors pointing at
// Lovable's CDN (`/__l5e/assets-v1/…`), which only resolves on their host.
// Same four images, pulled down and bundled — 5.2 MB of PNG re-encoded to
// 146 KB of webp, since this is a hero rotator that loads eagerly.
//
// hero-3 and hero-4 are byte-identical: upstream uploaded the same picture
// twice under two asset ids and gave it two different alt texts. Kept as four
// scenes to match upstream; Vite emits one file and both imports point at it,
// so the duplication costs nothing at runtime.
import imgOne from "@/assets/therapist-bridge/hero-1.webp";
import imgTwo from "@/assets/therapist-bridge/hero-2.webp";
import imgThree from "@/assets/therapist-bridge/hero-3.webp";
import imgFour from "@/assets/therapist-bridge/hero-4.webp";

const scenes = [
  { url: imgOne, alt: "Two soft armchairs facing each other in a sunlit therapy room" },
  { url: imgTwo, alt: "A calm consulting room with green chairs, plants and warm wood shelving" },
  { url: imgThree, alt: "A softly lit arch and steps in muted sage and ivory tones" },
  { url: imgFour, alt: "A serene archway with glowing steps surrounded by sage leaves" },
];


const KEY = "bridge:hero-visit";

function pickScene(): number {
  try {
    const prev = Number(localStorage.getItem(KEY) ?? "-1");
    const next = (Number.isFinite(prev) ? prev + 1 : 0) % scenes.length;
    localStorage.setItem(KEY, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * scenes.length);
  }
}

/**
 * Rotates the hero scene on every visit.
 *
 * Upstream resolves the index in an effect, "chosen after mount to keep SSR
 * stable". MindMitra is a pure SPA with no server render, so that constraint
 * does not apply here — and deferring it cost a paint: the browser could not
 * begin fetching the image until after hydration, on the surface's LCP element.
 * Resolving it in the state initialiser means the <img> is in the very first
 * render and the fetch starts immediately.
 */
export function HeroImage({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [index] = useState<number>(pickScene);

  const scene = scenes[index] ?? scenes[0]!;

  return (
    <div className={className}>
      <motion.figure
        key={scene.url}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.03, filter: "blur(10px)" }}
        animate={index === null ? {} : reduced ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-full w-full overflow-hidden rounded-3xl shadow-2xl"
        style={{ borderRadius: "1.5rem" }}

      >
        <img
          src={scene.url}
          alt={scene.alt}
          loading="eager"
          className="h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 70% at 30% 20%, transparent, color-mix(in oklab, var(--parchment) 45%, transparent))",
          }}
        />
        <div className="paper-grain pointer-events-none absolute inset-0 opacity-30" />
      </motion.figure>
    </div>
  );
}
