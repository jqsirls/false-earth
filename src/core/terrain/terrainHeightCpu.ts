import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

/** Defaults match `core/shaders/uniforms.ts` + Leva terrain controls. */
export const TERRAIN_AMP = 1.5;
export const TERRAIN_FREQ = 0.05;
export const TERRAIN_SEED = 0.0;

const noise = new ImprovedNoise();

/**
 * CPU FBM approximating TSL `mx_fractal_noise_float` used by `getTerrainHeight`.
 * Keeps WebGL XR grass + ground aligned with the WebGPU TSL terrain.
 */
export function sampleTerrainHeight(
  worldX: number,
  worldZ: number,
  amp = TERRAIN_AMP,
  freq = TERRAIN_FREQ,
  seed = TERRAIN_SEED,
): number {
  const sx = worldX + 0.001;
  const sz = worldZ + 0.001;
  const ox = sx * freq + seed;
  const oz = sz * freq;

  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let octave = 0; octave < 4; octave++) {
    value += noise.noise(ox * frequency, oz * frequency, 0) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return (value / maxValue) * amp;
}
