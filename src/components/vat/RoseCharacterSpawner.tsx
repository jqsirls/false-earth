import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { RoseHandle } from './Rose';

interface RoseCharacterSpawnerProps {
  roseRef: React.MutableRefObject<RoseHandle | null>;
  distanceThreshold?: number;
}

export function RoseCharacterSpawner({ roseRef, distanceThreshold = 0.5 }: RoseCharacterSpawnerProps) {
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
      // Directly command spawn, bypassing React render cycle
      rose.spawn(currentPos);
      lastSpawnPos.current.copy(currentPos);
    }
  });

  return null;
}
