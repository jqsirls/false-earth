import type { WebGPURenderer } from 'three/webgpu';
import { useVrStore } from '../store/vrStore';
import { useGameStore } from '../store/gameStore';
import { isQuestBrowser, isVisionOsBrowser, shouldForceWebGlRendererBackend } from '../../config/vrProfile';

export type VrSessionEndReason = 'user' | 'system' | 'error';

export const VR_BIND_NOT_READY = 'WebGPU XR renderer not ready';
export const VR_SESSION_TIMEOUT = 'VR_SESSION_TIMEOUT';

const QUEST_VR_BODY =
  'Update Meta Quest Browser (Settings → About) to version 146 or newer, then try again.';

const VISION_PRO_VR_BODY =
  'WebXR is enabled but VR did not connect. Close other Safari tabs, restart Safari, then try Enter VR again.';

const DESKTOP_VR_GENERIC_BODY =
  'VR could not start in this browser. Refresh once, or try a desktop browser with WebXR enabled.';

const RENDERER_NOT_READY_BODY =
  'The meadow is still loading. Press START first, wait a moment, then try Enter VR again.';

function looksLikeRawJsException(message: string): boolean {
  return (
    /is not a function/i.test(message) ||
    /is not defined/i.test(message) ||
    /cannot read propert/i.test(message) ||
    /unexpected token/i.test(message) ||
    /syntaxerror/i.test(message) ||
    /typeerror/i.test(message) ||
    /referenceerror/i.test(message)
  );
}

function isWebGpuXrBackendError(message: string): boolean {
  return (
    message.includes('getContextAttributes') ||
    message.includes('gitContextAttributes') ||
    message.includes('WebGPU backend') ||
    message.includes('forceWebGL') ||
    message.includes('THREE.XRManager') ||
    message.includes('webgpu" session feature') ||
    message === VR_BIND_NOT_READY ||
    message.includes('WebGPU XR renderer not ready') ||
    message.includes('WebGPU renderer has no XR manager')
  );
}

function isVrTimeoutError(message: string): boolean {
  return (
    message === VR_SESSION_TIMEOUT ||
    /failed to respond/i.test(message) ||
    /timed out/i.test(message) ||
    /timeout/i.test(message)
  );
}

function deviceVrGenericBody(): string {
  if (isQuestBrowser()) return QUEST_VR_BODY;
  if (isVisionOsBrowser()) return VISION_PRO_VR_BODY;
  return DESKTOP_VR_GENERIC_BODY;
}

/** User-facing VR session errors — never show raw stack traces in the HUD. */
export function formatVrSessionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'VR session failed');

  if (raw.includes('WebXR unavailable')) {
    if (isQuestBrowser()) {
      return `WebXR is not available in this browser. ${QUEST_VR_BODY}`;
    }
    if (isVisionOsBrowser()) {
      return `WebXR is not available. ${VISION_PRO_VR_BODY}`;
    }
    return 'WebXR is not available in this browser.';
  }

  if (raw === VR_BIND_NOT_READY || raw.includes('WebGPU XR renderer not ready')) {
    return RENDERER_NOT_READY_BODY;
  }

  if (isVrTimeoutError(raw)) {
    return deviceVrGenericBody();
  }

  if (raw.includes('webgpu" session feature') || raw.includes('WebGPU XR sessions require')) {
    return deviceVrGenericBody();
  }

  if (isWebGpuXrBackendError(raw) || looksLikeRawJsException(raw)) {
    return deviceVrGenericBody();
  }

  return deviceVrGenericBody();
}

let vrRendererRef: WebGPURenderer | null = null;

export function setVrRenderer(renderer: WebGPURenderer | null): void {
  vrRendererRef = renderer;
}

export function getVrRenderer(): WebGPURenderer | null {
  return vrRendererRef;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function requestImmersiveVrSession(): Promise<XRSession> {
  if (!navigator.xr) {
    throw new Error('WebXR unavailable in this browser');
  }

  const timeoutMs = isVisionOsBrowser() ? 45000 : 20000;

  const tryRequest = (init: XRSessionInit) =>
    withTimeout(navigator.xr!.requestSession('immersive-vr', init), timeoutMs, VR_SESSION_TIMEOUT);

  // Vision Pro: WebGPU XR via the `webgpu` session feature (three.js r185+).
  if (isVisionOsBrowser() && !shouldForceWebGlRendererBackend()) {
    try {
      return await tryRequest({ optionalFeatures: ['local-floor', 'webgpu'] });
    } catch (firstError) {
      try {
        return await tryRequest({ optionalFeatures: ['webgpu'] });
      } catch {
        throw firstError;
      }
    }
  }

  // Quest WebGL XR path — do not request the webgpu session feature.
  if (isQuestBrowser() || shouldForceWebGlRendererBackend()) {
    try {
      return await tryRequest({ requiredFeatures: ['local-floor'] });
    } catch {
      return await tryRequest({ optionalFeatures: ['local-floor'] });
    }
  }

  // Desktop PCVR emulation.
  try {
    return await tryRequest({ requiredFeatures: ['local-floor'] });
  } catch {
    return await tryRequest({ optionalFeatures: ['local-floor'] });
  }
}

export async function startImmersiveVrSession(
  renderer: WebGPURenderer,
): Promise<void> {
  if (!navigator.xr) {
    throw new Error('WebXR unavailable in this browser');
  }

  const session = await requestImmersiveVrSession();

  const xr = renderer.xr;
  if (!xr) {
    session.end();
    throw new Error(VR_BIND_NOT_READY);
  }

  // Required for Renderer._updateCamera to swap to the XR rig while presenting.
  xr.enabled = true;

  const game = useGameStore.getState();
  game.setIsFlying(false);
  // Flip before setSession so the first XR frame uses the direct render path.
  useVrStore.getState().setIsActive(true);
  useVrStore.getState().setLastError(null);

  try {
    await xr.setSession(session);
  } catch (error) {
    useVrStore.getState().setIsActive(false);
    session.end().catch(() => undefined);
    throw error;
  }

  const onEnd = () => {
    useVrStore.getState().setIsActive(false);
    session.removeEventListener('end', onEnd);
  };
  session.addEventListener('end', onEnd);
}

export async function endImmersiveVrSession(renderer: WebGPURenderer): Promise<void> {
  const session = renderer.xr?.getSession();
  if (session) {
    await session.end();
  }
  useVrStore.getState().setIsActive(false);
}
