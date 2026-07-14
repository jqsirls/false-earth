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

/** Meta Quest / Oculus built-in browser. */
export function isQuestBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /OculusBrowser|Oculus|Quest/i.test(ua) || /Meta Quest/i.test(ua);
}

/** visionOS Safari / Apple Vision Pro spatial browser. */
export function isVisionOsBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/VisionOS|Vision Pro|visionOS|AppleVisionPro/i.test(ua)) return true;
  // Spatial Safari reports Macintosh with multi-touch (VP hand tracking).
  if (/Macintosh/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua) && navigator.maxTouchPoints >= 5) {
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  }
  return false;
}

/** Emergency opt-in: force WebGL2 XR on Vision Pro (?webxr=1&webgl-xr=1). */
export function shouldUseWebGlXrFallback(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isWebXrSpikeEnabled() || !isVisionOsBrowser()) return false;
  const raw = new URLSearchParams(window.location.search).get('webgl-xr');
  return raw === '1' || raw === 'true';
}

/**
 * Quest WebXR routes through three.js WebGL2 — not the WebGPU canvas context.
 * Vision Pro defaults to WebGPU + `webgpu` session feature (three r185+); use
 * ?webgl-xr=1 only if WebGPU XR still fails after the visionOS scissor patch.
 * Desktop ?webxr=1 keeps WebGPU so grass compute + roses stay live for emulation.
 */
export function shouldForceWebGlRendererBackend(): boolean {
  if (!isWebXrSpikeEnabled()) return false;
  if (isQuestBrowser()) return true;
  return shouldUseWebGlXrFallback();
}

/** WebGPU compute grass grid for ?webxr=1 preload (desktop emulation). */
export const VR_GRASS_BLADES_PER_AXIS = 256;
/** CPU-instanced grass on Quest WebGL XR path. */
export const VR_WEBGL_GRASS_BLADES_PER_AXIS = 128;
export const VR_ROSE_INSTANCE_COUNT = 250;
export const VR_ORB_GROUND_COUNT = 8;
export const VR_ORB_SKY_COUNT = 2;
export const VR_MAX_DPR = 1;
export const VR_SHADOW_MAP_HIGH = 512;
export const VR_SHADOW_MAP_LOW = 256;
