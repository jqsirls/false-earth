import { useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { struct } from 'three/tsl';
import { uTime, uActiveWaveCount, GlobalWaveState } from '../../../core/shaders/uniforms';

export const waveStructure = struct({
  x: 'float',
  z: 'float',
  startTime: 'float',
  maxRadius: 'float',
  lifetime: 'float',
});

const MAX_WAVES = 16; // Maximum number of waves that can exist simultaneously
const DATA_PER_WAVE = 5; // x, z, startTime, maxRadius, lifetime

export function useCosmicWaves() {
  // 1. Create data buffer
  const waveDataArray = useMemo(() => new Float32Array(MAX_WAVES * DATA_PER_WAVE), []);

  // 2. Create WebGPU Storage Buffer
  const waveStorageBuffer = useMemo(() => {
    return new THREE.StorageBufferAttribute(waveDataArray, DATA_PER_WAVE);
  }, [waveDataArray]);

  // Publish buffer to global state (singleton)
  useEffect(() => {
    GlobalWaveState.buffer = waveStorageBuffer;
    return () => {
      GlobalWaveState.buffer = null;
    };
  }, [waveStorageBuffer]);

  const activeWaves = useRef<any[]>([]);

  // 3. Trigger: called externally (e.g. when a ray hits the ground)
  const triggerShockwave = useCallback((position: THREE.Vector3, maxRadius: number = 15.0, lifetime: number = 5.0) => {
    activeWaves.current.push({
      pos: new THREE.Vector2(position.x, position.z),
      startTime: uTime.value,
      maxRadius,
      lifetime,
    });
    if (activeWaves.current.length > MAX_WAVES) activeWaves.current.shift();
  }, []);

  // 4. Update buffer and uniform every frame
  useFrame(() => {
    waveDataArray.fill(0);

    activeWaves.current = activeWaves.current.filter(wave => {
      const age = uTime.value - wave.startTime;
      return age <= wave.lifetime;
    });

    let activeCount = 0;
    for (let i = 0; i < activeWaves.current.length; i++) {
      const wave = activeWaves.current[i];
      const age = uTime.value - wave.startTime;
      if (age > wave.lifetime) break;

      const index = activeCount * DATA_PER_WAVE;
      waveDataArray[index + 0] = wave.pos.x;
      waveDataArray[index + 1] = wave.pos.y;
      waveDataArray[index + 2] = wave.startTime;
      waveDataArray[index + 3] = wave.maxRadius;
      waveDataArray[index + 4] = wave.lifetime;
      activeCount++;
    }

    uActiveWaveCount.value = activeCount;
    waveStorageBuffer.needsUpdate = true;
  });

  return {
    triggerShockwave,
    waveCount: MAX_WAVES,
  };
}
