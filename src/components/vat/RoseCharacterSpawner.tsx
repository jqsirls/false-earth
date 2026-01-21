import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls, folder } from 'leva';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { RoseHandle } from './Rose';

interface RoseCharacterSpawnerProps {
  roseRef: React.MutableRefObject<RoseHandle | null>;
  distanceThreshold?: number;
  spawnCount?: number; // Number of roses to spawn per trigger (1-64)
}

export function RoseCharacterSpawner({ 
  roseRef, 
  distanceThreshold = 0.5,
  spawnCount = 1,
}: RoseCharacterSpawnerProps) {
  const lastSpawnPos = useRef(new THREE.Vector3(9999, 9999, 9999));
  const totalDistance = useRef(0);
  const characterRef = useGameStore((state) => state.characterRef);

  const [config] = useControls('Rose Spawner', () => ({
    Wave: folder({
      waveLow: { value: 1.5, min: 0, max: 5, step: 0.1 },
      waveHigh: { value: 5, min: 0, max: 5, step: 0.1 },
      waveFrequency: { value: 0.2, min: 0.1, max: 10, step: 0.1 }, // Base frequency (cycles per unit distance)
      waveHarmonics: { value: 3, min: 1, max: 8, step: 1 }, // Number of harmonic waves to add
      waveHarmonicStrength: { value: 0.7, min: 0, max: 1, step: 0.05 }, // Strength of harmonics relative to base
    }),
  }), { collapsed: true });

  useFrame(() => {
    const character = characterRef?.current;
    const rose = roseRef?.current;
    if (!character || !rose) return;

    const currentPos = new THREE.Vector3();
    currentPos.setFromMatrixPosition(character.matrixWorld);

    const dist = currentPos.distanceTo(lastSpawnPos.current);
    if (dist > distanceThreshold) {
      // Accumulate total distance traveled
      totalDistance.current += dist;

      // Calculate scatter radius using multiple harmonic sine waves for complex but continuous pattern
      const basePhase = totalDistance.current * config.waveFrequency;
      let waveValue = Math.sin(basePhase); // Base wave [-1, 1]
      
      // Add harmonics for more complex pattern
      for (let i = 2; i <= config.waveHarmonics + 1; i++) {
        const harmonicPhase = basePhase * i;
        const harmonicAmplitude = config.waveHarmonicStrength / (i - 1); // Decreasing amplitude for higher harmonics
        waveValue += Math.sin(harmonicPhase) * harmonicAmplitude;
      }
      
      // Normalize to [0, 1] and map to waveLow-waveHigh range
      const normalized = (waveValue + 1) / 2; // Normalize from [-1, 1] to [0, 1]
      const scatterRadius = config.waveLow + (config.waveHigh - config.waveLow) * normalized;

      // Use batch spawning for efficient parallel GPU processing
      // Clamp spawn count to valid range (1-64)
      const count = Math.max(1, Math.min(spawnCount, 64));
      rose.spawn(currentPos, count, scatterRadius);
      lastSpawnPos.current.copy(currentPos);
    }
  });

  return null;
}
