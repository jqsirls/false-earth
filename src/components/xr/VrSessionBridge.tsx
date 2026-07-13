import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { useGameStore } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import { VR_SNAP_TURN_DEGREES } from '../../config/vrProfile';
import { input } from '../../core/input/controls';

/**
 * In-session VR locomotion bridge: snap turn (A/D), keyboard parity, flight allowed.
 * Controller thumbstick wiring ships in VR v1; spike uses keyboard + gaze menu stub.
 */
export function VrSessionBridge() {
  const { gl, camera } = useThree();
  const isActive = useVrStore((state) => state.isActive);

  useEffect(() => {
    if (!isActive) return undefined;

    const renderer = gl as unknown as WebGPURenderer;
    const session = renderer.xr?.getSession();
    if (!session) return undefined;

    const onInputs = (event: XRInputSourcesChangeEvent) => {
      for (const source of event.added) {
        source.gamepad;
      }
    };

    session.addEventListener('inputsourceschange', onInputs);
    return () => session.removeEventListener('inputsourceschange', onInputs);
  }, [gl, isActive]);

  useEffect(() => {
    if (!isActive) return undefined;

    const snapRad = (VR_SNAP_TURN_DEGREES * Math.PI) / 180;

    const turnIfReady = (delta: number) => {
      if (!useVrStore.getState().isActive) return;
      if (!useGameStore.getState().isControlEnabled) return;
      camera.rotation.y += delta;
    };

    const unsubLeft = input.subscribe('RotateLeft', () => turnIfReady(snapRad));
    const unsubRight = input.subscribe('RotateRight', () => turnIfReady(-snapRad));

    return () => {
      unsubLeft();
      unsubRight();
    };
  }, [camera, isActive]);

  return null;
}
