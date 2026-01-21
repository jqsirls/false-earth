import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { RoseHandle } from './Rose';

interface RoseCharacterSpawnerProps {
  roseRef: React.MutableRefObject<RoseHandle | null>;
  distanceThreshold?: number;
  spawnCount?: number; // Number of roses to spawn per trigger (1-64)
  scatterRadius?: number; // Scatter radius around character position
}

export function RoseCharacterSpawner({ 
  roseRef, 
  distanceThreshold = 0.5,
  spawnCount = 1,
  scatterRadius = 0.3
}: RoseCharacterSpawnerProps) {
  const lastSpawnPos = useRef(new THREE.Vector3(9999, 9999, 9999));
  const characterRef = useGameStore((state) => state.characterRef);

  useFrame(() => {
    const character = characterRef?.current;
    const rose = roseRef?.current;
    if (!character || !rose) return;

    const currentPos = new THREE.Vector3();
    currentPos.setFromMatrixPosition(character.matrixWorld);

    const dist = currentPos.distanceTo(lastSpawnPos.current);
    if (dist > distanceThreshold) {
      // Use batch spawning for efficient parallel GPU processing
      // Clamp spawn count to valid range (1-64)
      const count = Math.max(1, Math.min(spawnCount, 64));
      rose.spawn(currentPos, count, scatterRadius);
      lastSpawnPos.current.copy(currentPos);
    }
  });

  return null;
}
