/**
 * OnboardingAvatar.jsx — Lightweight 3D avatar for the onboarding flow.
 *
 * Unlike the main Avatar.jsx (which is coupled to useChat, lipsync, audio,
 * and debug controls), this component shows a self-contained idle avatar
 * with:
 *   - Idle animation loop
 *   - Gentle / compassionate facial expression
 *   - Natural eye movement
 *   - Subtle idle breathing
 *   - Soft head sway
 *   - Natural blinking
 *
 * It does NOT depend on ChatProvider or any chat hooks.
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

// ── Component ─────────────────────────────────────────────────────────────

export function OnboardingAvatar({ expression = "gentle", ...props }) {
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
    const [eyeTarget, setEyeTarget] = useState({ x: 0, y: 0 });
    const [blink, setBlink] = useState(false);

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
