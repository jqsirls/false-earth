import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { AsyncCompile } from "@core";
import { useGameStore } from "../../core/store/gameStore";
import { useRoseUniforms } from "./hooks/useRoseUniforms";
import { useRoseCompute } from "./hooks/useRoseCompute";
import { useRoseLODLoader } from "./hooks/useRoseLODLoader";
import { useFrame } from "@react-three/fiber";
import { RoseLOD } from "./RoseLOD";
import { DEFAULT_ROSE_LOD_CONFIG } from "./core/config";
import type { RoseLODConfig } from "./core/config";
import { getRoseCompileTimeoutMs } from "../../core/utils/browserCaps";

import { gameEvents } from "../../core/events";

export default function Rose({
    count,
    visible = true,
    lodConfig = DEFAULT_ROSE_LOD_CONFIG,
    onCompileReady,
    compileDebug = false,
}: {
    count: number;
    visible?: boolean;
    lodConfig?: RoseLODConfig[];
    onCompileReady?: (id: string, isReady: boolean) => void;
    compileDebug?: boolean;
}) {
    const characterRef = useGameStore((state) => state.characterRef)
    const characterPos = useMemo(() => new THREE.Vector3(), [])

    const { uniforms, config } = useRoseUniforms()
    const { lodBuffers, isLoading } = useRoseLODLoader(count, lodConfig)

    const { vatData, spawn } = useRoseCompute(count, lodBuffers, uniforms.compute)

    useEffect(() => {
        if (isLoading || !lodBuffers.length || !vatData) {
            onCompileReady?.('rose', false);
        }
    }, [isLoading, lodBuffers.length, vatData, onCompileReady]);

    useFrame(() => {
        if (!characterRef?.current) return
        characterRef.current.getWorldPosition(characterPos)
        uniforms.mat.uCharacterWorldPos.value.copy(characterPos)
        uniforms.compute.uCharacterWorldPos.value.copy(characterPos)
    })

    useEffect(() => {
        const onHit = ({ position, radius }: { position: THREE.Vector3, radius: number }) => {
            spawn(position, 256, radius);
        };
        gameEvents.on('beam:hit', onHit);
        return () => gameEvents.off('beam:hit', onHit);
    }, [spawn]);

    if (isLoading || !lodBuffers.length || !vatData) return null

    // AsyncCompile must mount only after VAT meshes exist — CDN loads are slower than
    // upstream local /public/ assets; compiling an empty group leaves roses invisible.
    return (
        <AsyncCompile
            id="rose"
            onReady={onCompileReady}
            debug={compileDebug}
            timeout={getRoseCompileTimeoutMs()}
        >
            <group visible={visible}>
                {lodBuffers.map((lodBuffer, index) => (
                    <RoseLOD
                        key={`rose-lod-${index}-${lodBuffer.minDistance}-${lodBuffer.maxDistance}`}
                        count={count}
                        lodBuffer={lodBuffer}
                        uniforms={uniforms.mat}
                        vatData={vatData}
                        config={config}
                    />
                ))}
            </group>
        </AsyncCompile>
    )
}