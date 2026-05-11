import { useCallback, useEffect, useRef } from "react";

export type AudioTrack = "none" | "brown-noise" | "rain" | "forest";

/**
 * Ambient noise hook used by TherapeuticGameShell. Synthesizes brown noise
 * through a lowpass filter; track selection tunes the filter cutoff.
 */
export function useAmbientAudio(track: AudioTrack) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
      ctxRef.current?.close();
    } catch {
      /* stop/close may throw if already stopped */
    }
    ctxRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    filterRef.current = null;
  }, []);

  const generateBrownNoise = useCallback((ctx: AudioContext) => {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastSample = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastSample + 0.02 * white) / 1.02;
      lastSample = data[i];
      data[i] *= 3.5;
    }
    return buffer;
  }, []);

  useEffect(() => {
    stop();
    if (track === "none") return;

    try {
      const ctx = new AudioContext();
      const buffer = generateBrownNoise(ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";

      if (track === "rain") {
        filter.frequency.setValueAtTime(800, ctx.currentTime);
      } else if (track === "forest") {
        filter.frequency.setValueAtTime(400, ctx.currentTime);
      } else {
        filter.frequency.setValueAtTime(200, ctx.currentTime);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      ctxRef.current = ctx;
      sourceRef.current = source;
      gainRef.current = gain;
      filterRef.current = filter;
    } catch (e) {
      console.warn("AudioContext failed", e);
    }

    return () => stop();
  }, [track, stop, generateBrownNoise]);

  return { stop };
}

/**
 * Lightweight sine-tone playback hook used by game tools (MemoryChallenge).
 * Debounces same-frequency triggers within 80ms to avoid clicks on rapid input.
 */
export function useTone(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastRef = useRef<{ freq: number; t: number }>({ freq: 0, t: 0 });

  const play = useCallback(
    (freq: number, durationMs = 320, gain = 0.16) => {
      if (muted) return;
      const now = performance.now();
      if (lastRef.current.freq === freq && now - lastRef.current.t < 80) return;
      lastRef.current = { freq, t: now };
      try {
        if (!ctxRef.current) {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) return;
          ctxRef.current = new Ctor();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + durationMs / 1000 + 0.05);
      } catch {
        /* audio unavailable — silently degrade */
      }
    },
    [muted],
  );

  useEffect(
    () => () => {
      ctxRef.current?.close().catch(() => {});
    },
    [],
  );

  return play;
}
