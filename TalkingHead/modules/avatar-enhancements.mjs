/**
 * Avatar Visual Enhancements Module
 *
 * Applies cinematic-quality material and rendering upgrades to TalkingHead avatars:
 * 1. SSS skin shader approximation (MeshPhysicalMaterial)
 * 2. Eye enhancement (corneal specularity + iris depth)
 * 3. Lip wetness shader (clearcoat)
 * 4. HDRI environment lighting
 * 5. SSAO post-processing
 * 6. Programmatic eyelash geometry
 *
 * Usage:
 *   import { enhanceAvatar } from './avatar-enhancements.mjs';
 *   await head.showAvatar({...});
 *   enhanceAvatar(head, { /* options * / });
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ---------- Mesh classification helpers ----------

/**
 * Classify a mesh by name to determine its body region.
 * Ready Player Me uses names like Wolf3D_Head, Wolf3D_Body, Wolf3D_Eyes, etc.
 * MPFB/MakeHuman uses names like Body, Eyes, Teeth, etc.
 * This handles both conventions plus common fallbacks.
 */
function classifyMesh(name) {
  const n = name.toLowerCase();

  if (n.includes('eye') && !n.includes('lash') && !n.includes('brow')) return 'eyes';
  if (n.includes('teeth') || n.includes('tooth')) return 'teeth';
  if (n.includes('tongue')) return 'tongue';
  if (n.includes('hair')) return 'hair';
  if (n.includes('glass') || n.includes('accessory')) return 'accessory';
  if (n.includes('outfit') || n.includes('cloth') || n.includes('shirt') ||
    n.includes('pants') || n.includes('shoe') || n.includes('top') ||
    n.includes('bottom') || n.includes('jacket') || n.includes('dress')) return 'clothing';
  if (n.includes('head') || n.includes('face')) return 'skin_head';
  if (n.includes('body') || n.includes('skin')) return 'skin_body';
  if (n.includes('lash')) return 'eyelash';

  return 'unknown';
}

/**
 * Check if a mesh name likely represents skin.
 */
function isSkinMesh(name) {
  const cls = classifyMesh(name);
  return cls === 'skin_head' || cls === 'skin_body' || cls === 'unknown';
}

// ---------- 1. SSS Skin Shader ----------

/**
 * Upgrades skin meshes to MeshPhysicalMaterial with SSS approximation.
 * Uses transmission + thickness to simulate subsurface light scattering.
 */
function applySkinSSS(armature, opts = {}) {
  const {
    sssIntensity = 0.35,
    sssColor = new THREE.Color(0.9, 0.3, 0.2),
    thickness = 0.8,
    roughness = 0.55,
    sheenIntensity = 0.3,
    sheenColor = new THREE.Color(0.8, 0.5, 0.5),
  } = opts;

  const upgraded = [];

  armature.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!isSkinMesh(obj.name)) return;

    const oldMat = obj.material;
    if (!oldMat) return;

    // Create MeshPhysicalMaterial from existing maps
    const physMat = new THREE.MeshPhysicalMaterial({
      // Carry over existing maps
      map: oldMat.map || null,
      normalMap: oldMat.normalMap || null,
      normalScale: oldMat.normalScale ? oldMat.normalScale.clone() : new THREE.Vector2(1, 1),
      aoMap: oldMat.aoMap || null,
      roughnessMap: oldMat.roughnessMap || null,
      metalnessMap: oldMat.metalnessMap || null,
      emissiveMap: oldMat.emissiveMap || null,
      emissive: oldMat.emissive ? oldMat.emissive.clone() : new THREE.Color(0, 0, 0),
      color: oldMat.color ? oldMat.color.clone() : new THREE.Color(1, 1, 1),

      // PBR base
      roughness: roughness,
      metalness: 0.0,

      // SSS approximation via transmission
      transmission: sssIntensity,
      thickness: thickness,
      attenuationColor: sssColor.clone(),
      attenuationDistance: 0.5,

      // Skin sheen (peach fuzz / vellus hair effect)
      sheen: sheenIntensity,
      sheenRoughness: 0.6,
      sheenColor: sheenColor.clone(),

      // Morph targets
      morphTargets: oldMat.morphTargets !== undefined ? oldMat.morphTargets : true,
      morphNormals: oldMat.morphNormals !== undefined ? oldMat.morphNormals : true,

      // Skinning
      skinning: true,

      // Keep same side
      side: oldMat.side || THREE.FrontSide,
      transparent: oldMat.transparent || false,
      alphaMap: oldMat.alphaMap || null,
      alphaTest: oldMat.alphaTest || 0,

      name: (oldMat.name || obj.name) + '_SSS',
    });

    // Copy morph target properties from geometry if needed
    if (obj.geometry) {
      physMat.morphTargets = !!obj.geometry.morphAttributes.position;
      physMat.morphNormals = !!obj.geometry.morphAttributes.normal;
    }

    obj.material = physMat;
    obj.material.needsUpdate = true;
    upgraded.push(obj.name);
  });

  return upgraded;
}

