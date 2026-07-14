import type { WebGPURenderer } from 'three/webgpu';
import { isVisionOsBrowser } from '../../config/vrProfile';

/**
 * visionOS Safari WebGPU+WebXR: any explicit GPURenderPassEncoder.setScissorRect
 * (even full-attachment) is misread as an eye sub-region hint and clips to black.
 * WebKit https://bugs.webkit.org/show_bug.cgi?id=315274 — PlayCanvas engine #8756.
 *
 * Skip scissor during immersive WebGPU XR on Vision Pro only; flat WebGPU unchanged.
 */
export function patchVisionOsWebGpuXrScissor(renderer: WebGPURenderer): void {
  if (!isVisionOsBrowser()) return;
  if (typeof GPURenderPassEncoder === 'undefined') return;

  const proto = GPURenderPassEncoder.prototype as GPURenderPassEncoder & {
    __meadowVisionOsXrScissorPatched?: boolean;
  };
  if (proto.__meadowVisionOsXrScissorPatched) return;

  const original = proto.setScissorRect;
  proto.setScissorRect = function setScissorRectVisionOsXrSafe(
    this: GPURenderPassEncoder,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    if (renderer.xr?.isPresenting) return;
    return original.call(this, x, y, width, height);
  };
  proto.__meadowVisionOsXrScissorPatched = true;
}
