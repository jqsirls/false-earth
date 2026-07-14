import { useMemo } from 'react';
import * as THREE from 'three';
import { DEFAULT_GRASS_AREA_SIZE } from './core/config';
import { getEffectiveGrassBladeCount, getEffectiveGrassBladesPerAxis } from '../../core/utils/browserCaps';

/**
 * CPU-instanced grass for Quest browsers and WebGL XR where WebGPU compute is unavailable.
 * Uses classic three.js materials so blades stay visible without WebGPU IBL / TSL.
 */
export function GrassStaticField({ visible = true }: { visible?: boolean }) {
  const blades = getEffectiveGrassBladeCount();
  const axis = getEffectiveGrassBladesPerAxis();

  const mesh = useMemo(() => {
    if (blades <= 0 || axis <= 0) return null;

    const geo = new THREE.PlaneGeometry(0.045, 0.72, 1, 3);
    geo.translate(0, 0.36, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a3d52'),
      emissive: new THREE.Color('#3d6a7a'),
      emissiveIntensity: 0.42,
      roughness: 0.58,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });

    const instanced = new THREE.InstancedMesh(geo, mat, blades);
    const spacing = DEFAULT_GRASS_AREA_SIZE / axis;
    const dummy = new THREE.Object3D();
    let index = 0;

    for (let x = 0; x < axis && index < blades; x++) {
      for (let z = 0; z < axis && index < blades; z++) {
        const jitterX = (Math.random() - 0.5) * spacing * 0.45;
        const jitterZ = (Math.random() - 0.5) * spacing * 0.45;
        dummy.position.set(
          (x - axis / 2) * spacing + jitterX,
          0,
          (z - axis / 2) * spacing + jitterZ,
        );
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.65 + Math.random() * 0.55;
        dummy.scale.set(scale, scale * (0.85 + Math.random() * 0.35), scale);
        dummy.updateMatrix();
        instanced.setMatrixAt(index, dummy.matrix);
        index++;
      }
    }

    instanced.instanceMatrix.needsUpdate = true;
    instanced.frustumCulled = false;
    instanced.receiveShadow = false;
    instanced.castShadow = false;
    return instanced;
  }, [blades, axis]);

  if (!mesh) return null;
  return <primitive object={mesh} visible={visible} />;
}