// ---------- 2. Eye Enhancement ----------

/**
 * Enhances eye meshes with corneal specularity and iris depth.
 * Adds clearcoat for the wet corneal surface, and boosts specular for refraction.
 */
function enhanceEyes(armature, opts = {}) {
  const {
    clearcoat = 1.0,
    clearcoatRoughness = 0.05,
    irisRoughness = 0.15,
    specularIntensity = 1.5,
    ior = 1.376, // Real corneal IOR
    envMapIntensity = 2.0,
  } = opts;

  const upgraded = [];

  armature.traverse((obj) => {
    if (!obj.isMesh) return;
    if (classifyMesh(obj.name) !== 'eyes') return;

    const oldMat = obj.material;
    if (!oldMat) return;

    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: oldMat.map || null,
      normalMap: oldMat.normalMap || null,
      normalScale: oldMat.normalScale ? oldMat.normalScale.clone() : new THREE.Vector2(1, 1),
      color: oldMat.color ? oldMat.color.clone() : new THREE.Color(1, 1, 1),

      // Corneal specularity
      clearcoat: clearcoat,
      clearcoatRoughness: clearcoatRoughness,

      // Iris properties
      roughness: irisRoughness,
      metalness: 0.0,

      // Refraction / specular
      specularIntensity: specularIntensity,
      specularColor: new THREE.Color(1, 1, 1),
      ior: ior,

      // Environment reflection boost
      envMapIntensity: envMapIntensity,

      // Skinning + morphs
      morphTargets: true,
      morphNormals: true,
      skinning: true,

      side: oldMat.side || THREE.FrontSide,
      transparent: oldMat.transparent || false,
      alphaMap: oldMat.alphaMap || null,
      alphaTest: oldMat.alphaTest || 0,

      name: (oldMat.name || obj.name) + '_Eye',
    });

    if (obj.geometry) {
      eyeMat.morphTargets = !!obj.geometry.morphAttributes.position;
      eyeMat.morphNormals = !!obj.geometry.morphAttributes.normal;
    }

    obj.material = eyeMat;
    obj.material.needsUpdate = true;
    upgraded.push(obj.name);
  });

  return upgraded;
}

// ---------- 3. Lip Wetness Shader ----------

/**
 * Adds wet lip appearance using clearcoat on lip mesh areas.
 * Since lips are usually part of the head mesh, this applies
 * a secondary clearcoat layer to head meshes that already have SSS.
 */
