import type { WebGPURenderer } from 'three/webgpu';
import { useVrStore } from '../store/vrStore';
import { useGameStore } from '../store/gameStore';
import { isQuestBrowser } from '../utils/browserCaps';

export type VrSessionEndReason = 'user' | 'system' | 'error';

export const VR_BIND_NOT_READY = 'WebGPU XR renderer not ready';

const QUEST_VR_BIND_BODY =
  'WebGPU XR is not ready in Meta Quest Browser yet. Update to version 146 or newer, then try again. The flat meadow at booster.storytailor.com still works without ?webxr=1.';

/** User-facing VR session errors — never show raw stack traces in the HUD. */
export function formatVrSessionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'VR session failed';
  if (!isQuestBrowser()) return raw;

  if (
    raw === VR_BIND_NOT_READY ||
    raw.includes('WebGPU XR renderer not ready') ||
    raw.includes('WebGPU renderer has no XR manager')
  ) {
    return QUEST_VR_BIND_BODY;
  }
  if (raw.includes('WebXR unavailable')) {
    return 'WebXR is not available in this browser. Update Meta Quest Browser to version 146 or newer, then try again.';
  }
  return raw;
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
