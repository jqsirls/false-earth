import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useSessionTimerStore } from '../core/store/sessionTimerStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { meadowHudFontFamily } from './meadowUiStyles';

/** How long the remaining-time readout stays up after a hover/tap. */
const REVEAL_MS = 3_000;
/** Final approach: the glyph brightens slightly as an ambient cue. */
const CLOSING_WINDOW_MS = 90_000;
const REST_OPACITY = 0.35;
const CLOSING_OPACITY = 0.65;

function remainingLabel(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  if (ms < 60_000) return 'UNDER 1 MIN LEFT';
  const totalMin = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0 && minutes > 0) return `${hours}H ${minutes} MIN LEFT`;
  if (hours > 0) return `${hours}H LEFT`;
  return `${minutes} MIN LEFT`;
}

/**
 * On-demand timer peek, NOT a persistent countdown (a ticking clock
 * reintroduces the clock-watching the meadow exists to dissolve). A tiny dim
 * ring sits in the bottom-right corner only while a timer is armed. Hover
 * (desktop) or tap (mobile) reveals the remaining time for a few seconds,
 * then it settles back to the bare glyph. Hidden with the rest of the UI in
 * zen mode (mounted inside the zen wrapper).
 */
export function TimerPeek() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isMobile = useGameStore((state) => state.isMobile);
  const endsAt = useSessionTimerStore((state) => state.endsAt);
  const reducedMotion = usePrefersReducedMotion();

  const [now, setNow] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(false);
  const [label, setLabel] = useState('');
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!isControlEnabled || !endsAt) return null;

  const remainingMs = endsAt - now;
  // At zero the soft SessionEnd fade owns the screen; the peek steps aside.
  if (remainingMs <= 0) return null;

  const isClosing = remainingMs <= CLOSING_WINDOW_MS;

  const reveal = () => {
    setLabel(remainingLabel(endsAt));
    setRevealed(true);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setRevealed(false), REVEAL_MS);
  };

  return (
    <div
      role="status"
      aria-label="Session timer"
      onPointerEnter={reveal}
      onClick={reveal}
      style={{
        position: 'fixed',
        right: isMobile ? 'max(16px, env(safe-area-inset-right))' : '20px',
        // Desktop: above the sound circle canvas; mobile: above the footer row.
        bottom: isMobile ? 'calc(max(12px, env(safe-area-inset-bottom)) + 40px)' : '56px',
        zIndex: 16,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        // A little invisible padding makes the tiny glyph tappable.
        padding: '8px',
        margin: '-8px',
        fontFamily: meadowHudFontFamily,
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        color: '#fff',
        userSelect: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          whiteSpace: 'nowrap',
          opacity: revealed ? 0.85 : 0,
          transition: reducedMotion ? 'none' : 'opacity 400ms ease',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          display: 'block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '1px solid #fff',
          boxSizing: 'border-box',
          opacity: revealed ? 0.85 : isClosing ? CLOSING_OPACITY : REST_OPACITY,
          transition: reducedMotion ? 'none' : 'opacity 500ms ease',
        }}
      />
    </div>
  );
}
