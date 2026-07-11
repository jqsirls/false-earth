import { useState } from 'react';
import { useMeadowAuthStore } from '../store/meadowAuthStore';
import { getProfileStatus } from '../../api/meadowAuthApi';

/**
 * Single entry point into the lights flow — shared by the lamp pill and the
 * About modal's CONNECT LIGHTS action so the routing never forks:
 * signed out → auth sheet with hue_connect intent; signed in → profile gate
 * → Hue sheet (which surfaces PROFILE_INCOMPLETE itself as a safety net).
 */
export function useHueEntry() {
  const isAuthenticated = useMeadowAuthStore((state) => state.isAuthenticated);
  const openAuthSheet = useMeadowAuthStore((state) => state.openAuthSheet);
  const openHueSheet = useMeadowAuthStore((state) => state.openHueSheet);
  const [isChecking, setIsChecking] = useState(false);

  const enterHueFlow = async (beforeOpen?: () => void) => {
    if (isChecking) return;

    if (!isAuthenticated) {
      beforeOpen?.();
      openAuthSheet('hue_connect');
      return;
    }

    // Gate Hue on a complete Storytailor profile — route to the in-modal
    // profile step instead of a dead-end inside the Hue sheet.
    setIsChecking(true);
    const statusResult = await getProfileStatus();
    setIsChecking(false);

    if (statusResult.ok && !statusResult.status.complete) {
      beforeOpen?.();
      openAuthSheet('hue_connect');
      return;
    }

    beforeOpen?.();
    openHueSheet();
  };

  return { isChecking, enterHueFlow };
}
