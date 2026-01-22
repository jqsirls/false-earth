import { useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/gameStore';
import { useThree } from '@react-three/fiber';

const MAX_WAVES = 16; // Maximum number of waves that can exist simultaneously
const DATA_PER_WAVE = 5; // x, z, startTime, maxRadius, lifetime

export function useCosmicShockwaves() {
  const { clock } = useThree();

  const setWaveStorageBuffer = useGameStore((state) => state.setWaveStorageBuffer);
  
  // 1. Create data buffer
  const waveDataArray = useMemo(() => new Float32Array(MAX_WAVES * DATA_PER_WAVE), []);
  
  // 2. Create WebGPU Storage Buffer
  // Use StorageBufferAttribute to allow Shader to read the array
  const waveStorageBuffer = useMemo(() => {
    const attr = new THREE.StorageBufferAttribute(waveDataArray, DATA_PER_WAVE);
    return attr;
  }, [waveDataArray]);

  // Update global store when buffer is created
  useEffect(() => {
    setWaveStorageBuffer(waveStorageBuffer);
    return () => {
      setWaveStorageBuffer(null);
    };
  }, [waveStorageBuffer, setWaveStorageBuffer]);

  // Track active waves on the JS side
  const activeWaves = useRef<any[]>([]);

  // 3. Trigger function: called externally (e.g., when a ray hits the ground)
  const triggerShockwave = useCallback((position: THREE.Vector3, maxRadius: number = 15.0, lifetime: number = 5.0) => {
    activeWaves.current.push({
      pos: new THREE.Vector2(position.x, position.z),
      startTime: clock.getElapsedTime(),
      maxRadius,
      lifetime
    });

    // Limit count, remove oldest
    if (activeWaves.current.length > MAX_WAVES) {
      activeWaves.current.shift();
    }
  }, []);

  // 4. Update Buffer every frame
  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    // Clear array (or only overwrite needed region)
    waveDataArray.fill(0);

    // Update data to Array
    activeWaves.current.forEach((wave, i) => {
      const index = i * DATA_PER_WAVE;
      
      const age = now - wave.startTime;
      if (age > wave.lifetime) return;

      waveDataArray[index + 0] = wave.pos.x;
      waveDataArray[index + 1] = wave.pos.y;
      waveDataArray[index + 2] = wave.startTime;
      waveDataArray[index + 3] = wave.maxRadius;
      waveDataArray[index + 4] = wave.lifetime;
    });
    waveStorageBuffer.needsUpdate = true;
  });

  return {
    triggerShockwave,
    waveCount: MAX_WAVES
  };
}
