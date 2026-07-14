import * as THREE from 'three';
import { sampleTerrainHeight } from './terrainHeightCpu';

/** Radial alpha mask — matches TSL terrain circular fade at grass field edge. */
function createTerrainAlphaMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.82, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let sharedAlphaMap: THREE.CanvasTexture | null = null;

export function createTerrainWebGlMaterial(): THREE.MeshStandardMaterial {
  if (!sharedAlphaMap) {
    sharedAlphaMap = createTerrainAlphaMap();
  }

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#000000'),
    roughness: 0.92,
    metalness: 0.04,
    transparent: true,
    alphaMap: sharedAlphaMap,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    envMapIntensity: 0.18,
  });
}

/**
 * Displace a plane geometry (XY, later rotated to XZ) to match TSL terrain height.
 * `meshOriginX/Z` is the snapped world origin of the terrain chunk.
 */
export function displaceTerrainGeometry(
  geometry: THREE.PlaneGeometry,
  meshOriginX: number,
  meshOriginZ: number,
  grassAreaSize: number,
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const half = grassAreaSize * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const localY = pos.getY(i);
    const worldX = meshOriginX + localX;
    const worldZ = meshOriginZ - localY;
    const height = sampleTerrainHeight(worldX, worldZ);
    pos.setZ(i, height);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}
