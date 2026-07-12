import { useEffect, useState, type CSSProperties } from 'react';
import { useSessionTimerStore } from '../core/store/sessionTimerStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { meadowHudFontFamily } from './meadowUiStyles';

/** Final approach: the readout pulses gently as the session winds down. */
const PULSE_WINDOW_MS = 15_000;

const pulseCss = `
@keyframes meadow-countdown-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

/** `MM:SS` under an hour, `H:MM:SS` above (2H sessions read cleaner than MM going to 120). */
function countdownLabel(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1_000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3_600);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Live `MM:SS` session countdown in the footer-link idiom. Renders nothing
 * when no timer is armed; at zero the soft SessionEnd fade owns the screen.
 * Deliberately isolated: the 1s tick re-renders only this small component,
 * never the footer/hint trees that host it.
 */
export function TimerCountdownText({
  style,
  trailingSeparator = false,
}: {
  style?: CSSProperties;
  /** Footer row usage: render the ` · ` divider only while the countdown shows. */
  trailingSeparator?: boolean;
}) {
  const endsAt = useSessionTimerStore((state) => state.endsAt);
  const reducedMotion = usePrefersReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;
  const remainingMs = endsAt - now;
  if (remainingMs <= 0) return null;

  const pulsing = remainingMs <= PULSE_WINDOW_MS;

  return (
    <>
      {pulsing && !reducedMotion ? <style>{pulseCss}</style> : null}
      <span
        role="timer"
        aria-label="Session time remaining"
        style={{
          fontFamily: meadowHudFontFamily,
          fontSize: '0.65rem',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          fontVariantNumeric: 'tabular-nums',
          ...style,
          // Final 15s: full white with a gentle 1s opacity pulse
          // (static at full brightness under reduced motion).
          ...(pulsing
            ? {
                color: '#ffffff',
                animation: reducedMotion
                  ? 'none'
                  : 'meadow-countdown-pulse 1s ease-in-out infinite',
              }
            : null),
        }}
      >
        {countdownLabel(remainingMs)}
      </span>
      {trailingSeparator ? (
        <span aria-hidden style={{ opacity: 0.45, padding: '0 2px' }}>·</span>
      ) : null}
    </>
  );
}
