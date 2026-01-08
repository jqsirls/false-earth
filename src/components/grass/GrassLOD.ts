import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { createBladeGeometry, createPositions, createGrassData } from "./core/grassGeometry";
import { findDirectionalLight } from "./core/utils";
import { createGrassMaterial } from "./core/grassMaterial";
import { extractMaterialInitialValues, updateMaterialUniforms } from "./core/helpers";
import type { TerrainParams, LODBufferConfig } from "./core/types";

interface GrassLODProps {
  grassParams: any;
  terrainParams?: TerrainParams;
  grassData: ReturnType<typeof createGrassData> | null;
  positions: ReturnType<typeof createPositions> | null;
  lodBuffer: LODBufferConfig;
}

export function GrassLOD({
  grassParams,
  terrainParams,
  grassData,
  positions,
  lodBuffer,
}: GrassLODProps) {
  const gridSize = grassParams.gridSize;
  const patchSize = grassParams.patchSize;
  const { scene } = useThree();

  const materialUniformsRef = useRef<Record<string, any> | null>(null);
  const materialRef = useRef<THREE.MeshStandardNodeMaterial | null>(null);

  // Create mesh and geometry only when structural properties change
  useEffect(() => {
    // Don't proceed if buffers aren't ready yet
    if (!grassData || !positions || !lodBuffer) {
      return;
    }

    const grassBlades = gridSize * gridSize;

    // Create geometry for this LOD
    const bladeGeometry = createBladeGeometry(lodBuffer.segments);
    bladeGeometry.setIndirect(lodBuffer.drawBuffer);

    // Find light and create material
    const light = findDirectionalLight(scene);
    const { material, uniforms: materialUniforms } = createGrassMaterial(
      grassData,
      positions,
      lodBuffer.indices,
      extractMaterialInitialValues(grassParams, terrainParams, light)
    );
    materialUniformsRef.current = materialUniforms;
    materialRef.current = material;

    // Create mesh and add to scene
    const mesh = new THREE.Mesh(bladeGeometry, material);
    mesh.count = grassBlades;
    scene.add(mesh);

    if (scene.environment) {
      material.envMap = scene.environment;
    }

    return () => {
      scene.remove(mesh);
      bladeGeometry.dispose();
      material.dispose();
    };
  }, [
    gridSize,
    patchSize,
    scene,
    grassData,
    positions,
    lodBuffer
  ]);

  // Update material uniforms when grassParams or terrainParams change
  useEffect(() => {
    if (!materialUniformsRef.current || !materialRef.current) return
    updateMaterialUniforms(
      materialUniformsRef.current,
      materialRef.current,
      grassParams,
      terrainParams
    )
  }, [grassParams, terrainParams])

  // Update material wind time uniform every frame
  useFrame(({ clock }) => {
    if (materialUniformsRef.current) {
      const elapsedTime = clock.getElapsedTime();
      materialUniformsRef.current.uTime.value = elapsedTime;
    }
  });

  return null;
}
