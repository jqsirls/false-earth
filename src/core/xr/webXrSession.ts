import type { WebGPURenderer } from 'three/webgpu';
import { useVrStore } from '../store/vrStore';
import { useGameStore } from '../store/gameStore';
import { isQuestBrowser, isVisionOsBrowser, shouldForceWebGlRendererBackend } from '../../config/vrProfile';

export type VrSessionEndReason = 'user' | 'system' | 'error';

export const VR_BIND_NOT_READY = 'WebGPU XR renderer not ready';
export const VR_SESSION_TIMEOUT = 'VR_SESSION_TIMEOUT';

const QUEST_VR_BIND_BODY =
  'WebXR on Quest still needs the browser graphics path, not the meadow WebGPU canvas. Update Meta Quest Browser to version 146 or newer, then try again. The flat meadow at booster.storytailor.com still works without ?webxr=1.';

const QUEST_VR_GENERIC_BODY =
  'VR could not start. Update Meta Quest Browser to version 146 or newer, then try again. The flat meadow at booster.storytailor.com still works without ?webxr=1. You can also try Wolvic.';

const VISION_PRO_VR_GENERIC_BODY =
  'VR could not start. In Safari Settings open Feature Flags, enable WebXR, then restart Safari and try Enter VR again.';

const VISION_PRO_VR_TIMEOUT_BODY =
  'VR did not start in time. In Safari Settings open Feature Flags, enable WebXR, restart Safari, then tap Enter VR again.';

const VISION_PRO_VR_WEBGPU_BODY =
  'VR needs WebXR with WebGPU on Vision Pro. In Safari Settings open Feature Flags, enable WebXR and WebGPU, restart Safari, then try again.';

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
  if (isQuestBrowser()) return QUEST_VR_GENERIC_BODY;
  if (isVisionOsBrowser()) return VISION_PRO_VR_GENERIC_BODY;
  return DESKTOP_VR_GENERIC_BODY;
}

/** User-facing VR session errors — never show raw stack traces in the HUD. */
export function formatVrSessionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'VR session failed');

  if (raw.includes('WebXR unavailable')) {
    if (isQuestBrowser()) {
      return 'WebXR is not available in this browser. Update Meta Quest Browser to version 146 or newer, then try again.';
    }
    if (isVisionOsBrowser()) {
      return 'WebXR is not available. In Safari Settings open Feature Flags, enable WebXR, then restart Safari.';
    }
    return 'WebXR is not available in this browser.';
  }

  if (raw === VR_BIND_NOT_READY || raw.includes('WebGPU XR renderer not ready')) {
    return RENDERER_NOT_READY_BODY;
  }

  if (isVrTimeoutError(raw)) {
    if (isVisionOsBrowser()) return VISION_PRO_VR_TIMEOUT_BODY;
    if (isQuestBrowser()) return QUEST_VR_GENERIC_BODY;
    return DESKTOP_VR_GENERIC_BODY;
  }

  if (raw.includes('webgpu" session feature') || raw.includes('WebGPU XR sessions require')) {
    if (isVisionOsBrowser()) return VISION_PRO_VR_WEBGPU_BODY;
    if (isQuestBrowser()) return QUEST_VR_BIND_BODY;
    return DESKTOP_VR_GENERIC_BODY;
  }

  if (isWebGpuXrBackendError(raw) || looksLikeRawJsException(raw)) {
    if (isQuestBrowser()) return QUEST_VR_BIND_BODY;
    if (isVisionOsBrowser()) return VISION_PRO_VR_WEBGPU_BODY;
    return DESKTOP_VR_GENERIC_BODY;
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

  await xr.setSession(session);

  const game = useGameStore.getState();
  game.setIsFlying(false);
  useVrStore.getState().setIsActive(true);
  useVrStore.getState().setLastError(null);

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
