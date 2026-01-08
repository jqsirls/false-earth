import { instancedArray, storage } from 'three/tsl'
import * as THREE from 'three/webgpu'

export interface TerrainParams {
  amplitude: number
  frequency: number
  seed: number
  color: string
}

export interface GrassProps {
  terrainUniforms?: { uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any }
  patchSize?: number
  onPatchSizeChange?: (patchSize: number) => void
}

export interface LODSegmentsConfig {
  segments: number
  minDistance: number
  maxDistance: number
}

export interface LODBufferConfig {
  segments: number
  indices: ReturnType<typeof instancedArray>
  drawBuffer: THREE.IndirectStorageBufferAttribute
  drawStorage: ReturnType<typeof storage>
  vertexCount: number
  minDistance: number
  maxDistance: number
}

