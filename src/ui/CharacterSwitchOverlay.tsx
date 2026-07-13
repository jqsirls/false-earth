import {
  SWITCH_OVERLAY_FADE_IN_MS,
  SWITCH_OVERLAY_HOLD_MS,
  SWITCH_OVERLAY_FADE_OUT_MS,
  useMeadowCharacterStore,
} from '../core/store/meadowCharacterStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { meadowHudFontFamily } from './meadowUiStyles';

const TOTAL_MS =
  SWITCH_OVERLAY_FADE_IN_MS + SWITCH_OVERLAY_HOLD_MS + SWITCH_OVERLAY_FADE_OUT_MS;
const FADE_IN_PCT = (SWITCH_OVERLAY_FADE_IN_MS / TOTAL_MS) * 100;
const FADE_OUT_START_PCT = 100 - (SWITCH_OVERLAY_FADE_OUT_MS / TOTAL_MS) * 100;

const OVERLAY_CSS = `
@keyframes meadowCharSwitchName {
  0% { opacity: 0; }
  ${FADE_IN_PCT.toFixed(2)}% { opacity: 1; }
  ${FADE_OUT_START_PCT.toFixed(2)}% { opacity: 1; }
  100% { opacity: 0; }
}
`;

/**
 * Transient centered incoming-character name during a switch — the same quiet
 * grammar as the mobile [DBL] [TAP] FLY intro (Cousine, mid-screen, purely
 * decorative). The model swap fires under this while it is fully opaque
 * (meadowCharacterStore timing), so there is never a visible hard pop.
 * Mounted OUTSIDE the zen wrapper: a running switch stays covered even if the
 * user hides the chrome mid-overlay.
 */
export function CharacterSwitchOverlay() {
  const overlayName = useMeadowCharacterStore((state) => state.overlayName);
  const reducedMotion = usePrefersReducedMotion();

  if (!overlayName) return null;

  return (
    <>
      <style>{OVERLAY_CSS}</style>
      <div
        aria-hidden
        data-meadow-character-switch-overlay
        style={{
          position: 'fixed',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -50%)',
          zIndex: 40,
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          color: '#fff',
          fontFamily: meadowHudFontFamily,
          fontSize: '1.05rem',
          letterSpacing: '0.24em',
          fontWeight: 500,
          textShadow: '0 0 12px rgba(0, 0, 0, 0.6)',
          ...(reducedMotion
            ? { opacity: 1 }
            : { animation: `meadowCharSwitchName ${TOTAL_MS}ms ease forwards` }),
        }}
      >
        {overlayName}
      </div>
    </>
  );
}
