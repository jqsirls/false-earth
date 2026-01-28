// ============================================================================
// Constants
// ============================================================================

/** Physics, movement, and animation blend config. Tweak here instead of in hooks. */
export const CHARACTER_CONFIG = {
  walkSpeed: 1.0,
  runSpeed: 3.5,
  rotateSpeed: 2.5,
  speedLerp: 0.1,
  rotationLerp: 0.15,
  animBlendLerp: 0.15,
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

// ============================================================================
// Types
// ============================================================================

export interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
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
