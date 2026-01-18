import { useRef, useEffect } from 'react';
import { Group } from 'three';
import { CharacterProps } from './types';
import { useCharacterAssets } from './hooks/useCharacterAssets';
import { useCharacterPhysics } from './hooks/useCharacterPhysics';

export function Character({ position = [0, 0, 0], scale = 1, terrainUniforms }: CharacterProps) {
  const groupRef = useRef<Group>(null);

  // 1. Get Assets (Mesh, Materials, TSL Uniforms)
  const { scene, animations, uCharacterWorldPos } = useCharacterAssets(terrainUniforms);

  // 2. Bind Physics & Behavior
  useCharacterPhysics(groupRef, scene, animations, uCharacterWorldPos);

  return (
    <group ref={groupRef} position={position} scale={scale} dispose={null}>
      {scene && <primitive object={scene} />}
    </group>
  );
}
