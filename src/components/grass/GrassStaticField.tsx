import { useMemo } from 'react';
import * as THREE from 'three';
import { DEFAULT_GRASS_AREA_SIZE } from './core/config';
import { getEffectiveGrassBladeCount, getEffectiveGrassBladesPerAxis } from '../../core/utils/browserCaps';

/** Meadow-tuned blade colors (match compute grass base, no glow). */
const GRASS_BASE = '#1a3d52';
const GRASS_EMISSIVE = '#1e3340';

function createBladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.055, 0.42, 1, 4);
  geo.translate(0, 0.21, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.05) {
      const t = y / 0.42;
      const lean = t * t * 0.08;
      pos.setX(i, pos.getX(i) + lean);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createGrassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(GRASS_BASE),
    emissive: new THREE.Color(GRASS_EMISSIVE),
    emissiveIntensity: 0.08,
    roughness: 0.72,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
}

function scatterBlades(
  instanced: THREE.InstancedMesh,
  axis: number,
  blades: number,
  yRotationOffset = 0,
) {
  const spacing = DEFAULT_GRASS_AREA_SIZE / axis;
  const dummy = new THREE.Object3D();
  let index = 0;

  for (let x = 0; x < axis && index < blades; x++) {
    for (let z = 0; z < axis && index < blades; z++) {
      const jitterX = (Math.random() - 0.5) * spacing * 0.55;
      const jitterZ = (Math.random() - 0.5) * spacing * 0.55;
      dummy.position.set(
        (x - axis / 2) * spacing + jitterX,
        0,
        (z - axis / 2) * spacing + jitterZ,
      );
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.12,
        Math.random() * Math.PI + yRotationOffset,
        (Math.random() - 0.5) * 0.08,
      );
      const scale = 0.55 + Math.random() * 0.65;
      dummy.scale.set(
        scale * (0.9 + Math.random() * 0.25),
        scale * (0.75 + Math.random() * 0.45),
        scale,
      );
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
      index++;
    }
  }

  instanced.instanceMatrix.needsUpdate = true;
}

/**
 * CPU-instanced grass for Quest / Vision Pro WebGL XR where WebGPU compute is unavailable.
 * Crossed planes per tuft + meadow colors — not tall emissive sticks.
 */
export function GrassStaticField({ visible = true }: { visible?: boolean }) {
  const blades = getEffectiveGrassBladeCount();
  const axis = getEffectiveGrassBladesPerAxis();

  const meshes = useMemo(() => {
    if (blades <= 0 || axis <= 0) return null;

    const geo = createBladeGeometry();
    const mat = createGrassMaterial();

    const layerA = new THREE.InstancedMesh(geo, mat, blades);
    const layerB = new THREE.InstancedMesh(geo, mat, blades);

    scatterBlades(layerA, axis, blades, 0);
    scatterBlades(layerB, axis, blades, Math.PI * 0.5);

    for (const mesh of [layerA, layerB]) {
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
    }

    return [layerA, layerB] as const;
  }, [blades, axis]);

  if (!meshes) return null;

  return (
    <group visible={visible}>
      <primitive object={meshes[0]} />
      <primitive object={meshes[1]} />
    </group>
  );
}
