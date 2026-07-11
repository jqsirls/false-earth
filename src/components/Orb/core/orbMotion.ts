import {
  ORB_DRIFT_AMP_XZ,
  ORB_DRIFT_AMP_Y,
} from './orbConfig';

/**
 * CPU mirror of the shader drift — MUST stay formula-identical with
 * `createOrbMaterial` in orbMaterial.ts so the collect check touches the orb
 * exactly where the player sees it. Pure sinusoids (no hash noise) so both
 * sides agree to float precision.
 *
 * Velocity budget: amp × (0.7ω + 0.3×0.37ω) ≤ walkSpeed(1.0) × 0.15.
 */
export interface OrbDriftOut {
  x: number;
  y: number;
  z: number;
}

export function orbDrift(
  t: number,
  omega: number,
  phaseX: number,
  phaseZ: number,
  phaseY: number,
  out: OrbDriftOut,
): void {
  const o2 = omega * 0.37;
  out.x =
    ORB_DRIFT_AMP_XZ *
    (0.7 * Math.sin(t * omega + phaseX) +
      0.3 * Math.sin(t * o2 + phaseX * 1.7 + 1.3));
  out.z =
    ORB_DRIFT_AMP_XZ *
    (0.7 * Math.sin(t * omega * 0.83 + phaseZ) +
      0.3 * Math.sin(t * o2 * 0.83 + phaseZ * 1.7 + 1.3));
  out.y = ORB_DRIFT_AMP_Y * Math.sin(t * omega * 0.61 + phaseY);
}

/** Seeded drift angular speed — keeps peak velocity ≲ 0.1 m/s ("firefly, never fly"). */
export function orbOmegaFromRandom(r: number): number {
  return 0.18 + r * 0.16;
}
