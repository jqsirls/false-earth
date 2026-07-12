import { float, max, min, select, smoothstep, sub } from 'three/tsl';

function asFloat(value: unknown) {
  return typeof value === 'number' ? float(value) : value;
}

/**
 * GLSL-compatible smoothstep for WebGPU/WGSL.
 * WGSL requires edge0 < edge1; inverted ranges (edge0 > edge1) are emulated.
 */
export function wgslSmoothstep(edge0: unknown, edge1: unknown, x: unknown) {
  const e0 = asFloat(edge0);
  const e1 = asFloat(edge1);
  const lo = min(e0, e1);
  const hi = max(e0, e1);
  const forward = smoothstep(lo, hi, x);
  return select(e0.lessThan(e1), forward, sub(float(1), forward));
}
