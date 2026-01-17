import { useRef, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { Group } from 'three';
import { Fn, vec3, vec4, float, positionLocal, modelWorldMatrix, cameraViewMatrix, cameraProjectionMatrix, uniform } from 'three/tsl';
import { getTerrainHeight } from '../../terrain/terrainHelpers';
import { TerrainUniforms } from '../../terrain/types';

export interface UseCharacterTerrainParams {
  terrainUniforms?: TerrainUniforms;
  groupRef?: MutableRefObject<Group | null>;
  bodyMat: THREE.MeshStandardNodeMaterial | null;
  detailMat: THREE.MeshStandardNodeMaterial | null;
}

/**
 * Hook to handle terrain-based vertex displacement for character
 */
export function useCharacterTerrain({
  terrainUniforms,
  groupRef,
  bodyMat,
  detailMat,
}: UseCharacterTerrainParams) {
  const uGroupWorldPosRef = useRef(uniform(new THREE.Vector3(0, 0, 0)));

  useEffect(() => {
    if (!terrainUniforms || !bodyMat || !detailMat) return;
    
    const uGroupWorldPos = uGroupWorldPosRef.current;

    const terrainHeight = getTerrainHeight(
      terrainUniforms.uTerrainAmp,
      terrainUniforms.uTerrainFreq,
      terrainUniforms.uTerrainSeed
    );

    const vertexNodeFn = Fn(() => {
      const worldPos = modelWorldMatrix.mul(vec4(positionLocal, float(1.0))).xyz;
      const th = terrainHeight(uGroupWorldPos.xz);
      const displacedWorldPos = vec3(worldPos.x, worldPos.y.add(th), worldPos.z);

      const viewPos = cameraViewMatrix.mul(vec4(displacedWorldPos, float(1.0)));
      return cameraProjectionMatrix.mul(viewPos);
    });
    
    bodyMat.vertexNode = vertexNodeFn();
    detailMat.vertexNode = vertexNodeFn();
  }, [terrainUniforms, bodyMat, detailMat]);

  useFrame(() => {
    if (groupRef?.current && uGroupWorldPosRef.current) {
      groupRef.current.updateMatrixWorld(true);
      const groupWorldPos = new THREE.Vector3();
      groupWorldPos.setFromMatrixPosition(groupRef.current.matrixWorld);
      uGroupWorldPosRef.current.value.set(groupWorldPos.x, groupWorldPos.y, groupWorldPos.z);
    }
  });
}
