import type { WebGPURenderer } from 'three/webgpu';
import { logVrSession } from './vrSessionDebug';

type XrFrameCallback = ((time: number, frame?: XRFrame) => void) | null;

type XrManagerWithLegacyLoop = WebGPURenderer['xr'] & {
  setAnimationLoop?: (callback: XrFrameCallback) => void;
  _currentAnimationLoop?: XrFrameCallback;
  __meadowR3fPatched?: boolean;
};

/**
 * three.js r185 WebGPURenderer uses common/XRManager, which no longer exposes
 * xr.setAnimationLoop(). @react-three/fiber still calls it on sessionstart to
 * wire advance() into the XR frame — without this shim VR sessions hear audio
 * but render black because R3F's loop never runs while isPresenting.
 *
 * Mirrors WebGLRenderer.XRManager.setAnimationLoop: assign _currentAnimationLoop
 * so XRManager.onAnimationFrame invokes the R3F callback after pose/target setup.
 */
export function patchWebGpuXrForR3f(renderer: WebGPURenderer): void {
  const xr = renderer.xr as XrManagerWithLegacyLoop;
  if (!xr || xr.__meadowR3fPatched) return;

  const nativeSetAnimationLoop =
    typeof xr.setAnimationLoop === 'function'
      ? xr.setAnimationLoop.bind(xr)
      : null;

  xr.setAnimationLoop = (callback: XrFrameCallback) => {
    xr._currentAnimationLoop = callback ?? null;
    logVrSession('xr_set_animation_loop', {
      hasCallback: Boolean(callback),
      isPresenting: xr.isPresenting,
      hasNative: Boolean(nativeSetAnimationLoop),
    });
    if (nativeSetAnimationLoop) {
      nativeSetAnimationLoop(callback);
      return;
    }
    if (!xr.isPresenting) {
      void renderer.setAnimationLoop(callback);
    }
  };

  const onSessionStart = () => {
    const pending = xr._currentAnimationLoop;
    if (pending && nativeSetAnimationLoop) {
      nativeSetAnimationLoop(pending);
    }
    logVrSession('xr_patch_sessionstart', {
      hasPendingLoop: Boolean(pending),
      isPresenting: xr.isPresenting,
    });
  };

  xr.addEventListener('sessionstart', onSessionStart);

  xr.__meadowR3fPatched = true;
}
