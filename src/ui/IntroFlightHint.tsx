import { useEffect, useState } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { HintKey } from './ControlsHint';

/** Let the splash overlay finish fading before the hint appears in its place. */
const SHOW_DELAY_MS = 1_200;
/** Hold fully visible, then fade. Shows once per page load, never returns. */
const HOLD_MS = 5_000;
const FADE_MS = 1_000;

let hasShownThisLoad = false;

/**
 * MOBILE-ONLY one-time centered intro hint after START (once Booster's camera
 * pan hands over control): `[DBL] [TAP] FLY` — the one non-obvious mechanic.
 * Desktop keeps its persistent bottom control row instead (owner correction,
 * 2026-07-12). Purely decorative: control is live under it, and it never
 * blocks pointer events.
 */
export function IntroFlightHint() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isMobile = useGameStore((state) => state.isMobile);
  const gpuError = useGameStore((state) => state.gpuError);
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<'idle' | 'shown' | 'fading' | 'done'>('idle');

  useEffect(() => {
    if (!isControlEnabled || !isMobile || hasShownThisLoad) return;
    hasShownThisLoad = true;
    const showId = window.setTimeout(() => setPhase('shown'), SHOW_DELAY_MS);
    const holdId = window.setTimeout(() => setPhase('fading'), SHOW_DELAY_MS + HOLD_MS);
    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(holdId);
    };
  }, [isControlEnabled, isMobile]);

  useEffect(() => {
    if (phase !== 'fading') return;
    // Reduced motion: no fade animation — it simply disappears.
    if (reducedMotion) {
      setPhase('done');
      return;
    }
    const fadeId = window.setTimeout(() => setPhase('done'), FADE_MS);
    return () => window.clearTimeout(fadeId);
  }, [phase, reducedMotion]);

  if (gpuError || phase === 'idle' || phase === 'done') return null;

  return (
    <div
      aria-hidden
      data-meadow-intro-hint
      style={{
        position: 'fixed',
        left: '50%',
        top: '45%',
        transform: 'translate(-50%, -50%)',
        zIndex: 18,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        color: '#ccc',
        fontFamily: 'Cousine, monospace',
        fontSize: '0.8rem',
        letterSpacing: '1px',
        fontWeight: 500,
        opacity: phase === 'fading' ? 0 : 1,
        transition: reducedMotion ? 'none' : `opacity ${FADE_MS}ms ease`,
      }}
    >
      <HintKey>DBL</HintKey>
      <HintKey>TAP</HintKey>
      <span>FLY</span>
    </div>
  );
}