function applyLipWetness(armature, opts = {}) {
  const {
    clearcoat = 0.6,
    clearcoatRoughness = 0.1,
  } = opts;

  const upgraded = [];

  armature.traverse((obj) => {
    if (!obj.isMesh) return;
    const cls = classifyMesh(obj.name);
    if (cls !== 'skin_head' && cls !== 'unknown') return;

    // Only apply to MeshPhysicalMaterial (post-SSS upgrade)
    if (!obj.material.isMeshPhysicalMaterial) return;

    // Lips are part of the head mesh - apply clearcoat to the entire head
    // This simulates skin moisture on the face and wet lips
    obj.material.clearcoat = clearcoat;
    obj.material.clearcoatRoughness = clearcoatRoughness;
    obj.material.needsUpdate = true;
    upgraded.push(obj.name);
  });

  return upgraded;
}

// ---------- 4. HDRI Environment Lighting ----------

/**
 * Sets up high-quality HDRI environment lighting.
 * Generates a procedural studio HDRI with multi-point lighting
 * for professional portrait-quality illumination.
 */
function setupHDRILighting(head, opts = {}) {
  const {
    hdriUrl = null,
    backgroundBlur = 1.0,
    backgroundIntensity = 0.3,
    environmentIntensity = 1.5,
    showBackground = false,
    backgroundColor = 0x1a1a2e,
    useProceduralStudio = true,
  } = opts;

  const scene = head.scene;
  const renderer = head.renderer;

  if (!renderer || !scene) return false;

  if (hdriUrl) {
    // Load external HDRI
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    new RGBELoader().load(hdriUrl, (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      if (showBackground) {
        scene.background = envMap;
        scene.backgroundBlurriness = backgroundBlur;
        scene.backgroundIntensity = backgroundIntensity;
      }
      texture.dispose();
      pmremGenerator.dispose();
    });
  } else if (useProceduralStudio) {
    // Create a procedural studio lighting environment
    const envScene = createStudioEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;

    if (showBackground) {
      scene.background = envMap;
      scene.backgroundBlurriness = backgroundBlur;
      scene.backgroundIntensity = backgroundIntensity;
    } else {
      scene.background = new THREE.Color(backgroundColor);
    }

    envScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    pmremGenerator.dispose();
  }

  // Set environment intensity on all physical materials
  scene.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.isMeshPhysicalMaterial) {
      obj.material.envMapIntensity = environmentIntensity;
      obj.material.needsUpdate = true;
    }
  });

  // Enhance existing lights for better fill
  if (head.lightAmbient) {
    head.lightAmbient.intensity = Math.max(head.lightAmbient.intensity, 1.5);
  }

  // Enable shadows on the directional light
  if (head.lightDirect) {
    head.lightDirect.castShadow = true;
    head.lightDirect.shadow.mapSize.width = 1024;
    head.lightDirect.shadow.mapSize.height = 1024;
    head.lightDirect.shadow.camera.near = 0.1;
    head.lightDirect.shadow.camera.far = 10;
    head.lightDirect.shadow.bias = -0.001;
  }

  return true;
}

/**
 * Creates a procedural studio lighting environment scene.
 * Simulates a 3-point lighting setup used in portrait photography.
 */
function createStudioEnvironment() {
  const envScene = new THREE.Scene();

  // Ambient fill - soft warm base
  const ambientGeo = new THREE.SphereGeometry(50, 32, 16);
  const ambientMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.15, 0.13, 0.12),
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(ambientGeo, ambientMat));

  // Key light - warm main light (upper right)
  addLightPanel(envScene, {
    color: new THREE.Color(8, 7, 6),
    position: new THREE.Vector3(3, 4, 2),
    width: 3, height: 3,
  });

  // Fill light - cool soft fill (left side)
  addLightPanel(envScene, {
    color: new THREE.Color(3, 3.5, 5),
    position: new THREE.Vector3(-4, 2, 1),
    width: 4, height: 4,
  });

  // Rim light - strong backlight for edge separation
  addLightPanel(envScene, {
    color: new THREE.Color(6, 6, 7),
    position: new THREE.Vector3(0, 3, -4),
    width: 5, height: 2,
  });

  // Bottom bounce - subtle upward fill to reduce harsh shadows
  addLightPanel(envScene, {
    color: new THREE.Color(1.5, 1.2, 1.0),
    position: new THREE.Vector3(0, -3, 2),
    width: 6, height: 3,
  });

  // Catch light - small bright panel for eye reflections
  addLightPanel(envScene, {
    color: new THREE.Color(15, 14, 13),
    position: new THREE.Vector3(0.5, 2.5, 3),
    width: 0.5, height: 0.5,
  });

  return envScene;
}

