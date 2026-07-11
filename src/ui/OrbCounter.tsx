import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { gameEvents } from '../core/events';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { meadowHudFontFamily, meadowModalTokens } from './meadowUiStyles';

/** Quiet delay after a collect before the count fades in. */
const APPEAR_DELAY_MS = 3000;
const FADE_IN_MS = 700;
const HOLD_MS = 3200;
const FADE_OUT_MS = 1400;

/**
 * Session-only gather counter — word-based ("7 gathered"), unnamed orbs.
 * Nothing while idle, nothing until the 2nd collect, no milestones,
 * no persistence, no animation emphasis. Fades in ~3s after a collect,
 * then fully out.
 */
export function OrbCounter() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const reducedMotion = usePrefersReducedMotion();

  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    const onGathered = ({ count: gathered }: { count: number }) => {
      setCount(gathered);
      if (gathered < 2) return;

      clearTimers();
      setVisible(false);
      timersRef.current.push(
        window.setTimeout(() => {
          setVisible(true);
          timersRef.current.push(
            window.setTimeout(() => setVisible(false), FADE_IN_MS + HOLD_MS),
          );
        }, APPEAR_DELAY_MS),
      );
    };

    gameEvents.on('orb:gathered', onGathered);
    return () => {
      gameEvents.off('orb:gathered', onGathered);
      clearTimers();
    };
  }, []);

  if (!isControlEnabled || count < 2) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 44px)',
        transform: 'translateX(-50%)',
        zIndex: 12,
        pointerEvents: 'none',
        userSelect: 'none',
        color: meadowModalTokens.muted,
        fontFamily: meadowHudFontFamily,
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
        opacity: visible ? 1 : 0,
        transition: reducedMotion
          ? 'none'
          : `opacity ${visible ? FADE_IN_MS : FADE_OUT_MS}ms ease`,
      }}
    >
      {count} gathered
    </div>
  );
}
