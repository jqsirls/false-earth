/**
 * Meadow lighting baseline — warm key, soft fill, world-locked rim.
 * Ratios are relative to directional key = 1.0.
 */
export const CINEMATIC_LIGHTING = {
  /** Warm-neutral key — moonlight with readable suit highlights */
  keyColor: '#e6e2d8',
  /** Soft key (not harsh drama) */
  keyIntensity: 1.85,
  /** Above-behind-left of spawn (~35° elevation) — lights grass + astronaut together */
  keyPosition: [-18, 22, -16] as const,
  /** IBL fill — restored from cinematic crush (was 0.14) */
  environmentIntensity: 0.3,
  /** Neutral shadow fill — navy/charcoal, not cyan */
  hemisphereSky: '#6a6e78',
  hemisphereGround: '#1a1816',
  hemisphereIntensity: 0.28,
  /** Subtle world-locked character rim */
  rimColor: '#c8b8a4',
  rimIntensity: 0.12,
  rimPosition: [-8, 10, -12] as const,
} as const
