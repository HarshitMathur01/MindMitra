import React, { useEffect, useMemo, useState } from 'react'
import { Leva } from "leva";
import { Loader } from "@react-three/drei";
import Experience from "../Experience.jsx";
import { Canvas } from "@react-three/fiber";

const DAY_CYCLE_MS = 180000;

const SKY_STOPS = [
  { top: [45, 25, 70], bottom: [85, 55, 100], glow: [180, 120, 160], accent: [255, 180, 140] },  // Pre-dawn violet
  { top: [200, 140, 160], bottom: [255, 195, 170], glow: [255, 165, 120], accent: [255, 210, 180] },  // Warm sunrise
  { top: [135, 195, 235], bottom: [185, 220, 245], glow: [240, 230, 210], accent: [255, 245, 220] },  // Clear morning
  { top: [100, 175, 225], bottom: [170, 210, 240], glow: [255, 245, 220], accent: [255, 250, 230] },  // Bright noon
  { top: [160, 170, 210], bottom: [210, 190, 200], glow: [255, 200, 150], accent: [255, 180, 130] },  // Golden afternoon
  { top: [80, 50, 120], bottom: [140, 90, 130], glow: [200, 130, 170], accent: [180, 100, 150] },  // Dusk
  { top: [20, 15, 50], bottom: [40, 30, 70], glow: [80, 60, 130], accent: [60, 80, 160] },    // Night
  { top: [30, 20, 55], bottom: [55, 40, 80], glow: [120, 80, 150], accent: [140, 100, 170] },  // Late night
  { top: [45, 25, 70], bottom: [85, 55, 100], glow: [180, 120, 160], accent: [255, 180, 140] },  // Loop to pre-dawn
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
    accent: lerpRGB(current.accent, next.accent, localT),
  };
};

// Snow particles
const snowParticles = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  size: `${Math.random() * 3 + 2}px`,
  duration: `${Math.random() * 6 + 7}s`,
  delay: `${Math.random() * 6}s`,
  drift: `${Math.random() * 60 - 30}px`,
  opacity: Math.random() * 0.5 + 0.3,
}));

