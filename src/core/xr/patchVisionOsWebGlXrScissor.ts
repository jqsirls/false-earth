import type { WebGPURenderer } from 'three/webgpu';
import { isVisionOsBrowser } from '../../config/vrProfile';

type GlScissorPatched = WebGLRenderingContext & {
  __meadowVisionOsGlScissorPatched?: boolean;
};

/**
 * visionOS WebGL XR: explicit gl.scissor during immersive sessions can clip to a
 * sub-rectangle (same class of WebKit compositor bug as WebGPU setScissorRect —
 * bugs.webkit.org/show_bug.cgi?id=315274). Skip scissor calls while presenting.
 * Flat WebGL preview is unchanged.
 */
export function patchVisionOsWebGlXrScissor(renderer: WebGPURenderer): void {
  if (!isVisionOsBrowser()) return;

  const gl = renderer.getContext() as GlScissorPatched | null;
  if (!gl || gl.__meadowVisionOsGlScissorPatched) return;

  const originalScissor = gl.scissor.bind(gl);
  gl.scissor = function scissorVisionOsXrSafe(x: number, y: number, width: number, height: number) {
    if (renderer.xr?.isPresenting) return;
    return originalScissor(x, y, width, height);
  };

  gl.__meadowVisionOsGlScissorPatched = true;
}
