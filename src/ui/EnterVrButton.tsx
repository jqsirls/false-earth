import { useEffect } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useVrStore } from '../core/store/vrStore';
import { probeImmersiveVrSupport } from '../core/xr/xrSupport';
import {
  formatVrSessionError,
  getVrRenderer,
  startImmersiveVrSession,
  VR_BIND_NOT_READY,
} from '../core/xr/webXrSession';
import { isQuestBrowser } from '../core/utils/browserCaps';
import { HintKey } from './ControlsHint';
import { meadowHudQuietButtonStyle } from './meadowUiStyles';

/**
 * Flat-screen [ ENTER VR ] — bottom-center HUD, above controls hint / joystick.
 * In-session [ EXIT ] lives on the world locomotion ring (PRD C4 / AC5).
 * Hidden unless spike flag + immersive-vr is supported (PRD AC1).
 */
/** Desktop: above ControlsHint row. Mobile: above joystick / ORBS controls band. */
const ENTER_VR_BOTTOM_DESKTOP = 'max(100px, calc(88px + env(safe-area-inset-bottom)))';
const ENTER_VR_BOTTOM_MOBILE = 'max(136px, calc(120px + env(safe-area-inset-bottom)))';

export function EnterVrButton() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isMobile = useGameStore((state) => state.isMobile);
  const gpuError = useGameStore((state) => state.gpuError);
  const isSupported = useVrStore((state) => state.isSupported);
  const isActive = useVrStore((state) => state.isActive);
  const isEntering = useVrStore((state) => state.isEntering);
  const lastError = useVrStore((state) => state.lastError);
  const setIsSupported = useVrStore((state) => state.setIsSupported);
  const setIsEntering = useVrStore((state) => state.setIsEntering);
  const setLastError = useVrStore((state) => state.setLastError);

  useEffect(() => {
    let cancelled = false;
    void probeImmersiveVrSupport().then((supported) => {
      if (!cancelled) setIsSupported(supported);
    });
    return () => {
      cancelled = true;
    };
  }, [setIsSupported]);

  if (!isControlEnabled || gpuError || !isSupported || isActive) return null;

  const onClick = async () => {
    setLastError(null);
    setIsEntering(true);
    try {
      const renderer = getVrRenderer();
      if (!renderer) {
        throw new Error(VR_BIND_NOT_READY);
      }

      await startImmersiveVrSession(renderer);
    } catch (error) {
      setLastError(formatVrSessionError(error));
    } finally {
      setIsEntering(false);
    }
  };

  return (
    <div
      data-meadow-enter-vr
      style={{
        position: 'fixed',
        bottom: isMobile ? ENTER_VR_BOTTOM_MOBILE : ENTER_VR_BOTTOM_DESKTOP,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 16,
        pointerEvents: 'auto',
        fontFamily: 'Cousine, monospace',
        fontSize: '0.75rem',
        color: '#ccc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={isEntering}
        style={{
          ...meadowHudQuietButtonStyle,
          cursor: isEntering ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <HintKey>ENTER VR</HintKey>
      </button>
      {lastError ? (
        <span
          style={{
            fontSize: '0.65rem',
            opacity: 0.75,
            maxWidth: isQuestBrowser() ? '320px' : '280px',
            lineHeight: 1.45,
            textAlign: 'center',
          }}
        >
          {lastError}
        </span>
      ) : null}
    </div>
  );
}
