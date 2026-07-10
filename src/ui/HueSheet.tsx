import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import {
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudLabelStyle,
  meadowHudQuietButtonStyle,
  meadowSheetBackdropStyle,
  meadowSheetPanelBase,
} from './meadowUiStyles';
import type { CSSProperties } from 'react';

const HUE_COMING_SOON = true;

export function HueSheet() {
  const isMobile = useGameStore((state) => state.isMobile);
  const reducedMotion = usePrefersReducedMotion();
  const isOpen = useMeadowAuthStore((state) => state.isHueSheetOpen);
  const closeHueSheet = useMeadowAuthStore((state) => state.closeHueSheet);

  if (!isOpen) return null;

  const panelStyle: CSSProperties = isMobile
    ? {
        ...meadowSheetPanelBase,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: '16px 16px 0 0',
        padding: '24px 20px max(24px, env(safe-area-inset-bottom))',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideUp 220ms ease-out',
      }
    : {
        ...meadowSheetPanelBase,
        top: 'max(20px, env(safe-area-inset-top))',
        right: 'max(20px, env(safe-area-inset-right))',
        width: 'min(360px, calc(100vw - 40px))',
        borderRadius: '12px',
        padding: '22px',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideIn 220ms ease-out',
      };

  return (
    <>
      <style>{`
        ${meadowFocusCss}
        @keyframes meadowHueSlideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes meadowHueSlideIn {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes meadowHueFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .meadow-hue-panel { animation: meadowHueFadeIn 1ms linear !important; }
        }
      `}</style>

      <button
        type="button"
        aria-label="Close lights settings"
        style={{
          ...meadowSheetBackdropStyle,
          border: 'none',
          padding: 0,
          cursor: 'default',
        }}
        onClick={closeHueSheet}
      />

      <section
        className="meadow-hue-panel meadow-focusable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meadow-hue-title"
        style={panelStyle}
      >
        <h2
          id="meadow-hue-title"
          style={{
            margin: '0 0 6px',
            fontSize: '0.85rem',
            fontWeight: 400,
            lineHeight: 1.45,
            letterSpacing: '0.04em',
          }}
        >
          Booster can glow your room along with the sky.
        </h2>

        <p style={{ margin: '0 0 18px', fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em' }}>
          Philips Hue is optional and stays gentle by default.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
            padding: '10px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <span style={meadowHudLabelStyle}>Room lights</span>
          <span style={{ ...meadowHudLabelStyle, color: 'rgba(255,255,255,0.45)' }}>Off</span>
        </div>

        <button
          type="button"
          className="meadow-focusable"
          disabled={HUE_COMING_SOON}
          aria-disabled={HUE_COMING_SOON}
          style={{
            ...meadowHudActionStyle,
            marginBottom: '10px',
            opacity: HUE_COMING_SOON ? 0.55 : 1,
            cursor: HUE_COMING_SOON ? 'not-allowed' : 'pointer',
          }}
        >
          {HUE_COMING_SOON ? '[ COMING SOON ]' : '[ CONNECT HUE ]'}
        </button>

        <button
          type="button"
          className="meadow-focusable"
          onClick={closeHueSheet}
          style={meadowHudQuietButtonStyle}
        >
          Close
        </button>
      </section>
    </>
  );
}
