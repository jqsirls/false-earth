import { useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { DEFAULT_GRASS_AREA_SIZE } from './grass/core/config';

/** Simple lit ground for ?mobile-lite=1 / ?safari-lite=1 emergency fallback when grass compute is disabled. */
export function SafariGround({ size = DEFAULT_GRASS_AREA_SIZE }: { size?: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color('#0a1a12'),
        roughness: 0.92,
        metalness: 0.02,
      }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size, 1, 1]} />
      <primitive object={material} />
    </mesh>
  );
}
