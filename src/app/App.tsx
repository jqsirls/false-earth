import { Environment } from "@react-three/drei";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useState, useRef, useEffect } from "react";
import { Terrain } from "../components/terrain/Terrain";
import { Wind } from "../components/wind/Wind";
import { DirectionalLight } from "../components/DirectionalLight";
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/grass/GrassWebGPU";
import { GrassCullingDebug } from "../components/debug/GrassCullingDebug";
import { DebugModeToggle } from "../components/debug/DebugModeToggle";
import Effects from "../components/Effects";
import { Character } from "../components/character";
import { Background } from "../components/vat/core/Background";
import { Stars } from "../components/Stars";
import { useGameStore } from "../store/gameStore";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import Rose, { RoseHandle } from "../components/vat/Rose";
import { RoseCharacterSpawner } from "../components/vat/RoseCharacterSpawner";

export default function App() {
    const [debugMode, setDebugMode] = useState(false) // Toggle for culling debug mode
    const roseRef = useRef<RoseHandle>(null)
    
    // Get toggle method from store
    const toggleCameraMode = useGameStore((state) => state.toggleCameraMode);

    // Centralized Input Management (Keyboard)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'c') {
                toggleCameraMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleCameraMode]);

    return <>
        <LevaWrapper collapsed={true} />

        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
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

            <color attach="background" args={['#000000']} />



            {/* <CameraControls
                makeDefault
            /> */}
            <CameraViewControl />
            <Environment preset="city" environmentIntensity={0.5} />
            <DirectionalLight />
            <Background />

            <Effects />
            <Rose ref={roseRef} count={2000} />

            <Stars />


            {/* Toggle between normal mode and culling debug mode */}
            <DebugModeToggle onToggle={() => setDebugMode(prev => !prev)} />
            {debugMode ? (
                <GrassCullingDebug />
            ) : (
                <>
                    <Terrain />
                    <Wind />
                    <GrassWebGPU />
                    <Character position={[0, 0, 0]} scale={0.01} />
                    <RoseCharacterSpawner roseRef={roseRef} spawnCount={10} />
                </>
            )}

        </Canvas>
    </>
}
