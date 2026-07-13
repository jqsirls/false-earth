/**
 * Meadow scene grade defaults (owner 2026-07-13).
 * Reversible — tweak here only; wired through tone mapping + post stack.
 */
export const MEADOW_TONE_EXPOSURE = 0.88; // −20% vs 1.1 baseline

/** Contrast restored to neutral (mid-gray mix removed in Effects). */
export const MEADOW_POST_CONTRAST = 1.0;

/** +10% saturation via TSL saturation(). */
export const MEADOW_POST_SATURATION = 1.1;

/** Blacks 5% darker — uniform multiply on RGB. */
export const MEADOW_POST_BLACKS = 0.95;

/** Shadows 10% darker — extra multiply in shadow luminance band. */
export const MEADOW_POST_SHADOWS = 0.9;

/** Sharpness −10% — mix toward mild hashBlur (0 = sharp, 1 = full blur). */
export const MEADOW_POST_SOFTEN = 0.1;

/** Shadow mask: smoothstep from full shadow at 0 luma to none at this luma. */
export const MEADOW_POST_SHADOW_LUMA_MAX = 0.4;

/** Bloom defaults (Leva initial values in useEffectsControls). */
export const MEADOW_BLOOM_THRESHOLD = 0.35;
export const MEADOW_BLOOM_STRENGTH = 0.3;
export const MEADOW_BLOOM_RADIUS = 0.5;
