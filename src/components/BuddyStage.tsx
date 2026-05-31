import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { tweenPreset } from "@/lib/companion/presets.js";
import { setMorph, getMorph } from "@/lib/companion/morphs.js";
import { playMicroExpression } from "@/lib/companion/microExpr.js";
import { speakVisemes as runSpeakVisemes } from "@/lib/companion/lipsync.js";

// Procedural clip names produced by the dashboard engine (procAnim.js).
export const PROC_ANIMATIONS = [
  "Wave",
  "Nod yes",
  "Shake no",
  "Look around",
  "Shrug",
  "Bounce",
  "Dance",
  "Idle variation",
  "Hero entrance",
  "Double clap",
  "Punch combo",
  "Jump twist",
  "Sneaky walk",
  "Bhangra dance",
  "Thinking pose",
] as const;

// Expression preset names (presets.js / PRESETS).
export const EXPRESSIONS = [
  "Neutral",
  "Happy",
  "Sad",
  "Angry",
  "Surprised",
  "Disgust",
  "Fear",
  "Confused",
] as const;

export type LiveStatus =
  | "off"
  | "connecting"
  | "live"
  | "reconnecting"
  | "error"
  | "closed"
  | "no-skeleton";

export interface BuddyHandle {
  /** Play a procedural clip by name (see PROC_ANIMATIONS). */
  playProc: (name: string, opts?: { timeScale?: number }) => void;
  /** Fade out the current procedural clip. */
  stopProc: () => void;
  /** Tween facial morphs to an expression preset (see EXPRESSIONS). Resolves when settled. */
  setExpression: (name: string) => Promise<void>;
  /** Play a transient micro-expression over the base (see microExpr MICRO). Returns cancel. */
  playMicro: (name: string, opts?: { intensity?: number; durationMs?: number }) => () => void;
  /** Visual lip-flap for a line (no audio). Returns the cancel handle + est. duration. */
  speakVisemes: (
    text: string,
    opts?: { msPerViseme?: number; intensity?: number },
  ) => { cancel: () => void; durationMs: number };
  /** Show a speech-bubble line via the onSay prop (engine-driven dialogue). */
  say: (text: string, ms?: number) => void;
  /** Bias the head toward (yaw,pitch) radians; pass null to release. Eye-follow-cursor. */
  setHeadLookAt: (yaw: number | null, pitch?: number) => void;
  /** Blink cadence in seconds (gap = minGap + rand*span). */
  setBlinkRange: (minGap: number, span: number) => void;
  /** Connect/disconnect the live pose stream. */
  setLive: (on: boolean) => void;
  isReady: () => boolean;
  /** The underlying canvas (for cursor-relative eye-follow math). */
  getCanvas: () => HTMLCanvasElement | null;
  /** Tween the stage room palette to an emotion (background/light/bloom). */
  setMood: (emotion: string) => void;
  /** Celebratory exposure + bloom pop (e.g. on a win). */
  flash: (amount?: number) => void;
  /** Attach/detach a procedural 3D prop to a bone (Tier-3 seam). */
  attachProp: (
    name: string,
    boneRole?: string,
    opts?: { size?: number; offset?: [number, number, number] },
  ) => void;
  detachProp: (name: string) => void;
}

interface Props {
  className?: string;
  /** WebSocket URL for the live pose stream. */
  poseUrl?: string;
  /** GLB to load. Defaults to the bundled Smurf. */
  modelUrl?: string;
  onReady?: () => void;
  onLiveStatus?: (status: LiveStatus) => void;
  /** Engine-driven speech bubble: called with the line + how long to hold it. */
  onSay?: (text: string, ms: number) => void;
}

const DEFAULT_MODEL = "/companion/Smur_male6.glb";
const DEFAULT_POSE_URL = "ws://localhost:8765";

