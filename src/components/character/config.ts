// ============================================================================
// Constants
// ============================================================================

/** Physics, movement, and animation blend config. Tweak here instead of in hooks. */
export const CHARACTER_CONFIG = {
  walkSpeed: 1.0,
  runSpeed: 3.5,
  flightSpeed: 4.0,
  flightHoverLift: 2.5,
  rotateSpeed: 2.5,
  speedLerp: 0.1,
  rotationLerp: 0.15,
  animBlendLerp: 0.15,
} as const;

/**
 * Idle-variety chain (owner spec, rev 2): at rest, Idle holds 6s, then
 * Offensive Idle plays exactly one cycle (LoopOnce + finished event), then
 * Happy Idle loops until the user moves. Any movement exits the chain
 * instantly; returning to rest restarts from Idle + 6s.
 *
 * Crossfades are true mixer fades (linear weight ramps with both actions
 * playing). Offensive Idle's first frame differs a lot from base Idle, so its
 * entry fade is stretched to 1s to read as a natural stance shift; the
 * movement exit keeps the fast locomotion feel so controls stay responsive.
 */
export const IDLE_CHAIN_CONFIG = {
  baseHoldSeconds: 6,
  crossfadeSeconds: {
    toOffensive: 1.0,
    toHappy: 0.8,
    exitToBase: 0.3,
  },
} as const;

export type IdleChainStage = 'base' | 'offensive' | 'happy';

export const IDLE_CHAIN_STAGE_CLIPS: Record<IdleChainStage, string> = {
  base: 'Idle',
  offensive: 'IdleOffensive',
  happy: 'IdleHappy',
} as const;

// Character mesh name constants
export const BODY_MESH_NAMES: readonly string[] = [
  'Astronaut_Suit_Body_Detail_01_Mesh',
  'Astronaut_Suit_Body_Mesh',
  'Astronaut_Suit_Shoes_Mesh',
];


export const BODY_TEXTURE_PATHS = {
  map: 'textures/Body/Astronaut_Suit_Body_Albedo.ktx2',
  metalnessMap: 'textures/Body/Astronaut_Suit_Body_Metallic.ktx2',
  aoMap: 'textures/Body/Astronaut_Suit_Body_Ao.ktx2',
  normalMap: 'textures/Body/Astronaut_Suit_Body_Normals.ktx2',
};

export const DETAIL_TEXTURE_PATHS = {
  map: 'textures/Details/Astronaut_Suit_Details_Albedo.ktx2',
  metalnessMap: 'textures/Details/Astronaut_Suit_Details_Metallic.ktx2',
  aoMap: 'textures/Details/Astronaut_Suit_Details_Ao.ktx2',
  normalMap: 'textures/Details/Astronaut_Suit_Details_Normals.ktx2',
};

export const MODEL_PATHS = [
  '/models/Astronaut.glb',
  '/models/Idle.glb',
  '/models/Walking.glb',
  '/models/Running.glb',
  '/models/WalkingBack.glb',
];

// ============================================================================
// Types
// ============================================================================

export interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
  visible?: boolean;
}

export interface CharacterState {
  currentSpeed: number;
  targetSpeed: number;
  maxSpeed: number;
  rotateSpeed: number;
  speedLerpFactor: number;
  animBlendLerpFactor: number;
  currentIdleWeight: number;
  currentWalkWeight: number;
  isMoving: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}

// src/core/physics/types.ts
export interface PhysicsState {
  speed: number;
  rotationVelocity: number; // Used for FPV smoothing

  // Animation weights
  idleWeight: number;
  walkWeight: number;
  runWeight: number;
  backWeight: number;
  flightWeight: number;

  // Config Parameters
  walkSpeed: number;
  runSpeed: number;
  backSpeed: number;
  flightSpeed: number;
  rotateSpeed: number; // Base rotation speed

  // Smoothing Factors
  speedLerpFactor: number;
  rotationLerpFactor: number;
  animBlendLerpFactor: number;
}

export const INITIAL_PHYSICS_STATE: PhysicsState = {
  speed: 0,
  rotationVelocity: 0,
  idleWeight: 1.0,
  walkWeight: 0.0,
  runWeight: 0.0,
  backWeight: 0.0,
  flightWeight: 0.0,
  walkSpeed: CHARACTER_CONFIG.walkSpeed,
  runSpeed: CHARACTER_CONFIG.runSpeed,
  backSpeed: 0.6,
  flightSpeed: CHARACTER_CONFIG.flightSpeed,
  rotateSpeed: 2.5,
  speedLerpFactor: 0.1,
  rotationLerpFactor: 0.15,
  animBlendLerpFactor: 0.15,
};