import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_GRASS_AREA_SIZE } from './grass/core/config';
import { useGridSnapping } from '../core/utils/gridSnapping';
import {
  createTerrainWebGlMaterial,
  displaceTerrainGeometry,
} from '../core/terrain/terrainWebGlMaterial';

/**
 * Lit, displaced ground for WebGL XR (Quest / Vision Pro ?webxr=1).
 * Matches upstream TSL terrain height + black fill; circular fade at field edge.
 */
export function TerrainWebGL({ size = DEFAULT_GRASS_AREA_SIZE }: { size?: number }) {
  const { camera: defaultCamera, scene } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, 128, 128);
    displaceTerrainGeometry(geo, 0, 0, size);
    return geo;
  }, [size]);

  const material = useMemo(() => createTerrainWebGlMaterial(), []);

  useEffect(() => {
    if (scene.environment) {
      material.envMap = scene.environment;
    }
  }, [scene.environment, material]);

  useGridSnapping({
    camera: defaultCamera,
    grassAreaSize: size,
    onSnap: ({ snappedX, snappedZ }) => {
      const mesh = meshRef.current;
      if (!mesh) return;
      mesh.position.set(snappedX, 0, snappedZ);
      displaceTerrainGeometry(geometry, snappedX, snappedZ, size);
      mesh.updateMatrixWorld(true);
    },
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
