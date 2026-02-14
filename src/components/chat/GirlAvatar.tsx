import React from 'react'
import { Leva } from "leva";
import { Loader } from "@react-three/drei";
import Experience  from "../Experience.jsx";
import { Canvas } from "@react-three/fiber";


const GirlAvatar = () => {
  return (
    <>
   
    <Loader />
    <Leva hidden/>
    {/* <UI></UI> */}
    <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }} style={{ background: 'linear-gradient(to bottom, #0a0a2e 0%, #1a1a4e 40%, #2a1a3e 100%)' }}>
        <Experience />
    </Canvas>
    </>
  )
}

export default GirlAvatar
