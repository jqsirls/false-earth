import { useEffect } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { useHueStatusStore } from '../core/store/hueStatusStore';
import { useHueEntry } from '../core/hooks/useHueEntry';
import { fetchMeadowHueProfile } from '../api/meadowHueApi';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { meadowFocusCss, meadowIconPillStyle } from './meadowUiStyles';

// Warm connected-lamp halo: gentle breathing on the pill border, frozen to a
// static glow under prefers-reduced-motion. Disconnected keeps the plain pill.
const lampGlowCss = `
  .meadow-lamp-connected {
    border-color: rgba(255, 196, 128, 0.55) !important;
    color: rgba(255, 214, 160, 0.95) !important;
    box-shadow: 0 0 12px 2px rgba(255, 180, 100, 0.28);
    animation: meadowLampBreath 5s ease-in-out infinite;
  }
  @keyframes meadowLampBreath {
    0%, 100% { box-shadow: 0 0 10px 1px rgba(255, 180, 100, 0.22); }
    50% { box-shadow: 0 0 16px 4px rgba(255, 180, 100, 0.38); }
  }
  @media (prefers-reduced-motion: reduce) {
    .meadow-lamp-connected {
      animation: none;
      box-shadow: 0 0 12px 2px rgba(255, 180, 100, 0.3);
    }
  }
`;

export function LampButton() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const gpuError = useGameStore((state) => state.gpuError);
  const isAuthenticated = useMeadowAuthStore((state) => state.isAuthenticated);
  const hueConnected = useHueStatusStore((state) => state.connected);
  const setHueConnected = useHueStatusStore((state) => state.setConnected);
  const { isChecking, enterHueFlow } = useHueEntry();

  // One status check when a signed-in visitor reaches the meadow — the Hue
  // sheet keeps the shared state fresh afterwards (connect/disconnect events).
  useEffect(() => {
    if (!isAuthenticated || hueConnected !== null) return;
    let cancelled = false;
    void fetchMeadowHueProfile().then((result) => {
      if (cancelled || !result.ok) return;
      setHueConnected(result.data.connected);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hueConnected, setHueConnected]);

  if (!isControlEnabled || gpuError) return null;

  const isConnected = isAuthenticated && hueConnected === true;

  // Signed out → auth sheet with hue_connect intent; signed in → profile
  // gate → Hue sheet. Shared with the About modal via useHueEntry.
  const handleClick = () => void enterHueFlow();

  return (
    <>
      <style>{`${meadowFocusCss}${lampGlowCss}`}</style>
      <div
        style={{
          position: 'fixed',
          top: 'max(20px, env(safe-area-inset-top))',
          right: 'max(20px, env(safe-area-inset-right))',
          zIndex: 20,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          className={`meadow-focusable${isConnected ? ' meadow-lamp-connected' : ''}`}
          aria-label={isConnected ? 'Booster room lights — connected' : 'Booster room lights'}
          aria-busy={isChecking}
          onClick={handleClick}
          style={{
            ...meadowIconPillStyle,
            opacity: isChecking ? 0.6 : 1,
            cursor: isChecking ? 'wait' : 'pointer',
          }}
        >
          {isConnected ? (
            <LightbulbIcon sx={{ fontSize: 20, color: 'inherit' }} />
          ) : (
            <LightbulbOutlinedIcon sx={{ fontSize: 20, color: 'inherit' }} />
          )}
        </button>
      </div>
    </>
  );
}