function addLightPanel(scene, { color, position, width, height }) {
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.lookAt(0, 1.5, 0); // aim at avatar center
  scene.add(mesh);
}

// ---------- 5. SSAO Post-Processing ----------

/**
 * Adds Screen-Space Ambient Occlusion (SSAO) as a post-processing effect.
 * This creates natural shadow contact in crevices (underarms, neck, fingers).
 */
function setupSSAO(head, opts = {}) {
  const {
    kernelRadius = 0.5,
    minDistance = 0.001,
    maxDistance = 0.1,
    intensity = 1.0,
  } = opts;

  const renderer = head.renderer;
  const scene = head.scene;
  const camera = head.camera;

  if (!renderer || !scene || !camera) return null;

  // Create the EffectComposer
  const composer = new EffectComposer(renderer);

  // Render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // SSAO pass
  const ssaoPass = new SSAOPass(
    scene,
    camera,
    renderer.domElement.clientWidth,
    renderer.domElement.clientHeight,
  );
  ssaoPass.kernelRadius = kernelRadius;
  ssaoPass.minDistance = minDistance;
  ssaoPass.maxDistance = maxDistance;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);

  // Output pass for correct color space
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // Override the render method to use the composer
  const originalRender = head.render.bind(head);
  head.render = function () {
    if (this.isRunning && !this.isAvatarOnly) {
      composer.render();
    }
  };

  // Override resize to update composer size
  const originalResize = head.onResize.bind(head);
  head.onResize = function () {
    if (!this.isAvatarOnly) {
      this.camera.aspect = this.nodeAvatar.clientWidth / this.nodeAvatar.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.nodeAvatar.clientWidth, this.nodeAvatar.clientHeight);
      composer.setSize(this.nodeAvatar.clientWidth, this.nodeAvatar.clientHeight);
      this.controls.update();
      this.render();
    }
  };

  // Store reference for disposal
  head._enhancementComposer = composer;
  head._enhancementSSAOPass = ssaoPass;

  return composer;
}

// ---------- 6. Programmatic Eyelash Geometry ----------

/**
 * Generates realistic eyelash geometry with alpha-card strips.
 * Creates upper and lower lashes for both eyes using curved strip geometry.
 */
