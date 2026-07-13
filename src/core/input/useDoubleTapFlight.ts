import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { getIsMeadowOverlayOpen } from '../hooks/useIsMeadowOverlayOpen';

const DOUBLE_TAP_MS = 320;
const MAX_TAP_MOVE_PX = 28;
const JOYSTICK_EXCLUSION_PX = 140;

function isJoystickZone(x: number, y: number): boolean {
  return x < JOYSTICK_EXCLUSION_PX && y > window.innerHeight - JOYSTICK_EXCLUSION_PX;
}

/** Double-tap / double-click toggles flight when controls are active. */
export function useDoubleTapFlight() {
  const toggleFlight = useGameStore((state) => state.toggleFlight);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isControlEnabled) return;

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (getIsMeadowOverlayOpen()) return;

      const { clientX, clientY } = event;
      if (isJoystickZone(clientX, clientY)) return;

      const now = performance.now();
      const prev = lastTapRef.current;

      if (
        prev &&
        now - prev.time < DOUBLE_TAP_MS &&
        Math.hypot(clientX - prev.x, clientY - prev.y) < MAX_TAP_MOVE_PX
      ) {
        toggleFlight();
        lastTapRef.current = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      lastTapRef.current = { time: now, x: clientX, y: clientY };
    };

    window.addEventListener('pointerup', onPointerUp, { passive: false });
    return () => window.removeEventListener('pointerup', onPointerUp);
  }, [isControlEnabled, toggleFlight]);
}
