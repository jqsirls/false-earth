import * as THREE from 'three/webgpu'

/**
 * Finds the first DirectionalLight in the scene, searching recursively through all children.
 * This is more robust than searching only direct children, as lights might be nested in groups.
 * 
 * @param scene - The Three.js scene to search in
 * @returns The first DirectionalLight found, or undefined if none exists
 */
export function findDirectionalLight(scene: THREE.Scene): THREE.DirectionalLight | undefined {
  let foundLight: THREE.DirectionalLight | undefined = undefined
  
  scene.traverse((object) => {
    if (object instanceof THREE.DirectionalLight && !foundLight) {
      foundLight = object
    }
  })
  
  return foundLight
}

