// Scene dressing for the buddy stage: a gradient "sky", a small stylized room
// (back wall + lit window + shelf + plant + rug), mood palettes the viewer
// tweens between, and a tiny factory for 3D comedy props (hat/trophy) that can
// be parented to a bone. All procedural geometry — no asset pipeline.
import * as THREE from "three";

// ---- Gradient backdrop -----------------------------------------------------
// A vertical gradient with two slow-drifting soft glows + a gentle "breathe"
// so the backdrop is never quite static. `time` is advanced by the viewer.
export function makeSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(0x3a3f4b) },
    bottomColor: { value: new THREE.Color(0x23262c) },
    time: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vWorld;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float time;
        void main() {
          vec3 dir = normalize(vWorld);
          float h = dir.y * 0.5 + 0.5;
          vec3 base = mix(bottomColor, topColor, smoothstep(0.0, 1.0, h));
          // Two drifting soft light pools (slow, lava-lamp-ish).
          vec2 p = dir.xy;
          vec2 c1 = vec2(0.5 * sin(time * 0.11), 0.35 + 0.18 * cos(time * 0.13));
          vec2 c2 = vec2(-0.45 * cos(time * 0.09), 0.1 + 0.2 * sin(time * 0.075));
          float g1 = smoothstep(1.0, 0.0, distance(p, c1));
          float g2 = smoothstep(1.1, 0.0, distance(p, c2));
          float breathe = 0.5 + 0.5 * sin(time * 0.4);
          vec3 col = base + topColor * g1 * 0.16 + topColor * g2 * 0.10 + topColor * 0.04 * breathe;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// ---- Floating glow-motes ---------------------------------------------------
// Additive-blended points driven by a small shader: each mote twinkles (size +
// alpha) and sways on its own phase, so the field shimmers like dust in a sun
// shaft and catches the bloom. Upward drift + recycle stays on the CPU.
export function makeParticles(count = 110) {
  const positions = new Float32Array(count * 3);
  const aPhase = new Float32Array(count);
  const aScale = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 3.4;
    positions[i * 3 + 1] = Math.random() * 2.8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2.6 - 0.4;
    aPhase[i] = Math.random() * Math.PI * 2;
    aScale[i] = 0.5 + Math.random() * 1.1;
    speeds[i] = 0.03 + Math.random() * 0.08;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
  geom.setAttribute("aScale", new THREE.BufferAttribute(aScale, 1));
  const pr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0xfff2d0) },
      pixelRatio: { value: pr },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aScale;
      uniform float time;
      uniform float pixelRatio;
      varying float vTw;
      void main() {
        vec3 p = position;
        p.x += sin(time * 0.5 + aPhase) * 0.16;   // lateral sway
        p.z += cos(time * 0.4 + aPhase) * 0.10;   // depth bob
        float tw = 0.5 + 0.5 * sin(time * 1.7 + aPhase); // twinkle
        vTw = tw;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * 6.0 * pixelRatio * (0.7 + 0.5 * tw);
      }`,
    fragmentShader: `
      uniform vec3 color;
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d); // soft round sprite
        gl_FragColor = vec4(color, a * (0.18 + 0.5 * vTw));
      }`,
  });
  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  points.userData.speeds = speeds;
  return points;
}

/** Advance the shader clock + drift motes upward; recycle to the floor at the top. */
export function updateParticles(points, dt) {
  const t = (points.userData.t || 0) + dt;
  points.userData.t = t;
  if (points.material.uniforms) points.material.uniforms.time.value = t;
  const pos = points.geometry.getAttribute("position");
  const speeds = points.userData.speeds;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + speeds[i] * dt;
    if (y > 2.8) y = -0.1;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}

// ---- The little room -------------------------------------------------------
export function buildMiniSet() {
  const group = new THREE.Group();
  const matte = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });

  // Back wall.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), matte(0x2f333b));
  wall.position.set(0, 2.2, -1.8);
  wall.receiveShadow = true;
  group.add(wall);

  // A warm "lit window" (emissive → catches the bloom; recolored by mood).
  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    emissive: new THREE.Color(0xfff2cc),
    emissiveIntensity: 0.6,
    roughness: 1,
    metalness: 0,
  });
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), windowGlowMat);
  windowGlow.position.set(1.0, 2.45, -1.78);
  group.add(windowGlow);
  // Frame + cross bars.
  const frameMat = matte(0x20232a);
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), frameMat);
    m.position.set(x, y, -1.76);
    group.add(m);
  };
  bar(0.07, 1.9, 1.0, 2.45); // vertical mullion
  bar(1.5, 0.07, 1.0, 2.45); // horizontal mullion
  bar(1.5, 0.08, 1.0, 3.38); // top
  bar(1.5, 0.08, 1.0, 1.52); // bottom

  // Side shelf with two knick-knacks.
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.32), matte(0x4a3f33));
  shelf.position.set(-1.7, 1.35, -1.35);
  shelf.castShadow = true;
  group.add(shelf);
  const trinketA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), matte(0x8a6f4a));
  trinketA.position.set(-1.95, 1.5, -1.35);
  group.add(trinketA);
  const trinketB = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), matte(0x6f8a5a));
  trinketB.position.set(-1.45, 1.47, -1.35);
  group.add(trinketB);

  // Potted plant on the other side.
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.32, 16), matte(0x8a4a39));
  pot.position.y = 0.16;
  pot.castShadow = true;
  plant.add(pot);
  const leafMat = matte(0x4f7a45);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), leafMat);
    leaf.position.set(
      (Math.random() - 0.5) * 0.12,
      0.5 + Math.random() * 0.12,
      (Math.random() - 0.5) * 0.12,
    );
    leaf.rotation.set(
      (Math.random() - 0.5) * 0.6,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.6,
    );
    plant.add(leaf);
  }
  plant.position.set(1.85, 0, -1.2);
  group.add(plant);

  // Soft rug under the buddy (receives the shadow; sits just under the floor).
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), matte(0x5a4a40));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = -0.002;
  rug.receiveShadow = true;
  group.add(rug);
  const rugRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.12, 48),
    new THREE.MeshStandardMaterial({ color: 0x6f5a4a, roughness: 1, metalness: 0 }),
  );
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.position.y = 0.0;
  group.add(rugRing);

  return { group, windowGlow, plant };
}

// ---- Mood palettes ---------------------------------------------------------
// Each: sky gradient, key-light color/intensity, window-glow color/intensity,
// and bloom strength. The viewer lerps the *live* values toward these.
export const MOOD_PALETTES = {
  neutral: {
    skyTop: 0x3a3f4b,
    skyBottom: 0x23262c,
    key: 0xffffff,
    keyI: 1.6,
    glow: 0xfff2cc,
    glowI: 0.6,
    bloom: 0.35,
  },
  happy: {
    skyTop: 0x4a4030,
    skyBottom: 0x2a2620,
    key: 0xfff0d0,
    keyI: 1.8,
    glow: 0xffe6a0,
    glowI: 0.9,
    bloom: 0.5,
  },
  elated: {
    skyTop: 0x5a4a20,
    skyBottom: 0x322a18,
    key: 0xffe9b0,
    keyI: 2.0,
    glow: 0xffd54a,
    glowI: 1.4,
    bloom: 0.85,
  },
  smug: {
    skyTop: 0x40384f,
    skyBottom: 0x252030,
    key: 0xf0e2ff,
    keyI: 1.6,
    glow: 0xe7c6ff,
    glowI: 0.7,
    bloom: 0.45,
  },
  mischief: {
    skyTop: 0x3c3a4f,
    skyBottom: 0x232030,
    key: 0xeae0ff,
    keyI: 1.6,
    glow: 0xd8c6ff,
    glowI: 0.7,
    bloom: 0.5,
  },
  curious: {
    skyTop: 0x35424b,
    skyBottom: 0x222a30,
    key: 0xeaf2ff,
    keyI: 1.6,
    glow: 0xcfe3ff,
    glowI: 0.6,
    bloom: 0.35,
  },
  surprised: {
    skyTop: 0x44505e,
    skyBottom: 0x262d36,
    key: 0xffffff,
    keyI: 1.9,
    glow: 0xcfe7ff,
    glowI: 0.9,
    bloom: 0.6,
  },
  confused: {
    skyTop: 0x3b3a44,
    skyBottom: 0x232228,
    key: 0xf2eef0,
    keyI: 1.4,
    glow: 0xd9d2e0,
    glowI: 0.5,
    bloom: 0.3,
  },
  sad: {
    skyTop: 0x2c3650,
    skyBottom: 0x1b2030,
    key: 0xb9c8ff,
    keyI: 1.0,
    glow: 0x8aa0d0,
    glowI: 0.4,
    bloom: 0.25,
  },
  supportive: {
    skyTop: 0x3f4440,
    skyBottom: 0x24271f,
    key: 0xfdeed8,
    keyI: 1.5,
    glow: 0xffe9c0,
    glowI: 0.7,
    bloom: 0.35,
  },
  bored: {
    skyTop: 0x35373c,
    skyBottom: 0x202125,
    key: 0xeaeaea,
    keyI: 1.3,
    glow: 0xcfcabb,
    glowI: 0.4,
    bloom: 0.25,
  },
  sleepy: {
    skyTop: 0x202634,
    skyBottom: 0x14161e,
    key: 0x9fb0d0,
    keyI: 0.7,
    glow: 0xffb060,
    glowI: 0.95,
    bloom: 0.4,
  },
  embarrassed: {
    skyTop: 0x4e3a3c,
    skyBottom: 0x2a2022,
    key: 0xffe0e0,
    keyI: 1.6,
    glow: 0xffc0c0,
    glowI: 0.7,
    bloom: 0.4,
  },
  focused: {
    skyTop: 0x33424a,
    skyBottom: 0x1f2a30,
    key: 0xffffff,
    keyI: 1.7,
    glow: 0xbfe0ff,
    glowI: 0.5,
    bloom: 0.3,
  },
};

// ---- 3D comedy props (Tier-3 seam; attach to a bone) -----------------------
export function makeProp(name) {
  if (name === "hat") {
    const hat = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.9, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd54a,
        emissive: 0x442f00,
        roughness: 0.5,
        metalness: 0.2,
      }),
    );
    cone.position.y = 0.45;
    hat.add(cone);
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    );
    pom.position.y = 0.95;
    hat.add(pom);
    return hat;
  }
  if (name === "trophy") {
    const t = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0x6a4a00,
      roughness: 0.3,
      metalness: 0.7,
    });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.34, 20), gold);
    cup.position.y = 0.5;
    t.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12), gold);
    stem.position.y = 0.24;
    t.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.1, 16), gold);
    base.position.y = 0.1;
    t.add(base);
    return t;
  }
  return null;
}
