/**
 * OnboardingAvatar.jsx — 3D avatar for the onboarding flow with full lip-sync support.
 *
 * Features:
 *   - Idle animation loop
 *   - Gentle / compassionate facial expression presets
 *   - Natural eye movement & natural blinking
 *   - Subtle idle breathing + soft head sway
 *   - Full viseme-based lip-sync (same quality as the main Avatar)
 *   - Coarticulation blending between consecutive visemes
 *   - Jaw coupling tied to viseme openness
 *   - Procedural talking fallback (sine-wave mouth) when isSpeaking=true but no lipsync data
 *
 * Props:
 *   expression  — "gentle" | "compassionate" | "listening"  (default: "gentle")
 *   lipsync     — Rhubarb mouthCues object  { mouthCues: [{start,end,value},...] }
 *   audio       — base64 audio string OR HTMLAudioElement; when provided syncs lipsync to audio time
 *   isSpeaking  — boolean; triggers procedural talking when no lipsync data is available
 *
 * Does NOT depend on ChatProvider or any chat hooks.
 */

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ── Facial expression presets ─────────────────────────────────────────────
const EXPRESSIONS = {
    gentle: {
        mouthSmileLeft: 0.35,
        mouthSmileRight: 0.30,
        eyeSquintLeft: 0.25,
        eyeSquintRight: 0.28,
        browInnerUp: 0.08,
        mouthDimpleLeft: 0.15,
        mouthDimpleRight: 0.15,
        cheekSquintLeft: 0.15,
        cheekSquintRight: 0.15,
    },
    compassionate: {
        browInnerUp: 0.35,
        eyeSquintLeft: 0.30,
        eyeSquintRight: 0.32,
        mouthSmileLeft: 0.20,
        mouthSmileRight: 0.18,
        mouthDimpleLeft: 0.20,
        mouthDimpleRight: 0.20,
        cheekSquintLeft: 0.20,
        cheekSquintRight: 0.20,
        mouthShrugLower: 0.15,
    },
    listening: {
        browInnerUp: 0.25,
        eyeWideLeft: 0.12,
        eyeWideRight: 0.12,
        mouthClose: 0.05,
        mouthPressLeft: 0.08,
        mouthPressRight: 0.08,
    },
};

// ── Viseme config: intensity, jaw-open coupling, cheek puff, lip funnel/pucker ──
const VISEME_CONFIG = {
    //                            intensity  jawOpen  cheek  funnel  pucker
    viseme_PP: { intensity: 0.85, jawOpen: 0.00, cheek: 0.00, funnel: 0.00, pucker: 0.10 }, // p,b,m — pressed
    viseme_kk: { intensity: 0.70, jawOpen: 0.12, cheek: 0.05, funnel: 0.00, pucker: 0.00 }, // k,g   — back stop
    viseme_I: { intensity: 0.80, jawOpen: 0.25, cheek: 0.10, funnel: 0.00, pucker: 0.00 }, // i,ee  — stretch
    viseme_AA: { intensity: 0.90, jawOpen: 0.50, cheek: 0.05, funnel: 0.00, pucker: 0.00 }, // a,aa  — wide open
    viseme_O: { intensity: 0.85, jawOpen: 0.35, cheek: 0.00, funnel: 0.55, pucker: 0.00 }, // o     — rounded
    viseme_U: { intensity: 0.80, jawOpen: 0.15, cheek: 0.00, funnel: 0.30, pucker: 0.50 }, // u,oo  — puckered
    viseme_FF: { intensity: 0.75, jawOpen: 0.08, cheek: 0.00, funnel: 0.00, pucker: 0.00 }, // f,v   — teeth-lip
    viseme_TH: { intensity: 0.70, jawOpen: 0.18, cheek: 0.00, funnel: 0.00, pucker: 0.00 }, // th,l  — tongue
};