// Floating orbs — warm/cool mix
const floatingOrbs = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 22 + 8}px`,
  durationX: `${Math.random() * 14 + 18}s`,
  durationY: `${Math.random() * 12 + 16}s`,
  durationPulse: `${Math.random() * 7 + 5}s`,
  delayX: `${-(Math.random() * 20)}s`,
  delayY: `${-(Math.random() * 20)}s`,
  delayPulse: `${-(Math.random() * 10)}s`,
  opacity: Math.random() * 0.25 + 0.08,
  isWarm: i % 3 !== 0,
}));

// Firefly particles — small twinkling lights
const fireflies = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: `${10 + Math.random() * 80}%`,
  top: `${20 + Math.random() * 60}%`,
  size: `${Math.random() * 4 + 2}px`,
  durationFloat: `${Math.random() * 10 + 12}s`,
  durationBlink: `${Math.random() * 3 + 2}s`,
  delayFloat: `${-(Math.random() * 15)}s`,
  delayBlink: `${-(Math.random() * 5)}s`,
}));

// Cloud wisps
const cloudWisps = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  top: `${10 + Math.random() * 35}%`,
  width: `${120 + Math.random() * 100}px`,
  height: `${20 + Math.random() * 15}px`,
  duration: `${40 + Math.random() * 30}s`,
  delay: `${-(Math.random() * 40)}s`,
  opacity: 0.06 + Math.random() * 0.08,
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
      if (Math.random() < 0.35) {
        setIsSnowing(true);
        window.setTimeout(() => setIsSnowing(false), 10000);
      }
    }, 18000);

    return () => window.clearInterval(intervalId);
  }, []);

  const sky = useMemo(() => getSkyColors(cycleProgress), [cycleProgress]);

  // Is it nighttime? (roughly 60-90% of cycle)
  const isNight = cycleProgress > 0.55 && cycleProgress < 0.9;
  const isDusk = cycleProgress > 0.45 && cycleProgress < 0.6;

  const orbit = Math.sin((cycleProgress * Math.PI * 2) - Math.PI / 2);
  const glowX = `${Math.round(cycleProgress * 100)}%`;
  const glowY = `${orbit > 0 ? 60 - orbit * 50 : 85}%`;

  // ── Sun position (visible ~5%-55% of cycle = sunrise to late afternoon) ──
  const sunProgress = cycleProgress; // 0→1 maps full cycle
  // Sun arc: rises from left-bottom, peaks top-center, sets right-bottom
  // Active roughly 0.05 to 0.55
  const sunAngle = ((sunProgress - 0.05) / 0.5) * Math.PI; // 0 to PI over daytime
  const sunX = 10 + ((sunProgress - 0.05) / 0.5) * 80; // 10% to 90% horizontal
  const sunY = 80 - Math.sin(sunAngle) * 65; // arc: 80% → 15% → 80%
  const sunVisible = cycleProgress > 0.03 && cycleProgress < 0.57;
  const sunOpacity = sunVisible
    ? (cycleProgress < 0.08 ? (cycleProgress - 0.03) / 0.05  // fade in
      : cycleProgress > 0.52 ? (0.57 - cycleProgress) / 0.05  // fade out
        : 1)
    : 0;

  // ── Moon position (visible ~60%-95% + 0-5% of cycle = night) ──
  const moonActive = cycleProgress > 0.58 || cycleProgress < 0.07;
  const moonCycleT = cycleProgress > 0.5
    ? (cycleProgress - 0.58) / 0.42  // 0.58→1.0 maps to 0→1
    : (cycleProgress + 0.42) / 0.42; // 0→0.07 maps continuing
  const moonAngle = Math.max(0, Math.min(1, moonCycleT)) * Math.PI;
  const moonX = 10 + Math.max(0, Math.min(1, moonCycleT)) * 80;
  const moonY = 78 - Math.sin(moonAngle) * 60;
  const moonOpacity = moonActive
    ? (cycleProgress > 0.58 && cycleProgress < 0.65 ? (cycleProgress - 0.58) / 0.07
      : cycleProgress > 0.93 ? (1.0 - cycleProgress) / 0.07
        : cycleProgress < 0.07 ? Math.max(0, (0.07 - cycleProgress) / 0.07)
          : 1)
    : 0;

  // Secondary glow for depth
  const glow2X = `${100 - Math.round(cycleProgress * 80)}%`;
  const glow2Y = `${70 + orbit * 15}%`;

  const background = `
    radial-gradient(ellipse 60% 50% at ${glowX} ${glowY}, ${sky.glow} 0%, transparent 50%),
    radial-gradient(ellipse 40% 35% at ${glow2X} ${glow2Y}, ${sky.accent} 0%, transparent 45%),
    linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)
  `;

  return (
    <>
      <Loader />
      <Leva hidden />

      <style>{`
      .avatar-sky {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      /* ── Vignette overlay ── */
      .avatar-vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 2;
        background: radial-gradient(ellipse 70% 65% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%);
      }

      /* ── Bottom fade for subtitle readability ── */
      .avatar-bottom-fade {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        height: 35%;
        pointer-events: none;
        z-index: 2;
        background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.18) 100%);
      }

      /* ── Snow ── */
      .avatar-snow {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 3;
      }

      .avatar-snowflake {
        position: absolute;
        top: -10%;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 0 4px 1px rgba(255,255,255,0.3);
        filter: blur(0.3px);
        animation: avatarSnowFall linear infinite;
      }

      @keyframes avatarSnowFall {
        0%   { transform: translate3d(0, -10%, 0) rotate(0deg); }
        100% { transform: translate3d(var(--snow-drift), 120%, 0) rotate(360deg); }
      }

      /* ── Floating orbs ── */
      .avatar-orbs {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
      }

      .avatar-orb {
        position: absolute;
        border-radius: 9999px;
        filter: blur(2px);
        animation:
          avatarOrbX var(--orb-dur-x) ease-in-out infinite var(--orb-delay-x),
          avatarOrbY var(--orb-dur-y) ease-in-out infinite var(--orb-delay-y),
          avatarOrbPulse var(--orb-dur-pulse) ease-in-out infinite var(--orb-delay-pulse);
      }

      .avatar-orb--warm {
        background: radial-gradient(circle at 35% 35%,
          rgba(255,230,200,0.8) 0%,
          rgba(255,200,160,0.3) 40%,
          transparent 70%
        );
      }

      .avatar-orb--cool {
        background: radial-gradient(circle at 35% 35%,
          rgba(200,210,255,0.7) 0%,
          rgba(160,180,240,0.25) 40%,
          transparent 70%
        );
      }

      @keyframes avatarOrbX {
        0%, 100% { translate: -35px 0; }
        50%      { translate: 35px 0; }
      }

      @keyframes avatarOrbY {
        0%, 100% { translate: 0 -25px; }
        50%      { translate: 0 25px; }
      }

      @keyframes avatarOrbPulse {
        0%, 100% { scale: 1;   opacity: var(--orb-opacity); }
        50%      { scale: 1.5; opacity: calc(var(--orb-opacity) + 0.12); }
      }

      /* ── Fireflies ── */
      .avatar-fireflies {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 3;
      }

      .avatar-firefly {
        position: absolute;
        border-radius: 9999px;
        background: radial-gradient(circle, rgba(255,255,200,0.95) 0%, rgba(255,240,150,0.4) 50%, transparent 70%);
        box-shadow: 0 0 8px 3px rgba(255,240,180,0.35);
        animation:
          avatarFireflyFloat var(--ff-dur-float) ease-in-out infinite var(--ff-delay-float),
          avatarFireflyBlink var(--ff-dur-blink) ease-in-out infinite var(--ff-delay-blink);
      }

      @keyframes avatarFireflyFloat {
        0%, 100% { transform: translate(0, 0); }
        25%      { transform: translate(12px, -18px); }
        50%      { transform: translate(-8px, -10px); }
        75%      { transform: translate(15px, 8px); }
      }

      @keyframes avatarFireflyBlink {
        0%, 100% { opacity: 0; }
        15%      { opacity: 0.85; }
        50%      { opacity: 0.6; }
        85%      { opacity: 0.9; }
      }

      /* ── Cloud wisps ── */
      .avatar-clouds {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
      }

      .avatar-cloud {
        position: absolute;
        left: -20%;
        border-radius: 9999px;
        background: rgba(255,255,255, var(--cloud-opacity));
        filter: blur(12px);
        animation: avatarCloudDrift var(--cloud-dur) linear infinite var(--cloud-delay);
      }

      @keyframes avatarCloudDrift {
        0%   { transform: translateX(0); }
        100% { transform: translateX(calc(100vw + 40%)); }
      }

      /* ── Aurora bands (night only) ── */
      .avatar-aurora {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
        opacity: var(--aurora-opacity, 0);
        transition: opacity 3s ease;
      }

      .avatar-aurora-band {
        position: absolute;
        width: 200%;
        left: -50%;
        height: 30%;
        filter: blur(30px);
        animation: avatarAuroraWave 15s ease-in-out infinite;
      }

      .avatar-aurora-band--1 {
        top: 5%;
        background: linear-gradient(90deg, transparent 0%, rgba(80,200,120,0.12) 25%, rgba(100,180,255,0.08) 50%, rgba(180,100,255,0.1) 75%, transparent 100%);
        animation-delay: 0s;
      }

      .avatar-aurora-band--2 {
        top: 15%;
        background: linear-gradient(90deg, transparent 0%, rgba(100,180,255,0.08) 30%, rgba(200,100,255,0.06) 60%, transparent 100%);
        animation-delay: -5s;
        animation-duration: 20s;
      }

      .avatar-aurora-band--3 {
        top: 8%;
        background: linear-gradient(90deg, transparent 0%, rgba(150,255,200,0.06) 40%, rgba(80,120,255,0.05) 70%, transparent 100%);
        animation-delay: -10s;
        animation-duration: 18s;
      }

      @keyframes avatarAuroraWave {
        0%, 100% { transform: translateX(-15%) scaleY(1); }
        33%      { transform: translateX(5%) scaleY(1.3); }
        66%      { transform: translateX(-10%) scaleY(0.8); }
      }

      /* ── Twinkling stars (night only) ── */
      .avatar-stars {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        opacity: var(--stars-opacity, 0);
        transition: opacity 3s ease;
      }

      .avatar-star {
        position: absolute;
        width: 2px;
        height: 2px;
        border-radius: 9999px;
        background: white;
        animation: avatarStarTwinkle var(--star-dur) ease-in-out infinite var(--star-delay);
      }

      @keyframes avatarStarTwinkle {
        0%, 100% { opacity: 0.2; transform: scale(0.8); }
        50%      { opacity: 1; transform: scale(1.3); }
      }

      /* ── Sun ── */
      .avatar-sun-container {
        position: absolute;
        pointer-events: none;
        z-index: 2;
        transition: opacity 1.5s ease;
      }

      .avatar-sun {
        position: relative;
        width: 44px;
        height: 44px;
        border-radius: 9999px;
        background: radial-gradient(circle at 40% 38%,
          #fff8e1 0%,
          #ffe082 30%,
          #ffb300 60%,
          #ff8f00 100%
        );
        box-shadow:
          0 0 20px 8px rgba(255,183,77,0.5),
          0 0 50px 20px rgba(255,167,38,0.25),
          0 0 90px 40px rgba(255,152,0,0.1);
      }

      .avatar-sun-rays {
        position: absolute;
        inset: -22px;
        border-radius: 9999px;
        background: radial-gradient(circle,
          rgba(255,235,180,0.25) 0%,
          rgba(255,200,100,0.08) 50%,
          transparent 70%
        );
        animation: avatarSunPulse 4s ease-in-out infinite;
      }

      @keyframes avatarSunPulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50%      { transform: scale(1.15); opacity: 1; }
      }

      /* ── Moon ── */
      .avatar-moon-container {
        position: absolute;
        pointer-events: none;
        z-index: 2;
        transition: opacity 2s ease;
      }

      .avatar-moon {
        position: relative;
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        background: radial-gradient(circle at 55% 45%,
          #f5f5f5 0%,
          #e0e0e0 40%,
          #bdbdbd 80%,
          #9e9e9e 100%
        );
        box-shadow:
          0 0 15px 6px rgba(200,210,240,0.4),
          0 0 40px 16px rgba(180,195,230,0.18),
          0 0 70px 30px rgba(160,180,220,0.08);
      }

      /* Moon craters */
      .avatar-moon::before {
        content: '';
        position: absolute;
        top: 8px;
        left: 10px;
        width: 7px;
        height: 7px;
        border-radius: 9999px;
        background: rgba(0,0,0,0.06);
        box-shadow:
          12px 6px 0 3px rgba(0,0,0,0.04),
          4px 16px 0 1px rgba(0,0,0,0.05),
          -2px 12px 0 2px rgba(0,0,0,0.03);
      }

      /* Moon shadow (crescent effect) */
      .avatar-moon::after {
        content: '';
        position: absolute;
        top: -2px;
        left: 6px;
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        background: radial-gradient(circle at 70% 30%,
          transparent 50%,
          rgba(30,30,60,0.12) 100%
        );
      }

      .avatar-moon-glow {
        position: absolute;
        inset: -18px;
        border-radius: 9999px;
        background: radial-gradient(circle,
          rgba(200,210,240,0.2) 0%,
          rgba(180,195,230,0.06) 50%,
          transparent 70%
        );
        animation: avatarMoonPulse 6s ease-in-out infinite;
      }

      @keyframes avatarMoonPulse {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50%      { transform: scale(1.1); opacity: 1; }
      }
    `}</style>

      <div className="avatar-sky" style={{ background }}>

        {/* Three.js Canvas */}
        <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }} style={{ background: 'transparent', position: 'relative', zIndex: 4 }}>
          <Experience />
        </Canvas>

        {/* Sun */}
        <div
          className="avatar-sun-container"
          aria-hidden="true"
          style={{
            left: `calc(${sunX}% - 22px)`,
            top: `calc(${sunY}% - 22px)`,
            opacity: sunOpacity,
          }}
        >
          <div className="avatar-sun-rays" />
          <div className="avatar-sun" />
        </div>

        {/* Moon */}
        <div
          className="avatar-moon-container"
          aria-hidden="true"
          style={{
            left: `calc(${moonX}% - 18px)`,
            top: `calc(${moonY}% - 18px)`,
            opacity: Math.max(0, Math.min(1, moonOpacity)),
          }}
        >
          <div className="avatar-moon-glow" />
          <div className="avatar-moon" />
        </div>

        {/* Vignette */}
        <div className="avatar-vignette" />

        {/* Bottom fade for subtitle area */}
        <div className="avatar-bottom-fade" />

        {/* Aurora bands — visible at night / dusk */}
        <div
          className="avatar-aurora"
          style={{ ['--aurora-opacity' as string]: (isNight || isDusk) ? 1 : 0 }}
        >
          <div className="avatar-aurora-band avatar-aurora-band--1" />
          <div className="avatar-aurora-band avatar-aurora-band--2" />
          <div className="avatar-aurora-band avatar-aurora-band--3" />
        </div>

        {/* Twinkling CSS stars (night) */}
        <div
          className="avatar-stars"
          style={{ ['--stars-opacity' as string]: isNight ? 1 : 0 }}
        >
          {Array.from({ length: 35 }, (_, i) => (
            <span
              key={i}
              className="avatar-star"
              style={{
                left: `${5 + Math.sin(i * 7.3) * 45 + 45}%`,
                top: `${5 + Math.cos(i * 5.1) * 30 + 10}%`,
                ['--star-dur' as string]: `${2 + (i % 5) * 0.7}s`,
                ['--star-delay' as string]: `${-(i * 0.4)}s`,
              }}
            />
          ))}
        </div>

        {/* Cloud wisps */}
        <div className="avatar-clouds" aria-hidden="true">
          {cloudWisps.map((cloud) => (
            <span
              key={cloud.id}
              className="avatar-cloud"
              style={{
                top: cloud.top,
                width: cloud.width,
                height: cloud.height,
                ['--cloud-opacity' as string]: cloud.opacity,
                ['--cloud-dur' as string]: cloud.duration,
                ['--cloud-delay' as string]: cloud.delay,
              }}
            />
          ))}
        </div>

        {/* Floating orbs */}
        <div className="avatar-orbs" aria-hidden="true">
          {floatingOrbs.map((orb) => (
            <span
              key={orb.id}
              className={`avatar-orb ${orb.isWarm ? 'avatar-orb--warm' : 'avatar-orb--cool'}`}
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

        {/* Fireflies — dreamy accent */}
        <div className="avatar-fireflies" aria-hidden="true">
          {fireflies.map((ff) => (
            <span
              key={ff.id}
              className="avatar-firefly"
              style={{
                left: ff.left,
                top: ff.top,
                width: ff.size,
                height: ff.size,
                ['--ff-dur-float' as string]: ff.durationFloat,
                ['--ff-dur-blink' as string]: ff.durationBlink,
                ['--ff-delay-float' as string]: ff.delayFloat,
                ['--ff-delay-blink' as string]: ff.delayBlink,
              }}
            />
          ))}
        </div>

        {/* Snow */}
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
