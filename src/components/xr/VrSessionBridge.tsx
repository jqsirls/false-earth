import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import { input } from '../../core/input/controls';
import { useVrControllerInput } from '../../core/input/useVrControllerInput';
import { applyVrSnapTurn } from '../../core/xr/vrLocomotion';

/**
 * In-session VR locomotion: controller thumbsticks + keyboard parity (PRD §2.5).
 */
export function VrSessionBridge() {
  const { camera } = useThree();
  const isActive = useVrStore((state) => state.isActive);

  useVrControllerInput();

  useEffect(() => {
    if (!isActive) return undefined;

    const turnIfReady = (direction: 'left' | 'right') => {
      if (!useVrStore.getState().isActive) return;
      if (!useGameStore.getState().isControlEnabled) return;
      applyVrSnapTurn(camera, direction);
    };

    const unsubLeft = input.subscribe('RotateLeft', () => turnIfReady('left'));
    const unsubRight = input.subscribe('RotateRight', () => turnIfReady('right'));

    return () => {
      unsubLeft();
      unsubRight();
    };
  }, [camera, isActive]);

  return null;
}
