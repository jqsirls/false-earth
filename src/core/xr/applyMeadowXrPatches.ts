import type { WebGPURenderer } from 'three/webgpu';
import { patchWebGpuXrForR3f } from './patchWebGpuXrForR3f';
import { patchXrRenderCamera } from './patchXrRenderCamera';
import { patchVisionOsWebGpuXrScissor } from './patchVisionOsWebGpuXrScissor';
import { patchVisionOsWebGlXrScissor } from './patchVisionOsWebGlXrScissor';

/**
 * Apply all Meadow WebXR renderer patches in a fixed order.
 *
 * Only call when `?webxr=1` is enabled — flat meadow must not monkey-patch globals.
 *
 * | Patch | Problem solved |
 * |-------|----------------|
 * | patchWebGpuXrForR3f | r185 XRManager lacks public setAnimationLoop; R3F never receives XRFrame |
 * | patchXrRenderCamera | R3F renders with flat camera while presenting → black swapchain |
 * | patchVisionOsWebGpuXrScissor | WebKit misreads GPURenderPassEncoder.setScissorRect in WebGPU XR |
 * | patchVisionOsWebGlXrScissor | Same scissor bug on visionOS WebGL XR escape hatch |
 *
 * Vision Pro scissor patches are no-ops on Quest/desktop. WebGL scissor patch only runs when
 * forceWebGL backend is active (&webgl-xr=1 on VP).
 */
export function applyMeadowXrPatches(renderer: WebGPURenderer): void {
  patchWebGpuXrForR3f(renderer);
  patchXrRenderCamera(renderer);
  patchVisionOsWebGpuXrScissor(renderer);
  patchVisionOsWebGlXrScissor(renderer);
}

export { ensureR3fXrAnimationLoop } from './patchWebGpuXrForR3f';
