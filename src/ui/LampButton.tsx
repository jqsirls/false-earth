import { useState } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { getProfileStatus } from '../api/meadowAuthApi';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { meadowFocusCss, meadowIconPillStyle } from './meadowUiStyles';

export function LampButton() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const gpuError = useGameStore((state) => state.gpuError);
  const isAuthenticated = useMeadowAuthStore((state) => state.isAuthenticated);
  const openAuthSheet = useMeadowAuthStore((state) => state.openAuthSheet);
  const openHueSheet = useMeadowAuthStore((state) => state.openHueSheet);
  const [isChecking, setIsChecking] = useState(false);

  if (!isControlEnabled || gpuError) return null;

  const handleClick = async () => {
    if (isChecking) return;

    if (!isAuthenticated) {
      openAuthSheet('hue_connect');
      return;
    }

    // Gate Hue on a complete Storytailor profile — route to the in-modal
    // profile step instead of a dead-end inside the Hue sheet.
    setIsChecking(true);
    const statusResult = await getProfileStatus();
    setIsChecking(false);

    if (statusResult.ok && !statusResult.status.complete) {
      openAuthSheet('hue_connect');
      return;
    }

    // Complete profile — or status check failed; the Hue sheet surfaces
    // PROFILE_INCOMPLETE itself as a safety net.
    openHueSheet();
  };

  return (
    <>
      <style>{meadowFocusCss}</style>
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
          className="meadow-focusable"
          aria-label="Booster room lights"
          aria-busy={isChecking}
          onClick={() => void handleClick()}
          style={{
            ...meadowIconPillStyle,
            opacity: isChecking ? 0.6 : 1,
            cursor: isChecking ? 'wait' : 'pointer',
          }}
        >
          <LightbulbOutlinedIcon sx={{ fontSize: 20, color: 'inherit' }} />
        </button>
      </div>
    </>
  );
}
