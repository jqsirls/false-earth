import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import {
  createBladeGeometry,
  createGrassData,
  createPositions,
} from "./geometry";
import { findDirectionalLight } from "./utils/index";
import { createGrassMaterial } from "./materials/grassMaterial";
import type { TerrainParams, LODBufferConfig } from "./types";

interface UseGrassSetupParams {
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
}: UseGrassSetupParams) {
  const gridSize = grassParams.gridSize;
  const patchSize = grassParams.patchSize;
  const { scene } = useThree();

  const materialUniformsRef = useRef<Record<string, any> | null>(null);
  const materialRef = useRef<THREE.MeshStandardNodeMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);

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
    geometryRef.current = bladeGeometry;

    // Find light
    const light = findDirectionalLight(scene);
    const groundColor = terrainParams?.color || "#1a3319";
    const lightDirection = light
      ? new THREE.Vector3(0, 0, -1)
      : new THREE.Vector3(0, 0, -1);
    const lightColor = light ? light.color : new THREE.Color("#ffffff");

    // Create material with initial values
    const { material, uniforms: materialUniforms } = createGrassMaterial(
      grassData,
      positions,
      lodBuffer.indices,
      {
        baseWidth: grassParams.baseWidth,
        tipThin: grassParams.tipThin,
        windTime: 0.0, // Will be updated in useFrame
        windDir: { x: grassParams.windDirX, y: grassParams.windDirZ },
        swayFreqMin: grassParams.swayFreqMin,
        swayFreqMax: grassParams.swayFreqMax,
        swayStrength: grassParams.swayStrength,
        windDistanceStart: grassParams.windDistanceStart,
        windDistanceEnd: grassParams.windDistanceEnd,
        cullStart: grassParams.cullStart,
        cullEnd: grassParams.cullEnd,
        roughness: grassParams.roughness,
        metalness: grassParams.metalness,
        emissive: grassParams.emissive,
        envMapIntensity: grassParams.envMapIntensity,
        midSoft: grassParams.midSoft,
        rimPos: grassParams.rimPos,
        rimSoft: grassParams.rimSoft,
        baseColor: grassParams.baseColor,
        tipColor: grassParams.tipColor,
        groundColor: groundColor,
        bladeSeedRange: grassParams.bladeSeedRange,
        clumpSeedRange: grassParams.clumpSeedRange,
        aoPower: grassParams.aoPower,
        lightDirection: lightDirection,
        lightColor: lightColor,
        lightBackStrength: grassParams.backLightStrength,
        noiseParams: {
          x: grassParams.noiseFreqX,
          y: grassParams.noiseFreqY,
          z: grassParams.noiseRemapMin,
          w: grassParams.noiseRemapMax,
        },
      }
    );
    materialUniformsRef.current = materialUniforms;
    materialRef.current = material;

    // Create mesh and add to scene
    const mesh = new THREE.Mesh(bladeGeometry, material);
    mesh.count = grassBlades;
    meshRef.current = mesh;
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
    const params = grassParams as any;

    // Update material wind parameter uniforms (vertex shader has these additional ones)
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uWindDir.value.set(
        params.windDirX,
        params.windDirZ
      );
      materialUniformsRef.current.uWindSwayFreqMin.value = params.swayFreqMin;
      materialUniformsRef.current.uWindSwayFreqMax.value = params.swayFreqMax;
      materialUniformsRef.current.uWindSwayStrength.value = params.swayStrength;
      materialUniformsRef.current.uWindDistanceStart.value =
        params.windDistanceStart;
      materialUniformsRef.current.uWindDistanceEnd.value =
        params.windDistanceEnd;
    }

    // Update material properties (both High and Low detail materials)
    if (materialRef.current) {
      materialRef.current.roughness = params.roughness;
      materialRef.current.metalness = params.metalness;
      if (params.emissive) {
        materialRef.current.emissive = new THREE.Color(params.emissive);
      }
      materialRef.current.envMapIntensity = params.envMapIntensity;
    }

    // Update material width shaping uniforms
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uMidSoft.value = params.midSoft;
      materialUniformsRef.current.uRimPos.value = params.rimPos;
      materialUniformsRef.current.uRimSoft.value = params.rimSoft;

      // Update color uniforms
      const baseColor = new THREE.Color(params.baseColor);
      materialUniformsRef.current.uBaseColor.value.set(
        baseColor.r,
        baseColor.g,
        baseColor.b
      );

      const tipColor = new THREE.Color(params.tipColor);
      materialUniformsRef.current.uTipColor.value.set(
        tipColor.r,
        tipColor.g,
        tipColor.b
      );

      const groundColor = terrainParams?.color || "#1a3319";
      const groundColorObj = new THREE.Color(groundColor);
      materialUniformsRef.current.uGroundColor.value.set(
        groundColorObj.r,
        groundColorObj.g,
        groundColorObj.b
      );

      materialUniformsRef.current.uBladeSeedRange.value.set(
        params.bladeSeedRange.x,
        params.bladeSeedRange.y
      );
      materialUniformsRef.current.uClumpSeedRange.value.set(
        params.clumpSeedRange.x,
        params.clumpSeedRange.y
      );
      materialUniformsRef.current.uAOPower.value = params.aoPower;

      // Update lighting uniforms
      materialUniformsRef.current.uLightBackStrength.value =
        params.backLightStrength;

      // Update noise uniforms
      materialUniformsRef.current.uNoiseParams.value.set(
        params.noiseFreqX,
        params.noiseFreqY,
        params.noiseRemapMin,
        params.noiseRemapMax
      );
    }
  }, [
    grassParams,
    terrainParams,
    materialUniformsRef,
    materialRef,
  ]);

  // Update material wind time uniform every frame
  useFrame(({ clock }) => {
    if (materialUniformsRef.current) {
      const elapsedTime = clock.getElapsedTime();
      materialUniformsRef.current.uWindTime.value = elapsedTime;
    }
  });

  return null;
}