function addEyelashes(armature, opts = {}) {
  const {
    color = new THREE.Color(0.02, 0.01, 0.01),
    upperLashCount = 24,
    lowerLashCount = 14,
    upperLength = 0.008,
    lowerLength = 0.004,
    upperCurl = 0.4,
    lowerCurl = 0.15,
    thickness = 0.0008,
    opacity = 0.92,
  } = opts;

  const leftEye = armature.getObjectByName('LeftEye');
  const rightEye = armature.getObjectByName('RightEye');
  const headBone = armature.getObjectByName('Head');

  if (!leftEye || !rightEye || !headBone) {
    console.warn('Eyelash generation: Could not find eye or head bones');
    return [];
  }

  // Get eye positions relative to head
  const leftPos = new THREE.Vector3();
  const rightPos = new THREE.Vector3();
  leftEye.getWorldPosition(leftPos);
  rightEye.getWorldPosition(rightPos);

  const headPos = new THREE.Vector3();
  headBone.getWorldPosition(headPos);

  // Calculate eye spacing to estimate eye size
  const eyeDistance = leftPos.distanceTo(rightPos);
  const eyeRadius = eyeDistance * 0.18;

  // Create lash material with alpha gradient
  const lashAlpha = createLashAlphaTexture();
  const lashMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.8,
    metalness: 0.0,
    transparent: true,
    alphaMap: lashAlpha,
    alphaTest: 0.1,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    name: 'Eyelash_Material',
  });

  const lashes = [];

  // Generate lashes for each eye
  [
    { eyeBone: leftEye, side: 'left' },
    { eyeBone: rightEye, side: 'right' },
  ].forEach(({ eyeBone, side }) => {
    const mirror = side === 'right' ? -1 : 1;

    // Upper lashes
    const upperGeo = createLashStripGeometry({
      count: upperLashCount,
      length: upperLength,
      curl: upperCurl,
      thickness: thickness,
      arcAngle: Math.PI * 0.65,
      arcRadius: eyeRadius,
      isUpper: true,
      mirror: mirror,
    });

    const upperMesh = new THREE.Mesh(upperGeo, lashMaterial);
    upperMesh.name = `Eyelash_Upper_${side}`;
    upperMesh.renderOrder = 999;
    eyeBone.add(upperMesh);

    // Position relative to eye bone
    upperMesh.position.set(0, eyeRadius * 0.15, eyeRadius * 0.8);
    lashes.push(upperMesh);

    // Lower lashes
    const lowerGeo = createLashStripGeometry({
      count: lowerLashCount,
      length: lowerLength,
      curl: lowerCurl,
      thickness: thickness * 0.7,
      arcAngle: Math.PI * 0.45,
      arcRadius: eyeRadius,
      isUpper: false,
      mirror: mirror,
    });

    const lowerMesh = new THREE.Mesh(lowerGeo, lashMaterial);
    lowerMesh.name = `Eyelash_Lower_${side}`;
    lowerMesh.renderOrder = 999;
    eyeBone.add(lowerMesh);

    lowerMesh.position.set(0, -eyeRadius * 0.3, eyeRadius * 0.8);
    lashes.push(lowerMesh);
  });

  return lashes;
}

/**
 * Creates a single lash strip geometry with multiple lash strands.
 */
