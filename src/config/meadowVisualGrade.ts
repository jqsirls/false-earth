/**
 * Meadow scene grade defaults (owner 2026-07-13).
 * Reversible — tweak here only; wired through tone mapping + post stack.
 */
export const MEADOW_TONE_EXPOSURE = 0.935; // −15% vs 1.1 baseline

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

/** Softer IBL fill — directional key carries the splash rim. */
export const MEADOW_ENV_INTENSITY = 0.42;

/** Whisper film grain (high quality only; off under reduced motion). */
export const MEADOW_FILM_GRAIN_INTENSITY = 0.035;

/** Dedicated bloom feed for soft horizontal flare (high quality only). */
export const MEADOW_FLARE_BLOOM_THRESHOLD = 0.72;
export const MEADOW_FLARE_BLOOM_STRENGTH = 0.18;
export const MEADOW_FLARE_BLOOM_RADIUS = 0.55;
export const MEADOW_FLARE_THRESHOLD = 0.8;
export const MEADOW_FLARE_GHOST_SAMPLES = 2;
export const MEADOW_FLARE_GHOST_SPACING = 0.18;
export const MEADOW_FLARE_GHOST_ATTENUATION = 38;
export const MEADOW_FLARE_ADD_STRENGTH = 0.3;
