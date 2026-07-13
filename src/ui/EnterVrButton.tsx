import { useEffect } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useVrStore } from '../core/store/vrStore';
import { probeImmersiveVrSupport } from '../core/xr/xrSupport';
import { getVrRenderer, startImmersiveVrSession } from '../core/xr/webXrSession';
import { HintKey } from './ControlsHint';
import { meadowHudQuietButtonStyle } from './meadowUiStyles';

/**
 * Flat-screen [ ENTER VR ] — keycap HUD idiom.
 * In-session [ EXIT ] lives on the world locomotion ring (PRD C4 / AC5).
 * Hidden unless spike flag + immersive-vr is supported (PRD AC1).
 */
export function EnterVrButton() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
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
        throw new Error('WebGPU XR renderer not ready');
      }

      await startImmersiveVrSession(renderer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VR session failed';
      setLastError(message);
    } finally {
      setIsEntering(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
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
        <span style={{ fontSize: '0.65rem', opacity: 0.75, maxWidth: '280px', textAlign: 'center' }}>
          {lastError}
        </span>
      ) : null}
    </div>
  );
}
