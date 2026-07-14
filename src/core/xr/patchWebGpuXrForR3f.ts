import type { WebGPURenderer } from 'three/webgpu';

type XrFrameCallback = ((time: number, frame?: XRFrame) => void) | null;

type XrManagerWithLegacyLoop = WebGPURenderer['xr'] & {
  setAnimationLoop?: (callback: XrFrameCallback) => void;
  _currentAnimationLoop?: XrFrameCallback;
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
  if (!xr || typeof xr.setAnimationLoop === 'function') return;

  xr.setAnimationLoop = (callback: XrFrameCallback) => {
    xr._currentAnimationLoop = callback ?? null;
    if (!xr.isPresenting) {
      void renderer.setAnimationLoop(callback);
    }
  };
}