// ── Rhubarb phoneme letter → Three.js viseme morph target ────────────────
const PHONEME_TO_VISEME = {
    A: "viseme_PP",  // Closed mouth (p, b, m)
    B: "viseme_kk",  // Clenched teeth
    C: "viseme_I",   // Open mouth (vowels)
    D: "viseme_AA",  // Wide open mouth
    E: "viseme_O",   // Rounded mouth
    F: "viseme_U",   // Puckered lips
    G: "viseme_FF",  // F/V sounds
    H: "viseme_TH",  // Tongue/L sounds
    X: "viseme_PP",  // Rest/pause — closed (natural resting position)
};

// ── Component ─────────────────────────────────────────────────────────────

export function OnboardingAvatar({
    expression = "gentle",
    lipsync = null,    // { mouthCues: [{start, end, value},...] } from Rhubarb
    audio = null,    // base64 string OR HTMLAudioElement for time-sync
    isSpeaking = false,   // boolean — enables procedural talking when no lipsync
    ...props
}) {
    const group = useRef();
    const { nodes, materials, scene } = useGLTF(
        "/models/68c43859d830ce77ae036e51.glb"
    );
    const { animations } = useGLTF("/models/animations.glb");
    const { actions } = useAnimations(animations, group);

    // ── Refs for animation systems ──────────────────────────────────────
    const breathingRef = useRef({ time: 0, originalScaleY: null });
    const eyeRef = useRef({ currentX: 0, currentY: 0, nextChangeTime: 0 });
    const headRef = useRef({ yawTime: 0 });
    const proceduralRef = useRef({ time: 0 }); // procedural talking fallback timer
    const [eyeTarget, setEyeTarget] = useState({ x: 0, y: 0 });
    const [blink, setBlink] = useState(false);

    // ── Lipsync state ───────────────────────────────────────────────────
    const playbackTimeRef = useRef(0); // ref avoids async state drift inside useFrame
    const audioElemRef = useRef(null); // holds HTMLAudioElement when audio prop is a string
    const lastCueIdxRef = useRef(0);   // cached cue index — O(1) amortised search per frame

    // ── Enhance materials (same warm Indian skin tones as main Avatar) ──
    useEffect(() => {
        const enhanceSkin = (material, satBoost, lightnessShift, hueShift = 0) => {
            if (!material?.color) return;
            const hsl = { h: 0, s: 0, l: 0 };
            material.color.getHSL(hsl);
            material.color.setHSL(
                Math.max(0, Math.min(1, hsl.h + hueShift)),
                Math.max(0, Math.min(1, hsl.s * satBoost)),
                Math.max(0, Math.min(1, hsl.l + lightnessShift))
            );
            material.roughness = 0.55;
            material.metalness = 0.02;
            material.envMapIntensity = 0.8;
            material.needsUpdate = true;
        };

        enhanceSkin(materials.Wolf3D_Skin, 1.35, -0.06, -0.008);
        enhanceSkin(materials.Wolf3D_Body, 1.25, -0.04, -0.005);

        if (materials.Wolf3D_Eye) {
            materials.Wolf3D_Eye.roughness = 0.1;
            materials.Wolf3D_Eye.metalness = 0.05;
            materials.Wolf3D_Eye.envMapIntensity = 1.5;
            materials.Wolf3D_Eye.needsUpdate = true;
        }
        if (materials.Wolf3D_Teeth) {
            materials.Wolf3D_Teeth.roughness = 0.3;
            materials.Wolf3D_Teeth.metalness = 0.0;
            materials.Wolf3D_Teeth.needsUpdate = true;
        }
        if (materials.Wolf3D_Hair) {
            materials.Wolf3D_Hair.roughness = 0.45;
            materials.Wolf3D_Hair.metalness = 0.08;
            materials.Wolf3D_Hair.envMapIntensity = 0.6;
            materials.Wolf3D_Hair.needsUpdate = true;
        }
    }, [materials]);

    // ── Start idle animation ────────────────────────────────────────────
    useEffect(() => {
        const idleAction =
            actions["Idle"] || actions[Object.keys(actions)[0]];
        if (idleAction) {
            idleAction.reset().fadeIn(0.4).play();
            return () => idleAction.fadeOut(0.4);
        }
    }, [actions]);

    // ── Blinking system ─────────────────────────────────────────────────
    useEffect(() => {
        let timeout;
        const nextBlink = () => {
            timeout = setTimeout(() => {
                setBlink(true);
                const dur = THREE.MathUtils.randInt(120, 220);
                setTimeout(() => {
                    setBlink(false);
                    // 25 % chance of a double-blink
                    if (Math.random() < 0.25) {
                        setTimeout(() => {
                            setBlink(true);
                            setTimeout(() => {
                                setBlink(false);
                                nextBlink();
                            }, 100);
                        }, 120);
                    } else {
                        nextBlink();
                    }
                }, dur);
            }, THREE.MathUtils.randInt(1500, 5500));
        };
        nextBlink();
        return () => clearTimeout(timeout);
    }, []);

    // ── Audio / lipsync setup ────────────────────────────────────────────
    // Accepts either:
    //   • an HTMLAudioElement (used directly)
    //   • a base64 audio string (creates an Audio element internally)
    //   • null (timer-based playback used instead)
    useEffect(() => {
        if (!lipsync) {
            playbackTimeRef.current = 0;
            lastCueIdxRef.current = 0;
            audioElemRef.current = null;
            return;
        }

        playbackTimeRef.current = 0; // reset timer whenever new lipsync arrives
        lastCueIdxRef.current = 0;

        if (audio instanceof HTMLAudioElement) {
            audioElemRef.current = audio;
        } else if (typeof audio === "string" && audio.length > 0) {
            const isWav = audio.startsWith("UklGR");
            const mime = isWav ? "audio/wav" : "audio/mp3";
            const elem = new Audio(`data:${mime};base64,` + audio);
            elem.play().catch(() => { }); // autoplay — falls back to timer sync if blocked
            audioElemRef.current = elem;
        } else {
            audioElemRef.current = null;
        }

        return () => {
            if (audioElemRef.current && typeof audio === "string") {
                audioElemRef.current.pause();
                audioElemRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lipsync]);

    // ── Helper: lerp a single morph target across all skinned meshes ───
    const lerpMorphTarget = (target, value, speed = 0.1) => {
        scene.traverse((child) => {
            if (child.isSkinnedMesh && child.morphTargetDictionary) {
                const idx = child.morphTargetDictionary[target];
                if (idx === undefined || child.morphTargetInfluences[idx] === undefined) return;
                child.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
                    child.morphTargetInfluences[idx],
                    value,
                    speed
                );
            }
        });
    };

    // ── Per-frame animation loop ────────────────────────────────────────
    useFrame((state, delta) => {
        const t = state.clock.elapsedTime;
        const mapping = EXPRESSIONS[expression] || EXPRESSIONS.gentle;

        // — Facial expression morph targets —
        if (nodes.EyeLeft?.morphTargetDictionary) {
            Object.keys(nodes.EyeLeft.morphTargetDictionary).forEach((key) => {
                if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;
                if (key.startsWith("eyeLook")) return;

                if (mapping[key]) {
                    const speed = key.startsWith("brow") ? 0.12 : key.startsWith("mouth") ? 0.07 : 0.06;
                    lerpMorphTarget(key, mapping[key], speed);
                } else {
                    lerpMorphTarget(key, 0, 0.05);
                }
            });
        }

        // — Blink —
        lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
        lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

        // — Natural eye gaze —
        if (t >= eyeRef.current.nextChangeTime) {
            setEyeTarget({
                x: (Math.random() - 0.5) * 0.25,
                y: (Math.random() - 0.5) * 0.15,
            });
            eyeRef.current.nextChangeTime = t + THREE.MathUtils.randFloat(2.5, 5);
        }
        eyeRef.current.currentX = THREE.MathUtils.lerp(eyeRef.current.currentX, eyeTarget.x, 0.04);
        eyeRef.current.currentY = THREE.MathUtils.lerp(eyeRef.current.currentY, eyeTarget.y, 0.04);

        lerpMorphTarget("eyeLookOutLeft", Math.max(0, -eyeRef.current.currentX), 0.08);
        lerpMorphTarget("eyeLookInLeft", Math.max(0, eyeRef.current.currentX), 0.08);
        lerpMorphTarget("eyeLookOutRight", Math.max(0, eyeRef.current.currentX), 0.08);
        lerpMorphTarget("eyeLookInRight", Math.max(0, -eyeRef.current.currentX), 0.08);
        lerpMorphTarget("eyeLookUpLeft", Math.max(0, eyeRef.current.currentY), 0.08);
        lerpMorphTarget("eyeLookUpRight", Math.max(0, eyeRef.current.currentY), 0.08);
        lerpMorphTarget("eyeLookDownLeft", Math.max(0, -eyeRef.current.currentY), 0.08);
        lerpMorphTarget("eyeLookDownRight", Math.max(0, -eyeRef.current.currentY), 0.08);

        // — Idle breathing —
        breathingRef.current.time += delta;
        const breathCycle = Math.sin(breathingRef.current.time * 0.2 * Math.PI * 2);
        if (nodes.Hips) {
            if (!breathingRef.current.originalScaleY) {
                breathingRef.current.originalScaleY = nodes.Hips.scale.y;
            }
            nodes.Hips.scale.y = breathingRef.current.originalScaleY + 0.007 * breathCycle;
        }

        // — Subtle head sway —
        headRef.current.yawTime += delta;
        if (nodes.Head) {
            const sway = Math.sin(headRef.current.yawTime * 0.15) * 0.018;
            const tilt = Math.cos(headRef.current.yawTime * 0.12) * 0.010;
            nodes.Head.rotation.y = THREE.MathUtils.lerp(nodes.Head.rotation.y, sway, 0.03);
            nodes.Head.rotation.z = THREE.MathUtils.lerp(nodes.Head.rotation.z, tilt, 0.03);
        }

        // ── LIP-SYNC ────────────────────────────────────────────────────

        const appliedVisemes = [];
        let jawOpenTarget = 0;
        let cheekTarget = 0;

        const hasMouthCues =
            lipsync &&
            Array.isArray(lipsync.mouthCues) &&
            lipsync.mouthCues.length > 0;

        if (hasMouthCues) {
            // ── Advance playback via ref — no async setState drift ──────
            if (!audioElemRef.current) {
                playbackTimeRef.current += delta;
            }
            const currentTime = audioElemRef.current
                ? audioElemRef.current.currentTime
                : playbackTimeRef.current;

            // ── O(1) amortised cue search via cached index ────────────────
            const cues = lipsync.mouthCues;
            let idx = lastCueIdxRef.current;
            // Advance forward past expired cues
            while (idx < cues.length - 1 && currentTime > cues[idx].end) idx++;
            // Walk back on audio seek / restart
            while (idx > 0 && currentTime < cues[idx].start) idx--;
            lastCueIdxRef.current = idx;

            let currentCue = null;
            let nextCue = null;
            const c = cues[idx];
            if (
                c &&
                typeof c.start === "number" &&
                typeof c.end === "number" &&
                c.value &&
                currentTime >= c.start &&
                currentTime <= c.end
            ) {
                currentCue = c;
                nextCue = cues[idx + 1] || null;
            }

            let funnelTarget = 0;
            let puckerTarget = 0;

            if (currentCue) {
                const viseme = PHONEME_TO_VISEME[currentCue.value];
                if (viseme) {
                    const cfg = VISEME_CONFIG[viseme] || { intensity: 0.8, jawOpen: 0.2, cheek: 0, funnel: 0, pucker: 0 };
                    const cueDuration = Math.max(currentCue.end - currentCue.start, 0.01);
                    const progress = Math.min((currentTime - currentCue.start) / cueDuration, 1.0);

                    // Envelope: faster attack (0→15 %), flat sustain, gentle partial release (75→100 %)
                    let envelope = 1.0;
                    if (progress < 0.15) {
                        envelope = progress / 0.15;                               // Fast attack
                    } else if (progress > 0.75) {
                        envelope = 1.0 - ((progress - 0.75) / 0.25) * 0.35;     // Partial release
                    }

                    const intensity = cfg.intensity * envelope;
                    appliedVisemes.push(viseme);

                    // Snappier lerp during attack, smooth during sustain/decay
                    const lerpSpeed = progress < 0.15 ? 0.65 : 0.38;
                    lerpMorphTarget(viseme, intensity, lerpSpeed);

                    jawOpenTarget = cfg.jawOpen * envelope;
                    cheekTarget = cfg.cheek * envelope;
                    funnelTarget = (cfg.funnel || 0) * envelope;
                    puckerTarget = (cfg.pucker || 0) * envelope;

                    // Suppress mouthClose during open vowels to prevent half-shut look
                    if (jawOpenTarget > 0.2) {
                        lerpMorphTarget("mouthClose", 0, 0.55);
                    }

                    // Coarticulation: blend toward next viseme in last 40 %
                    if (nextCue && progress > 0.6) {
                        const nextViseme = PHONEME_TO_VISEME[nextCue.value];
                        if (nextViseme && nextViseme !== viseme) {
                            const blend = (progress - 0.6) / 0.4;
                            const nCfg = VISEME_CONFIG[nextViseme] || { intensity: 0.8, jawOpen: 0.2, cheek: 0, funnel: 0, pucker: 0 };
                            lerpMorphTarget(nextViseme, nCfg.intensity * blend * 0.5, 0.28);
                            appliedVisemes.push(nextViseme);
                            jawOpenTarget = THREE.MathUtils.lerp(jawOpenTarget, nCfg.jawOpen, blend * 0.4);
                            funnelTarget = THREE.MathUtils.lerp(funnelTarget, nCfg.funnel || 0, blend * 0.4);
                            puckerTarget = THREE.MathUtils.lerp(puckerTarget, nCfg.pucker || 0, blend * 0.4);
                        }
                    }
                }
            }

            // Reset inactive visemes — faster to prevent ghosting
            Object.values(PHONEME_TO_VISEME).forEach((v) => {
                if (!appliedVisemes.includes(v)) {
                    lerpMorphTarget(v, 0, 0.30);
                }
            });

            // Apply jaw, cheek puff, lip rounding, lip pucker, cheek squint
            lerpMorphTarget("jawOpen", jawOpenTarget, 0.42);
            lerpMorphTarget("cheekPuff", cheekTarget, 0.25);
            lerpMorphTarget("mouthFunnel", funnelTarget, 0.38);
            lerpMorphTarget("mouthPucker", puckerTarget, 0.38);
            lerpMorphTarget("cheekSquintLeft", cheekTarget * 0.4, 0.22);
            lerpMorphTarget("cheekSquintRight", cheekTarget * 0.4, 0.22);

        } else if (isSpeaking) {
            // ── Procedural talking fallback (no Rhubarb data) ─────────────
            // Layered multi-sine for natural speech rhythm with phrase-level amplitude variation
            proceduralRef.current.time += delta;
            const pt = proceduralRef.current.time;

            // Syllable open/close at ~2.8 syllables/sec
            const syllable = Math.max(0, Math.sin(pt * Math.PI * 2.8));
            const ampMod = 0.6 + 0.4 * Math.sin(pt * Math.PI * 0.7); // phrase-level variation
            const openClose = syllable * ampMod * 0.55;

            // Shape oscillation: cycles between wide 'A', rounded 'O', and stretched 'I'
            const vowelPhase = Math.sin(pt * Math.PI * 1.8) * 0.5 + 0.5;
            const iFlicker = Math.max(0, Math.sin(pt * Math.PI * 5.3)) * 0.30;

            const aaVal = openClose * (1.0 - vowelPhase) * 0.95;
            const oVal = openClose * vowelPhase * 0.85;
            const iVal = iFlicker * (1.0 - openClose);       // 'I' appears in quick closures
            // Consonant lip closure pulses (~1/sec)
            const ppPulse = Math.max(0, Math.sin(pt * Math.PI * 1.1 + 1.5)) * 0.42 * (1.0 - openClose);

            lerpMorphTarget("viseme_AA", aaVal, 0.38);
            lerpMorphTarget("viseme_O", oVal, 0.38);
            lerpMorphTarget("viseme_I", iVal, 0.32);
            lerpMorphTarget("viseme_PP", ppPulse, 0.45);
            lerpMorphTarget("jawOpen", openClose * 0.42, 0.38);
            lerpMorphTarget("mouthFunnel", oVal * 0.55, 0.32);

            // Reset unused visemes
            ["viseme_kk", "viseme_U", "viseme_FF", "viseme_TH"].forEach((v) =>
                lerpMorphTarget(v, 0, 0.25)
            );
            lerpMorphTarget("cheekPuff", 0, 0.2);
            lerpMorphTarget("mouthPucker", 0, 0.2);
            lerpMorphTarget("cheekSquintLeft", 0, 0.2);
            lerpMorphTarget("cheekSquintRight", 0, 0.2);

        } else {
            // ── Idle / silent: gently close the mouth ──────────────────────
            Object.values(PHONEME_TO_VISEME).forEach((v) => lerpMorphTarget(v, 0, 0.15));
            lerpMorphTarget("jawOpen", 0, 0.20);
            lerpMorphTarget("cheekPuff", 0, 0.20);
            lerpMorphTarget("mouthFunnel", 0, 0.20);
            lerpMorphTarget("mouthPucker", 0, 0.20);
            lerpMorphTarget("cheekSquintLeft", 0, 0.15);
            lerpMorphTarget("cheekSquintRight", 0, 0.15);
            proceduralRef.current.time = 0; // reset procedural timer
            playbackTimeRef.current = 0; // reset timer sync
            lastCueIdxRef.current = 0;
        }
    });

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <group
            dispose={null}
            ref={group}
            {...props}
        >
            <primitive object={nodes.Hips} />
            <skinnedMesh
                name="Wolf3D_Body"
                geometry={nodes.Wolf3D_Body.geometry}
                material={materials.Wolf3D_Body}
                skeleton={nodes.Wolf3D_Body.skeleton}
            />
            <skinnedMesh
                name="Wolf3D_Outfit_Bottom"
                geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
                material={materials.Wolf3D_Outfit_Bottom}
                skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
            />
            <skinnedMesh
                name="Wolf3D_Outfit_Footwear"
                geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
                material={materials.Wolf3D_Outfit_Footwear}
                skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
            />
            <skinnedMesh
                name="Wolf3D_Outfit_Top"
                geometry={nodes.Wolf3D_Outfit_Top.geometry}
                material={materials.Wolf3D_Outfit_Top}
                skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
            />
            <skinnedMesh
                name="Wolf3D_Hair"
                geometry={nodes.Wolf3D_Hair.geometry}
                material={materials.Wolf3D_Hair}
                skeleton={nodes.Wolf3D_Hair.skeleton}
            />
            <skinnedMesh
                name="EyeLeft"
                geometry={nodes.EyeLeft.geometry}
                material={materials.Wolf3D_Eye}
                skeleton={nodes.EyeLeft.skeleton}
                morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
                morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
            />
            <skinnedMesh
                name="EyeRight"
                geometry={nodes.EyeRight.geometry}
                material={materials.Wolf3D_Eye}
                skeleton={nodes.EyeRight.skeleton}
                morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
                morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
            />
            <skinnedMesh
                name="Wolf3D_Head"
                geometry={nodes.Wolf3D_Head.geometry}
                material={materials.Wolf3D_Skin}
                skeleton={nodes.Wolf3D_Head.skeleton}
                morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
                morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
            />
            <skinnedMesh
                name="Wolf3D_Teeth"
                geometry={nodes.Wolf3D_Teeth.geometry}
                material={materials.Wolf3D_Teeth}
                skeleton={nodes.Wolf3D_Teeth.skeleton}
                morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
                morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
            />
        </group>
    );
}

useGLTF.preload("/models/68c43859d830ce77ae036e51.glb");
useGLTF.preload("/models/animations.glb");

export default OnboardingAvatar;
