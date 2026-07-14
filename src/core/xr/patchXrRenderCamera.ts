import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';

type RenderArgs = [scene: Scene, camera: Camera, target?: unknown, forceClear?: boolean];

type PatchedRenderer = WebGPURenderer & {
  __meadowXrRenderPatched?: boolean;
};

/**
 * R3F always calls gl.render(scene, state.camera) after useFrame — even in XR.
 * Rendering with the flat PerspectiveCamera after XR pose/bind corrupts the
 * swapchain (black on Vision Pro / Quest). Redirect to xr.getCamera() while presenting.
 */
export function patchXrRenderCamera(renderer: WebGPURenderer): void {
  const patched = renderer as PatchedRenderer;
  if (patched.__meadowXrRenderPatched) return;

  const originalRender = renderer.render.bind(renderer) as (...args: RenderArgs) => void;

  renderer.render = (...args: RenderArgs) => {
    const xr = renderer.xr;
    if (xr?.isPresenting && xr.enabled) {
      return originalRender(args[0], xr.getCamera(), args[2], args[3]);
    }
    return originalRender(...args);
  };

  patched.__meadowXrRenderPatched = true;
}
