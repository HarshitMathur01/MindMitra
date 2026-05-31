import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { discoverMorphs } from "./morphs.js";
import { detectArmature } from "./armature.js";
import { createProcAnimations } from "./procAnim.js";
import {
  makeSky,
  makeParticles,
  updateParticles,
  buildMiniSet,
  MOOD_PALETTES,
  makeProp,
} from "./scenery.js";

// One-time scene/renderer setup. Returns a viewer handle whose .loadGLB(url)
// loads the smurf model into the scene.
export async function createViewer(canvas, onStatus = () => {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2d33);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb0c4ff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 64),
    new THREE.ShadowMaterial({ opacity: 0.25 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Gradient backdrop + themed mini-set + floating dust.
  const sky = makeSky();
  scene.add(sky.mesh);
  const miniSet = buildMiniSet();
  scene.add(miniSet.group);
  const particles = makeParticles(90);
  scene.add(particles);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 2000);
  camera.position.set(0, 1.55, 1.2);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.5, 0);
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.7;

  // Post-processing: gentle bloom (the window glow + gold props pop on a win).
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // Mood state: `cur` chases `target`; the tick loop lerps every frame so mood
  // shifts read as a slow recolor of the room rather than a hard cut.
  const baseExposure = 1.0;
  const cur = {
    skyTop: new THREE.Color(MOOD_PALETTES.neutral.skyTop),
    skyBottom: new THREE.Color(MOOD_PALETTES.neutral.skyBottom),
    key: new THREE.Color(MOOD_PALETTES.neutral.key),
    keyI: MOOD_PALETTES.neutral.keyI,
    glow: new THREE.Color(MOOD_PALETTES.neutral.glow),
    glowI: MOOD_PALETTES.neutral.glowI,
    bloom: MOOD_PALETTES.neutral.bloom,
  };
  let target = MOOD_PALETTES.neutral;
  let flash = 0; // transient celebratory pop (exposure + bloom), decays to 0
  let elapsed = 0; // animation clock for the backdrop (sky/window/plant)
  function setMood(emotion) {
    target = MOOD_PALETTES[emotion] || MOOD_PALETTES.neutral;
  }
  function doFlash(amount = 1) {
    flash = Math.min(1.5, flash + amount);
  }

  const loader = new GLTFLoader();

  // --- Model state ---
  const viewer = {
    scene,
    camera,
    renderer,
    controls,
    avatar: null,
    armature: null,
    mixer: null,
    animations: new Map(),
    procAnimations: { actions: new Map(), status: [] },
    morphIndex: { byName: new Map(), allNames: [], arkit: [] },
    currentFileName: null,
    setIdleUpdate(fn) {
      idleUpdate = fn;
    },
    setPoseUpdate(fn) {
      poseUpdate = fn;
    },
    frameHead,
    frameBody,
    setMood, // (emotion) → tween room palette
    flash: doFlash, // celebratory exposure/bloom pop
    attachProp,
    detachProp,
    loadGLB, // async (url: string)
    dispose,
    onModelLoaded: null, // set by main.js
  };

  let idleUpdate = null;
  let poseUpdate = null;
  const props3d = new Map(); // name → { mesh, bone }
  let headBoneWorld = new THREE.Vector3();
  let avatarBox = new THREE.Box3();
  let avatarSize = new THREE.Vector3();
  let avatarCenter = new THREE.Vector3();

  // ----- Animation loop runs even before first GLB loaded -----
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const clock = new THREE.Clock();
  let rafId = 0;
  let running = true;
  function tick() {
    if (!running) return;
    const dt = clock.getDelta();
    if (idleUpdate) idleUpdate(dt);
    if (viewer.mixer) viewer.mixer.update(dt);
    // Pose stream runs AFTER the mixer so streamed bone transforms win over clips.
    if (poseUpdate) poseUpdate(dt);
    updateMood(dt);
    updateParticles(particles, dt);
    controls.update();
    composer.render();
    rafId = requestAnimationFrame(tick);
  }

  // Ease the live palette toward the target mood, advance the backdrop's own
  // animation clock (drifting sky glows, breathing window, swaying plant), and
  // decay the celebratory flash.
  function updateMood(dt) {
    elapsed += dt;
    const k = Math.min(1, dt * 2.2); // ~0.45s to settle
    cur.skyTop.lerp(_tmpC.set(target.skyTop), k);
    cur.skyBottom.lerp(_tmpC.set(target.skyBottom), k);
    cur.key.lerp(_tmpC.set(target.key), k);
    cur.glow.lerp(_tmpC.set(target.glow), k);
    cur.keyI += (target.keyI - cur.keyI) * k;
    cur.glowI += (target.glowI - cur.glowI) * k;
    cur.bloom += (target.bloom - cur.bloom) * k;
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);

    sky.uniforms.topColor.value.copy(cur.skyTop);
    sky.uniforms.bottomColor.value.copy(cur.skyBottom);
    sky.uniforms.time.value = elapsed;
    key.color.copy(cur.key);
    key.intensity = cur.keyI + flash * 0.6;
    miniSet.windowGlow.material.emissive.copy(cur.glow);
    // Gentle "breathing" on top of the mood base + the win flash.
    miniSet.windowGlow.material.emissiveIntensity =
      (cur.glowI + flash * 0.8) * (1 + 0.07 * Math.sin(elapsed * 0.8));
    if (miniSet.plant) miniSet.plant.rotation.z = Math.sin(elapsed * 0.6) * 0.025;
    bloomPass.strength = cur.bloom + flash * 0.7;
    renderer.toneMappingExposure = baseExposure + flash * 0.25;
  }
  const _tmpC = new THREE.Color();
  rafId = requestAnimationFrame(tick);

  // Stop the loop, release the WebGL context and observers (React unmount).
  function dispose() {
    running = false;
    cancelAnimationFrame(rafId);
    try {
      resizeObserver.disconnect();
    } catch (e) {
      /* noop */
    }
    try {
      controls.dispose();
    } catch (e) {
      /* noop */
    }
    for (const name of [...props3d.keys()]) detachProp(name);
    disposeAvatar();
    disposeTree(sky.mesh);
    disposeTree(miniSet.group);
    particles.geometry.dispose();
    particles.material.dispose();
    try {
      composer.dispose();
    } catch (e) {
      /* noop */
    }
    try {
      renderer.dispose();
    } catch (e) {
      /* noop */
    }
  }

  // Dispose every geometry/material under an object tree.
  function disposeTree(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
  }

  // ----- Disposal of previous avatar -----
  function disposeAvatar() {
    for (const name of [...props3d.keys()]) detachProp(name);
    if (!viewer.avatar) return;
    if (viewer.mixer) {
      viewer.mixer.stopAllAction();
      viewer.mixer.uncacheRoot(viewer.avatar);
    }
    scene.remove(viewer.avatar);
    viewer.avatar.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const k of Object.keys(m)) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        }
      }
    });
    viewer.avatar = null;
    viewer.armature = null;
    viewer.mixer = null;
    viewer.animations = new Map();
    viewer.procAnimations = { actions: new Map(), status: [] };
    viewer.morphIndex = { byName: new Map(), allNames: [], arkit: [] };
  }

  // ----- Load the smurf GLB from a URL -----
  async function loadGLB(url, fileName = null) {
    onStatus("Loading GLB…");
    let gltf;
    try {
      gltf = await new Promise((resolve, reject) => {
        loader.load(
          url,
          resolve,
          (xhr) => {
            if (xhr.lengthComputable) {
              const pct = Math.round((xhr.loaded / xhr.total) * 100);
              onStatus(`Loading GLB… ${pct}%`);
            }
          },
          reject,
        );
      });
    } catch (err) {
      onStatus(`Failed to load GLB: ${err.message || err}`);
      throw err;
    }

    disposeAvatar();

    const avatar = gltf.scene;
    avatar.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    scene.add(avatar);
    avatar.updateMatrixWorld(true);

    // Normalize scale + position.
    let rawBox = new THREE.Box3().setFromObject(avatar);
    let rawSize = rawBox.getSize(new THREE.Vector3());
    if (rawSize.y > 10) {
      const s = 1.7 / rawSize.y;
      avatar.scale.multiplyScalar(s);
      avatar.updateMatrixWorld(true);
    }
    avatarBox.setFromObject(avatar);
    avatarBox.getSize(avatarSize);
    const center = avatarBox.getCenter(new THREE.Vector3());
    avatar.position.x -= center.x;
    avatar.position.z -= center.z;
    avatar.position.y -= avatarBox.min.y;
    avatar.updateMatrixWorld(true);
    avatarBox.setFromObject(avatar);
    avatarBox.getSize(avatarSize);

    viewer.avatar = avatar;
    viewer.currentFileName = fileName;

    // Armature + morphs + animations.
    viewer.armature = detectArmature(avatar);
    viewer.morphIndex = discoverMorphs(avatar);
    viewer.mixer = new THREE.AnimationMixer(avatar);

    const animations = new Map();
    for (const clip of gltf.animations) {
      animations.set(clip.name, viewer.mixer.clipAction(clip));
    }
    viewer.animations = animations;

    viewer.procAnimations = createProcAnimations(viewer.armature, viewer.mixer);

    // Camera framing.
    const head = viewer.armature.resolved.head;
    if (head) {
      head.getWorldPosition(headBoneWorld);
    } else {
      headBoneWorld.set(0, avatarBox.max.y - avatarSize.y * 0.08, 0);
    }
    avatarBox.getCenter(avatarCenter);
    const dist = distanceToFitBox(avatarSize, 1.18);
    controls.target.copy(avatarCenter);
    camera.position.set(avatarCenter.x, avatarCenter.y, avatarCenter.z + dist);
    camera.near = Math.max(0.001, dist * 0.01);
    camera.far = Math.max(50, dist * 20);
    camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.3;
    controls.maxDistance = dist * 6;
    controls.update();

    console.log("[viewer] loaded", fileName || url, {
      bones: viewer.armature.bones.size,
      rig: viewer.armature.rig,
      animations: [...viewer.animations.keys()],
      morphs: viewer.morphIndex.allNames.length,
    });

    if (typeof viewer.onModelLoaded === "function") viewer.onModelLoaded(viewer);
  }

  function frameHead() {
    if (!viewer.armature?.resolved.head) return;
    viewer.armature.resolved.head.getWorldPosition(headBoneWorld);
    controls.target.copy(headBoneWorld);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, 0.75);
  }
  function frameBody() {
    if (!viewer.avatar) return;
    avatarBox.setFromObject(viewer.avatar);
    avatarBox.getCenter(avatarCenter);
    avatarBox.getSize(avatarSize);
    controls.target.copy(avatarCenter);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, distanceToFitBox(avatarSize, 1.18));
  }

  // Parent a small procedural prop to a resolved bone (head/hand). Scales the
  // prop into bone-local space so it shows at a sane real-world size regardless
  // of the avatar's import scale. Tier-3 seam — not auto-triggered by the game.
  function attachProp(name, boneRole = "head", opts = {}) {
    detachProp(name);
    const bone = viewer.armature?.resolved?.[boneRole];
    const mesh = makeProp(name);
    if (!bone || !mesh) return false;
    const worldScale = bone.getWorldScale(new THREE.Vector3());
    const s = (opts.size ?? 0.18) / Math.max(1e-4, worldScale.x);
    mesh.scale.setScalar(s);
    const off = opts.offset ?? [0, 0.12, 0];
    mesh.position.set(off[0] / worldScale.x, off[1] / worldScale.y, off[2] / worldScale.z);
    bone.add(mesh);
    props3d.set(name, { mesh, bone });
    return true;
  }
  function detachProp(name) {
    const entry = props3d.get(name);
    if (!entry) return;
    entry.bone.remove(entry.mesh);
    entry.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    props3d.delete(name);
  }

  function distanceToFitBox(size, margin = 1.15) {
    const fovRad = (camera.fov * Math.PI) / 180;
    const fitHeight = size.y / (2 * Math.tan(fovRad / 2));
    const fitWidth = size.x / (2 * Math.tan(fovRad / 2) * Math.max(0.1, camera.aspect));
    return Math.max(0.5, fitHeight, fitWidth, size.z * 1.5) * margin;
  }

  return viewer;
}
