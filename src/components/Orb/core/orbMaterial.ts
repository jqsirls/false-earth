import * as THREE from 'three/webgpu';
import {
  abs,
  cameraPosition,
  clamp,
  cos,
  dot,
  float,
  fract,
  instanceIndex,
  mix,
  normalWorld,
  normalGeometry,
  normalize,
  oneMinus,
  positionGeometry,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import { getTerrainHeight } from '../../../core/shaders/terrainHelpers';
import { shouldUseCheapOrbRendering } from '../../../core/utils/browserCaps';
import {
  uTerrainAmp,
  uTerrainFreq,
  uTerrainSeed,
  uTime,
} from '../../../core/shaders/uniforms';
import {
  ORB_DISSOLVE_SECONDS,
  ORB_DRIFT_AMP_XZ,
  ORB_DRIFT_AMP_Y,
  ORB_PULSE_PERIOD_SECONDS,
  ORB_PULSE_RISE_FRACTION,
} from './orbConfig';

export interface OrbGpuState {
  material: THREE.MeshBasicNodeMaterial;
  /** (baseX, hoverY, baseZ, seed) per orb — mutate in place, uploaded per render. */
  baseArray: THREE.Vector4[];
  /** (omega, phaseX, phaseZ, phaseY) per orb — must feed the CPU orbDrift mirror. */
  motionArray: THREE.Vector4[];
  /** (mode 1=active/0=collected, collectTime, sizeScale, unused) per orb. */
  stateArray: THREE.Vector4[];
  /** 1 = full motion, 0 = reduced motion (no drift/spin/scatter, keep slow pulse). */
  uMotionScale: { value: number };
}

/**
 * Sculpted glowing orb (owner's Abstract_Spherical_Shape GLB) — pearlescent
 * rose-to-blue gradient with a bright fresnel halo that feeds the bloom pass.
 * Position is fully shader-computed per instance (instanceMatrix stays
 * identity): seeded slow drift, 6-cycles/min asymmetric breathing pulse
 * (covert ~0.1Hz breath pacer), soft spin, terrain-following hover, and an
 * instant soft "poof" on first touch (airy outward/upward puff, ~0.55s).
 *
 * Drift formulas MUST mirror orbMotion.ts (CPU collect check).
 */
export function createOrbMaterial(orbCount: number): OrbGpuState {
  const baseArray = Array.from({ length: orbCount }, () => new THREE.Vector4());
  const motionArray = Array.from({ length: orbCount }, () => new THREE.Vector4());
  const stateArray = Array.from({ length: orbCount }, () => new THREE.Vector4());

  const uBase = uniformArray(baseArray);
  const uMotion = uniformArray(motionArray);
  const uState = uniformArray(stateArray);
  const uMotionScale = uniform(1);

  // TSL uniform-array elements are untyped (UniformArrayElementNode<unknown>);
  // swizzles exist at runtime — same `any` idiom the Rose uniforms use.
  const base = uBase.element(instanceIndex) as any;
  const motion = uMotion.element(instanceIndex) as any;
  const state = uState.element(instanceIndex) as any;

  const seed = base.w;
  const t = uTime;

  // --- Drift (mirror of orbMotion.orbDrift) ---
  const omega = motion.x;
  const o2 = omega.mul(0.37);
  const driftX: any = sin(t.mul(omega).add(motion.y)).mul(0.7)
    .add(sin(t.mul(o2).add(motion.y.mul(1.7)).add(1.3)).mul(0.3))
    .mul(ORB_DRIFT_AMP_XZ);
  const driftZ: any = sin(t.mul(omega.mul(0.83)).add(motion.z)).mul(0.7)
    .add(sin(t.mul(o2.mul(0.83)).add(motion.z.mul(1.7)).add(1.3)).mul(0.3))
    .mul(ORB_DRIFT_AMP_XZ);
  const driftY: any = sin(t.mul(omega.mul(0.61)).add(motion.w)).mul(ORB_DRIFT_AMP_Y);
  const drift = vec3(driftX, driftY, driftZ).mul(uMotionScale);

  // --- Breathing pulse: 10s period, rise 4s / fall 6s (asymmetric ease) ---
  const pulsePhase = fract(t.div(ORB_PULSE_PERIOD_SECONDS).add(seed));
  const pulse = smoothstep(float(0.0), float(ORB_PULSE_RISE_FRACTION), pulsePhase)
    .mul(oneMinus(smoothstep(float(ORB_PULSE_RISE_FRACTION), float(1.0), pulsePhase)));

  // --- Poof on first touch (mode 0): instant, airy — fast start, soft settle ---
  const collected = oneMinus(state.x);
  const dissolve = clamp(t.sub(state.y).div(ORB_DISSOLVE_SECONDS), 0.0, 1.0).mul(collected);
  const hidden = collected.mul(smoothstep(float(0.985), float(1.0), dissolve));

  // Decelerating ease: bursts immediately on contact, then drifts to rest.
  const inv: any = oneMinus(dissolve);
  const poof = oneMinus(inv.mul(inv));

  const vertexHash = fract(
    sin(dot(positionGeometry, vec3(12.9898, 78.233, 37.719))).mul(43758.5453),
  );
  const scatter = normalGeometry
    .mul(poof)
    .mul(vertexHash.mul(1.1).add(0.35))
    .mul(uMotionScale);
  const rise = poof.mul(0.5).mul(uMotionScale);

  // --- Soft spin ≤ 0.2 rev/s ---
  const spinAngle = t.mul(seed.mul(0.6).add(0.6)).mul(uMotionScale);
  const ca: any = cos(spinAngle);
  const sa: any = sin(spinAngle);
  const spunX: any = positionGeometry.x.mul(ca).sub(positionGeometry.z.mul(sa));
  const spunZ: any = positionGeometry.x.mul(sa).add(positionGeometry.z.mul(ca));
  const spun = vec3(spunX, positionGeometry.y as any, spunZ);

  const scale = state.z
    .mul(pulse.mul(0.12).add(0.9))
    .mul(poof.mul(0.45).add(1.0))
    .mul(oneMinus(hidden));

  const terrainHeightFn = getTerrainHeight(uTerrainAmp, uTerrainFreq, uTerrainSeed);
  const terrainY: any = terrainHeightFn(vec2(base.x.add(drift.x), base.z.add(drift.z)));
  const hoverY: any = terrainY.add(base.y).add(rise);

  const worldPos = vec3(base.x, 0.0, base.z)
    .add(drift)
    .add(vec3(float(0.0) as any, hoverY, float(0.0) as any))
    .add(spun.add(scatter).mul(scale));

  const material = new THREE.MeshBasicNodeMaterial();
  material.positionNode = worldPos;

  // --- Pearlescent rose→blue gradient across the sculpt (reference look) ---
  // Gradient rides the spun local axis so the iridescence turns with the orb.
  const vSpun = varying(spun) as any;
  // Diagonal rose→blue split like the reference render (rose low-left, blue up-right).
  const gradT = clamp(vSpun.x.add(vSpun.y.mul(0.7)).mul(0.6).add(0.5), 0.0, 1.0);
  const rose = vec3(1.0, 0.28, 0.42);
  const blue = vec3(0.22, 0.5, 1.0);
  const bodyColor = mix(rose, blue, gradT);

  const viewDir = normalize(cameraPosition.sub(positionWorld));
  const facing = abs(dot(normalize(normalWorld), viewDir));
  const fresnel = pow(oneMinus(facing), 2.0);
  const energy = pulse.mul(0.45).add(0.55);

  // Rim pushes past 1.0 so the bloom pass wraps a halo around the sculpt.
  // Tinted mostly by the local gradient so the rose/blue duality survives bloom.
  const rimGlow = mix(vec3(0.85, 0.9, 1.0), bodyColor, 0.85)
    .mul(fresnel)
    .mul(energy.mul(1.5).add(1.0));
  material.colorNode = bodyColor
    .mul(energy.mul(0.7).add(0.45))
    .add(rimGlow) as any;

  // Glassy translucency: the facing body stays see-through so the meadow
  // shows through; edges and inner shells (DoubleSide) stay defined.
  const glassAlpha = fresnel.mul(0.62).add(0.2).mul(energy.mul(0.3).add(0.8));
  material.opacityNode = glassAlpha
    .mul(oneMinus(dissolve).mul(oneMinus(dissolve)))
    .mul(select(hidden.greaterThan(0.5), float(0.0), float(1.0))) as any;

  material.transparent = true;
  material.blending = THREE.NormalBlending;
  material.depthWrite = false;
  // DoubleSide translucency shades every fragment twice; on the shared
  // iOS/mobile GPU memory pool FrontSide halves the transparent overdraw
  // while keeping the glassy fresnel look. Desktop keeps the inner shells.
  material.side = shouldUseCheapOrbRendering() ? THREE.FrontSide : THREE.DoubleSide;
  material.fog = false;

  return { material, baseArray, motionArray, stateArray, uMotionScale };
}
