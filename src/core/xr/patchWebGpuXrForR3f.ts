import type { WebGPURenderer } from 'three/webgpu';
import { logVrSession } from './vrSessionDebug';

type XrFrameCallback = ((time: number, frame?: XRFrame) => void) | null;

type XrManagerWithLegacyLoop = WebGPURenderer['xr'] & {
  setAnimationLoop?: (callback: XrFrameCallback) => void;
  _currentAnimationLoop?: XrFrameCallback;
  __meadowR3fPatched?: boolean;
};

/** Latest callback from R3F xr.setAnimationLoop(handleXRFrame). */
let meadowR3fXrLoop: XrFrameCallback = null;

/**
 * three.js r185 common XRManager has no public setAnimationLoop (unlike WebGL
 * WebXRManager). @react-three/fiber wires advance() via xr.setAnimationLoop on
 * sessionstart. Without a shim, _currentAnimationLoop stays the flat rAF loop
 * (no XRFrame arg) and priority-1 Effects skips render → black immersion on VP.
 */
export function patchWebGpuXrForR3f(renderer: WebGPURenderer): void {
  const xr = renderer.xr as XrManagerWithLegacyLoop;
  if (!xr || xr.__meadowR3fPatched) return;

  const assignLoop = (callback: XrFrameCallback) => {
    meadowR3fXrLoop = callback;
    xr._currentAnimationLoop = callback;
  };

  xr.setAnimationLoop = (callback: XrFrameCallback) => {
    assignLoop(callback);
    logVrSession('xr_set_animation_loop', {
      hasCallback: Boolean(callback),
      isPresenting: xr.isPresenting,
    });
    if (!xr.isPresenting && callback) {
      void renderer.setAnimationLoop(callback);
    }
  };

  const rewirePresentingLoop = () => {
    if (!xr.isPresenting || !meadowR3fXrLoop) return;
    xr._currentAnimationLoop = meadowR3fXrLoop;
    logVrSession('xr_rewire_animation_loop', { isPresenting: true });
  };

  xr.addEventListener('sessionstart', rewirePresentingLoop);
  xr.addEventListener('sessionend', () => {
    if (meadowR3fXrLoop && !xr.isPresenting) {
      void renderer.setAnimationLoop(meadowR3fXrLoop);
    }
  });

  xr.__meadowR3fPatched = true;
}

/** Call after xr.setSession() so VP/Quest always run the R3F XR frame callback. */
export function ensureR3fXrAnimationLoop(renderer: WebGPURenderer): void {
  const xr = renderer.xr as XrManagerWithLegacyLoop;
  if (!xr?.isPresenting || !meadowR3fXrLoop) return;
  xr._currentAnimationLoop = meadowR3fXrLoop;
  logVrSession('xr_ensure_animation_loop', { isPresenting: true });
}
