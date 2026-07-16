import type { WebGPURenderer } from 'three/webgpu';
import { useVrStore } from '../store/vrStore';
import { useGameStore } from '../store/gameStore';
import {
  isQuestBrowser,
  isVisionOsBrowser,
  shouldForceWebGlRendererBackend,
  shouldUseWebGpuXrOnVisionPro,
} from '../../config/vrProfile';
import { logVrSession } from './vrSessionDebug';
import { applyVrSpawnOffset } from './vrSpawnOffset';
import { ensureR3fXrAnimationLoop } from './applyMeadowXrPatches';

export type VrSessionEndReason = 'user' | 'system' | 'error';

export const VR_BIND_NOT_READY = 'WebGPU XR renderer not ready';
export const VR_SESSION_TIMEOUT = 'VR_SESSION_TIMEOUT';
export const VR_SESSION_ENDED_EARLY = 'VR_SESSION_ENDED_EARLY';

const QUEST_VR_BODY =
  'Update Meta Quest Browser (Settings → About) to version 146 or newer, then try again.';

const VISION_PRO_VR_BODY =
  'WebXR started but did not stay connected. Close other Safari tabs, restart Safari, then try Enter VR again.';

const DESKTOP_VR_GENERIC_BODY =
  'VR could not start in this browser. Refresh once, or try a desktop browser with WebXR enabled.';

const RENDERER_NOT_READY_BODY =
  'The meadow is still loading. Press START first, wait a moment, then try Enter VR again.';

const VR_ENDED_UNEXPECTEDLY_BODY =
  'VR stopped before the meadow could render. Try Enter VR again. If it keeps happening, restart Safari and reload this page.';

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

  if (raw === VR_SESSION_ENDED_EARLY) {
    return VR_ENDED_UNEXPECTEDLY_BODY;
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
let sessionStartedAtMs = 0;
let sessionEnteredByUser = false;

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

  logVrSession('request_session_start', {
    quest: isQuestBrowser(),
    visionPro: isVisionOsBrowser(),
    webglBackend: shouldForceWebGlRendererBackend(),
    webgpuXr: shouldUseWebGpuXrOnVisionPro(),
  });

  const tryRequest = (init: XRSessionInit) =>
    withTimeout(navigator.xr!.requestSession('immersive-vr', init), timeoutMs, VR_SESSION_TIMEOUT);

  // visionOS: immersive-ar is unsupported — immersive-vr only (Apple / W3C, 2025+).
  if (isVisionOsBrowser() && shouldUseWebGpuXrOnVisionPro()) {
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

  // Quest / Vision Pro WebGL XR path — do not request the webgpu session feature.
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

function prepareRendererForXr(renderer: WebGPURenderer): void {
  const xr = renderer.xr;
  if (xr) {
    try {
      xr.setReferenceSpaceType('local-floor');
    } catch (error) {
      logVrSession('reference_space_type_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!shouldForceWebGlRendererBackend()) return;
  // MSAA on the WebGL XR layer blacks out visionOS output (PlayCanvas AVP guidance).
  renderer.samples = 0;
}

export async function startImmersiveVrSession(
  renderer: WebGPURenderer,
): Promise<void> {
  if (!navigator.xr) {
    throw new Error('WebXR unavailable in this browser');
  }

  prepareRendererForXr(renderer);

  const session = await requestImmersiveVrSession();
  logVrSession('session_acquired', { mode: session.mode, visibilityState: session.visibilityState });

  const xr = renderer.xr;
  if (!xr) {
    session.end();
    logVrSession('session_aborted', { reason: 'no_xr_manager' });
    throw new Error(VR_BIND_NOT_READY);
  }

  xr.enabled = true;

  const game = useGameStore.getState();
  game.setIsFlying(false);

  sessionEnteredByUser = true;
  sessionStartedAtMs = performance.now();
  useVrStore.getState().setLastError(null);

  try {
    await xr.setSession(session);
    ensureR3fXrAnimationLoop(renderer);
    await applyVrSpawnOffset(renderer, session);
    logVrSession('set_session_ok', {
      isPresenting: xr.isPresenting,
      referenceSpaceType: xr.getReferenceSpaceType?.(),
    });
  } catch (error) {
    session.end().catch(() => undefined);
    sessionEnteredByUser = false;
    logVrSession('set_session_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  useVrStore.getState().setIsActive(true);
  logVrSession('store_active_true');

  const onEnd = () => {
    const elapsedMs = performance.now() - sessionStartedAtMs;
    const endedEarly = sessionEnteredByUser && elapsedMs < 4000;
    logVrSession('session_end', { elapsedMs: Math.round(elapsedMs), endedEarly });
    useVrStore.getState().setIsActive(false);
    if (endedEarly && !useVrStore.getState().lastError) {
      useVrStore.getState().setLastError(formatVrSessionError(new Error(VR_SESSION_ENDED_EARLY)));
    }
    sessionEnteredByUser = false;
    session.removeEventListener('end', onEnd);
  };
  session.addEventListener('end', onEnd);
}

export async function endImmersiveVrSession(renderer: WebGPURenderer): Promise<void> {
  sessionEnteredByUser = false;
  const session = renderer.xr?.getSession();
  if (session) {
    await session.end();
  }
  useVrStore.getState().setIsActive(false);
}
