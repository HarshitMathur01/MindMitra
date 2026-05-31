// Live pose streaming — "fetch the procedural animation from the dashboard".
//
// Connects to a WebSocket that streams per-bone LOCAL pose deltas in the
// Blender `pose_delta.json` format and applies them to the loaded armature
// every frame, AFTER the AnimationMixer (see viewer.js `poseUpdate` hook), so
// streamed bone transforms win over the procedural clips.
//
// Frame protocol (JSON, one message per frame):
//   { "t": <number>, "bones": { "<boneName>": { "q": [w,x,y,z], "loc"?: [x,y,z] } } }
//
// `q` is a bone-LOCAL rotation delta relative to its rest pose, in Blender
// quaternion order [w,x,y,z] (this is `delta_B_channel.rotation_quaternion`
// from pose_delta.json). `loc` is an optional local translation delta.
// GLTFLoader strips the dot from bone names, so "Bone.101" is resolved to the
// GLB bone "Bone101" automatically.

import * as THREE from 'three';

export function connectPoseStream(viewer, url, opts = {}) {
  const { smoothing = 0.3, applyLocation = true, onStatus = () => {} } = opts;
  const armature = viewer.armature;
  if (!armature || !armature.hasSkeleton) {
    onStatus('no-skeleton');
    return { close() {} };
  }

  // ---- Bone name resolution (exact → dot-stripped → case-insensitive) ----
  const bones = armature.bones; // Map<name, THREE.Bone>
  const lower = new Map();
  for (const [n, b] of bones) lower.set(n.toLowerCase(), b);
  function resolve(name) {
    if (bones.has(name)) return bones.get(name);
    const nd = name.replace(/\./g, '');
    if (bones.has(nd)) return bones.get(nd);
    return lower.get(name.toLowerCase()) || lower.get(nd.toLowerCase()) || null;
  }

  // ---- Per-bone rest cache + smoothed target ----
  // Rest is captured the first time a bone appears in the stream.
  const cache = new Map(); // THREE.Bone -> { restQ, restPos, targetQ, targetPos }
  function entryFor(bone) {
    let e = cache.get(bone);
    if (!e) {
      e = {
        restQ: bone.quaternion.clone(),
        restPos: bone.position.clone(),
        targetQ: bone.quaternion.clone(),
        targetPos: bone.position.clone(),
      };
      cache.set(bone, e);
    }
    return e;
  }

  const tmpDelta = new THREE.Quaternion();
  const active = new Set(); // bones present in the latest frame
  let hasFrame = false;

  function ingest(frame) {
    if (!frame || !frame.bones) return;
    active.clear();
    for (const name in frame.bones) {
      const bone = resolve(name);
      if (!bone) continue;
      const data = frame.bones[name];
      const e = entryFor(bone);
      const q = data && data.q;
      if (Array.isArray(q) && q.length === 4) {
        // Blender [w,x,y,z] -> THREE (x,y,z,w); local delta multiplied onto rest.
        tmpDelta.set(q[1], q[2], q[3], q[0]);
        e.targetQ.copy(e.restQ).multiply(tmpDelta);
      }
      const loc = applyLocation && data && data.loc;
      if (Array.isArray(loc) && loc.length === 3) {
        e.targetPos.set(e.restPos.x + loc[0], e.restPos.y + loc[1], e.restPos.z + loc[2]);
      } else {
        e.targetPos.copy(e.restPos);
      }
      active.add(bone);
    }
    hasFrame = true;
  }

  // Runs every frame from viewer.tick(), after mixer.update().
  function poseUpdate(dt) {
    if (!hasFrame) return;
    const a = smoothing <= 0 ? 1 : Math.min(1, dt / smoothing);
    for (const bone of active) {
      const e = cache.get(bone);
      if (!e) continue;
      bone.quaternion.slerp(e.targetQ, a);
      bone.position.lerp(e.targetPos, a);
    }
  }
  viewer.setPoseUpdate(poseUpdate);

  // ---- WebSocket ----
  let ws = null;
  let closed = false;
  let reconnectTimer = 0;

  function open() {
    onStatus('connecting');
    try {
      ws = new WebSocket(url);
    } catch (e) {
      onStatus('error');
      return;
    }
    ws.onopen = () => onStatus('live');
    ws.onmessage = (ev) => {
      try { ingest(JSON.parse(ev.data)); } catch (e) { /* ignore malformed frame */ }
    };
    ws.onerror = () => onStatus('error');
    ws.onclose = () => {
      if (closed) return;
      onStatus('reconnecting');
      reconnectTimer = window.setTimeout(open, 1500);
    };
  }
  open();

  function close() {
    closed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    try { ws && ws.close(); } catch (e) { /* noop */ }
    viewer.setPoseUpdate(null);
    // Snap bones back to their captured rest pose on disconnect.
    for (const [bone, e] of cache) {
      bone.quaternion.copy(e.restQ);
      bone.position.copy(e.restPos);
    }
    onStatus('off');
  }

  return { close };
}
