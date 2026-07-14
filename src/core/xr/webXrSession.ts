import type { WebGPURenderer } from 'three/webgpu';
import { useVrStore } from '../store/vrStore';
import { useGameStore } from '../store/gameStore';
import { isQuestBrowser } from '../utils/browserCaps';

export type VrSessionEndReason = 'user' | 'system' | 'error';

export const VR_BIND_NOT_READY = 'WebGPU XR renderer not ready';

const QUEST_VR_BIND_BODY =
  'WebXR on Quest still needs the browser graphics path, not the meadow WebGPU canvas. Update Meta Quest Browser to version 146 or newer, then try again. The flat meadow at booster.storytailor.com still works without ?webxr=1.';

const QUEST_VR_GENERIC_BODY =
  'VR could not start. Update Meta Quest Browser to version 146 or newer, then try again. The flat meadow at booster.storytailor.com still works without ?webxr=1. You can also try Wolvic.';

const DESKTOP_VR_GENERIC_BODY =
  'VR could not start in this browser. Refresh once, or try Chrome with WebXR enabled.';

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
    message === VR_BIND_NOT_READY ||
    message.includes('WebGPU XR renderer not ready') ||
    message.includes('WebGPU renderer has no XR manager')
  );
}

/** User-facing VR session errors — never show raw stack traces in the HUD. */
export function formatVrSessionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'VR session failed');

  if (raw.includes('WebXR unavailable')) {
    return isQuestBrowser()
      ? 'WebXR is not available in this browser. Update Meta Quest Browser to version 146 or newer, then try again.'
      : 'WebXR is not available in this browser.';
  }

  if (isWebGpuXrBackendError(raw) || looksLikeRawJsException(raw)) {
    return isQuestBrowser() ? QUEST_VR_BIND_BODY : DESKTOP_VR_GENERIC_BODY;
  }

  return isQuestBrowser() ? QUEST_VR_GENERIC_BODY : DESKTOP_VR_GENERIC_BODY;
}

let vrRendererRef: WebGPURenderer | null = null;

export function setVrRenderer(renderer: WebGPURenderer | null): void {
  vrRendererRef = renderer;
}

export function getVrRenderer(): WebGPURenderer | null {
  return vrRendererRef;
}

export async function startImmersiveVrSession(
  renderer: WebGPURenderer,
): Promise<void> {
  if (!navigator.xr) {
    throw new Error('WebXR unavailable in this browser');
  }

  const session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
  });

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
