import { AdaptiveDpr, CameraControls, Environment } from "@react-three/drei";
import { CanvasCapture } from "@packages/r3f-gist/components/utility";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import Effects from "../components/Effects";
import { Terrain } from "../components/terrain/Terrain";
import { DirectionalLight } from "../components/DirectionalLight";
import { Background } from "../components/background/Background";
import * as THREE from 'three'
import { Perf } from "r3f-perf";
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/grass/GrassWebGPU";

export default function App() {
    const [terrainUniforms, setTerrainUniforms] = useState<{ uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any } | undefined>(undefined)
    const [lightPosition, setLightPosition] = useState<THREE.Vector3 | undefined>(undefined)
    const [patchSize, setPatchSize] = useState<number | undefined>(undefined)

    return <>
        <LevaWrapper collapsed={true} />

        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 80,
                position: [0, 3, 10]
            }}
            gl={(canvas) => {
                const renderer = new WebGPURenderer({
                    ...canvas as any,
                    powerPreference: "high-performance",
                    antialias: true,
                });
                return renderer.init().then(() => renderer);
            }}
            dpr={[1, 2]}
            performance={{ min: 0.5, max: 1 }}
        >
            {/* <Perf /> */}

            <color attach="background" args={['#000000']} />
            {/* <AdaptiveDpr pixelated /> */}

            <CameraControls makeDefault maxPolarAngle={Math.PI / 2.2} minPolarAngle={Math.PI / 4} dollySpeed={0.5} />
            <Environment preset="city" environmentIntensity={0.5} />
            <DirectionalLight onPositionChange={setLightPosition} />
            {/* <Background sunPosition={lightPosition} /> */}
            <Terrain onUniformsChange={setTerrainUniforms} patchSize={patchSize} />
            <GrassWebGPU terrainUniforms={terrainUniforms} patchSize={patchSize} />
            <CanvasCapture />

            {/* <Effects /> */}
        </Canvas>
    </>
}
