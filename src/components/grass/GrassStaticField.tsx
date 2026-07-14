import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_GRASS_AREA_SIZE } from './core/config';
import { getEffectiveGrassBladeCount, getEffectiveGrassBladesPerAxis } from '../../core/utils/browserCaps';
import { useGridSnapping } from '../../core/utils/gridSnapping';
import { sampleTerrainHeight } from '../../core/terrain/terrainHeightCpu';

/** Match compute grass `grassControls` Appearance + Material defaults. */
const GRASS_TIP = new THREE.Color('#1a3d52');
const GRASS_BASE = new THREE.Color('#000000');
const GRASS_EMISSIVE = new THREE.Color('#2a4a5c');

type BladeSeed = {
  lx: number;
  lz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  sx: number;
  sy: number;
  sz: number;
};

function createBladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.035, 0.65, 1, 5);
  geo.translate(0, 0.325, 0);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.04) {
      const t = y / 0.65;
      const lean = t * t * 0.06;
      pos.setX(i, pos.getX(i) + lean);
    }
    const heightT = THREE.MathUtils.clamp(y / 0.65, 0, 1);
    const c = GRASS_BASE.clone().lerp(GRASS_TIP, Math.pow(heightT, 0.85));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createGrassMaterial(envMap: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: GRASS_EMISSIVE,
    emissiveIntensity: 0.14,
    roughness: 0.58,
    metalness: 0.06,
    side: THREE.DoubleSide,
    envMapIntensity: 0.22,
  });
  if (envMap) mat.envMap = envMap;
  return mat;
}

function scatterBladeSeeds(axis: number, blades: number): BladeSeed[] {
  const spacing = DEFAULT_GRASS_AREA_SIZE / axis;
  const seeds: BladeSeed[] = [];
  const half = DEFAULT_GRASS_AREA_SIZE * 0.48;

  for (let x = 0; x < axis && seeds.length < blades; x++) {
    for (let z = 0; z < axis && seeds.length < blades; z++) {
      const jitterX = (Math.random() - 0.5) * spacing * 0.5;
      const jitterZ = (Math.random() - 0.5) * spacing * 0.5;
      const lx = (x - axis / 2) * spacing + jitterX;
      const lz = (z - axis / 2) * spacing + jitterZ;
      if (Math.abs(lx) > half || Math.abs(lz) > half) continue;

      const scale = 0.55 + Math.random() * 0.55;
      seeds.push({
        lx,
        lz,
        rotX: (Math.random() - 0.5) * 0.1,
        rotY: Math.random() * Math.PI * 2,
        rotZ: (Math.random() - 0.5) * 0.06,
        sx: scale * (0.85 + Math.random() * 0.2),
        sy: scale * (0.7 + Math.random() * 0.45),
        sz: scale,
      });
    }
  }

  return seeds;
}

function applyBladeMatrices(
  instanced: THREE.InstancedMesh,
  seeds: BladeSeed[],
  groupX: number,
  groupZ: number,
  yRotationOffset = 0,
) {
  const dummy = new THREE.Object3D();
  const count = Math.min(seeds.length, instanced.count);

  for (let i = 0; i < count; i++) {
    const seed = seeds[i];
    const y = sampleTerrainHeight(groupX + seed.lx, groupZ - seed.lz);
    dummy.position.set(seed.lx, y, -seed.lz);
    dummy.rotation.set(seed.rotX, seed.rotY + yRotationOffset, seed.rotZ);
    dummy.scale.set(seed.sx, seed.sy, seed.sz);
    dummy.updateMatrix();
    instanced.setMatrixAt(i, dummy.matrix);
  }

  instanced.instanceMatrix.needsUpdate = true;
}

/**
 * CPU-instanced grass for Quest / Vision Pro WebGL XR where WebGPU compute is unavailable.
 * Tufted crossed planes, terrain-snapped heights, compute-matched colors — not emissive sticks.
 */
export function GrassStaticField({ visible = true }: { visible?: boolean }) {
  const { camera: defaultCamera, scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const blades = getEffectiveGrassBladeCount();
  const axis = getEffectiveGrassBladesPerAxis();

  const bladeSeeds = useMemo(() => scatterBladeSeeds(axis, blades), [axis, blades]);

  const meshes = useMemo(() => {
    if (blades <= 0 || axis <= 0 || bladeSeeds.length === 0) return null;

    const geo = createBladeGeometry();
    const matA = createGrassMaterial(scene.environment);
    const matB = createGrassMaterial(scene.environment);

    const layerA = new THREE.InstancedMesh(geo, matA, bladeSeeds.length);
    const layerB = new THREE.InstancedMesh(geo, matB, bladeSeeds.length);

    applyBladeMatrices(layerA, bladeSeeds, 0, 0, 0);
    applyBladeMatrices(layerB, bladeSeeds, 0, 0, Math.PI * 0.5);

    for (const mesh of [layerA, layerB]) {
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
    }

    return [layerA, layerB] as const;
  }, [blades, axis, bladeSeeds, scene.environment]);

  const refreshHeights = (groupX: number, groupZ: number) => {
    if (!meshes) return;
    applyBladeMatrices(meshes[0], bladeSeeds, groupX, groupZ, 0);
    applyBladeMatrices(meshes[1], bladeSeeds, groupX, groupZ, Math.PI * 0.5);
  };

  useGridSnapping({
    camera: defaultCamera,
    onSnap: ({ snappedX, snappedZ }) => {
      if (groupRef.current) {
        groupRef.current.position.set(snappedX, 0, snappedZ);
        groupRef.current.updateMatrixWorld(true);
      }
      refreshHeights(snappedX, snappedZ);
    },
  });

  useEffect(() => {
    if (!meshes || !scene.environment) return;
    for (const mesh of meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.envMap = scene.environment;
      mat.needsUpdate = true;
    }
  }, [meshes, scene.environment]);

  useEffect(() => {
    return () => {
      if (!meshes) return;
      meshes[0].geometry.dispose();
      (meshes[0].material as THREE.Material).dispose();
      (meshes[1].material as THREE.Material).dispose();
    };
  }, [meshes]);

  if (!meshes) return null;

  return (
    <group ref={groupRef} visible={visible}>
      <primitive object={meshes[0]} />
      <primitive object={meshes[1]} />
    </group>
  );
}
