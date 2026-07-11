import { useEffect, useMemo, type CSSProperties } from 'react';
import { useGameStore } from '../core/store/gameStore';
import {
  buildMeadowCtaUrl,
  detectMeadowCtaVariant,
  getMeadowCtaLabel,
} from '../config/meadow';
import {
  clearMeadowAnalyticsTimers,
  scheduleMeadowFiveMinuteEvent,
  trackMeadowCtaClick,
  trackMeadowVisit,
} from '../analytics/meadowAnalytics';
import { meadowHudFontFamily } from './meadowUiStyles';

const ctaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 20px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.22)',
  background: 'rgba(0,0,0,0.45)',
  color: '#fff',
  textDecoration: 'none',
  fontFamily: meadowHudFontFamily,
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  outline: 'none',
};

const ctaFocusStyle = `
  .meadow-cta:focus-visible {
    box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 4px rgba(21,94,239,0.85);
  }
`;

export function MeadowCta() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const gpuError = useGameStore((state) => state.gpuError);
  const isMobile = useGameStore((state) => state.isMobile);

  const variant = useMemo(() => detectMeadowCtaVariant(), []);
  const label = getMeadowCtaLabel(variant);
  const href = buildMeadowCtaUrl(variant);

  useEffect(() => {
    if (!isControlEnabled || gpuError) return;

    trackMeadowVisit();
    scheduleMeadowFiveMinuteEvent();

    return () => {
      clearMeadowAnalyticsTimers();
    };
  }, [isControlEnabled, gpuError]);

  if (!isControlEnabled || gpuError) return null;

  return (
    <>
      <style>{ctaFocusStyle}</style>
      <div
        style={{
          position: 'fixed',
          top: 'max(20px, env(safe-area-inset-top))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          paddingLeft: 'max(12px, env(safe-area-inset-left))',
          paddingRight: 'max(12px, env(safe-area-inset-right))',
          boxSizing: 'border-box',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <a
          className="meadow-cta"
          href={href}
          onClick={() => trackMeadowCtaClick(variant)}
          aria-label={label}
          style={{
            ...ctaStyle,
            // Mobile: quieter than the experience itself — a tad smaller, not tiny.
            ...(isMobile ? { fontSize: '0.7rem', padding: '8px 16px' } : null),
            pointerEvents: 'auto',
            maxWidth: 'min(100%, 340px)',
            textAlign: 'center',
          }}
        >
          {label}
        </a>
      </div>
    </>
  );
}
