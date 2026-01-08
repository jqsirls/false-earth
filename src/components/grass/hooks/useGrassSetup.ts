import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { createBladeGeometry, createPositions, createGrassData, createVisibleIndicesBuffer } from '../geometry'
import { HIGH_DETAIL_SEGMENTS, LOW_DETAIL_SEGMENTS } from '../constants'
import { findDirectionalLight } from '../utils/index'
import { createGrassMaterial } from '../materials/grassMaterial'
import type { TerrainParams } from '../types'

interface UseGrassSetupParams {
  grassParams: any
  terrainParams?: TerrainParams
  grassComputeRef: React.MutableRefObject<any>
  resetComputeRef: React.MutableRefObject<any>
  computeUniformsRef: React.MutableRefObject<Record<string, any>>
  grassData: ReturnType<typeof createGrassData> | null
  positions: ReturnType<typeof createPositions> | null
  indicesHigh: ReturnType<typeof createVisibleIndicesBuffer> | null
  indicesLow: ReturnType<typeof createVisibleIndicesBuffer> | null
  drawBufferHigh: THREE.IndirectStorageBufferAttribute | null
  drawBufferLow: THREE.IndirectStorageBufferAttribute | null
}

export function useGrassSetup({
  grassParams,
  terrainParams,
  grassComputeRef,
  resetComputeRef,
  computeUniformsRef,
  grassData,
  positions,
  indicesHigh,
  indicesLow,
  drawBufferHigh,
  drawBufferLow,
}: UseGrassSetupParams) {
  const gridSize = grassParams.gridSize
  const patchSize = grassParams.patchSize
  const { scene } = useThree()

  const materialUniformsRef = useRef<Record<string, any> | null>(null)
  const materialRef = useRef<THREE.MeshStandardNodeMaterial | null>(null)
  const materialLowRef = useRef<THREE.MeshStandardNodeMaterial | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const meshLowRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    // Don't proceed if buffers aren't ready yet
    if (!grassData || !positions || !indicesHigh || !indicesLow || !drawBufferHigh || !drawBufferLow) {
      return
    }

    const highDetailSegments = grassParams.highDetailSegments ?? HIGH_DETAIL_SEGMENTS
    const lowDetailSegments = grassParams.lowDetailSegments ?? LOW_DETAIL_SEGMENTS
    
    const bladeGeometryHigh = createBladeGeometry(highDetailSegments)
    const bladeGeometryLow = createBladeGeometry(lowDetailSegments)
    
    const grassBlades = gridSize * gridSize
    
    // Set indirect draw buffers (passed from parent)
    bladeGeometryHigh.setIndirect(drawBufferHigh)
    bladeGeometryLow.setIndirect(drawBufferLow)

    // Find light and create material
    const light = findDirectionalLight(scene)
    const groundColor = terrainParams?.color || '#1a3319'
    const lightDirection = light ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, -1) // Default direction
    const lightColor = light ? light.color : new THREE.Color('#ffffff')
    
    // Create materials for High and Low detail
    // High detail material uses indicesHigh buffer
    const { material, uniforms: materialUniforms } = createGrassMaterial(
      grassData, 
      positions, 
      indicesHigh,
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
      // Color uniforms
      baseColor: grassParams.baseColor,
      tipColor: grassParams.tipColor,
      groundColor: groundColor,
      bladeSeedRange: grassParams.bladeSeedRange,
      clumpSeedRange: grassParams.clumpSeedRange,
      aoPower: grassParams.aoPower,
      // Lighting uniforms
      lightDirection: lightDirection,
      lightColor: lightColor,
      lightBackStrength: grassParams.backLightStrength,
      // Noise uniforms
      noiseParams: {
        x: grassParams.noiseFreqX,
        y: grassParams.noiseFreqY,
        z: grassParams.noiseRemapMin,
        w: grassParams.noiseRemapMax,
      },
    })
    materialUniformsRef.current = materialUniforms
    materialRef.current = material

    // Create Low detail material (shares same uniforms as High detail material)
    const { material: materialLow } = createGrassMaterial(
      grassData,
      positions,
      indicesLow,
      {
        // Share uniforms from High detail material so they stay in sync
        sharedUniforms: materialUniforms,
      }
    )
    materialLowRef.current = materialLow

    // Create meshes and add to scene
    const mesh = new THREE.Mesh(bladeGeometryHigh, material)
    mesh.count = grassBlades
    meshRef.current = mesh
    scene.add(mesh)

    const meshLow = new THREE.Mesh(bladeGeometryLow, materialLow)
    meshLow.count = grassBlades
    meshLowRef.current = meshLow
    scene.add(meshLow)

    if (scene.environment) {
      material.envMap = scene.environment
      materialLow.envMap = scene.environment
    }

    return () => {
      scene.remove(mesh)
      scene.remove(meshLow)
      bladeGeometryHigh.dispose()
      bladeGeometryLow.dispose()
      material.dispose()
      materialLow.dispose()
    }
  }, [gridSize, patchSize, scene, grassParams.lodDistance, grassParams.highDetailSegments, grassParams.lowDetailSegments, grassParams, grassData, positions, indicesHigh, indicesLow, drawBufferHigh, drawBufferLow])

  // Update uniforms when grassParams or terrainParams change
  useEffect(() => {
    if (!computeUniformsRef.current) return

    const params = grassParams as any
    const uniforms = computeUniformsRef.current

    // Update shape parameter uniforms from Leva controls
    uniforms.uBladeHeightMin.value = params.bladeHeightMin
    uniforms.uBladeHeightMax.value = params.bladeHeightMax
    uniforms.uBladeWidthMin.value = params.bladeWidthMin
    uniforms.uBladeWidthMax.value = params.bladeWidthMax
    uniforms.uBendAmountMin.value = params.bendAmountMin
    uniforms.uBendAmountMax.value = params.bendAmountMax
    uniforms.uBladeRandomness.value.set(
      params.bladeRandomness.x,
      params.bladeRandomness.y,
      params.bladeRandomness.z
    )

    // Update clump parameter uniforms
    uniforms.uClumpSize.value = params.clumpSize
    uniforms.uClumpRadius.value = params.clumpRadius
    uniforms.uCenterYaw.value = params.centerYaw
    uniforms.uBladeYaw.value = params.bladeYaw
    uniforms.uClumpYaw.value = params.clumpYaw
    uniforms.uTypeTrendScale.value = params.typeTrendScale

    // Update wind parameter uniforms (compute shader only has these)
    uniforms.uWindScale.value = params.windScale ?? 0.25
    uniforms.uWindSpeed.value = params.windSpeed
    uniforms.uWindStrength.value = params.windStrength
    uniforms.uWindDir.value.set(params.windDirX, params.windDirZ)
    uniforms.uWindFacing.value = params.windFacing
    
    // Update LOD parameter uniforms
    if (uniforms.uLODDistance) {
      uniforms.uLODDistance.value = params.lodDistance ?? 15.0
    }

    // Update material wind parameter uniforms (vertex shader has these additional ones)
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uWindDir.value.set(params.windDirX, params.windDirZ)
      materialUniformsRef.current.uWindSwayFreqMin.value = params.swayFreqMin
      materialUniformsRef.current.uWindSwayFreqMax.value = params.swayFreqMax
      materialUniformsRef.current.uWindSwayStrength.value = params.swayStrength
      materialUniformsRef.current.uWindDistanceStart.value = params.windDistanceStart
      materialUniformsRef.current.uWindDistanceEnd.value = params.windDistanceEnd
    }

    // Update material properties (both High and Low detail materials)
    if (materialRef.current) {
      materialRef.current.roughness = params.roughness
      materialRef.current.metalness = params.metalness
      if (params.emissive) {
        materialRef.current.emissive = new THREE.Color(params.emissive)
      }
      materialRef.current.envMapIntensity = params.envMapIntensity
    }
    
    // Update Low detail material properties (same values as High detail)
    if (materialLowRef.current) {
      materialLowRef.current.roughness = params.roughness
      materialLowRef.current.metalness = params.metalness
      if (params.emissive) {
        materialLowRef.current.emissive = new THREE.Color(params.emissive)
      }
      materialLowRef.current.envMapIntensity = params.envMapIntensity
    }

    // Update material width shaping uniforms
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uMidSoft.value = params.midSoft
      materialUniformsRef.current.uRimPos.value = params.rimPos
      materialUniformsRef.current.uRimSoft.value = params.rimSoft

      // Update color uniforms
      const baseColor = new THREE.Color(params.baseColor)
      materialUniformsRef.current.uBaseColor.value.set(baseColor.r, baseColor.g, baseColor.b)

      const tipColor = new THREE.Color(params.tipColor)
      materialUniformsRef.current.uTipColor.value.set(tipColor.r, tipColor.g, tipColor.b)

      const groundColor = terrainParams?.color || '#1a3319'
      const groundColorObj = new THREE.Color(groundColor)
      materialUniformsRef.current.uGroundColor.value.set(groundColorObj.r, groundColorObj.g, groundColorObj.b)

      materialUniformsRef.current.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y)
      materialUniformsRef.current.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y)
      materialUniformsRef.current.uAOPower.value = params.aoPower

      // Update lighting uniforms
      materialUniformsRef.current.uLightBackStrength.value = params.backLightStrength

      // Update noise uniforms
      materialUniformsRef.current.uNoiseParams.value.set(
        params.noiseFreqX,
        params.noiseFreqY,
        params.noiseRemapMin,
        params.noiseRemapMax
      )
    }
  }, [grassParams, terrainParams, computeUniformsRef, materialUniformsRef, materialRef, materialLowRef])

  // Update material wind time uniform every frame
  useFrame(({ clock }) => {
    if (materialUniformsRef.current) {
      const elapsedTime = clock.getElapsedTime()
      materialUniformsRef.current.uWindTime.value = elapsedTime
    }
  })
}

