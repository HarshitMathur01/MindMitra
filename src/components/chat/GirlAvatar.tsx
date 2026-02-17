import React, { useEffect, useMemo, useState } from 'react'
import { Leva } from "leva";
import { Loader } from "@react-three/drei";
import Experience from "../Experience.jsx";
import { Canvas } from "@react-three/fiber";

const DAY_CYCLE_MS = 180000;

const SKY_STOPS = [
  { top: [200, 185, 220], bottom: [225, 215, 240], glow: [210, 195, 230] },
  { top: [165, 205, 225], bottom: [200, 225, 240], glow: [180, 215, 235] },
  { top: [155, 205, 195], bottom: [195, 225, 220], glow: [170, 215, 210] },
  { top: [185, 175, 210], bottom: [215, 205, 235], glow: [200, 190, 225] },
  { top: [55, 65, 105], bottom: [75, 85, 125], glow: [120, 130, 185] },
  { top: [200, 185, 220], bottom: [225, 215, 240], glow: [210, 195, 230] },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpRGB = (from: number[], to: number[], t: number) => {
  const r = Math.round(lerp(from[0], to[0], t));
  const g = Math.round(lerp(from[1], to[1], t));
  const b = Math.round(lerp(from[2], to[2], t));
  return `rgb(${r}, ${g}, ${b})`;
};

const getSkyColors = (progress: number) => {
  const scaled = progress * (SKY_STOPS.length - 1);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const current = SKY_STOPS[index];
  const next = SKY_STOPS[Math.min(index + 1, SKY_STOPS.length - 1)];

  return {
    top: lerpRGB(current.top, next.top, localT),
    bottom: lerpRGB(current.bottom, next.bottom, localT),
    glow: lerpRGB(current.glow, next.glow, localT),
  };
};

const snowParticles = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  size: `${Math.random() * 3 + 2}px`,
  duration: `${Math.random() * 6 + 7}s`,
  delay: `${Math.random() * 6}s`,
  drift: `${Math.random() * 60 - 30}px`,
  opacity: Math.random() * 0.45 + 0.35,
}));

const floatingOrbs = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 18 + 6}px`,
  durationX: `${Math.random() * 12 + 16}s`,
  durationY: `${Math.random() * 10 + 14}s`,
  durationPulse: `${Math.random() * 6 + 5}s`,
  delayX: `${-(Math.random() * 20)}s`,
  delayY: `${-(Math.random() * 20)}s`,
  delayPulse: `${-(Math.random() * 10)}s`,
  opacity: Math.random() * 0.2 + 0.08,
}));


const GirlAvatar = () => {
  const [cycleProgress, setCycleProgress] = useState(0);
  const [isSnowing, setIsSnowing] = useState(false);

  useEffect(() => {
    const cycleStart = Date.now();
    let frameId = 0;

    const animate = () => {
      const elapsed = Date.now() - cycleStart;
      setCycleProgress((elapsed % DAY_CYCLE_MS) / DAY_CYCLE_MS);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (Math.random() < 0.4) {
        setIsSnowing(true);
        window.setTimeout(() => setIsSnowing(false), 10000);
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  const sky = useMemo(() => getSkyColors(cycleProgress), [cycleProgress]);

  const orbit = Math.sin((cycleProgress * Math.PI * 2) - Math.PI / 2);
  const glowX = `${Math.round(cycleProgress * 100)}%`;
  const glowY = `${orbit > 0 ? 68 - orbit * 48 : 82}%`;

  const background = `
    radial-gradient(circle at ${glowX} ${glowY}, ${sky.glow} 0%, transparent 35%),
    linear-gradient(to bottom, ${sky.top} 0%, ${sky.bottom} 100%)
  `;

  return (
    <>

      <Loader />
      <Leva hidden />
      {/* <UI></UI> */}
      <style>{`
      .avatar-sky {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .avatar-snow {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .avatar-snowflake {
        position: absolute;
        top: -10%;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.92);
        filter: blur(0.4px);
        animation: avatarSnowFall linear infinite;
      }

      @keyframes avatarSnowFall {
        0% {
          transform: translate3d(0, -10%, 0);
        }
        100% {
          transform: translate3d(var(--snow-drift), 120%, 0);
        }
      }

      .avatar-orbs {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .avatar-orb {
        position: absolute;
        border-radius: 9999px;
        background: radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%);
        animation:
          avatarOrbX var(--orb-dur-x) ease-in-out infinite var(--orb-delay-x),
          avatarOrbY var(--orb-dur-y) ease-in-out infinite var(--orb-delay-y),
          avatarOrbPulse var(--orb-dur-pulse) ease-in-out infinite var(--orb-delay-pulse);
      }

      @keyframes avatarOrbX {
        0%, 100% { translate: -30px 0; }
        50%      { translate: 30px 0; }
      }

      @keyframes avatarOrbY {
        0%, 100% { translate: 0 -20px; }
        50%      { translate: 0 20px; }
      }

      @keyframes avatarOrbPulse {
        0%, 100% { scale: 1;   opacity: var(--orb-opacity); }
        50%      { scale: 1.4; opacity: calc(var(--orb-opacity) + 0.1); }
      }
    `}</style>

      <div className="avatar-sky" style={{ background }}>
        <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }} style={{ background: 'transparent' }}>
          <Experience />
        </Canvas>

        <div className="avatar-orbs" aria-hidden="true">
          {floatingOrbs.map((orb) => (
            <span
              key={orb.id}
              className="avatar-orb"
              style={{
                left: orb.left,
                top: orb.top,
                width: orb.size,
                height: orb.size,
                ['--orb-opacity' as string]: orb.opacity,
                ['--orb-dur-x' as string]: orb.durationX,
                ['--orb-dur-y' as string]: orb.durationY,
                ['--orb-dur-pulse' as string]: orb.durationPulse,
                ['--orb-delay-x' as string]: orb.delayX,
                ['--orb-delay-y' as string]: orb.delayY,
                ['--orb-delay-pulse' as string]: orb.delayPulse,
              }}
            />
          ))}
        </div>

        {isSnowing && (
          <div className="avatar-snow" aria-hidden="true">
            {snowParticles.map((flake) => (
              <span
                key={flake.id}
                className="avatar-snowflake"
                style={{
                  left: flake.left,
                  width: flake.size,
                  height: flake.size,
                  opacity: flake.opacity,
                  animationDuration: flake.duration,
                  animationDelay: flake.delay,
                  ['--snow-drift' as string]: flake.drift,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default GirlAvatar
