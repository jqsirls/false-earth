/**
 * Pure function for 1D Blend Tree logic.
 * Maps speed + rotation intent -> target weights for Idle / Walk / Run.
 */

export interface BlendWeights {
  idle: number;
  walk: number;
  run: number;
}

export function calculateBlendWeights(
  speed: number,
  isRotating: boolean,
  walkSpeed: number,
  runSpeed: number
): BlendWeights {
  const isStationary = Math.abs(speed) < 0.05;

  if (isStationary && isRotating) {
    return { idle: 0.3, walk: 0.7, run: 0 };
  }

  let idle = 0;
  let walk = 0;
  let run = 0;

  if (speed <= walkSpeed) {
    const t = speed / walkSpeed;
    idle = 1 - t;
    walk = t;
  } else {
    const t = (speed - walkSpeed) / (runSpeed - walkSpeed);
    const clampT = Math.min(Math.max(t, 0), 1);
    walk = 1 - clampT;
    run = clampT;
  }

  return { idle, walk, run };
}
