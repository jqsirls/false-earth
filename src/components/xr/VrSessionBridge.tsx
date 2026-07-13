import { useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { useGameStore } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import { VR_SNAP_TURN_DEGREES } from '../../config/vrProfile';
import { input } from '../../core/input/controls';

/**
 * In-session VR locomotion: walk-only, snap turn (A/D or stick), no flight.
 * Runs only while an immersive session is active.
 */
export function VrSessionBridge() {
  const { gl, camera } = useThree();
  const isActive = useVrStore((state) => state.isActive);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const setIsFlying = useGameStore((state) => state.setIsFlying);

  useEffect(() => {
    if (!isActive) return;
    setIsFlying(false);
  }, [isActive, setIsFlying]);

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

  useFrame(() => {
    if (!isActive || !isControlEnabled) return;

    const snapRad = (VR_SNAP_TURN_DEGREES * Math.PI) / 180;
    if (input.isPressed('RotateLeft')) {
      camera.rotation.y += snapRad;
    }
    if (input.isPressed('RotateRight')) {
      camera.rotation.y -= snapRad;
    }

    // Flight unreachable in VR v1.
    if (useGameStore.getState().isFlying) {
      setIsFlying(false);
    }
  });

  return null;
}
