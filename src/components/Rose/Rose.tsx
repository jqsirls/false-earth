import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useGameStore } from "../../core/store/gameStore";
import { useRoseUniforms } from "./hooks/useRoseUniforms";
import { useRoseCompute } from "./hooks/useRoseCompute";
import { useRoseLODLoader } from "./hooks/useRoseLODLoader";
import { useFrame } from "@react-three/fiber";
import { RoseLOD } from "./RoseLOD";
import { DEFAULT_ROSE_LOD_CONFIG } from "./core/config";
import type { RoseLODConfig } from "./core/config";

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
    lodConfig = DEFAULT_ROSE_LOD_CONFIG 
}: { 
    count: number; 
    visible?: boolean;
    lodConfig?: RoseLODConfig[];
}) {
    const characterRef = useGameStore((state) => state.characterRef)
    const characterPos = useMemo(() => new THREE.Vector3(), [])
    const hasSeededField = useRef(false)

    const { uniforms, config } = useRoseUniforms()
    const { lodBuffers, isLoading } = useRoseLODLoader(count, lodConfig)

    const { vatData, spawn } = useRoseCompute(count, lodBuffers, uniforms.compute)

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
        let index = 0;

        const seedInterval = window.setInterval(() => {
            const [x, z] = INITIAL_SPAWN_GRID[index];
            spawn(new THREE.Vector3(x, 0, z), 256, 14);
            index += 1;

            if (index >= INITIAL_SPAWN_GRID.length) {
                window.clearInterval(seedInterval);
            }
        }, 120);

        return () => window.clearInterval(seedInterval);
    }, [isLoading, lodBuffers.length, vatData, spawn]);

    if (isLoading || !lodBuffers.length || !vatData) return null

    return (
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
    )
}