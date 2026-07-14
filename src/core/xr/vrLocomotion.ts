import type { Camera } from 'three';
import { useVrStore } from '../store/vrStore';

/** Snap-turn the view by configured degrees (PRD §2.5, comfort vignette optional). */
export function applyVrSnapTurn(camera: Camera, direction: 'left' | 'right'): void {
  const degrees = useVrStore.getState().comfort.snapTurnDegrees;
  const snapRad = (degrees * Math.PI) / 180;
  camera.rotation.y += direction === 'left' ? snapRad : -snapRad;
  useVrStore.getState().pulseSnapComfort();
}
