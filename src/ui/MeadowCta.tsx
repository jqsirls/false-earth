import { useEffect, useMemo, type CSSProperties } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowCharacterStore } from '../core/store/meadowCharacterStore';
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
import { pauseMeadowBgm } from '../audio/meadowBgmPlayer';
import { mintStoryHandoff } from '../api/meadowAuthApi';
import { MEADOW_TOP_STRIP_HEIGHT_PX, meadowClickableCss, meadowHudFontFamily } from './meadowUiStyles';

const ctaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Same height as the icon pills so the whole top strip shares one optical
  // centerline; the label centers vertically via alignItems.
  height: `${MEADOW_TOP_STRIP_HEIGHT_PX}px`,
  padding: '0 20px',
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
  const isSoundOn = useGameStore((state) => state.isSoundOn);
  const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);

  const activeCharacter = useMeadowCharacterStore((state) => state.activeCharacter);
  const variant = useMemo(() => detectMeadowCtaVariant(), []);
  const label = getMeadowCtaLabel(variant, activeCharacter);
  const href = buildMeadowCtaUrl(variant);

  const handleCtaClick = () => {
    trackMeadowCtaClick(variant);
    // Renew the session handoff cookie so the app tab can adopt the sign-in.
    // Fire-and-forget: navigation must never wait on it.
    void mintStoryHandoff();
    // Storytailor opens in a new tab; quiet the meadow's music here so the two
    // tabs don't compete. The speaker icon flips off — one tap resumes.
    pauseMeadowBgm();
    if (isSoundOn) setIsSoundOn(false);
  };

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
      <style>{`${ctaFocusStyle}${meadowClickableCss}`}</style>
      {/* Anchored to true viewport center — independent of the left counter
          and right lamp widths (left 50% + translateX, not a flex row). */}
      {/* Label is already 100% white; the class adds the standard 400ms ease +
          focus-visible parity without changing the pill's border/glow language. */}
      <a
        className="meadow-cta meadow-clickable"
        href={href}
        target="_blank"
        rel="noopener"
        onClick={handleCtaClick}
        aria-label={label}
        style={{
          ...ctaStyle,
          // Mobile: quieter than the experience itself — a tad smaller, not tiny.
          ...(isMobile ? { fontSize: '0.7rem', padding: '0 16px' } : null),
          position: 'fixed',
          top: 'max(20px, env(safe-area-inset-top))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          pointerEvents: 'auto',
          maxWidth: 'min(calc(100vw - 24px), 340px)',
          boxSizing: 'border-box',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </a>
    </>
  );
}
