import {
  CameraControls,
  ContactShadows,
  Environment,
  Stars,
  Text,
} from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useChat } from "../hooks/useChat.tsx";
import { Avatar } from "./Avatar.jsx";
import { useTheme } from "@/context/ThemeContext";

const loaderMessages = [
  "Settling into a calm response",
  "Listening with care",
  "Preparing a gentle reply",
];

const SoothingLoader = () => {
  const { loading } = useChat();
  const { theme } = useTheme();
  const groupRef = useRef();
  const outerRingRef = useRef();
  const innerRingRef = useRef();
  const orbRefs = useRef([]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setMessageIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % loaderMessages.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [loading]);

  useFrame((state) => {
    if (!loading) {
      return;
    }

    const elapsed = state.clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.position.y = 1.68 + Math.sin(elapsed * 1.2) * 0.03;
    }

    if (outerRingRef.current) {
      const outerScale = 1 + Math.sin(elapsed * 1.4) * 0.08;
      outerRingRef.current.scale.setScalar(outerScale);
      outerRingRef.current.rotation.z = elapsed * 0.28;
    }

    if (innerRingRef.current) {
      const innerScale = 1 + Math.cos(elapsed * 1.8) * 0.05;
      innerRingRef.current.scale.setScalar(innerScale);
      innerRingRef.current.rotation.z = -elapsed * 0.4;
    }

    orbRefs.current.forEach((orb, index) => {
      if (!orb) {
        return;
      }

      const offset = elapsed * 1.6 + index * 1.9;
      orb.position.x = Math.cos(offset) * 0.32;
      orb.position.y = Math.sin(offset) * 0.12;
      orb.position.z = Math.sin(offset * 0.8) * 0.08;
      const orbScale = 0.85 + ((Math.sin(offset) + 1) / 2) * 0.45;
      orb.scale.setScalar(orbScale);
    });
  });

  if (!loading) return null;

  const primaryColor = theme === "dark" ? "#F6D7BF" : "#9A6B52";
  const secondaryColor = theme === "dark" ? "#E9C2FF" : "#C08ACF";
  const glowColor = theme === "dark" ? "#FFE7D6" : "#E8BFA7";

  return (
    <group ref={groupRef} position={[0, 1.68, 0.42]}>
      <mesh rotation-x={-0.2} position={[0, 0.02, -0.04]}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial color={glowColor} transparent opacity={theme === "dark" ? 0.08 : 0.12} />
      </mesh>

      <group ref={outerRingRef}>
        <mesh>
          <torusGeometry args={[0.26, 0.012, 18, 80]} />
          <meshBasicMaterial color={primaryColor} transparent opacity={0.55} />
        </mesh>
      </group>

      <group ref={innerRingRef}>
        <mesh rotation-x={0.45}>
          <torusGeometry args={[0.16, 0.01, 18, 60]} />
          <meshBasicMaterial color={secondaryColor} transparent opacity={0.45} />
        </mesh>
      </group>

      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          ref={(element) => {
            orbRefs.current[index] = element;
          }}
          position={[0, 0, 0.04]}
        >
          <sphereGeometry args={[0.03, 18, 18]} />
          <meshBasicMaterial color={index === 1 ? secondaryColor : primaryColor} transparent opacity={0.85} />
        </mesh>
      ))}

      <Text fontSize={0.09} maxWidth={1.8} anchorX={"center"} anchorY={"middle"} position={[0, -0.38, 0.02]}>
        {loaderMessages[messageIndex]}
        <meshBasicMaterial attach="material" color={primaryColor} toneMapped={false} />
      </Text>

      <Text fontSize={0.06} letterSpacing={0.08} anchorX={"center"} anchorY={"middle"} position={[0, -0.53, 0.02]}>
        BREATHE IN • BREATHE OUT
        <meshBasicMaterial attach="material" color={secondaryColor} transparent opacity={0.9} toneMapped={false} />
      </Text>
    </group>
  );
};

export const Experience = () => {
  const cameraControls = useRef();
  const { cameraZoomed } = useChat();
  const { scene } = useThree();
  const { theme } = useTheme();

  useEffect(() => {
    cameraControls.current.setLookAt(0, 2, 5, 0, 1.5, 0);
  }, []);

  useEffect(() => {
    if (cameraZoomed) {
      cameraControls.current.setLookAt(0, 1.5, 1.5, 0, 1.5, 0, true);
    } else {
      cameraControls.current.setLookAt(0, 2.2, 5, 0, 1.0, 0, true);
    }
  }, [cameraZoomed]);

  useEffect(() => {
    const backgroundColor = theme === "dark" ? "#0D1F25" : "#F5F0EB";
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, theme === "dark" ? 8 : 12, 20);
  }, [theme, scene]);

  return (
    <>
      <CameraControls ref={cameraControls} />
      <Environment preset="sunset" />
      <Stars
        radius={50}
        depth={50}
        count={5000}
        factor={4}
        saturation={0.3}
        fade
        speed={1}
      />
      {/* Key light - warm directional from front-right */}
      <directionalLight
        position={[3, 4, 4]}
        intensity={1.0}
        color="#ffe4cc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Fill light - softer, cool tone from left to add dimension */}
      <ambientLight intensity={0.35} color="#c8b8d8" />
      <pointLight position={[-3, 2.5, 2]} intensity={0.4} color="#d4c4e8" />
      {/* Rim/back light - warm glow to separate avatar from background */}
      <pointLight position={[0, 3, -3]} intensity={0.6} color="#ffccaa" />
      {/* Under-chin bounce light - subtle warm fill to soften shadows */}
      <pointLight position={[0, 0.5, 2]} intensity={0.15} color="#ffe8d6" />
      {/* Wrap loader text to prevent a brief font blink while Troika assets initialize */}
      <Suspense>
        <SoothingLoader />
      </Suspense>
      <Avatar />
      <ContactShadows opacity={0.5} blur={2.5} />
    </>
  );
};


export default Experience;