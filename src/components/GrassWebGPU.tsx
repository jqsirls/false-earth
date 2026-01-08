import { useEffect, useRef } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { DEFAULT_PATCH_SIZE } from './grass/constants'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { storage } from 'three/tsl'
import { createGrassControls } from './grass/controls'
import { createPositions, createGrassData, createVisibleIndicesBuffer, createBladeGeometry } from './grass/geometry'
import { createGrassCompute, createResetDrawBufferCompute } from './grass/compute/grassCompute'
import { drawIndirectStructure } from './grass/constants'
import { useGrassSetup } from './grass/hooks'
import type { GrassProps, LODBufferConfig, LODSegmentsConfig } from './grass/types'

export default function GrassWebGPU({ terrainParams, patchSize: initialPatchSize = DEFAULT_PATCH_SIZE }: GrassProps = {} as GrassProps) {
  const { gl, camera } = useThree()

  const [grassParams] = useControls('Grass', () => createGrassControls({ initialPatchSize }), { collapsed: true })

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)
  const computeUniformsRef = useRef<Record<string, any>>({})

  // Buffer refs (created at top level, passed to useGrassSetup)
  const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
  const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)
  const lodBuffersRef = useRef<LODBufferConfig[]>([])

  // Create compute shader and shared buffers
  useEffect(() => {
    const gridSize = grassParams.gridSize
    const patchSize = grassParams.patchSize

    // LOD segments configuration - defines detail levels with distance ranges
    const lodSegmentsConfig: LODSegmentsConfig[] = [
      {
        segments: 14,
        minDistance: 0,
        maxDistance: 15,
      },
      {
        segments: 4,
        minDistance: 15,
        maxDistance: Infinity,
      },
    ]

    const grassBlades = gridSize * gridSize
    const positions = createPositions(gridSize, patchSize)
    const grassData = createGrassData(grassBlades)

    // Store shared buffers in refs
    positionsRef.current = positions
    grassDataRef.current = grassData

    // Generate LOD buffers from segments config
    const lodConfigs: LODBufferConfig[] = lodSegmentsConfig.map((lodSegConfig) => {
      const bladeGeometry = createBladeGeometry(lodSegConfig.segments)
      const vertexCount = bladeGeometry.attributes.position.count
      const indexCount = bladeGeometry.index ? bladeGeometry.index.count : vertexCount
      const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(5), 5)
      const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)

      bladeGeometry.dispose()

      return {
        segments: lodSegConfig.segments,
        indices: createVisibleIndicesBuffer(grassBlades),
        drawBuffer,
        drawStorage,
        vertexCount: indexCount,
        minDistance: lodSegConfig.minDistance,
        maxDistance: lodSegConfig.maxDistance,
      }
    })

    // Store LOD buffers in refs
    lodBuffersRef.current = lodConfigs

    // Create compute shader with LOD support
    const { computeFn, uniforms } = createGrassCompute(
      grassData,
      positions,
      lodConfigs,
      {
        bladeHeightMin: grassParams.bladeHeightMin,
        bladeHeightMax: grassParams.bladeHeightMax,
        bladeWidthMin: grassParams.bladeWidthMin,
        bladeWidthMax: grassParams.bladeWidthMax,
        bendAmountMin: grassParams.bendAmountMin,
        bendAmountMax: grassParams.bendAmountMax,
        bladeRandomness: grassParams.bladeRandomness,
        clumpSize: grassParams.clumpSize,
        clumpRadius: grassParams.clumpRadius,
        centerYaw: grassParams.centerYaw,
        bladeYaw: grassParams.bladeYaw,
        clumpYaw: grassParams.clumpYaw,
        typeTrendScale: grassParams.typeTrendScale,
        windTime: 0.0,
        windScale: grassParams.windScale ?? 0.25,
        windSpeed: grassParams.windSpeed,
        windStrength: grassParams.windStrength,
        windDir: { x: grassParams.windDirX, y: grassParams.windDirZ },
        windFacing: grassParams.windFacing,
        maxCullDistance: (grassParams as any).maxCullDistance ?? 50.0,
        cullOffset: grassParams.bladeHeightMax ?? 0.8,
      }
    )
    const grassCompute = computeFn().compute(grassBlades)
    computeUniformsRef.current = uniforms
    grassComputeRef.current = grassCompute

    // Create reset compute shader
    const resetCompute = createResetDrawBufferCompute(lodConfigs)
    resetComputeRef.current = resetCompute
  }, [
    grassParams.gridSize,
    grassParams.patchSize,
    grassParams.bladeHeightMin,
    grassParams.bladeHeightMax,
    grassParams.bladeWidthMin,
    grassParams.bladeWidthMax,
    grassParams.bendAmountMin,
    grassParams.bendAmountMax,
    grassParams.bladeRandomness,
    grassParams.clumpSize,
    grassParams.clumpRadius,
    grassParams.centerYaw,
    grassParams.bladeYaw,
    grassParams.clumpYaw,
    grassParams.typeTrendScale,
    grassParams.windScale,
    grassParams.windSpeed,
    grassParams.windStrength,
    grassParams.windDirX,
    grassParams.windDirZ,
    grassParams.windFacing,
  ])

  useGrassSetup({
    grassParams,
    terrainParams,
    grassData: grassDataRef.current,
    positions: positionsRef.current,
    lodBuffers: lodBuffersRef.current,
  })

  // Update compute uniforms when grassParams change
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
  }, [grassParams, computeUniformsRef])

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    // Ensure all compute shaders are ready and camera is initialized before executing
    if (!grassComputeRef.current || !computeUniformsRef.current || !resetComputeRef.current || !camera) return

    const elapsedTime = clock.getElapsedTime()

    // Update windTime based on elapsed time
    computeUniformsRef.current.uWindTime.value = elapsedTime

    const uniforms = computeUniformsRef.current

    camera.updateMatrixWorld()
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)
    uniforms.uCameraPosition.value.copy(camera.position)
    uniforms.uModelMatrix.value.identity()

    renderer.compute(resetComputeRef.current)
    renderer.compute(grassComputeRef.current)
  })

  return null
}
