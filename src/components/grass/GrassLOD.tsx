import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { createBladeGeometry, createGrassData, createPositions } from "./core/grassGeometry";
import { createGrassMaterial } from "./core/grassMaterial";
import type { LODBufferConfig } from "./core/types";

interface GrassLODProps {
  grassParams: any;
  terrainUniforms?: { uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any };
  grassData: ReturnType<typeof createGrassData> | null;
  positions: ReturnType<typeof createPositions> | null;
  lodBuffer: LODBufferConfig;
  uniforms: Record<string, any>;
}

export function GrassLOD({
  grassParams,
  terrainUniforms,
  grassData,
  positions,
  lodBuffer,
  uniforms,
}: GrassLODProps) {
  const gridSize = grassParams.gridSize;
  const patchSize = grassParams.patchSize;
  const { scene } = useThree();

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

    // Create material with uniforms
    const { material } = createGrassMaterial(
      grassData,
      positions,
      lodBuffer.indices,
      uniforms,
      terrainUniforms
    );
    material.metalness = grassParams.metalness;
    material.roughness = grassParams.roughness;
    material.emissive = new THREE.Color(grassParams.emissive);
    material.envMapIntensity = grassParams.envMapIntensity;
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
    lodBuffer,
    uniforms,
    terrainUniforms
  ]);

  useEffect(() => {
    if (!materialRef.current) return;
    const mat = materialRef.current;
    mat.roughness = grassParams.roughness ?? 0.3;
    mat.metalness = grassParams.metalness ?? 0.5;
    mat.emissive = new THREE.Color(grassParams.emissive);
    mat.envMapIntensity = grassParams.envMapIntensity ?? 0.5;
  }, [grassParams.roughness, grassParams.metalness, grassParams.emissive, grassParams.envMapIntensity]);

  return null;
}

