import { useEffect, useRef, useState } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { storage } from 'three/tsl'
import { DEFAULT_PATCH_SIZE, DEFAULT_LOD_SEGMENTS_CONFIG, drawIndirectStructure } from './core/constants'
import { createGrassControls } from './core/grassControls'
import { createPositions, createGrassData, createVisibleIndicesBuffer, createBladeGeometry } from './core/grassGeometry'
import { createGrassCompute, createResetDrawBufferCompute } from './core/grassCompute'
import { extractComputeInitialValues, updateComputeUniforms } from './core/helpers'
import { GrassLOD } from './GrassLOD'
import type { GrassProps, LODBufferConfig } from './core/types'

export default function GrassWebGPU({ terrainParams, patchSize: initialPatchSize = DEFAULT_PATCH_SIZE }: GrassProps = {} as GrassProps) {
  const { gl, camera } = useThree()

  const [grassParams] = useControls('Grass', () => createGrassControls({ initialPatchSize }), { collapsed: true })

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)
  const computeUniformsRef = useRef<Record<string, any>>({})

  // Buffer refs (created at top level, passed to GrassLOD components)
  const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
  const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)
  const [lodBuffers, setLodBuffers] = useState<LODBufferConfig[]>([])

  // Create compute shader and shared buffers only when structural properties change
  useEffect(() => {
    const gridSize = grassParams.gridSize
    const patchSize = grassParams.patchSize
    const grassBlades = gridSize * gridSize

    // Create shared buffers
    const positions = createPositions(gridSize, patchSize)
    const grassData = createGrassData(grassBlades)
    positionsRef.current = positions
    grassDataRef.current = grassData

    // Generate LOD buffers from segments config
    const lodConfigs: LODBufferConfig[] = DEFAULT_LOD_SEGMENTS_CONFIG.map((lodSegConfig) => {
      const bladeGeometry = createBladeGeometry(lodSegConfig.segments)
      const indexCount = bladeGeometry.index ? bladeGeometry.index.count : bladeGeometry.attributes.position.count
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

    setLodBuffers(lodConfigs)

    // Create compute shader with initial values
    const { computeFn, uniforms } = createGrassCompute(
      grassData,
      positions,
      lodConfigs,
      extractComputeInitialValues(grassParams)
    )
    const grassCompute = computeFn().compute(grassBlades)
    computeUniformsRef.current = uniforms
    grassComputeRef.current = grassCompute

    // Create reset compute shader
    const resetCompute = createResetDrawBufferCompute(lodConfigs)
    resetComputeRef.current = resetCompute
  }, [grassParams.gridSize, grassParams.patchSize])

  // Update compute uniforms when grassParams change (only updates uniforms, doesn't recreate shader)
  useEffect(() => {
    if (!computeUniformsRef.current) return
    updateComputeUniforms(computeUniformsRef.current, grassParams)
  }, [grassParams])

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    if (!grassComputeRef.current || !computeUniformsRef.current || !resetComputeRef.current || !camera) return

    const elapsedTime = clock.getElapsedTime()
    
    const uniforms = computeUniformsRef.current
    uniforms.uTime.value = elapsedTime

    // Update camera matrices for frustum culling
    camera.updateMatrixWorld()
    uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)
    uniforms.uCameraPosition.value.copy(camera.position)
    uniforms.uModelMatrix.value.identity()

    // Execute compute shaders
    renderer.compute(resetComputeRef.current)
    renderer.compute(grassComputeRef.current)
  })

  return (
    <>
      {lodBuffers.map((lodBuffer) => (
        <GrassLOD
          key={`lod-${lodBuffer.segments}-${lodBuffer.minDistance}-${lodBuffer.maxDistance}`}
          grassParams={grassParams}
          terrainParams={terrainParams}
          grassData={grassDataRef.current}
          positions={positionsRef.current}
          lodBuffer={lodBuffer}
        />
      ))}
    </>
  )
}
