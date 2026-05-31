import { setMorph } from "./morphs.js";

// Idle behaviors are bound to the smurf armature (head/spine) + morph index.
// `rebind(armature, morphIndex)` is called once after the model loads.

export function createIdle(armature, morphIndex) {
  const state = {
    blink: {
      enabled: true,
      t: 0,
      next: 2 + Math.random() * 3,
      phase: "idle",
      start: 0,
      dur: 0,
      minGap: 2.5,
      span: 3.5,
    },
    breathing: { enabled: true, t: 0 },
    headSway: { enabled: true, t: 0, suppressed: false },
    // Eye-follow / look-at bias, smoothed toward (targetYaw,targetPitch) radians.
    look: { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, active: false },
  };

  let headBone = null,
    spineBone = null;
  let headBase = null,
    spineBase = 0;
  let hasBlinkL = false,
    hasBlinkR = false;
  let currentMorphIndex = morphIndex;

  function rebind(newArmature, newMorphIndex) {
    headBone = newArmature?.resolved.head || null;
    spineBone = newArmature?.resolved.spine || newArmature?.resolved.chest || null;
    headBase = headBone
      ? { x: headBone.rotation.x, y: headBone.rotation.y, z: headBone.rotation.z }
      : null;
    spineBase = spineBone ? spineBone.rotation.x : 0;
    currentMorphIndex = newMorphIndex || { byName: new Map() };
    hasBlinkL = currentMorphIndex.byName.has("eyeBlinkLeft");
    hasBlinkR = currentMorphIndex.byName.has("eyeBlinkRight");
  }
  rebind(armature, morphIndex);

  function setBlink(v) {
    if (hasBlinkL) setMorph(currentMorphIndex, "eyeBlinkLeft", v);
    if (hasBlinkR) setMorph(currentMorphIndex, "eyeBlinkRight", v);
  }

  function update(dt) {
    if (state.blink.enabled && (hasBlinkL || hasBlinkR)) {
      const b = state.blink;
      if (b.phase === "idle") {
        b.t += dt;
        if (b.t >= b.next) {
          b.phase = "closing";
          b.start = 0;
          b.dur = 0.08;
          b.t = 0;
        }
      } else if (b.phase === "closing") {
        b.start += dt;
        const p = Math.min(1, b.start / b.dur);
        setBlink(p);
        if (p >= 1) {
          b.phase = "opening";
          b.start = 0;
          b.dur = 0.14;
        }
      } else if (b.phase === "opening") {
        b.start += dt;
        const p = Math.min(1, b.start / b.dur);
        setBlink(1 - p);
        if (p >= 1) {
          b.phase = "idle";
          b.t = 0;
          b.next = b.minGap + Math.random() * b.span;
        }
      }
    }

    if (state.breathing.enabled && spineBone) {
      state.breathing.t += dt;
      const amp = 0.008;
      spineBone.rotation.x = spineBase + Math.sin(state.breathing.t * ((2 * Math.PI) / 4)) * amp;
    } else if (spineBone) {
      spineBone.rotation.x = spineBase;
    }

    // Smooth the look-at bias toward its target every frame (eye-follow cursor).
    const lk = state.look;
    const ls = Math.min(1, dt * 6);
    lk.yaw += (lk.targetYaw - lk.yaw) * ls;
    lk.pitch += (lk.targetPitch - lk.pitch) * ls;

    if (headBone && headBase) {
      const swayActive = state.headSway.enabled && !state.headSway.suppressed;
      if (swayActive) {
        state.headSway.t += dt;
        const t = state.headSway.t;
        // Damp the ambient sway while Buddy is actively looking at something.
        const w = lk.active ? 0.3 : 1;
        const yaw = (Math.sin(t * 0.6) * 0.025 + Math.sin(t * 0.21) * 0.015) * w;
        const pitch = Math.sin(t * 0.43) * 0.015 * w;
        headBone.rotation.y = headBase.y + yaw + lk.yaw;
        headBone.rotation.x = headBase.x + pitch + lk.pitch;
      } else {
        // Sway off (e.g. live pose) — ease toward base + the look bias only.
        headBone.rotation.y += (headBase.y + lk.yaw - headBone.rotation.y) * Math.min(1, dt * 4);
        headBone.rotation.x += (headBase.x + lk.pitch - headBone.rotation.x) * Math.min(1, dt * 4);
      }
    }
  }

  return {
    update,
    rebind,
    setBlinkEnabled: (v) => {
      state.blink.enabled = v;
      if (!v) setBlink(0);
    },
    setBreathingEnabled: (v) => {
      state.breathing.enabled = v;
    },
    setHeadSwayEnabled: (v) => {
      state.headSway.enabled = v;
    },
    suppressHeadSway: (v) => {
      state.headSway.suppressed = v;
    },
    /** Blink cadence in seconds: gap = minGap + rand*span. Faster while speaking. */
    setBlinkRange: (minGap, span) => {
      state.blink.minGap = minGap;
      state.blink.span = span;
    },
    /**
     * Bias the head toward (yaw,pitch) radians on top of the ambient sway.
     * Pass null to release back to free sway. Used for eye-follow-cursor.
     */
    setHeadLookAt: (yaw, pitch) => {
      if (yaw == null) {
        state.look.targetYaw = 0;
        state.look.targetPitch = 0;
        state.look.active = false;
        return;
      }
      // Clamp so Buddy never cranks his neck unnaturally.
      const c = (v, lim) => Math.max(-lim, Math.min(lim, v));
      state.look.targetYaw = c(yaw, 0.5);
      state.look.targetPitch = c(pitch, 0.3);
      state.look.active = true;
    },
    state,
    get headBone() {
      return headBone;
    },
    get spineBone() {
      return spineBone;
    },
  };
}
