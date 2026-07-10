import { useRef } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { useFocusTrap } from '../core/hooks/useFocusTrap';
import {
  meadowCrtCss,
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudLabelStyle,
  meadowHudQuietButtonStyle,
  meadowOverlayRootStyle,
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
  const panelRef = useRef<HTMLElement>(null);

  useFocusTrap(isOpen, panelRef);

  if (!isOpen) return null;

  const panelStyle: CSSProperties = isMobile
    ? {
        ...meadowSheetPanelBase,
        width: '100%',
        borderRadius: '10px 10px 0 0',
        maxHeight: '82vh',
        padding: '24px 20px max(24px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideUp 220ms ease-out',
      }
    : {
        ...meadowSheetPanelBase,
        width: 'min(360px, calc(100vw - 32px))',
        maxHeight: '72vh',
        padding: '24px',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideIn 220ms ease-out',
      };

  return (
    <div style={meadowOverlayRootStyle(isMobile)}>
      <style>{`
        ${meadowFocusCss}
        ${meadowCrtCss}
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
        style={meadowSheetBackdropStyle}
        onClick={closeHueSheet}
      />

      <section
        ref={panelRef}
        className="meadow-hue-panel meadow-crt-panel meadow-crt-warmup meadow-focusable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meadow-hue-title"
        tabIndex={-1}
        style={panelStyle}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          {!isMobile ? (
            <button
              type="button"
              className="meadow-focusable meadow-crt-keycap"
              onClick={closeHueSheet}
              style={{
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
                fontFamily: 'Cousine, monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              [ ESC ]
            </button>
          ) : (
            <button
              type="button"
              className="meadow-focusable"
              aria-label="Close"
              onClick={closeHueSheet}
              style={{
                minWidth: '44px',
                minHeight: '44px',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
                fontFamily: 'Cousine, monospace',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>

        <h2
          id="meadow-hue-title"
          className="meadow-crt-title"
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
    </div>
  );
}
