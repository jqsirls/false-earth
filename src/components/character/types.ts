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

