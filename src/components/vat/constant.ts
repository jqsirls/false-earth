import { struct } from "three/tsl";

export const vatStructure = struct({
    position: 'vec3',  // World coordinates
    scale: 'float',    // Scale size
    frame: 'float',    // Current animation frame (0-1)
    isActive: 'float',   // Status: 0=dead, 1=alive (prepared for Spawn system)
})