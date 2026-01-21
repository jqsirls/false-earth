import * as THREE from 'three'
import { VATMeta } from '../types'

/**
 * Setup VAT geometry: generate UV1 coordinates and convert coordinate system
 * - Generates UV1 coordinates matching Unity's VAT texture layout
 * - Converts positions from Unity's left-handed to Three.js right-handed coordinate system
 */
export function setupVATGeometry(geometry: THREE.BufferGeometry, meta: VATMeta): void {
  const count = geometry.getAttribute('position').count
  const positionAttr = geometry.getAttribute('position')
  
  const uv1Array = new Float32Array(count * 2)
  const positionArray = new Float32Array(count * 3)
  const padding = meta.padding ?? 2 // Space between columns (default: 2)
  const adjustedFramesCount = meta.frameCount + padding
  
  for(let i = 0; i < count; i++) {
    // Calculate UV1 coordinates based on vertex index (matching Unity's getCoord logic)
    const columnIndex = Math.floor(i / meta.textureHeight)
    const verticalIndex = i % meta.textureHeight
    
    const uIdx = columnIndex * adjustedFramesCount
    const vIdx = verticalIndex
    
    const u = (uIdx + 0.5) / meta.textureWidth
    const v = (vIdx + 0.5) / meta.textureHeight
    
    uv1Array[2 * i + 0] = u
    uv1Array[2 * i + 1] = v

    // Convert coordinate system: Unity (left-handed) -> Three.js (right-handed)
    // Flip X axis to convert from left-handed to right-handed
    positionArray[3 * i + 0] = positionAttr.getX(i) * -1
    positionArray[3 * i + 1] = positionAttr.getY(i)
    positionArray[3 * i + 2] = positionAttr.getZ(i)
  }
  
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1Array, 2))
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
}

export function calculateVATFrame(
  frameRatio: number | undefined,
  currentTime: number,
  metaData: VATMeta,
  speed: number
): number {
  if (frameRatio !== undefined) {
    return Math.max(0, Math.min(1, frameRatio))
  }
  // Calculate time position from elapsed time
  const fps = metaData.fps || 24
  const duration = metaData.frameCount / fps
  const timePosition = ((currentTime * speed) % duration) / duration
  return Math.max(0, Math.min(1, timePosition))
}

/**
 * Extract geometry from a THREE.Group/Scene
 */
export function extractGeometryFromScene(scene: THREE.Group): THREE.BufferGeometry | null {
  let geometry: THREE.BufferGeometry | null = null
  
  scene.traverse((object: any) => {
    if (object.isMesh && object.geometry && !geometry) {
      geometry = object.geometry.clone()
    }
  })
  
  return geometry
}