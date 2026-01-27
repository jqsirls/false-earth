import { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { storage } from 'three/tsl'
import { DEFAULT_BLADES_PER_AXIS, DEFAULT_GRASS_AREA_SIZE, DEFAULT_LOD_SEGMENTS_CONFIG, drawIndirectStructure } from './core/config'
import { useGridSnapping } from '../../core/utils/gridSnapping'
import { createPositions, createGrassData, createVisibleIndicesBuffer, createBladeGeometry } from './core/grassGeometry'
import { createGrassCompute, createResetDrawBufferCompute } from './core/grassCompute'
import { GrassLOD } from './GrassLOD'
import type { GrassProps, LODBufferConfig } from './core/config'
import { useGameStore } from '../../core/store/gameStore'
import { useGrassUniforms } from './hooks/useGrassUniforms'

export default function GrassWebGPU({ cullCamera }: GrassProps = {} as GrassProps) {
  const { gl, camera: defaultCamera } = useThree()
  
  // Use cullCamera if provided, otherwise use default render camera
  const cameraToUse = cullCamera || defaultCamera
  
  // Get character ref and wind uniforms from global store
  const characterRef = useGameStore((state) => state.characterRef)
  const windUniforms = useGameStore((state) => state.windUniforms)
  
  
  // Temporary vector to get character position
  const characterPos = useMemo(() => new THREE.Vector3(), [])
  
  const { uniforms, params } = useGrassUniforms(windUniforms)

  // Use default constants for size parameters (not exposed in controls)
  const bladesPerAxis = DEFAULT_BLADES_PER_AXIS
  const grassAreaSize = DEFAULT_GRASS_AREA_SIZE

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)
  const groupRef = useRef<THREE.Group>(null)

  // Buffer refs (created at top level, passed to GrassLOD components)
  const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
  const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)
  const [lodBuffers, setLodBuffers] = useState<LODBufferConfig[]>([])

  // Use centralized grid snapping hook
  const { gridCellSize } = useGridSnapping({
    camera: cameraToUse,
    grassAreaSize,
    onSnap: ({ snappedX, snappedZ }) => {
      if (!groupRef.current) return;

      groupRef.current.position.set(snappedX, 0, snappedZ)
      groupRef.current.updateMatrixWorld(true)
    },
  })

  // Create compute shader and shared buffers
  useEffect(() => {
    const grassBlades = bladesPerAxis * bladesPerAxis

    // Create shared buffers
    const positions = createPositions(bladesPerAxis, grassAreaSize)
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
        debugColor: lodSegConfig.debugColor,
      }
    })

    setLodBuffers(lodConfigs)

    // Merge wind uniforms into compute uniforms if available
    const mergedComputeUniforms = windUniforms ? {
      ...uniforms.compute,
      uWindDir: windUniforms.uWindDir,
      uWindScale: windUniforms.uWindScale,
      uWindSpeed: windUniforms.uWindSpeed,
      uWindStrength: windUniforms.uWindStrength,
      uWindFacing: windUniforms.uWindFacing,
    } : uniforms.compute;

    // Create compute shader with merged uniforms
    const { computeFn } = createGrassCompute(
      grassData,
      positions,
      lodConfigs,
      mergedComputeUniforms
    )
    const grassCompute = computeFn().compute(grassBlades)
    grassComputeRef.current = grassCompute

    // Create reset compute shader
    const resetCompute = createResetDrawBufferCompute(lodConfigs)
    resetComputeRef.current = resetCompute
  }, [bladesPerAxis, grassAreaSize, windUniforms])

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    if (!grassComputeRef.current || !resetComputeRef.current || !cameraToUse) return

    // Update character world position from ref
    if (characterRef?.current) {
      characterRef.current.getWorldPosition(characterPos);
      uniforms.material.uCharacterWorldPos.value.copy(characterPos);
    }

      // Update uniforms with current group position (snapping is handled by useGridSnapping hook)
    if (groupRef.current) {
      uniforms.compute.uGroupOffset.value.setFromMatrixPosition(groupRef.current.matrixWorld)
      uniforms.compute.uGridCellSize.value = gridCellSize
      
      uniforms.material.uGroupOffset.value.copy(uniforms.compute.uGroupOffset.value)
    }

    uniforms.material.uTime.value = clock.getElapsedTime()
    uniforms.compute.uTime.value = clock.getElapsedTime()

    // Update camera matrices (for Culling)
    // Use cullCamera if provided, otherwise use default render camera
    if (cameraToUse) {
      cameraToUse.updateMatrixWorld()
      uniforms.compute.uViewProjectionMatrix.value.copy(cameraToUse.projectionMatrix.clone().multiply(cameraToUse.matrixWorldInverse))
      uniforms.compute.uCameraPosition.value.copy(cameraToUse.position)
    }

    // Execute Compute Shaders
    renderer.compute(resetComputeRef.current)
    renderer.compute(grassComputeRef.current)
  })

  return (
    <group ref={groupRef}>
      {lodBuffers.map((lodBuffer) => (
        <GrassLOD
          key={`lod-${lodBuffer.segments}-${lodBuffer.minDistance}-${lodBuffer.maxDistance}`}
          grassParams={params}
          grassData={grassDataRef.current}
          positions={positionsRef.current}
          lodBuffer={lodBuffer}
          uniforms={uniforms.material}
        />
      ))}
    </group>
  )
}
