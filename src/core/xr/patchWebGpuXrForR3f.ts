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
 */
export function patchWebGpuXrForR3f(renderer: WebGPURenderer): void {
  const xr = renderer.xr as XrManagerWithLegacyLoop;
  if (!xr || typeof xr.setAnimationLoop === 'function') return;

  xr.setAnimationLoop = (callback: XrFrameCallback) => {
    if (xr.isPresenting) {
      xr._currentAnimationLoop = callback ?? undefined;
      return;
    }
    void renderer.setAnimationLoop(callback);
  };
}
