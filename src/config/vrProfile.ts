/** WebXR v1 comfort + performance profile (MEADOW_POST_LAUNCH_PRD §2). */

export const VR_SNAP_TURN_DEGREES = 30;

/** Thumbstick deadzone (PRD §2.5.1). */
export const VR_STICK_DEADZONE = 0.15;

/** Right-stick snap turn fires once per flick past this magnitude. */
export const VR_SNAP_STICK_THRESHOLD = 0.65;

/** Brief comfort vignette on snap turn (ms). */
export const VR_SNAP_COMFORT_MS = 220;

/** Vision Pro gaze chip dwell before auto-highlight (pinch still primary). */
export const VR_GAZE_DWELL_MS = 800;

/** Locomotion ring fades to this opacity after idle (PRD §2.5.2). */
export const VR_MENU_IDLE_OPACITY = 0.25;

/** Full opacity while user is interacting with the ring. */
export const VR_MENU_ACTIVE_OPACITY = 0.92;

/** Idle time before locomotion ring fades (ms). */
export const VR_MENU_IDLE_FADE_MS = 8000;

/** Chip confirm pulse duration after select (ms). */
export const VR_MENU_CHIP_PULSE_MS = 200;

/** Spike gate: opt-in via ?webxr=1 until Quest+PCVR v1 ship proof. */
export function isWebXrSpikeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('webxr') === '1' || params.get('webxr') === 'true';
}

/**
 * Quest / PCVR WebXR still routes through three.js WebGL2 — not the WebGPU canvas
 * context. Required for XRManager.setSession (getContextAttributes + projection layers).
 */
export function shouldForceWebGlRendererBackend(): boolean {
  return isWebXrSpikeEnabled();
}

export const VR_GRASS_BLADES_PER_AXIS = 256;
export const VR_ROSE_INSTANCE_COUNT = 250;
export const VR_ORB_GROUND_COUNT = 8;
export const VR_ORB_SKY_COUNT = 2;
export const VR_MAX_DPR = 1;
export const VR_SHADOW_MAP_HIGH = 512;
export const VR_SHADOW_MAP_LOW = 256;
