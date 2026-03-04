import {
  CameraControls,
  ContactShadows,
  Environment,
  Stars,
  Text,
} from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useChat } from "../hooks/useChat.tsx";
import { Avatar } from "./Avatar.jsx";
import { useTheme } from "@/context/ThemeContext";

const Dots = (props) => {
  const { loading } = useChat();
  const [loadingText, setLoadingText] = useState("");
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingText((loadingText) => {
          if (loadingText.length > 2) {
            return ".";
          }
          return loadingText + ".";
        });
      }, 800);
      return () => clearInterval(interval);
    } else {
      setLoadingText("");
    }
  }, [loading]);
  if (!loading) return null;
  return (
    <group>
      <Text fontSize={0.14} anchorX={"left"} anchorY={"bottom"}>
        {loadingText}
        <meshBasicMaterial attach="material" color="black" />
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
      {/* Wrapping Dots into Suspense to prevent Blink when Troika/Font is loaded */}
      <Suspense>
        <Dots position-y={1.75} position-x={-0.02} />
      </Suspense>
      <Avatar />
      <ContactShadows opacity={0.5} blur={2.5} />
    </>
  );
};


export default Experience;