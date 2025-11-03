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
    <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }}>
        <Experience />
    </Canvas>
    </>
  )
}

export default GirlAvatar
