// ============================================================================
// Wave Constants and Structures
// ============================================================================
import { struct } from 'three/tsl'

// Wave data structure for shockwave effects
// Each wave contains: x position, z position, start time, max radius, lifetime
export const waveStructure = struct({
  x: 'float',
  z: 'float',
  startTime: 'float',
  maxRadius: 'float',
  lifetime: 'float',
})
