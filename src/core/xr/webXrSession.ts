import type { WebGPURenderer } from 'three/webgpu';
import { useVrStore } from '../store/vrStore';
import { useGameStore } from '../store/gameStore';

export type VrSessionEndReason = 'user' | 'system' | 'error';

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
    throw new Error('WebGPU renderer has no XR manager');
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