export const BuddyStage = forwardRef<BuddyHandle, Props>(function BuddyStage(
  { className, poseUrl = DEFAULT_POSE_URL, modelUrl = DEFAULT_MODEL, onReady, onLiveStatus, onSay },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentProcRef = useRef<any>(null);
  const currentMicroRef = useRef<(() => void) | null>(null);
  const currentSpeechRef = useRef<{ cancel: () => void } | null>(null);
  const onSayRef = useRef(onSay);
  useEffect(() => {
    onSayRef.current = onSay;
  }, [onSay]);
  const poseConnRef = useRef<{ close: () => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null;
    (async () => {
      try {
        // Engine modules pull in three/WebGL — import them only on the client.
        const [{ createViewer }, { createIdle }] = await Promise.all([
          import("@/lib/companion/viewer.js"),
          import("@/lib/companion/idle.js"),
        ]);
        if (disposed || !canvasRef.current) return;

        viewer = await createViewer(canvasRef.current, () => {});
        const idle = createIdle(null, null);
        viewer.setIdleUpdate(idle.update);
        viewer.onModelLoaded = (v: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vv = v as any;
          idle.rebind(vv.armature, vv.morphIndex);
          setStatus("ready");
          onReady?.();
        };
        viewerRef.current = viewer;
        idleRef.current = idle;

        await viewer.loadGLB(modelUrl, modelUrl.split("/").pop());
        if (disposed) viewer.dispose();
      } catch (e) {
        console.error("[BuddyStage] failed to start viewer", e);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      currentMicroRef.current?.();
      currentMicroRef.current = null;
      currentSpeechRef.current?.cancel();
      currentSpeechRef.current = null;
      poseConnRef.current?.close();
      poseConnRef.current = null;
      try {
        viewer?.dispose();
      } catch {
        /* noop */
      }
      viewerRef.current = null;
      idleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  useImperativeHandle(
    ref,
    (): BuddyHandle => ({
      playProc(name, opts = {}) {
        const v = viewerRef.current;
        if (!v) return;
        const action = v.procAnimations?.actions?.get(name);
        if (!action) return;
        const prev = currentProcRef.current;
        if (prev && prev !== action) prev.fadeOut(0.25);
        action
          .reset()
          .setEffectiveWeight(1)
          .setEffectiveTimeScale(opts.timeScale ?? 1)
          .fadeIn(0.2)
          .play();
        currentProcRef.current = action;
      },
      stopProc() {
        const prev = currentProcRef.current;
        if (prev) {
          prev.fadeOut(0.25);
          currentProcRef.current = null;
        }
      },
      setExpression(name) {
        const v = viewerRef.current;
        if (!v?.morphIndex) return Promise.resolve();
        return tweenPreset(v.morphIndex, setMorph, getMorph, name) as Promise<void>;
      },
      playMicro(name, opts) {
        const v = viewerRef.current;
        if (!v?.morphIndex) return () => {};
        currentMicroRef.current?.();
        const cancel = playMicroExpression(v.morphIndex, name, opts ?? {});
        currentMicroRef.current = cancel;
        return cancel;
      },
      speakVisemes(text, opts) {
        const v = viewerRef.current;
        if (!v?.morphIndex) return { cancel: () => {}, durationMs: 0 };
        currentSpeechRef.current?.cancel();
        const ctrl = runSpeakVisemes(v.morphIndex, text, opts ?? {});
        currentSpeechRef.current = ctrl;
        return ctrl;
      },
      say(text, ms = 2600) {
        onSayRef.current?.(text, ms);
      },
      setHeadLookAt(yaw, pitch = 0) {
        idleRef.current?.setHeadLookAt(yaw, pitch);
      },
      setBlinkRange(minGap, span) {
        idleRef.current?.setBlinkRange(minGap, span);
      },
      getCanvas() {
        return canvasRef.current;
      },
      setMood(emotion) {
        viewerRef.current?.setMood?.(emotion);
      },
      flash(amount) {
        viewerRef.current?.flash?.(amount);
      },
      attachProp(name, boneRole, opts) {
        viewerRef.current?.attachProp?.(name, boneRole, opts);
      },
      detachProp(name) {
        viewerRef.current?.detachProp?.(name);
      },
      async setLive(on) {
        const v = viewerRef.current;
        if (!v) return;
        if (on) {
          if (poseConnRef.current) return;
          // Hand the bones to the stream: stop clips + the procedural idle sway/breath
          // so rest capture is clean and nothing fights the streamed pose.
          this.stopProc();
          idleRef.current?.setBreathingEnabled(false);
          idleRef.current?.setHeadSwayEnabled(false);
          const { connectPoseStream } = await import("@/lib/companion/poseStream.js");
          poseConnRef.current = connectPoseStream(v, poseUrl, {
            onStatus: (s: LiveStatus) => onLiveStatus?.(s),
          });
        } else {
          poseConnRef.current?.close();
          poseConnRef.current = null;
          idleRef.current?.setBreathingEnabled(true);
          idleRef.current?.setHeadSwayEnabled(true);
          onLiveStatus?.("off");
        }
      },
      isReady() {
        return status === "ready";
      },
    }),
    [status, poseUrl, onLiveStatus],
  );

  return (
    <div className={className} style={{ position: "relative" }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-sm font-mono text-foreground/60 pointer-events-none">
          {status === "error" ? "Buddy failed to load — see console" : "Waking up your buddy…"}
        </div>
      )}
    </div>
  );
});
