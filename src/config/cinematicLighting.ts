/**
 * Cinematic sci-fi lighting ratios (phases 1–4).
 * Values are tuned relative to directional key = 1.0, not absolute engine units.
 */
export const CINEMATIC_LIGHTING = {
  /** Dominant moon/sun — cool-neutral key with slight warmth in highlights */
  keyColor: '#c8d0e0',
  /** Reference key intensity (Three.js linear light units) */
  keyIntensity: 2.4,
  /** Fixed position: behind + left of spawn, elevated for rim readability */
  keyPosition: [-14, 20, -22] as const,
  /** IBL fill relative to key (target 0.08–0.18) */
  environmentIntensity: 0.14,
  /** Weak hemisphere for shadow fill without flattening */
  hemisphereSky: '#3a4458',
  hemisphereGround: '#0e1218',
  hemisphereIntensity: 0.22,
  /** Subtle character rim — world-locked, not camera-follow */
  rimColor: '#9eb4d4',
  rimIntensity: 0.35,
  rimPosition: [-6, 8, -10] as const,
} as const
