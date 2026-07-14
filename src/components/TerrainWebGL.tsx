import { useMemo } from 'react';
import * as THREE from 'three';
import { DEFAULT_GRASS_AREA_SIZE } from './grass/core/config';

/** Lit ground for WebGL XR (Quest / Vision Pro) where TSL terrain nodes are unreliable. */
export function TerrainWebGL({ size = DEFAULT_GRASS_AREA_SIZE }: { size?: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0a1210'),
        roughness: 0.92,
        metalness: 0.04,
      }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