function createLashStripGeometry({ count, length, curl, thickness, arcAngle, arcRadius, isUpper, mirror }) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const segments = 4; // segments per lash strand

  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) - 0.5; // -0.5 to 0.5
    const angle = t * arcAngle;

    // Base position on the eyelid arc
    const baseX = Math.sin(angle) * arcRadius * mirror;
    const baseY = 0;
    const baseZ = Math.cos(angle) * arcRadius * 0.15;

    // Length varies — longer in center, shorter on edges
    const lengthFactor = 1.0 - Math.abs(t) * 0.6;
    const lashLen = length * lengthFactor * (0.85 + Math.random() * 0.3);

    // Build strand segments
    const baseIdx = vertices.length / 3;
    for (let s = 0; s <= segments; s++) {
      const st = s / segments;

      // Curl direction
      const curlOffset = curl * st * st * (isUpper ? 1 : -1);
      const outward = st * lashLen;
      const direction = isUpper ? 1 : -1;

      const vx = baseX + (Math.random() - 0.5) * thickness * 0.3;
      const vy = baseY + outward * direction + curlOffset * lashLen;
      const vz = baseZ + st * lashLen * 0.3;

      // Left edge of strip
      vertices.push(vx - thickness * (1 - st * 0.7), vy, vz);
      uvs.push(0, st);

      // Right edge of strip
      vertices.push(vx + thickness * (1 - st * 0.7), vy, vz);
      uvs.push(1, st);

      // Create triangles
      if (s < segments) {
        const bi = baseIdx + s * 2;
        indices.push(bi, bi + 1, bi + 2);
        indices.push(bi + 1, bi + 3, bi + 2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Creates an alpha gradient texture for lash transparency.
 * Full opacity at root, fading to transparent at tip.
 */
function createLashAlphaTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.9, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}


// ---------- Main Enhancement Function ----------

/**
 * Apply all visual enhancements to a TalkingHead instance.
 *
 * @param {TalkingHead} head - The TalkingHead instance (after showAvatar)
 * @param {Object} [options={}] - Enhancement options
 * @param {boolean|Object} [options.skin=true] - SSS skin options or false to disable
 * @param {boolean|Object} [options.eyes=true] - Eye enhancement options or false to disable
 * @param {boolean|Object} [options.lips=true] - Lip wetness options or false to disable
 * @param {boolean|Object} [options.hdri=true] - HDRI lighting options or false to disable
 * @param {boolean|Object} [options.ssao=true] - SSAO options or false to disable
 * @param {boolean|Object} [options.eyelashes=true] - Eyelash options or false to disable
 * @returns {Object} Summary of applied enhancements
 */
function enhanceAvatar(head, options = {}) {
  if (!head || !head.armature) {
    throw new Error('enhanceAvatar: TalkingHead instance must have a loaded avatar (call showAvatar first)');
  }

  const results = {
    skin: [],
    eyes: [],
    lips: [],
    hdri: false,
    ssao: null,
    eyelashes: [],
  };

  const armature = head.armature;

  // 1. SSS Skin
  if (options.skin !== false) {
    const skinOpts = typeof options.skin === 'object' ? options.skin : {};
    results.skin = applySkinSSS(armature, skinOpts);
  }

  // 2. Eye Enhancement
  if (options.eyes !== false) {
    const eyeOpts = typeof options.eyes === 'object' ? options.eyes : {};
    results.eyes = enhanceEyes(armature, eyeOpts);
  }

  // 3. Lip Wetness (must come after skin SSS since it modifies the physical material)
  if (options.lips !== false) {
    const lipOpts = typeof options.lips === 'object' ? options.lips : {};
    results.lips = applyLipWetness(armature, lipOpts);
  }

  // 4. HDRI Environment Lighting
  if (options.hdri !== false) {
    const hdriOpts = typeof options.hdri === 'object' ? options.hdri : {};
    results.hdri = setupHDRILighting(head, hdriOpts);
  }

  // 5. SSAO Post-Processing
  if (options.ssao !== false) {
    const ssaoOpts = typeof options.ssao === 'object' ? options.ssao : {};
    results.ssao = setupSSAO(head, ssaoOpts);
  }

  // 6. Eyelashes
  if (options.eyelashes !== false) {
    const lashOpts = typeof options.eyelashes === 'object' ? options.eyelashes : {};
    results.eyelashes = addEyelashes(armature, lashOpts);
  }

  // Enable shadow receiving on all meshes
  armature.traverse((obj) => {
    if (obj.isMesh) {
      obj.receiveShadow = true;
      obj.castShadow = true;
    }
  });

  // Enable shadow maps on renderer
  if (head.renderer) {
    head.renderer.shadowMap.enabled = true;
    head.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  return results;
}

/**
 * Remove all enhancements and restore original state.
 * Note: This disposes enhancement resources but does not restore original materials.
 * Reload the avatar to fully reset.
 */
function disposeEnhancements(head) {
  // Dispose SSAO composer
  if (head._enhancementComposer) {
    head._enhancementComposer.dispose();
    head._enhancementComposer = null;
    head._enhancementSSAOPass = null;
  }

  // Remove eyelash meshes
  if (head.armature) {
    const lashMeshes = [];
    head.armature.traverse((obj) => {
      if (obj.isMesh && obj.name.startsWith('Eyelash_')) {
        lashMeshes.push(obj);
      }
    });
    lashMeshes.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
      if (m.parent) m.parent.remove(m);
    });
  }
}

export {
  enhanceAvatar,
  disposeEnhancements,
  applySkinSSS,
  enhanceEyes,
  applyLipWetness,
  setupHDRILighting,
  setupSSAO,
  addEyelashes,
};
