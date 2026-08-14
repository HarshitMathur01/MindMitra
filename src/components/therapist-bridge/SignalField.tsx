import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useBridge } from "./BridgeContext";

type Particle = { x: number; y: number; vx: number; vy: number; r: number };
type Blob = { x: number; y: number; r: number; phase: number; hueShift: number };

/**
 * The signal field: a slow ambient ecosystem. Breathing organic shapes,
 * drifting particles, thin connective lines and a central seed that leans
 * toward the cursor. Fully static when reduced motion is requested.
 */
export function SignalField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const { mood } = useBridge();
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const particles: Particle[] = [];
    const blobs: Blob[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      particles.length = 0;
      blobs.length = 0;
      const count = width < 480 ? 26 : 46;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.14,
          vy: (Math.random() - 0.5) * 0.14,
          r: 0.8 + Math.random() * 1.5,
        });
      }
      for (let i = 0; i < 4; i++) {
        blobs.push({
          x: width * (0.28 + Math.random() * 0.44),
          y: height * (0.24 + Math.random() * 0.5),
          r: Math.min(width, height) * (0.16 + Math.random() * 0.16),
          phase: Math.random() * Math.PI * 2,
          hueShift: Math.random(),
        });
      }
    };

    resize();
    seed();

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener("resize", onResize);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const draw = (t: number) => {
      const m = moodRef.current;
      const speed = reduced ? 0 : 0.35 + m.tempo * 0.65;
      const time = t * 0.001 * speed;

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      const px = reduced ? 0.5 : pointer.x;
      const py = reduced ? 0.5 : pointer.y;

      ctx.clearRect(0, 0, width, height);

      // breathing organic shapes
      blobs.forEach((b, i) => {
        const breath = 1 + Math.sin(time * 0.5 + b.phase) * 0.06;
        const par = (i + 1) * 6;
        const cx = b.x + (px - 0.5) * par;
        const cy = b.y + (py - 0.5) * par;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r * breath);
        const warm = m.warmth;
        grad.addColorStop(
          0,
          `oklch(${0.82 - i * 0.03} ${0.045 + warm * 0.02} ${140 - warm * 55 + b.hueShift * 20} / 0.5)`,
        );
        grad.addColorStop(1, "oklch(0.9 0.02 120 / 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, b.r * breath, 0, Math.PI * 2);
        ctx.fill();
      });

      // drifting particles with magnetic response
      const mx = px * width;
      const my = py * height;
      particles.forEach((p) => {
        if (!reduced) {
          p.x += p.vx * (0.4 + m.tempo);
          p.y += p.vy * (0.4 + m.tempo);
          const dx = p.x - mx;
          const dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < 20000 && d2 > 1) {
            const f = (1 - d2 / 20000) * 0.35;
            p.x += (dx / Math.sqrt(d2)) * f;
            p.y += (dy / Math.sqrt(d2)) * f;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }
        ctx.fillStyle = "oklch(0.46 0.05 150 / 0.32)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // thin connective lines that form and dissolve
      const reach = 82 + m.links * 46;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < reach) {
            const fade = (1 - dist / reach) * (0.25 + m.links * 0.2);
            ctx.strokeStyle = `oklch(0.46 0.05 150 / ${fade.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // central seed
      const sx = width * 0.5 + (px - 0.5) * 26;
      const sy = height * 0.52 + (py - 0.5) * 22;
      const pulse = 1 + Math.sin(time * 0.8) * 0.08;
      const seedGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 46 * pulse);
      seedGrad.addColorStop(0, "oklch(0.44 0.07 155 / 0.55)");
      seedGrad.addColorStop(1, "oklch(0.44 0.07 155 / 0)");
      ctx.fillStyle = seedGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, 46 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "oklch(0.41 0.058 155 / 0.85)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 7 * pulse, 11 * pulse, Math.sin(time * 0.3) * 0.3, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    if (reduced) {
      // draw a single static frame then stop
      cancelAnimationFrame(raf);
      draw(0);
      cancelAnimationFrame(raf);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
