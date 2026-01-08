import { useEffect, useRef } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { DEFAULT_PATCH_SIZE, HIGH_DETAIL_SEGMENTS, LOW_DETAIL_SEGMENTS } from './grass/constants'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { storage } from 'three/tsl'
import { createGrassControls } from './grass/controls'
import { createPositions, createGrassData, createVisibleIndicesBuffer, createBladeGeometry } from './grass/geometry'
import { createGrassCompute, createResetDrawBufferCompute } from './grass/compute/grassCompute'
import { drawIndirectStructure } from './grass/constants'
import { useGrassSetup } from './grass/hooks'
import type { GrassProps } from './grass/types'

export default function GrassWebGPU({ terrainParams, patchSize: initialPatchSize = DEFAULT_PATCH_SIZE }: GrassProps = {} as GrassProps) {
  const { gl, camera } = useThree()

  const [grassParams] = useControls('Grass', () => createGrassControls({ initialPatchSize }), { collapsed: true })

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)
  const computeUniformsRef = useRef<Record<string, any>>({})

  // Buffer refs (created at top level, passed to useGrassSetup)
  const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
  const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)
  const indicesHighRef = useRef<ReturnType<typeof createVisibleIndicesBuffer> | null>(null)
  const indicesLowRef = useRef<ReturnType<typeof createVisibleIndicesBuffer> | null>(null)
  const drawBufferHighRef = useRef<THREE.IndirectStorageBufferAttribute | null>(null)
  const drawBufferLowRef = useRef<THREE.IndirectStorageBufferAttribute | null>(null)
  const drawStorageHighRef = useRef<ReturnType<typeof storage> | null>(null)
  const drawStorageLowRef = useRef<ReturnType<typeof storage> | null>(null)

  // Create compute shader and shared buffers
  useEffect(() => {
    const gridSize = grassParams.gridSize
    const patchSize = grassParams.patchSize
    const lodDistance = grassParams.lodDistance ?? 15.0
    const highDetailSegments = grassParams.highDetailSegments ?? HIGH_DETAIL_SEGMENTS
    const lowDetailSegments = grassParams.lowDetailSegments ?? LOW_DETAIL_SEGMENTS
    
    const grassBlades = gridSize * gridSize
    const positions = createPositions(gridSize, patchSize)
    const grassData = createGrassData(grassBlades)
    
    // Store shared buffers in refs
    positionsRef.current = positions
    grassDataRef.current = grassData
    
    // Create LOD buffers: High and Low detail
    const bladeGeometryHigh = createBladeGeometry(highDetailSegments)
    const bladeGeometryLow = createBladeGeometry(lowDetailSegments)
    
    const indicesHigh = createVisibleIndicesBuffer(grassBlades)
    const indicesLow = createVisibleIndicesBuffer(grassBlades)
    
    // Store indices buffers in refs
    indicesHighRef.current = indicesHigh
    indicesLowRef.current = indicesLow
    
    // Calculate counts for High and Low geometries
    const vertexCountHigh = bladeGeometryHigh.attributes.position.count
    const indexCountHigh = bladeGeometryHigh.index ? bladeGeometryHigh.index.count : vertexCountHigh
    const vertexCountLow = bladeGeometryLow.attributes.position.count
    const indexCountLow = bladeGeometryLow.index ? bladeGeometryLow.index.count : vertexCountLow
    
    // Create indirect draw buffers for High and Low detail
    const drawBufferArrayHigh = new Uint32Array(5)
    const drawBufferHigh = new THREE.IndirectStorageBufferAttribute(drawBufferArrayHigh, 5)
    const drawStorageHigh = storage(drawBufferHigh, drawIndirectStructure, 1)
    
    const drawBufferArrayLow = new Uint32Array(5)
    const drawBufferLow = new THREE.IndirectStorageBufferAttribute(drawBufferArrayLow, 5)
    const drawStorageLow = storage(drawBufferLow, drawIndirectStructure, 1)

    // Store buffer attributes and storage buffers in refs
    drawBufferHighRef.current = drawBufferHigh
    drawBufferLowRef.current = drawBufferLow
    drawStorageHighRef.current = drawStorageHigh
    drawStorageLowRef.current = drawStorageLow

    // Create compute shader with LOD support
    const { computeFn, uniforms } = createGrassCompute(
      grassData,
      positions,
      indicesHigh,
      indicesLow,
      drawStorageHigh,
      drawStorageLow,
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
        lodDistance: lodDistance,
      }
    )
    const grassCompute = computeFn().compute(grassBlades)
    computeUniformsRef.current = uniforms
    grassComputeRef.current = grassCompute

    // Create reset compute shader
    const resetCompute = createResetDrawBufferCompute(drawStorageHigh, indexCountHigh, drawStorageLow, indexCountLow)
    resetComputeRef.current = resetCompute

    // Cleanup geometries
    bladeGeometryHigh.dispose()
    bladeGeometryLow.dispose()
  }, [
    grassParams.gridSize,
    grassParams.patchSize,
    grassParams.lodDistance,
    grassParams.highDetailSegments,
    grassParams.lowDetailSegments,
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
    grassComputeRef,
    resetComputeRef,
    computeUniformsRef,
    grassData: grassDataRef.current,
    positions: positionsRef.current,
    indicesHigh: indicesHighRef.current,
    indicesLow: indicesLowRef.current,
    drawBufferHigh: drawBufferHighRef.current,
    drawBufferLow: drawBufferLowRef.current,
  })

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    // Ensure all compute shaders are ready and camera is initialized before executing
    if (!grassComputeRef.current || !computeUniformsRef.current || !resetComputeRef.current || !camera) return

    const elapsedTime = clock.getElapsedTime()

    // Update windTime based on elapsed time
    computeUniformsRef.current.uWindTime.value = elapsedTime

    // Update camera and model matrices for frustum culling
    // These uniforms are required because renderer.compute() has no camera context
    const uniforms = computeUniformsRef.current
    
    camera.updateMatrixWorld()
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)
    uniforms.uCameraPosition.value.copy(camera.position)
    uniforms.uModelMatrix.value.identity()

    // Execute compute shaders in correct order:
    // 1. Reset: Set instanceCount to 0 (GPU-side)
    try {
      renderer.compute(resetComputeRef.current)
    } catch (error) {
      console.error('Reset compute shader error:', error)
      return // Don't proceed if reset fails
    }

    // 2. Compute & Culling: Calculate grass parameters and perform culling
    //    This will atomically increment instanceCount from 0
    try {
      renderer.compute(grassComputeRef.current)
    } catch (error) {
      console.error('Grass compute shader error:', error)
    }
  })

  return null
}
