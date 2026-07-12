import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { gameEvents } from '../core/events';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { meadowHudFontFamily, meadowModalTokens } from './meadowUiStyles';

/** Rest opacity: full white (owner-approved 2026-07-11; supersedes the 28% dim rest). */
const REST_OPACITY = 1;
/** How long the readout holds full brightness after a collect. */
const BRIGHT_MS = 900;
/** Settle back to rest. */
const SETTLE_MS = 700;

const COUNTER_CSS = `
.orb-counter-readout {
  top: calc(max(12px, env(safe-area-inset-top)) + 8px);
  left: calc(max(12px, env(safe-area-inset-left)) + 8px);
  /* Desktop: readable at a glance (owner 2026-07-11 — users couldn't find it). */
  font-size: 1.05rem;
}
/* Narrow screens: the CTA pill spans most of the top strip and the speaker
   pill now anchors the top-left corner below it, so the readout sits beside
   the speaker pill (vertically centered against it). Mobile keeps the
   original quieter size — the HUD strip is denser there. */
@media (max-width: 560px) {
  .orb-counter-readout {
    top: calc(max(20px, env(safe-area-inset-top)) + 66px);
    left: calc(max(20px, env(safe-area-inset-left)) + 60px);
    font-size: 0.7rem;
  }
}
@keyframes orb-counter-glitch {
  0% { opacity: 1; transform: translateX(0); clip-path: inset(0 0 0 0); }
  18% { opacity: 0.65; transform: translateX(1px); clip-path: inset(15% 0 40% 0); }
  32% { opacity: 1; transform: translateX(-1px); clip-path: inset(55% 0 10% 0); }
  48% { opacity: 0.8; transform: translateX(0.5px); clip-path: inset(0 0 65% 0); }
  62% { opacity: 1; transform: translateX(0); clip-path: inset(0 0 0 0); }
  100% { opacity: 1; transform: translateX(0); clip-path: inset(0 0 0 0); }
}
`;

/**
 * Session-only gather readout in the suit-HUD idiom: `ORBS 07`, top-left.
 * Hidden until the first collect, then persistent at full-white rest opacity.
 * Each collect accents it with one soft glitch beat, then it settles.
 * Perfectly static while idle. No milestones, no persistence across visits.
 */
export function OrbCounter() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const reducedMotion = usePrefersReducedMotion();

  const [count, setCount] = useState(0);
  const [bright, setBright] = useState(false);
  const [glitchKey, setGlitchKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onGathered = ({ count: gathered }: { count: number }) => {
      setCount(gathered);
      setBright(true);
      setGlitchKey((k) => k + 1);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setBright(false), BRIGHT_MS);
    };

    gameEvents.on('orb:gathered', onGathered);
    return () => {
      gameEvents.off('orb:gathered', onGathered);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!isControlEnabled || count < 1) return null;

  const label = `ORBS ${String(count).padStart(2, '0')}`;

  return (
    <>
      <style>{COUNTER_CSS}</style>
      <div
        aria-live="polite"
        className="orb-counter-readout"
        style={{
          position: 'fixed',
          zIndex: 12,
          pointerEvents: 'none',
          userSelect: 'none',
          color: meadowModalTokens.accent,
          fontFamily: meadowHudFontFamily,
          // font-size lives in COUNTER_CSS so the mobile media query can win.
          letterSpacing: '0.14em',
          opacity: bright ? 1 : REST_OPACITY,
          transition: reducedMotion
            ? 'none'
            : `opacity ${bright ? 120 : SETTLE_MS}ms ease`,
        }}
      >
        <span
          key={glitchKey}
          style={{
            display: 'inline-block',
            animation:
              !reducedMotion && glitchKey > 0
                ? 'orb-counter-glitch 420ms steps(1, end) 1'
                : 'none',
          }}
        >
          {label}
        </span>
      </div>
    </>
  );
}
