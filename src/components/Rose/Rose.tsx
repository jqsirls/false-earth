import { useEffect, useMemo, useRef } from "react";
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

const INITIAL_SPAWN_GRID: Array<[number, number]> = [
  [0, 0],
  [6, 4],
  [-5, 7],
  [8, -6],
  [-7, -5],
  [12, 0],
  [-10, 3],
  [4, -11],
];

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
    const hasSeededField = useRef(false)

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

    useEffect(() => {
        if (hasSeededField.current || isLoading || !lodBuffers.length || !vatData) return;

        hasSeededField.current = true;

        const seedAt = (x: number, z: number) => {
            spawn(new THREE.Vector3(x, 0, z), 256, 14);
        };

        const timers: number[] = [];
        INITIAL_SPAWN_GRID.forEach(([x, z], index) => {
            if (index === 0) {
                seedAt(x, z);
            } else {
                timers.push(window.setTimeout(() => seedAt(x, z), index * 120));
            }
        });

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [isLoading, lodBuffers.length, vatData, spawn]);

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