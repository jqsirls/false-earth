import { resolveMeadowAsset } from '../../config/meadow';

/**
 * The Void (ORBY) — second playable character, LOCAL ONLY via ?character=void.
 *
 * Mesh part material names (Marmoset / Mixamo export): orby (body), stom
 * (belly orb), Eyes, lens, bwings (wings — separated into four rigid objects
 * bone-parented to Spine2; see tools/3d/blender_mixamo_orby_glb.py).
 */
export const VOID_MESH_PARTS = ['orby', 'stom', 'Eyes', 'lens', 'bwings'] as const;
export type VoidMeshPart = (typeof VOID_MESH_PARTS)[number];

/** Dedicated wing BONE names in VOID_mixamo.glb (children of mixamorig:Spine2). */
export const VOID_WING_NODES = [
  'VOID_wingL_upper',
  'VOID_wingL_lower',
  'VOID_wingR_upper',
  'VOID_wingR_lower',
] as const;

const PART_TEXTURE_DIR: Record<VoidMeshPart, string> = {
  orby: 'body',
  stom: 'stom',
  Eyes: 'eyes',
  lens: 'lens',
  bwings: 'wings',
};

function voidTex(part: VoidMeshPart, file: string): string {
  return resolveMeadowAsset(`/textures/void/${PART_TEXTURE_DIR[part]}/${file}`);
}

export function getVoidPartTexturePaths(part: VoidMeshPart): {
  map: string;
  normalMap: string;
  roughnessMap: string;
  metalnessMap?: string;
  emissiveMap?: string;
  alphaMap?: string;
} {
  const paths: Record<VoidMeshPart, ReturnType<typeof getVoidPartTexturePaths>> = {
    orby: {
      map: voidTex('orby', 'BaseColor.png'),
      normalMap: voidTex('orby', 'Normal.png'),
      roughnessMap: voidTex('orby', 'Roughness.png'),
      metalnessMap: voidTex('orby', 'Metallic.png'),
      emissiveMap: voidTex('orby', 'Emissive.png'),
    },
    stom: {
      map: voidTex('stom', 'BaseColor.png'),
      normalMap: voidTex('stom', 'Normal.png'),
      roughnessMap: voidTex('stom', 'Roughness.png'),
      metalnessMap: voidTex('stom', 'Metallic.png'),
      emissiveMap: voidTex('stom', 'Emissive.png'),
    },
    Eyes: {
      map: voidTex('Eyes', 'BaseColor.png'),
      normalMap: voidTex('Eyes', 'Normal.png'),
      roughnessMap: voidTex('Eyes', 'Roughness.png'),
      emissiveMap: voidTex('Eyes', 'Emissive.png'),
    },
    lens: {
      map: voidTex('lens', 'BaseColor.png'),
      normalMap: voidTex('lens', 'Normal.png'),
      roughnessMap: voidTex('lens', 'Roughness.png'),
    },
    bwings: {
      map: voidTex('bwings', 'BaseColor.png'),
      normalMap: voidTex('bwings', 'Normal.png'),
      roughnessMap: voidTex('bwings', 'Roughness.png'),
      metalnessMap: voidTex('bwings', 'Metallic.png'),
      emissiveMap: voidTex('bwings', 'Emissive.png'),
      alphaMap: voidTex('bwings', 'Opacity.png'),
    },
  };
  return paths[part];
}

export const VOID_MODEL_PATH = resolveMeadowAsset('/models/VOID_mixamo.glb');

/** Animation-only clip GLBs — same skeleton as VOID_mixamo.glb. */
export const VOID_LOCOMOTION_ANIM_PATHS = [
  resolveMeadowAsset('/models/VOID_Idle.glb'),
  resolveMeadowAsset('/models/VOID_Walking.glb'),
  resolveMeadowAsset('/models/VOID_Running.glb'),
  resolveMeadowAsset('/models/VOID_WalkingBack.glb'),
  resolveMeadowAsset('/models/VOID_Flying.glb'),
  resolveMeadowAsset('/models/VOID_ObserveIdle.glb'),
  resolveMeadowAsset('/models/VOID_CuriousIdle.glb'),
] as const;

/** Clip names must match the shared physics/idle-chain contract (config.ts). */
export const VOID_LOCOMOTION_CLIP_NAMES = [
  'Idle',
  'Walk',
  'Run',
  'Back',
  'Flight',
  'IdleOffensive',
  'IdleHappy',
] as const;

export const VOID_MODEL_PATHS = [VOID_MODEL_PATH, ...VOID_LOCOMOTION_ANIM_PATHS] as const;

/**
 * ORBY export is 0.0581 GLB units tall. Booster-matched height was
 * 1.87m / 0.0581 = 32.2; owner then asked for +20% on top of that
 * ("still getting lost in the grass"): 32.2 x 1.2 = 38.6 (~2.24m in-scene).
 */
export const VOID_CHARACTER_SCALE = 38.6;

/**
 * Glow state — glow-on drives the emissive maps with a slow breath pulse
 * (calm, sensory-safe; same 6-cycles/min family as the meadow breathing).
 * The meadow can later drive this (e.g. glow rising near gathered orbs).
 */
export const VOID_GLOW_CONFIG = {
  breathPeriodSeconds: 10,
  onIntensityBase: 1.0,
  onIntensityAmplitude: 0.25,
  offIntensity: 0.0,
  /** Seconds to ease between on/off states. */
  transitionSeconds: 1.2,
} as const;

let voidGlowOn = true;

export function setVoidGlow(on: boolean): void {
  voidGlowOn = on;
}

export function isVoidGlowOn(): boolean {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('glow');
    if (param === 'off') return false;
    if (param === 'on') return true;
  }
  return voidGlowOn;
}

/** Procedural wing motion vocabulary (see useVoidMotion). */
export const VOID_WING_CONFIG = {
  /** At-rest slow breathing flutter. */
  restFrequencyHz: 1.1,
  restAmplitudeRad: 0.05,
  /** Walking/running flutter scales with speed up to this. */
  moveFrequencyHz: 7,
  moveAmplitudeRad: 0.16,
  /** Flying: spread + continuous shimmer. */
  flightFrequencyHz: 10,
  flightAmplitudeRad: 0.2,
  flightSpreadRad: 0.35,
  /** Quick shimmer burst when starting to move. */
  burstDecaySeconds: 0.8,
  burstGain: 0.6,
  /** Upper/lower wing pairs run out of phase for the insect read. */
  lowerWingPhaseRad: Math.PI * 0.6,
} as const;

/** Flight anti-frozen secondary motion (owner spec: gentle; stays under reduced motion). */
export const VOID_FLIGHT_MOTION_CONFIG = {
  bobPeriodSeconds: 4,
  /** Local model units (pre-scale); ~3cm world at VOID_CHARACTER_SCALE. */
  bobAmplitudeLocal: 0.0014,
  /** Max lean into travel, radians (~5°), eased. */
  leanMaxRad: 0.09,
  leanEase: 0.04,
} as const;
